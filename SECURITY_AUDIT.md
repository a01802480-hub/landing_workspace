# Protheon — Security Audit & Vulnerability Mitigation

**Scope:** the full Protheon stack — `frontend/` (Next.js 16 + React 19 + R3F + GSAP +
Zod + custom SVG/canvas charts) and `backend/` (FastAPI + httpx) — as committed in this
repository.
**Date of audit:** 2026-09-30. **Auditor note:** this is a code-review + automated-test
audit performed during development, not an external penetration test. Every claim below is
backed by either a regression test in `backend/tests/`, a live probe against the running
service, or a static construction argument; where a control is a recommendation rather than
implemented code, it is explicitly marked.

---

## 1. Threat model

| # | Asset | Threat | Vector | Mitigation | Status |
|---|-------|--------|--------|------------|--------|
| T1 | API keys (Ensembl, Anthropic, Pinecone) | Leakage to the client | Accidental `NEXT_PUBLIC_*` prefix, env file committed, `/api/health` echoing config | Server-only `pydantic-settings`; `/api/health` returns booleans only; `.gitignore` blocks `.env*`; docs enumerate placement | Implemented + tested (`test_health_is_public_and_sets_cookie`) |
| T2 | Sequence/alignment views | XSS | Hostile FASTA/PDB content rendered as HTML | React escapes all text; zero `dangerouslySetInnerHTML`; CSP; backend never echoes raw input | Implemented + tested |
| T3 | State-changing endpoints | CSRF | Cross-site form POST / fetch without token | Double-submit cookie (`SameSite=Lax`, constant-time compare) + `X-CSRF-Token` header on every non-safe method; CORS origin allowlist | Implemented + tested |
| T4 | FASTA / PDB ingestion | Injection (HTML, SQL-ish, control chars, DoS) | Malformed or oversized uploads | Whitelist parsers, size caps, bounded numeric parsing, fail-closed 422s with safe messages | Implemented + tested |
| T5 | Upstream URLs | SSRF / path traversal | Identifier abuse (`../../`, `;rm`, encoded junk) | Strict regex on every path/query identifier **before** URL construction; upstream base URLs are server config, never client input | Implemented + tested |
| T6 | API availability | DoS | Request floods, oversized bodies | Per-IP sliding-window rate limit (429), 5 MB body cap (413), 25 MB PDB cap, 2 MB FASTA cap, parse-time atom caps | Implemented + tested |
| T7 | Clickjacking / MIME confusion / referrer leak | Header hardening | Frames, sniffing, referrer metadata | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, CSP on both tiers | Implemented |
| T8 | **AlphaFold PAE matrices** | **Memory DoS / malformed data** | A huge or hostile upstream matrix file (or a compromised upstream response) exhausting memory or poisoning the UI | Byte cap *before* JSON parsing; strict shape validation (square, finite, bounded); mean-pooling before it reaches the client; nothing proxied raw | Implemented + tested (`tests/test_alphafold.py`) |
| T9 | **Client render pipeline** | **Undefined-property crashes** | A payload that drifts from the expected shape (upstream schema change, partial response) crashing a panel | Zod validation of every API payload before render; React Error Boundaries around every major panel; designed fallbacks + skeletons | Implemented (build is type-strict; browser QA shows zero console errors) |
| T10 | **localStorage** | **Tampered workspace state** | User-modified or stale persisted values breaking the workspace on load | Persisted values re-validated on hydration (Zod schemas); guarded reads/writes; only non-sensitive state stored | Implemented |
| T11 | **GenBank / NCBI Entrez records** | **Injection, malformed or hostile flat files** | A crafted efetch response (or a user-supplied record) with hostile features, length lies, or junk sequences | Accession grammar validated before any upstream URL; strict flat-file parser (byte + length caps, base whitelist, declared-vs-found length check, span-only feature locations); upstream errors never echoed; Entrez API key stays server-side | Implemented + tested (`tests/test_dna.py`) |
| T12 | **MSA job queue (Clustal Omega)** | **Job-table abuse / upstream poisoning** | Submitting many jobs, hostile ids/sequences, malformed upstream Clustal text | Sequence ids/residues pattern-validated before any URL; job table capped (FIFO eviction); one upstream status call per GET; strict Clustal parser (equal widths, whitelisted ids); raw upstream errors never echoed | Implemented + tested (`tests/test_msa.py`, 34 tests) |
| T13 | **Docking / solvent biophysics** | **Malformed scoring inputs, hostile PDB reuse** | Bad PDB ids, unknown ligands, crafted PDB files through the scorer | PDB id/ligand/solvent enums validated (422); the scorer's own strict atom reader (fixed-column, finite-checked, capped); empirical models documented as research-preview | Implemented + tested (`tests/test_biophysics.py`, 57 tests) |
| T14 | **Raw-PDB passthrough** | **Third-party parser exposure** | Serving unparsed upstream text to the 3Dmol client | Path patterns on both endpoints; upstream text served as `text/plain` (never inline/HTML — no sniffing); fetched server-side with timeouts + 24 h cache; the browser CSP blocks any inline execution path | Implemented + tested (`tests/test_structure_file.py`, 26 tests) |

---

## 2. API key leakage (T1)

**Rule: a secret exists in exactly one place — `backend/.env` — and never crosses the
network boundary.**

- All credentials are loaded by `backend/app/config.py` via `pydantic-settings`
  (`ANTHROPIC_API_KEY`, `PINECONE_API_KEY`, `ENSEMBL_API_KEY`, …). Nothing in that module
  is serialized into any response.
- `GET /api/health` exposes only `configured_services` — a dict of booleans
  ("is an LLM configured?") that leaks no key material. Regression test asserts the
  response body contains neither `sk-ant` nor `api_key` strings.
- The frontend's only public variable is `NEXT_PUBLIC_API_BASE_URL` (the backend origin).
  `frontend/.env.local.example` documents that anything prefixed `NEXT_PUBLIC_` is inlined
  into the JS bundle, and that all secret keys belong in `backend/.env` instead.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local` (examples are whitelisted back
  in with `!*.example`). **Action required:** this audit found that the first commit had
  tracked a `cookies.txt` containing a dev CSRF token plus several debug JSON dumps under
  `backend/`. They contain no production secrets but should be removed from history with
  `git rm --cached` before any public push (see §8).
- No upstream key is required for the current integrations (UniProt, Ensembl, InterPro,
  AlphaFold DB, AlphaMissense hotspot API, VEP are all keyless public endpoints). The
  optional keys are wired for future agentic features and are dormant until set.
- Request headers are never logged; upstream error messages are truncated to 200 chars
  before being returned (`routes/variants.py` guard) so upstream bodies cannot reflect
  sensitive content.

**Verified by:** `tests/test_security.py::TestCsrf::test_health_is_public_and_sets_cookie`,
live probe of `/api/health` (booleans only), grep for `dangerouslySetInnerHTML` (zero hits)
and `NEXT_PUBLIC_` (one hit: the API base URL).

---

## 3. Cross-site scripting (T2)

**The XSS posture has four independent layers:**

1. **No unsanitized HTML, ever.** Every user/upstream-derived string — FASTA headers,
   sequence text, PDB titles, gene names, residue names, PAE-derived tooltips, error
   messages — is rendered through React JSX text nodes, `aria-label`s, canvas `fillText`,
   SVG `<text>` elements, or 3D sprite labels drawn as canvas textures (all inert). The
   sequence track renders each residue as its own `<button>`; the charts draw only
   numbers through canvas/SVG text APIs; the 3D scene contains **no DOM portals at all**
   (drei `<Html>` was removed — labels are canvas-texture sprites, which also eliminates
   the React 19 "synchronously unmount a root" race on viewer teardown). There is **no**
   `dangerouslySetInnerHTML`, **no** `innerHTML` assignment, **no** `insertAdjacentHTML`
   in the codebase.
2. **Input never reaches the DOM as markup.** The backend's 422 handler was deliberately
   overridden (`main.py::validation_exception_handler`) because FastAPI's default echoes
   the *raw offending input* back into the error JSON — a reflected-XSS footgun. Our
   handler returns only parameter locations and fixed messages. Tests assert hostile
   payloads are rejected and never echoed.
3. **Error boundaries render fixed + truncated text.** `PanelBoundary` shows the panel
   name and the *first 160 chars* of an error message as a React text node — even a
   hostile error string is inert.
4. **CSP as the backstop.** The backend serves `default-src 'none'; frame-ancestors 'none';
   base-uri 'none'; form-action 'none'` on API responses (docs paths get a separate,
   narrowly-scoped CSP for Swagger's CDN). The frontend ships a per-request CSP with a
   nonce (Next middleware): `script-src 'self' 'nonce-…'` (dev adds `'unsafe-eval'` for
   HMR), `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`. The new
   canvas/SVG chart layer and the React Bits-inspired background components add **zero**
   new script sources — everything is first-party, bundled, and nonce-compatible.

**Verified by:** `TestInjection::test_malformed_sequences_rejected` (7 payload classes),
`test_fasta_rejects_script_payload` / `test_fasta_rejects_sql_payload`,
`tests/test_alphafold.py::test_rejects_script_payload` (PAE matrix), static grep across the
repo for `innerHTML`/`dangerouslySetInnerHTML` (zero hits in app code).

---

## 4. Cross-site request forgery (T3)

**Scheme: double-submit cookie + constant-time compare + origin allowlist.**

- Any safe (GET/HEAD/OPTIONS) response ensures a `protheon_csrf` cookie exists:
  random 256-bit token, `SameSite=Lax`, `max_age` 24 h, non-HttpOnly (deliberate — the
  double-submit pattern requires the page's JS to read and echo it), `Secure` to be
  enabled behind TLS (flag exists in `config.py`).
- Every non-safe request must present the same value in `X-CSRF-Token`; comparison uses
  `hmac.compare_digest` (constant-time). Mismatch or absence → 403 with a fixed message.
- `SameSite=Lax` means a cross-site form POST never carries the cookie at all, so the
  double-submit comparison can never be satisfied cross-site.
- CORS (`allow_origins` from `CORS_ORIGINS` config, `allow_credentials=True`,
  allowlisted methods/headers) prevents a cross-origin page from *reading* the cookie or
  the token response. Note CORS is not CSRF protection by itself — it protects the token,
  while the cookie+header scheme protects the state change.
- The frontend client (`lib/api.ts`) sends `credentials: "include"`, echoes the cookie as
  the header on mutations, and on a 403 retries once after a safe GET (first-visit
  bootstrap, where no cookie exists yet).
- There are no state-changing GETs; every mutating route is POST.

**Verified by:** `TestCsrf` — post without token → 403, forged token → 403, valid token →
200, cookie length ≥ 32.

---

## 5. Injection in FASTA / PDB parsing (T4)

**Philosophy: fixed-width parsing, whitelist characters, bounded numerics, hard caps,
fail-closed errors that never echo input.**

`backend/app/parsers.py`:

- **FASTA:** 2 MB cap checked before parsing; headers must match a strict one-line
  pattern; sequence characters are validated against a whitelist
  (`A–Z * - _ .`); anything else — HTML tags, SQL fragments, NUL bytes, emoji — raises
  `ParseError` and the request ends in 422. Sequences capped at 20,000 residues.
- **PDB:** 25 MB cap before parsing. Records are parsed by **fixed column slicing** per
  the PDB specification (the grammar is positional, not regex-based). Only
  `ATOM`/`HETATM`/`TITLE`/`SITE` records are consumed; every numeric field goes through a
  bounded `float()`/`int()` inside `try/except` — malformed coordinates are skipped, never
  guessed, and non-finite values (NaN/Inf) are rejected. Atom count is capped.
- **Alignment:** sequences validated by regex `^[A-Z*\-_.]+$` and length (2,000) in the
  Pydantic layer *before* the Needleman–Wunsch kernel (which is additionally capped at
  1,500 residues and uses compact `array('i')` rows to bound memory).
- **No dynamic code execution anywhere:** no `eval`/`exec`, no `subprocess`/shell calls,
  no SQL database, no template rendering of input. The only thing a hostile FASTA can do
  is be rejected.

**Verified by:** `tests/test_parsers.py` (script/SQL payloads, malformed coordinates,
oversize via monkeypatched caps, sequence-before-header) + `TestInjection` (route-level).

---

## 6. SSRF / path traversal on upstream URLs (T5)

Every identifier that reaches an upstream URL passes a strict pattern **before** URL
construction:

| Input | Pattern | Where |
|---|---|---|
| PDB ID | `^[0-9A-Za-z]{4}$` | `routes/structure.py`, `routes/biophysics.py` |
| UniProt accession (path) | `^([OPQ][0-9][A-Z0-9]{3}[0-9]\|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$` — the real UniProtKB accession grammar | `routes/structure.py` |
| GenBank accession (path) | `^[A-Z]{1,4}_?\d{1,6}(\.\d+)?$` | `routes/dna.py` |
| Restriction enzyme list (query) | whitelisted against the enzyme dictionary; unknown names → 422 | `routes/dna.py` |
| MSA sequence id / residues / job id | `^[A-Za-z0-9_.-]{1,40}$` / `^[A-Z*\-_.]{1,2000}$` / `^[A-Za-z0-9_-]{1,80}$` | `routes/comparative.py` |
| Docking ligand / solvent | fixed enums (`aspirin…` / `ethanol|urea|guanidinium`) | `routes/biophysics.py` |
| Gene symbol | `^[A-Za-z0-9]{1,20}$` | `routes/comparative.py`, `ingest.py` |
| Species | `^[a-z_]{3,40}$` | `ingest.py` |
| Ensembl gene (from upstream!) | `^ENSG\d{11}$` | `services/ensembl.py`, `vep.py` |
| Variant fields | Pydantic patterns + ranges | `routes/schemas.py` |

The same patterns are mirrored **client-side** (`app/workspace/structure/page.tsx`
`IDENT_RE`) so an invalid identifier never even reaches a URL — with an actionable
inline hint (a 4-char code in the UniProt field is flagged as a probable PDB ID). A
mismatched identifier now 422s before any upstream call; upstream 400/404/5xx responses
are collapsed into one fixed user-safe message (the raw httpx error, which embeds the
full request URL, is never echoed). The Ensembl gene ID is itself *upstream data*
(UniProt cross-references), so it is re-validated against `ENSG\d{11}` before being
interpolated into a URL — defense in depth against a compromised upstream response.
Upstream base URLs come exclusively from server config; the client can never supply a
URL. All httpx calls use bounded timeouts.

**Verified by:** `TestInjection::test_pdb_path_traversal_rejected` and
`test_accession_injection_rejected` (encoded traversal, SQL-ish suffixes, NUL bytes,
oversize — all 404/422).

---

## 7. AlphaFold comprehensive-data pipeline (T8)

**New in this iteration.** The workspace now consumes three AlphaFold data products:
model PDB (pLDDT via B-factor), whitelisted metadata, and the PAE matrix file.

- **Byte cap before parsing.** `_MAX_PAE_BYTES` (100 MB) is checked against the
  upstream `content-length` *before* `json.loads` — a hostile or bloated matrix file
  cannot exhaust memory. (A legitimate 3000×3000 matrix is ≈ 50–90 MB; anything bigger is
  refused outright.)
- **Strict shape validation, no coercion.** `parse_pae_json` accepts only the documented
  v1–v6 shapes (object, or v6's list-of-entities); the matrix must be square, the
  residue index must match (or be derived from the model's sequence start), every value
  must be a finite number in `[0, 100]`, and bools/strings are rejected. Anything else
  raises `PaeError` → 404 with a fixed message. Tested against script payloads, NaN/Inf,
  ragged rows, mismatched indices, bools-as-numbers and oversized matrices.
- **Residue cap.** `PAE_MAX_RESIDUES` (3000) refuses absurd matrices by shape.
- **Mean-pooling before the client.** The validated matrix is mean-pooled to
  `PAE_DISPLAY_SIZE` (200×200) server-side; the client never downloads the full matrix.
  The displayed matrix is exported as CSV client-side (Blob download, no DOM injection)
  for the accessibility table-view and zero-data-loss export.
- **Metadata whitelisting.** `_public_metadata` copies only known fields, coerces
  identifiers against their known shape (`AF-…-F1` pattern) and truncates free text —
  an upstream schema change can't inject junk fields into the client payload.
- **Caching.** Only successful, validated payloads are cached (24 h TTL) — failures are
  never cached, so a transient upstream issue can't poison the workspace.

**Verified by:** `tests/test_alphafold.py` (24 tests: parser, downsampling, routes) and a
live end-to-end run of `P18858` (919-residue matrix → 184×184 pooled display, mean 17.1 Å).

---

## 7b. GenBank / NCBI Entrez pipeline (T11)

**New in the DNA workspace.** Registry records come from NCBI efetch
(`gbwithparts`) through the backend — the browser never talks to NCBI directly
except through the user-initiated BLAST form (below).

- **Accession gate.** The path validator enforces the GenBank accession grammar
  (`J01749`, `NC_002013`, `M77789.2`) before URL construction — no free-form
  identifiers reach an upstream URL. The client mirrors the same grammar.
- **Strict flat-file parser.** `parse_genbank_text` enforces: 5 MB byte cap and
  100 kb length cap; the LOCUS-declared length must exactly equal the extracted
  ORIGIN sequence (extracted over a base whitelist `ACGTN`); feature locations
  come only from `(\d+)..(\d+)` spans; qualifier values are truncated text.
  A truncated, lying or hostile record raises ParseError → 422 with a fixed
  message — nothing is guessed.
- **Upstream error hygiene.** Non-200 responses collapse into one fixed message;
  a 200 that isn't GenBank (no `LOCUS` header) is refused before caching.
- **Entrez key.** `ENTREZ_API_KEY` is appended to upstream requests server-side
  and appears in no response (`configured_services` reports only a boolean).
- **BLAST form.** The DNA toolbar posts the sequence to NCBI BLAST via a plain
  HTML form in a new tab — an explicit, user-initiated action; no credentials
  are involved, and the main app's CSP never needs to allow third-party
  `connect-src` for it.
- **No result caching on the registry route** — site computation (e.g.
  circular-junction fixes) must never serve stale data; the upstream text
  itself is cached 24 h in the Entrez service.

**Verified by:** `tests/test_dna.py` (19 tests: parser attack cases, enzyme
math incl. circular-junction motifs, route patterns, faked-upstream routes,
CSRF-protected file ingestion) — uploads (GenBank/FASTA) go through the same
strict parsers as upstream records; the multipart endpoint is CSRF-protected,
byte-capped, and rejects protein sequences with a clear message.

---

## 7c. Unblocked pipelines — timeouts at both tiers

**Client:** every request carries an AbortController timeout (90 s default;
100 s variants, 150 s comparative) — a hung upstream can no longer produce an
infinite loader; the panel resolves into its designed error state while the
backend keeps working (successes cache 24 h, so a retry is instant).

**Server:** the comparative dashboard runs the slow Ensembl ortholog call and
the InterPro call **concurrently** under per-part deadlines, each degrading
independently (`available: false` / `domains: []`) — one dead upstream can
never hang the dashboard. The variants route already gathered its three
sources under one deadline. Both remain single-worker-safe: FastAPI async +
httpx is the correct model here; Celery/Redis is only warranted for
multi-worker fan-out (roadmap, SECURITY_AUDIT §10.4).

---

## 8. Client-side stability & validation (T9, T10)

**"Zero unhandled errors" client policy — three layers:**

1. **Error boundaries.** `components/workspace/panels/PanelBoundary.tsx` wraps every major
   module: the 3D canvas, the sequence track, the pLDDT chart, the PAE heatmap, the
   writhe chart, the variant score cards. A panel crash (WebGL unavailable, corrupt
   state) renders a designed glass fallback with attribution and a retry — the rest of
   the workspace keeps running. `componentDidCatch` logs attribution only, never data
   payloads. A **root boundary** (`components/AppBoundary.tsx`) wraps the entire app:
   even a DOM-level error thrown inside React's own commit phase (the dev-mode
   "removeChild" HMR race) degrades to a reload card instead of unmounting the tree.
2. **Zod validation at the API boundary.** `lib/api.ts::apiValidated` runs every payload
   through a schema in `lib/validation.ts` before it reaches a panel; failures become a
   typed `ApiValidationError` instead of an undefined-property crash deep in a chart.
   All workspace pages fetch exclusively through this client. Strict TypeScript
   (`strict: true`) is the build gate.
3. **Designed loading/degradation states.** Every fetch has a `PanelSkeleton` loading
   state and a designed fallback (per-source degradation in the variants workspace, a
   local-writhe chart when no PAE matrix exists, "no sequence data" in the track). The
   pLDDT chart falls back from the full-model series to the Cα trace if the confidence
   endpoint is unavailable.
4. **GPU memory discipline.** The 3D scene renders as instanced spheres (one draw call,
   colors written in place — no geometry churn) or a tube whose geometry is explicitly
   `dispose()`d whenever it is rebuilt (three.js GPU buffers are not garbage-collected
   with the JS object). Label textures are disposed on unmount. **The Canvas root is
   permanent for the viewer panel's lifetime** — loading/error states are overlays, so
   the R3F reconciler root is never torn down mid-render (the React 19
   "synchronously unmount a root" race has no trigger). The PAE heatmap draws the
   matrix once to an offscreen canvas and redraws only the crosshair layer. No DOM
   portals inside the canvas (drei `<Html>` removed).

**localStorage (T10):** `lib/persistence.ts` stores only non-sensitive workspace state
(split ratios, rail state, open-tab list, view prefs — never tokens, keys or sequences).
Every read is guarded (cleared storage / quota / corrupt JSON → `null`, never a crash);
persisted values are re-validated with Zod on hydration, exactly like network payloads.
Hydration happens in an effect, so SSR and first client paint always match.

**Verified by:** strict `next build` (zero TypeScript errors) and browser QA of every
workspace page (zero console errors, zero failed requests; the AlphaFold flow exercised
end-to-end: model, full sequence, pLDDT chart, PAE heatmap).

---

## 9. DoS controls (T6)

- Body cap: 5 MB at the middleware (413) — before routing, parsing, or JSON decoding.
- Rate limit: per-IP sliding window (default 120 req/min, configurable), 429 on breach.
  In-memory and per-process — correct for the single-worker dev/deploy profile; for
  multi-worker production use a shared store (see §10).
- Parse caps: FASTA 2 MB / 20k residues, PDB 25 MB / 300k atoms, PAE 100 MB byte cap /
  3000-residue shape cap / 200×200 pooled output, writhe downsampled to ≤160 points (the
  Gauss-integral kernel is O(n²) — downsampling keeps it bounded), alignment 1,500
  residues.
- Upstream timeouts: 25 s default, 120 s for AlphaFold model + PAE downloads, a dedicated
  120 s window for Ensembl (whose legacy hosts currently answer healthy calls in 60–200 s
  — verified live 2026-09-30), and a 180 s variant deadline with per-source degradation.
  Only successful upstream results are cached (negative caching would poison retries).

**Verified by:** `TestLimits::test_oversized_body_rejected_413`,
`test_rate_limit_enforced` (4th request in the window → 429).

---

## 10. Residual risks & required actions

1. **⚠ Debug artifacts in git history.** `backend/cookies.txt` (a dev CSRF token dump)
   and `cmp*.json` / `var*.json` / `rcsb.json` (upstream response dumps) were committed in
   the first commit. No production secrets are inside, but remove them before any public
   push: `git rm --cached backend/cookies.txt backend/cmp*.json … && git commit`.
   `.gitignore` now prevents recurrence.
2. **CSRF cookie is not `Secure`** — correct for `http://localhost`; set
   `CSRF_COOKIE_SECURE=true` in `config.py` (currently hardcoded `secure=False`) and serve
   behind TLS before deploying anywhere reachable.
3. **No authentication layer.** There are no user accounts; rate limiting is per-IP.
   Before hosting publicly, add OIDC/API-token auth and scope rate limits per principal.
4. **Rate-limit and TTL caches are in-memory.** Fine for one uvicorn worker. Multi-worker
   deployment needs Redis (the `TTLCache` API is already shaped for a swap).
5. **Frontend CSP hardcodes `connect-src http://localhost:8000`** for local dev. For any
   deployed origin, update `frontend/middleware.ts` (ideally serve the API same-origin
   through a Next.js proxy) and remove `'unsafe-eval'` from any non-dev script-src.
   **Note:** Next 16 deprecates the `middleware` convention in favour of `proxy`; the
   current file still executes (the build reports "ƒ Proxy (Middleware)"). Migrate with
   `npx @next/codemod@canary middleware-to-proxy` at the next dependency sweep — the CSP
   must move with it, not get dropped.
6. **Upstream trust:** we display upstream annotations as-is (with graceful per-source
   degradation). Field-level provenance is not currently shown in the UI; consider
   surfacing `status`/`detail` chips per source (the data model already carries them).
7. **Automated tooling (recommended):** add `pip-audit` for Python deps, `npm audit` /
   `next lint` in CI, `bandit` on the backend, and keep the regression suite
   (`pytest tests/`, currently 66 tests) as a merge gate. The current suite is the
   enforceable subset.
8. **Secrets rotation:** if the repo was ever pushed with `.env` present, rotate any keys
   in it. The committed artifacts above contain none.
9. **PAE matrix for multi-entity (complex) predictions:** the v6 file lists one entry per
   entity; Protheon consumes the first entry. If complex structures become a target,
   extend the endpoint to select the entity matching the viewer's primary chain.

## 11. How to re-verify

```bash
# Backend: 216 offline security + numerics tests
cd backend
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest tests -q

# Live probes (server running on :8000)
curl -s http://localhost:8000/api/health                          # booleans only
curl -s -X POST http://localhost:8000/api/alignment/pairwise \
  -H 'Content-Type: application/json' \
  -d '{"sequence_a":"ACGT","sequence_b":"ACGT"}'                  # 403 without CSRF token
curl -s http://localhost:8000/api/structure/rcsb/..%2F..%2Fetc   # 422/404, no echo
curl -s http://localhost:8000/api/dna/registry/..%2F..%2Fetc     # 422/404, no echo
curl -s http://localhost:8000/api/structure/alphafold/../x/confidence  # 422, no echo

# Frontend: production build must succeed with the strict CSP in place
cd frontend && npm run build
```

**Audit result:** no critical or high findings outstanding in the code as audited;
nine hardening actions are listed in §10, of which items 1–2 are the only pre-share
must-dos.
