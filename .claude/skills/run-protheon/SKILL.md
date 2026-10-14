---
name: run-protheon
description: Run, start, build, test, or screenshot the Protheon bioinformatics workspace (landing_workspace repo) — Next.js frontend on :3000 plus FastAPI backend on :8000, driven headlessly via the browser-automation harness. Use when asked to run the app, check a page renders, verify a UI change, or QA the workspace.
---

# run-protheon

Protheon is a two-process app: a Next.js 16 App Router frontend (repo root,
dev server on `:3000`, unified IDE at `/workspace`) and a FastAPI backend
(`backend/`, `:8000`, serves `/api/*`). The frontend loads without the
backend, but every tool panel then fails its API calls — run both.

**All paths below are relative to the repo root** (`landing_workspace`).
The driver is `.claude/skills/run-protheon/driver.mjs` (Node ≥ 20, no deps).
Browser interaction goes through the user-level `browser-automation` skill
(`~/.claude/skills/browser-automation/browser.mjs` — patchright/Playwright
API, `--snapshot` refs, `--script` files, `--screenshot`).

## Prerequisites

- Node ≥ 20 (`node --version` — verified on v24.14.0) and npm.
- Python 3.11+ with backend deps installed (verified: fastapi 0.142.2, uvicorn 0.54.0, pydantic 2.13.5):
  `pip install -r backend/requirements.txt` (+ `backend/requirements-dev.txt` for pytest).
- The `browser-automation` user skill installed (`~/.claude/skills/browser-automation/browser.mjs`).

## Run (agent path) — the driver

```bash
node .claude/skills/run-protheon/driver.mjs up        # start backend then frontend, wait for readiness
node .claude/skills/run-protheon/driver.mjs status    # ports, health, who owns the pids
node .claude/skills/run-protheon/driver.mjs probe     # headless load of /workspace + console/request report
node .claude/skills/run-protheon/driver.mjs probe --script .claude/qa-ide.mjs   # full IDE flow (tabs/hash/keep-alive)
node .claude/skills/run-protheon/driver.mjs screenshot .claude/skills-artifacts/workspace-dna.png --url "http://localhost:3000/workspace#dna"
node .claude/skills/run-protheon/driver.mjs test      # npx tsc --noEmit + backend pytest
node .claude/skills/run-protheon/driver.mjs down      # kill what this driver started (reuses foreign servers)
```

- `up` reuses servers already answering on :3000/:8000 (it never double-spawns);
  it only kills what it recorded in `.claude/skills/run-protheon/.run/*.pid`
  (gitignored). Logs land in that same `.run/` dir when the driver spawns.
- `probe` accepts any `browser.mjs` flag (`--snapshot`, `--eval`, `--wait`,
  `--screenshot`, …); its default URL is `http://localhost:3000/workspace`
  with `--wait '[role="tablist"]'`. It prints console errors and failed
  requests automatically — **zero of each is the bar for "it works".**
- `screenshot` writes PNGs into `.claude/skills-artifacts/` by convention.

The driver is the primary path. The raw harness, for anything custom:

```bash
node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/workspace --script .claude/qa-ide.mjs
```

## Run (human path)

`start-all.bat` (or `start-all.sh`) launches backend + frontend in visible
windows — for the human, useless headless. **The .bat files must stay CRLF**
(after any edit: `sed -i 's/\r$//' *.bat && sed -i 's/$/\r/' *.bat`).

## Build & deploy path

```bash
npm run build        # static export → out/ (13 routes, exit 0 verified)
npx tsc --noEmit     # typecheck passes
```

`next build` rewrites `tsconfig.json`/`next-env.d.ts` — expected, don't revert.
Deploy is `wrangler pages deploy out` (documented, not re-verified here).

## Test

```bash
node .claude/skills/run-protheon/driver.mjs test                 # both
node .claude/skills/run-protheon/driver.mjs test --backend       # 248 passed (backend/)
node .claude/skills/run-protheon/driver.mjs test --frontend      # tsc only
```

`npm run lint` is **broken** — exit 2, "ESLint couldn't find an
eslint.config.(js|mjs|cjs) file"; the repo has eslint@9 + eslint-config-next@14
but no config file at all. Pre-existing; don't "fix" it as part of unrelated work.

## Gotchas

- **Read can't display images in DeepSeek sessions** ("[Unsupported Image]") —
  you cannot eyeball screenshots. Verify with `--eval` text probes
  (title/h1/`innerText`/svg counts) and the console-error report instead;
  screenshots are for the user and vision-capable sessions.
- **Backend down = 8 console errors** (`ERR_CONNECTION_REFUSED` to
  `localhost:8000/api/...`) and broken tool panels. The IDE shell still
  renders. Check `driver status` before concluding a frontend change is broken.
- `innerText` returns CSS-uppercased text ("DATAFRAMES" not "Dataframes") —
  match case-insensitively in QA scripts.
- The DNA tab auto-loads pBR322 only after the persistence store hydrates
  (static-export hydration rule: never read localStorage in a `useState`
  initializer). Give `/workspace#dna` a moment before asserting seqviz SVGs.
- Tab switches in the IDE use pushState (no `hashchange` event) — QA scripts
  that click a rail item must also wait for the tab panel, and hash-routed
  asserts belong in `--eval` on `location.hash`.
- Don't kill servers that `driver up` reused: `down` only touches its own pids.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ERR_CONNECTION_REFUSED http://localhost:8000/...` in browser report | backend not running → `driver up` |
| `[driver] ... did not become ready ... see .run` | read `.claude/skills/run-protheon/.run/<name>.log` — last 10 lines are printed |
| `driver.mjs` kills the wrong process | `up` printed "reusing, not owned by this driver" — stop that server yourself |
| Screenshot "looks" wrong | you can't look — re-probe with `--eval` and assert DOM state |
| Fresh clone: `npm run dev` shows weird Tailwind | ensure `node_modules` installed (`npm install`); Tailwind v4 needs `@import "tailwindcss"` in `app/globals.css` (already present) |

## Verification record (2026-10-13, this machine)

`driver up` → both servers healthy → `probe --script .claude/qa-ide.mjs`:
DNA tab mounts (47 svgs, seqviz), flows mounts (5 nodes), keep-alive + hash
routing pass, **0 console errors / 0 failed requests**. `pytest`: 248 passed.
`tsc --noEmit`: pass. `npm run build`: 13 routes, exit 0. `npm run lint`: broken (above).
