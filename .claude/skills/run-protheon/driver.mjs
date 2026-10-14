#!/usr/bin/env node
// Protheon run driver — start/stop backend + frontend, probe the running app
// through the browser-automation harness. Node >= 20, zero deps.
//
//   node .claude/skills/run-protheon/driver.mjs up
//   node .claude/skills/run-protheon/driver.mjs down
//   node .claude/skills/run-protheon/driver.mjs status
//   node .claude/skills/run-protheon/driver.mjs probe [browser.mjs args...]
//   node .claude/skills/run-protheon/driver.mjs screenshot <path> [--url URL]
//   node .claude/skills/run-protheon/driver.mjs test [--backend|--frontend]
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Skill dir is <root>/.claude/skills/run-protheon — three levels up.
const ROOT = path.resolve(HERE, "..", "..", "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const RUN_DIR = path.join(HERE, ".run");
const BROWSER = path.join(os.homedir(), ".claude", "skills", "browser-automation", "browser.mjs");
const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;
const isWin = process.platform === "win32";

const SERVERS = {
  backend: {
    port: BACKEND_PORT,
    health: `http://localhost:${BACKEND_PORT}/api/health`,
    cwd: BACKEND_DIR,
    cmd: "python",
    args: ["-m", "uvicorn", "app.main:app", "--port", String(BACKEND_PORT)],
    pidFile: path.join(RUN_DIR, "backend.pid"),
    logFile: path.join(RUN_DIR, "backend.log"),
  },
  frontend: {
    port: FRONTEND_PORT,
    health: `http://localhost:${FRONTEND_PORT}/`,
    cwd: ROOT,
    cmd: "npm",
    args: ["run", "dev"],
    pidFile: path.join(RUN_DIR, "frontend.pid"),
    logFile: path.join(RUN_DIR, "frontend.log"),
  },
};

async function portResponds(url, timeoutMs = 3000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    res.body?.cancel(); // release the pooled socket, or undici keeps the loop alive
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

async function waitReady(url, what, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portResponds(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`[driver] ${what} did not become ready within ${timeoutMs / 1000}s — see ${RUN_DIR}`);
  return false;
}

function readPid(pidFile) {
  try {
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function killTree(pid) {
  if (isWin) {
    // The recorded pid is the cmd.exe wrapper — /T kills its whole tree.
    // Tolerate an already-dead pid (taskkill reports an error; nothing to do).
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
  }
}

async function startOne(name) {
  const s = SERVERS[name];
  if (await portResponds(s.health)) {
    console.log(`[driver] ${name}: already responding on :${s.port} — reusing, not owned by this driver`);
    return true;
  }
  mkdirSync(RUN_DIR, { recursive: true });
  // Log capture via shell redirection to a RELATIVE path. Gotchas earned the
  // hard way: (1) fd-inheritance through the cmd.exe wrapper never reaches
  // the npm/uvicorn grandchildren — both logs stayed empty; (2) quoting an
  // absolute log path with spaces ("C:\Users\Santiago Arizpe\...") breaks —
  // nested quotes don't survive Windows command-line parsing and cmd treats
  // the space-truncated redirect target as a syntax error, killing the
  // server instantly. A relative path (`.claude/skills/run-protheon/.run/...`,
  // no spaces in any segment) needs no quotes at all.
  const relLog = path.relative(s.cwd, s.logFile).replaceAll("\\", "/");
  const child = isWin
    ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `${s.cmd} ${s.args.join(" ")} > ${relLog} 2>&1`], {
        cwd: s.cwd,
        detached: true,
        stdio: "ignore",
      })
    : spawn("sh", ["-c", `${s.cmd} ${s.args.join(" ")} > ${relLog} 2>&1`], {
        cwd: s.cwd,
        detached: true,
        stdio: "ignore",
      });
  // Without unref(), the child handle keeps THIS process's event loop alive
  // forever (the server never exits) — the driver would hang after `up`.
  child.unref();
  writeFileSync(s.pidFile, String(child.pid));
  console.log(`[driver] ${name}: spawned pid ${child.pid} (cwd ${s.cwd}) — log: ${s.logFile}`);
  const ok = await waitReady(s.health, name, name === "frontend" ? 120000 : 90000);
  if (!ok) {
    console.error(`[driver] ${name} failed to come up — last log lines:`);
    console.error(readFileSync(s.logFile, "utf8").split("\n").slice(-10).join("\n"));
  }
  return ok;
}

function stopOne(name) {
  const s = SERVERS[name];
  const pid = readPid(s.pidFile);
  if (!pid) {
    console.log(`[driver] ${name}: no pid file — nothing this driver started`);
    return;
  }
  killTree(pid);
  rmSync(s.pidFile);
  console.log(`[driver] ${name}: killed pid ${pid}`);
}

async function cmdUp() {
  await startOne("backend");
  await startOne("frontend");
  await cmdStatus();
}

function cmdDown() {
  stopOne("frontend");
  stopOne("backend");
}

async function cmdStatus() {
  for (const [name, s] of Object.entries(SERVERS)) {
    const pid = readPid(s.pidFile);
    const up = await portResponds(s.health);
    let extra = "";
    if (up && name === "backend") {
      try {
        const j = await (await fetch(s.health)).json(); // json() consumes the body — no cancel needed
        extra = ` status=${j.status} version=${j.version}`;
      } catch {}
    }
    console.log(
      `[driver] ${name}: :${s.port} ${up ? "UP" : "down"}${extra}${pid ? ` (driver-owned pid ${pid})` : ""}`
    );
  }
}

function browserArgs(argv) {
  if (!existsSync(BROWSER)) {
    console.error(`[driver] browser-automation skill not found at ${BROWSER}`);
    console.error("[driver] install it first (user-level skill: browser.mjs + SKILL.md).");
    process.exit(1);
  }
  return [BROWSER, ...argv];
}

function cmdProbe(argv) {
  // Default: probe the workspace shell. Extra args go straight to browser.mjs.
  let args = [...argv];
  let url = "http://localhost:3000/workspace";
  const urlIdx = args.findIndex((a, i) => i > 0 && !a.startsWith("-"));
  if (urlIdx !== -1) {
    url = args.splice(urlIdx, 1)[0];
  }
  const hasWait = args.some((a) => a === "--wait");
  if (!hasWait) args.push("--wait", '[role="tablist"]');
  const r = spawnSync("node", browserArgs([url, ...args]), { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

function cmdScreenshot(argv) {
  const outIdx = argv.findIndex((a) => !a.startsWith("-"));
  if (outIdx === -1) {
    console.error("[driver] usage: driver.mjs screenshot <output.png> [--url URL]");
    process.exit(1);
  }
  const out = argv.splice(outIdx, 1)[0];
  const hasUrl = argv.some((a) => a === "--url");
  const url = hasUrl ? null : "http://localhost:3000/workspace";
  const extra = hasUrl ? [] : ["--wait", '[role="tablist"]'];
  const r = spawnSync("node", browserArgs([...(url ? [url] : []), ...argv, ...extra, "--screenshot", out]), {
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

function cmdTest(argv) {
  const onlyBackend = argv.includes("--backend");
  const onlyFrontend = argv.includes("--frontend");
  let failed = false;
  if (!onlyBackend) {
    const tsc = spawnSync("npx", ["tsc", "--noEmit"], { cwd: ROOT, stdio: "inherit" });
    console.log(`[driver] frontend typecheck (npx tsc --noEmit): ${tsc.status === 0 ? "PASS" : "FAIL"}`);
    if (tsc.status !== 0) failed = true;
    // `npm run lint` is BROKEN in this repo (no eslint config file, exit 2) — see SKILL.md.
  }
  if (!onlyFrontend) {
    const pytest = spawnSync("python", ["-m", "pytest", "tests/", "-q"], { cwd: BACKEND_DIR, stdio: "inherit" });
    console.log(`[driver] backend pytest: ${pytest.status === 0 ? "PASS" : "FAIL"}`);
    if (pytest.status !== 0) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

const [cmd, ...argv] = process.argv.slice(2);
const commands = { up: cmdUp, down: cmdDown, status: cmdStatus, probe: cmdProbe, screenshot: cmdScreenshot, test: cmdTest };
if (!commands[cmd]) {
  console.error(`[driver] usage: driver.mjs <${Object.keys(commands).join("|")}> [args...]`);
  process.exit(1);
}
commands[cmd](argv);
