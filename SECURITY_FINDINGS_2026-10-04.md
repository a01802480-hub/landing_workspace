# Security findings & fixes — 2026-10-04

Full-repo credential sweep + dependency install fix. Severity-ordered.

## 🔴 CRITICAL — hardcoded API key in `claude.ps1` (tracked + in git history)

`claude.ps1` contained a live DeepSeek API key:

```powershell
$env:ANTHROPIC_AUTH_TOKEN="sk-7612…"   # 32-char key, committed to git
```

Anyone with repository access (GitHub repo is public/team-visible) gets a
working key; it also lives in every past commit.

**Fixed:**
- `claude.ps1` now loads the key from `$env:DEEPSEEK_API_KEY` or a local
  `deepseek.token` file (both gitignored) and exits with a clear error
  otherwise. No key material in the tracked tree.
- The existing key was moved to `deepseek.token` so the launcher keeps
  working locally.

**Still required — rotate the key.** It remains in git history. Generate a
new key in the DeepSeek console, replace the contents of `deepseek.token`,
and treat the old key as revoked.

## 🟠 HIGH — no `.gitignore` existed

The repo root had no `.gitignore`. Consequences:

- `backend/.env` (the file `config.py` documents as holding **every**
  upstream key: UniProt/Ensembl/Entrez, Nextflow Tower token, Anthropic,
  Pinecone) would have been committed the moment it was created.
- Session files were tracked: `backend/cookies.txt` (a Netscape cookie jar
  containing a session CSRF cookie), scrape payloads `cmp*.json`,
  `var.json`, `rcsb.json`, plus 38 `__pycache__/*.pyc` files.

**Fixed:** `.gitignore` created (`node_modules`, `.next`, `out`, `.env*`
with `!.env.example`, the data files, `__pycache__`, OS noise); the six
data files and all pycache entries were `git rm --cached` (kept on disk).
No `.env` exists on disk yet — nothing was leaked, but the exposure window
was open.

## 🟡 MEDIUM — `protv3-main/Biobackend` auth prototype is not deployable

`apis/auth/auth_router.py` falls back to a **public default JWT secret**
when no env var is set:

```python
_DEFAULT_SECRET = "your-secret-key-change-in-production"
SECRET_KEY = _SECRET_ENV if _SECRET_ENV else _DEFAULT_SECRET
```

Any deployment that forgets the env var signs tokens with a key everyone
knows. `main.py` also compares passwords in plaintext ("Hash in
production!") and `test_auth.py` prints tokens. This prototype is not the
current backend (the FastAPI app under `backend/` has the right posture —
see below) — but **do not deploy protv3-main as-is**; make the secret
required (fail boot when unset) and hash passwords first.

## 🟢 LOW — demo credentials in docs/tests

`securepass123`, `1234567`, `"password": "securepass123"` appear in the
auth guides and `test_auth.py`. Placeholder/demo values only — harmless in
a repo, but scrub them before any doc ships to external users.

## 🟢 LOW — broad Claude Code auto-allow rules

`.claude/settings.local.json` auto-approves `Bash(cmd *)` and
`Bash(cmd.exe *)` — any cmd.exe command runs without a prompt in this
workspace. Recommend tightening these two entries to the specific commands
you actually use.

## ✅ Verified-good posture (current backend)

`backend/` (the live app) does this right: secrets injected from
`.env` only (`config.py`), `/api/health` reports booleans never key
material, CSRF double-submit cookie (`protheon_csrf` + `X-CSRF-Token`),
per-IP rate limiting, strict CSP, fail-closed 422 that never echoes input,
Zod schema gates on every client payload. The only public env var in the
frontend is `NEXT_PUBLIC_API_BASE_URL` (a URL, not a secret) — correct use.

## Dependency fix (the ERESOLVE) — resolved state

| Package | Was | Now | Why |
|---|---|---|---|
| `next` | `^16.0.0` | `^16.3.8` | initial ERESOLVE was `@cloudflare/next-on-pages` capping next at `<=15.5.2`; that adapter is deprecated and unnecessary (static export serves `out/` directly) → removed, so next could return to the 16 line |
| `eslint-config-next` | `^16.0.0` | `^16.3.8` | must match next |
| `@teselagen/bio-parsers` | `^10.0.0` | `^0.4.38` | major 10 does not exist (ETARGET); verified exports: `anyToJson` (not `parseFile`) |
| `seqviz` | `^0.9.0` | `^3.10.0` | latest is 3.10.25; peers accept React 19; verified `SeqViz` named export |
| `wrangler` | `^3.114.0` | `^4.147.0` | audit fix for `@fastify/busboy` DoS (high) |
| `@cloudflare/next-on-pages` | devDep | removed | deprecated + the peer cap that caused ERESOLVE; `pages:build` is now plain `next build` |

**CVE-2025-66478 ("React2Shell", CVSS 10.0 RCE in the RSC protocol)**: the
interim pin 15.5.2 was itself vulnerable — final state is `next@16.3.8`,
which includes the fix. Static export means no server-side RSC surface is
deployed, but the version is patched regardless.

**Security overrides** (patch-safe): `jsondiffpatch ^0.7.6` (prototype
pollution fix inside @teselagen/bio-parsers), `nanoid ^3.3.18` (shortid
chain), `braces ^3.0.3`, `fast-glob ^3.3.3` (eslint chain).

**Accepted residuals** (documented, not fixed):
- 5 "high" audit entries in the **ESLint dev-tooling chain**
  (fast-glob/micromatch/braces) — dev-machine-only, npm's suggested "fix"
  is a nonsensical downgrade to eslint-config-next 14.2.35.
- 2 "moderate" in `@teselagen/bio-parsers` → `fast-xml-parser <5.7.0`
  (XML-builder injection; no upstream fix; the parser only processes the
  researcher's own files locally).

`npx tsc --noEmit` passes with **0 errors**; `npm run build` verified.
