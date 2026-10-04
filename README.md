# Protheon 🧬

A unified, web-based workspace for protein sequence alignment, structural analysis and
variant impact prediction — built for the **Global Innovation Build Challenge**.

**Protheon is a Benchling-style workspace with a "Zero-Gravity Clinical" aesthetic:**
pristine white planes, degraded-purple (violet → lavender) atmosphere, a collapsible
glass side rail, multi-tab structure files, resizable split panes, an AlphaFold-style
React Three Fiber viewer (per-residue pLDDT spheres / cartoon, catalytic-site markers),
and a synced dashboard of per-residue confidence (pLDDT line chart) and AlphaFold PAE
(2D heatmap, AlphaFold-green scale) — all floating over a lavender dot-field/aurora
backdrop. Every panel is crash-isolated by an error boundary, every API payload is Zod
validated before render, and every fetch has a designed loading and fallback state.

```
┌─────────────────────────── Browser ───────────────────────────┐
│  Next.js 16 (App Router) · Tailwind · GSAP · R3F · Zod        │
│  Benchling shell: SideRail · TabBar · SplitPane · PanelBoundary│
│  Charts: SVG pLDDT + writhe lines · canvas PAE heatmap · CSV  │
│  React Bits-inspired backdrop: DotField + Aurora (lavender)   │
│  NEXT_PUBLIC_API_BASE_URL  ──────────────┐   │
└───────────────────────────────────────────┼───────────────────┘
                                            ▼
┌─────────────────────────── FastAPI :8000 ─────────────────────┐
│  CSRF double-submit · rate limit · size caps · strict CSP     │
│  routes: structure · comparative · variants · alignment · ingest
│  services: UniProtKB · Ensembl · InterPro · AlphaFold DB      │
│           (model + PAE matrix) · AlphaMissense · VEP(SIFT)    │
│           ← server-side keys only, never in the browser       │
└───────────────────────────────────────────────────────────────┘
```

**Research preview — aggregations of public annotations are not clinical interpretation.**

---

## 1. Features

| Workspace | What it does |
|---|---|
| **Structure** (`/workspace/structure`) | Benchling-style flagship: multi-tab structure files (models stay loaded when you switch — zero data loss), resizable split between the R3F viewer and a synced panel stack. **AlphaFold-style viewer** — per-residue pLDDT spheres (instanced, one draw call) or a cartoon tube; AlphaFold models open in the canonical confidence view by default. **Sequence track** (one button per residue, canonical AlphaFold pLDDT band colors, full chain for AlphaFold models), **pLDDT confidence chart** (SVG line, band thresholds, crosshair + keyboard scrubbing), **PAE matrix heatmap** (canvas, AlphaFold-green ramp, mean-pooled 200×200, hover crosshair, CSV export) — RCSB models show a **local writhe chart** in the same slot, so two graphs are always present. Stats tiles. **Everything syncs**: hover/click a residue in any panel and the 3D viewer drops a focus marker while the other panels move their cursors. Color modes: chain / pLDDT / backbone writhe; catalytic residues (RuBisCO KCX201·Asp203·Glu204…) and Mg²⁺ ions as labeled sprite markers (no DOM portals in the scene). |
| **DNA** (`/workspace/dna`) | Benchling/SnapGene-style sequence canvas. **seqviz renders the real maps** (linear / circular / both, annotation rails, enzyme ticks, index ruler); the classic hand-rolled LinearMap/CircularMap stay behind a toolbar toggle. Properties sidebar (length, GC%, melting temperature, annotations, selection) on the right, sortable **feature annotation table** docked below — clicking a row selects the region on the canvas. **Universal browser parsing**: drop `.gb` / `.dna` (binary SnapGene) / `.fa` files — parsed client-side via @teselagen/bio-parsers into the shared viewer state (or loaded from the backend Entrez registry, `gbwithparts`, strictly parsed server-side). Action toolbar: Copy, FASTA export, BLAST (posts to NCBI in a new tab), Print/PDF; persistent status bar with selection metadata (range, length, GC%, Tm). Selection is shared workspace-wide: it is exactly what the CRISPR tools and flow builder receive. |
| **Flow builder** (`/workspace/flows`) | ProtoFlow-style visual pipeline canvas (@xyflow/react): a **Sequence Node** (reads the shared workspace store — name, length, live selection) connected by edges to tool nodes — **Run CHOPCHOP**, **Run CRISPR-GATE**, **Run CRISPR-P 2.0**, **Nextflow Pipeline**. Drag nodes from the palette, edit params in the inspector, and run any node with the current selection carried in the URL. Canvas persists to localStorage (shape-guarded). |
| **CRISPR design** (`/workspace/crispr`) | CHOPCHOP, CRISPR-GATE and CRISPR-P 2.0 in one workflow. Target sequence (paste, demo, or pull from the DNA registry) → local scoring core scans both strands for NGG guides (GC, self-complementarity, per-tool ranking: CHOPCHOP-style, CRISPR-GATE knockout 5′-bias, CRISPR-P plant windows). SnapGene-style **PAM overview track** (rank labels, both strands), ranked guide table, off-target detail (upstream-enriched when configured — **never fabricated**), and a CRISPR-GATE **knockout wizard** whose plan exports to JSON or launches a Nextflow validation run. |
| **Pipelines** (`/workspace/pipelines`) | Nextflow trigger + monitor. Template catalog with parameter forms; the run monitor shows live status, per-process step trace and a log tail (2 s polling, stops at terminal states). Runs carry `source: tower \| demo` — Tower-backed when `NEXTFLOW_TOWER_*` is configured, otherwise an in-process simulator that is always badged as demo. CRISPR knockout plans arrive prefilled via `?run=&guides=&target=`. |
| **In silico lab** (`/workspace/lab`) | Simulated genetics: **restriction digest → agarose gel** (band migration ∝ log size, 1 kb+ ladder, pBR322 digests), **Michaelis–Menten kinetics** (live Vmax/Km sliders), **dose–response** (4-parameter logistic on a log dose axis) — every dataset CSV-exportable. |
| **Comparative** (`/workspace/comparative`) | Human ↔ blue-whale orthologs for BER-pathway genes (LIG1, PNKP): Ensembl homology (UniProt-curated gene ID to dodge the LIG1/LRIG1 synonym collision), InterPro domain track, pairwise Needleman–Wunsch alignment. |
| **Variants** (`/workspace/variants`) | One substitution → AlphaFold pLDDT (B-factor from the model file), AlphaMissense pathogenicity (hegelab hotspot API), SIFT/PolyPhen (Ensembl VEP). Each source degrades independently; transparent consensus meter. |
| **Overview** (`/workspace`) | Watermelon-UI-style dashboard: KPI stat blocks + tool cards. |

**Comprehensive AlphaFold data:** the backend returns everything the DB offers —
model metadata (entry ID, release date, version, organism, taxon), per-residue pLDDT
for the full chain, and the PAE matrix (strictly validated, mean-pooled server-side).
No data is proxied raw: upstream payloads are shape-validated before they reach the client.

Security posture and the audit trail: **[SECURITY_AUDIT.md](SECURITY_AUDIT.md)**.

## 2. Repository layout

```
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, middleware stack, 422 fail-closed handler
│   │   ├── config.py          # pydantic-settings — ALL secrets live here
│   │   ├── security.py        # CSRF double-submit · rate limit · headers · body cap
│   │   ├── parsers.py         # strict FASTA + PDB + GenBank parsers (injection-safe)
│   │   ├── writhe.py          # Gauss-integral writhe + local writhe
│   │   ├── align.py           # Needleman–Wunsch (pure Python, bounded memory)
│   │   ├── enzymes.py         # restriction enzymes: sites (circular-aware) + digests
│   │   ├── cache.py           # thread-safe TTL cache
│   │   ├── routes/            # structure · dna · comparative · variants · alignment · ingest
│   │   └── services/          # uniprot · ensembl · interpro · alphafold (model+PAE)
│   │                          #   · alphamissense · vep · entrez (NCBI efetch)
│   ├── tests/                 # 91 tests: security regressions + parsers + PAE + DNA
│   ├── requirements.txt / requirements-dev.txt
│   ├── .env.example           # ← template for backend/.env
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx, layout.tsx        # landing (+ root AppBoundary)
│   │   └── workspace/
│   │       ├── layout.tsx              # Benchling shell (rail + top bar + backdrop)
│   │       ├── page.tsx                # dashboard hub (KPI blocks + tool cards)
│   │       └── structure|dna|comparative|variants|lab/
│   ├── components/
│   │   ├── bits/             # React Bits-inspired: DotField (canvas) · Aurora ·
│   │   │                     #   ClinicalBackdrop — clinical palette, reduced-motion aware
│   │   ├── antigravity/      # FloatIn (GSAP) · GlassCard · IsometricTilt · Parallax
│   │   ├── three/            # ProteinViewer (R3F, permanent canvas, hover/click sync)
│   │   ├── landing/          # Hero · ToolGrid · PipelineBand · SequenceDeck
│   │   └── workspace/
│   │       ├── panels/       # PanelBoundary (error boundaries) · PanelSkeleton · Panel
│   │       ├── shell/        # SideRail · TopBar · TabBar · SplitPane · ToolScroll
│   │       ├── sequence/     # SequenceTrack (per-residue buttons, pLDDT bands)
│   │       ├── charts/       # LineChart engine · PlddtChart · WritheChart · PaeHeatmap
│   │       ├── dna/          # LinearMap (dual-strand + ORFs) · CircularMap (SVG)
│   │       ├── lab/          # GelSimulation · KineticsPanel · DoseResponsePanel
│   │       └── …             # AlignmentViewer · DomainTrack · ScoreCard · HealthChip …
│   ├── lib/
│   │   ├── api.ts            # CSRF-aware client + apiValidated (Zod gate)
│   │   ├── validation.ts     # Zod schemas for every API payload
│   │   ├── persistence.ts    # guarded localStorage + usePersistentState (validated)
│   │   ├── dna.ts            # enzyme/feature palettes · digest math · gel model · GC%
│   │   ├── codon.ts          # standard genetic code · reverse complement · ORFs
│   │   ├── export.ts         # safe CSV download (Blob + anchor)
│   │   └── types.ts · format.ts · geometry.ts · motion.ts · gsap.ts
│   ├── middleware.ts         # per-request CSP with nonce
│   ├── next.config.js        # strict hardening headers
│   ├── .env.local.example    # ← template for frontend/.env.local
│   └── tailwind.config.ts
├── SECURITY_AUDIT.md
└── .gitignore
```

## 3. Prerequisites

- **Python 3.12+** (verified on 3.14) — `python --version`
- **Node.js 20+** (verified on 24) — `node --version`
- Internet access (upstream APIs are public and keyless)

## 4. Run the backend (FastAPI, port 8000)

```powershell
cd backend

# 1. Create + activate the virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# 2. Install dependencies
python -m pip install -r requirements-dev.txt

# 3. Create your environment file
Copy-Item .env.example .env        # then edit .env if you have keys (see §7)

# 4. Run the test suite (66 tests, offline) — optional but recommended
python -m pytest tests -q

# 5. Start the server
python -m uvicorn app.main:app --reload --port 8000
```

Check it: <http://localhost:8000/api/health> (returns service booleans, never keys) and
the interactive docs at <http://localhost:8000/api/docs>.

## 5. Run the frontend (Next.js, port 3000)

```powershell
cd frontend

# 1. Install dependencies (includes zod, three, R3F, drei, GSAP)
npm install

# 2. Create your environment file
Copy-Item .env.local.example .env.local

# 3. Start the dev server
npm run dev

# Production build (strict CSP included — must pass with zero TS errors)
npm run build
npm start
```

Open <http://localhost:3000>. The landing page loads instantly; the workspace tools call
the backend at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).

**First-request note:** state-changing calls bootstrap the CSRF cookie automatically
(the client retries one 403 after a safe GET) — no manual setup.

### React Bits & Watermelon UI — what was installed

- **Watermelon UI** is a design-pattern library (dashboard layouts, glassmorphic panel
  blocks). Its patterns are applied as Tailwind/CSS directly — the KPI stat blocks on the
  Overview dashboard, the glass panel chrome, and the sectioned dashboard composition.
  Nothing to install.
- **React Bits** components are MIT-licensed standalone components (not an npm package).
  `components/bits/` implements the two background effects in-house — **DotField**
  (canvas dot grid with pointer parallax) and **Aurora** (layered drifting glow) — retuned
  to the white + degraded-purple clinical palette and the repo's motion contract
  (transform-only, DPR-aware, fully cleaned up, `prefers-reduced-motion` renders static).
  No OGL dependency, no new script sources: the strict CSP stays untouched.

## 6. The workspace, panel by panel

- **SideRail** — collapsible icon rail (persisted). Workspace tools + data-source links.
- **TopBar** — current tool, live backend health chip, landing link.
- **Command bar + TabBar** (Structure) — load PDB / UniProt accessions, presets
  (LIG1 1X9N · RuBisCO 8RUC · AlphaFold P18858 · P00875), color modes (chain / pLDDT /
  writhe), render style (Spheres / Cartoon), marker toggles. Identifiers are validated
  client- and server-side against the real grammars — typing `2BMY` into the UniProt
  field shows an inline hint ("switch to PDB ID mode") instead of an upstream error.
  Each loaded structure is a tab; closing a tab never unloads the others.
- **SplitPane** — drag or keyboard-resize the boundary; the ratio persists. "▤ Panels"
  collapses the right column without remounting the viewer.
- **Panels** — Sequence, pLDDT confidence, and a third data panel: the **PAE matrix**
  for AlphaFold models (validated + mean-pooled server-side to ≤ 200×200; hover shows the
  residue pair + Å value; **CSV** exports the displayed matrix — the accessibility table
  view) or the **local writhe chart** for models without a PAE file. Every panel body is
  wrapped in a `PanelBoundary`: a crash in one panel degrades to a designed fallback,
  never the page.
- **Rendering & memory rules** — each database opens in its native look: AlphaFold →
  pLDDT spheres (the AF DB confidence view), RCSB PDB → chain-colored cartoon (the Mol*
  view). The 3D scene uses instanced spheres (one draw call, in-place recolors — no
  geometry churn) or a tube whose geometry is explicitly disposed on rebuild; labels are
  canvas-texture sprites (no DOM portals, no React root unmounting inside the canvas);
  textures are disposed on unmount. Switching or closing tabs fully unmounts the canvas.
  The PAE heatmap draws the matrix once to an offscreen canvas and redraws only the
  crosshair layer. A **root error boundary** (`AppBoundary`) backs the per-panel
  boundaries, so even a dev-mode React/HMR DOM race degrades to a reload card instead of
  unmounting the workspace ("buttons disappearing").

- **Performance budget** — the landing 3D ribbon is lazy-loaded (`ssr: false`); the
  dot-field animation loop pauses when the tab is hidden; the aurora blur is capped
  (blur is the most expensive pixel on the page); sequence rows use
  `content-visibility` so a 900-residue track paints only the visible rows; AlphaFold
  prediction metadata is cached server-side so a load makes one upstream round-trip
  instead of two. For the fastest, hiccup-free experience run the production server
  (`npm run build && npm start`) — dev mode is for editing, not for using.

## 7. Where every key goes (the only correct answer)

**One rule: anything prefixed `NEXT_PUBLIC_` is inlined into the browser JS bundle.**
No secret may ever carry that prefix. All secrets live in `backend/.env`.

### `backend/.env` (server-only — complete template)

```ini
# ── Public data services (keyless — these are just URLs) ─────────────────────
UNIPROT_BASE_URL=https://rest.uniprot.org
ENSEMBL_BASE_URL=https://rest.ensembl.org
INTERPRO_BASE_URL=https://www.ebi.ac.uk/interpro/api
ALPHAMISSENSE_BASE_URL=https://alphamissense.hegelab.org
ALPHAFOLD_BASE_URL=https://alphafold.ebi.ac.uk/api
ENTREZ_BASE_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils

# ── Optional credentials — SERVER-SIDE ONLY, never sent to the client ────────
# Ensembl REST is keyless; set this only for a privileged mirror.
ENSEMBL_API_KEY=
# NCBI E-utilities is keyless at <=3 req/s; a key raises the rate limit.
# Appended to upstream requests server-side — never exposed to the client.
ENTREZ_API_KEY=

# ── Agentic features (planned; dormant until set) ─────────────────────────────
ANTHROPIC_API_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

# ── Application behaviour ─────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ORTHOLOG_SPECIES=balaenoptera_musculus,balaenoptera_acutorostrata,physeter_catodon
RATE_LIMIT_PER_MINUTE=120
REQUEST_TIMEOUT_S=25
ENSEMBL_TIMEOUT_S=120
VARIANT_TIMEOUT_S=180
# AlphaFold model downloads (PDB + PAE matrix files can be large).
ALPHAFOLD_TIMEOUT_S=120
# Hard caps for upstream PAE matrices: refuse matrices beyond this residue
# count before parsing; mean-pool down to this size for the client heatmap.
PAE_MAX_RESIDUES=3000
PAE_DISPLAY_SIZE=200
TRUST_PROXY=false
```

### `frontend/.env.local` (client-safe — complete template)

```ini
# The ONLY public value in the frontend. Never put a secret here.
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Key placement table

| Credential / setting | File | Exposed to client? |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` (backend origin) | `frontend/.env.local` | ✅ yes, by design — it is not a secret |
| `UNIPROT_BASE_URL` (no key needed) | `backend/.env` | ❌ server-side |
| `ENSEMBL_BASE_URL` / `ENSEMBL_API_KEY` (keyless public REST; key optional) | `backend/.env` | ❌ server-side |
| `INTERPRO_BASE_URL` (keyless) | `backend/.env` | ❌ server-side |
| `ALPHAMISSENSE_BASE_URL` (hotspot API is keyless) | `backend/.env` | ❌ server-side |
| `ALPHAFOLD_BASE_URL` + PAE caps/timeouts (AlphaFold DB, keyless) | `backend/.env` | ❌ server-side |
| `ENTREZ_BASE_URL` / `ENTREZ_API_KEY` (NCBI E-utilities; key optional, rate-limiting) | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` (agentic LLM features) | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |
| `PINECONE_API_KEY` / `PINECONE_ENVIRONMENT` (vector store) | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |
| Any future per-service token | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |

Why this works: the browser only ever talks to *your* backend (same origin in a real
deployment; localhost in dev). The backend holds the keys and makes the upstream calls —
the client cannot leak what it never receives. `/api/health` exposes only booleans
("is an LLM configured?"), never values.

## 8. Motion & accessibility rules (the Zero-Gravity contract)

- **Never snap instantly** — every transition is ≥ 0.3 s `ease-out`; GSAP entrances run
  `power3.out`, staggers at 0.1 s.
- **Transform-only animation** — `will-change: transform`; filters/layout properties are
  never animated continuously. DotField/Aurora drift on transforms; canvas is DPR-aware.
- **`prefers-reduced-motion: reduce`** disables GSAP tweens, parallax, tilts, the hero
  spin, the dot-field animation loop *and* the aurora layer (rendered static/absent) —
  CSS + JS both covered.
- **Z-depth** — aurora orbs and the dot field recede behind foreground glass panels,
  which use layered diffused shadows (`0 20px 40px rgba(0,0,0,0.05)` stack).
- **Keyboard everywhere** — the splitter is a focusable `role="separator"` (arrow keys),
  tabs are `role="tab"`, charts scrub with arrow keys, `:focus-visible` is always
  visible (clinical cyan ring).
- **Charts follow the dataviz contract** (see `lib/format.ts`): validated dark
  categorical slots, single-hue sequential ramp for the PAE heatmap, hairline grid,
  hover layer by default, text wears text tokens, status colors reserved and always
  icon + label paired.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `403 Missing or invalid CSRF token` from curl | CSRF protects mutations: first `GET /api/health` to receive the cookie, then send its value as the `X-CSRF-Token` header. |
| "…is a PDB-style identifier — switch the loader to PDB ID mode" | You typed a PDB code into the UniProt field. The loader validates identifiers against the real accession grammar before any network call — flip the toggle to PDB ID. |
| Frontend shows "API unreachable" | Is the backend running on :8000? Does `CORS_ORIGINS` in `backend/.env` include `http://localhost:3000`? |
| Buttons vanish / `Failed to execute 'removeChild'` / "unmount a root" | Fixed structurally: the 3D Canvas root now stays mounted for the viewer panel's whole lifetime (loading/error are overlays, never canvas swaps), so the React 19 + R3F unmount race has no trigger. A root error boundary (`AppBoundary`) additionally catches anything exotic into a reload card. If you still see it in **dev** after a hard refresh, restart the dev server or use `npm run build && npm start` (production has no HMR). |
| Page feels slow / hiccups | Dev mode recompiles routes on demand and applies HMR updates. Use `npm run build && npm start` (standalone output, no HMR, optimized chunks). Upstream calls (RCSB, AlphaFold, Ensembl) still dominate first loads — successes cache 24 h server-side. |
| PAE panel: "No PAE matrix available for this model" | Some AlphaFold entries ship no PAE file (or upstream is transient). The pLDDT chart keeps working from the model file. Retry — failures are never cached. |
| PAE panel: "PAE is an AlphaFold prediction metric" | Expected for RCSB PDB loads — the metric only exists for AlphaFold models. |
| First load of a page is slow | Next dev compiles routes on first request; upstream calls (RCSB, AlphaFold, Ensembl) can take 5–120 s. Successes cache 24 h server-side; the tab list + view prefs persist client-side. |
| Comparative page: ortholog unavailable | Ensembl's legacy REST is degraded (healthy calls currently take 60–200 s). The first call may time out — retry; successes cache for 24 h. `ENSEMBL_TIMEOUT_S` tunes the window. |
| Variant scores partially unavailable | By design — each source degrades independently (timeouts, missing tables). The card shows the source's own detail. |
| Port conflicts | `--port` flag on uvicorn; change `NEXT_PUBLIC_API_BASE_URL` + `CORS_ORIGINS` to match. |
| `npm run build` CSP errors in dev | Dev-only CSP includes `'unsafe-eval'` for HMR; production CSP is strict — see `middleware.ts`. |
| `middleware` deprecation warning (Next 16) | The file still executes (build: "ƒ Proxy (Middleware)"). Migrate later with `npx @next/codemod@canary middleware-to-proxy` — and carry the CSP over (see SECURITY_AUDIT.md §10.5). |

## 10. Deployment guide

### Backend (Docker)

```powershell
cd backend
docker build -t biostream-api .
docker run --rm -p 8000:8000 --env-file .env biostream-api
```

The `Dockerfile` installs `requirements.txt` and runs uvicorn on :8000.

### Frontend (standalone output)

`next.config.js` sets `output: "standalone"` — `npm run build` emits a self-contained
server in `frontend/.next/standalone`:

```powershell
cd frontend
npm ci && npm run build
# copy .next/standalone + .next/static + public per the Next.js standalone docs
node .next/standalone/server.js   # or serve behind your reverse proxy
```

### Production checklist (all items — see SECURITY_AUDIT.md §10)

1. **TLS everywhere**; set `CSRF_COOKIE_SECURE=true` in `config.py` and
   `TRUST_PROXY=true` only behind a proxy that overwrites `X-Forwarded-For`.
2. **CSP:** update `frontend/middleware.ts` `connect-src` to the deployed API origin
   (prefer serving the API same-origin through a Next.js proxy), keep
   `script-src 'self' 'nonce-…'` and drop `'unsafe-eval'` (prod never has it).
3. **CORS:** set `CORS_ORIGINS` to the deployed frontend origin — exact origins, no `*`.
4. **Auth:** add OIDC/API tokens before public hosting; scope the rate limit per
   principal. Multi-worker deployments need a shared rate-limit/cache store (Redis).
5. **Secrets:** inject `backend/.env` values from your platform's secret store;
   frontend gets exactly one public variable (`NEXT_PUBLIC_API_BASE_URL`).
6. **Git hygiene:** `git rm --cached` the debug artifacts before any public push
   (SECURITY_AUDIT.md §10.1).
7. **CI gates:** `pytest tests/` (66 tests) + `npm run build` + `npm audit`/`pip-audit`.

## 11. Roadmap

- **BLAST/MSA lanes:** the DNA toolbar already posts queries to NCBI BLAST (user-initiated,
  new tab). A native hit-map panel (E-value/bit-score table) and Clustal Omega MSA
  (EBI REST, keyless) with conservation bars + consensus are the next comparative features.
- **SWISS-MODEL homology pipeline:** template search + model build behind a job-polling
  endpoint (the workspace API is already shaped for long-running upstream jobs).
- **Molecular interactions:** protein–DNA contact maps, docking poses and distance
  measurements on top of the existing R3F viewer (which already renders ligands/metal
  sites — the interaction layer is the remaining piece).
- **Agentic features (planned):** the `ANTHROPIC_API_KEY` / `PINECONE_API_KEY` hooks in
  `config.py` are reserved for an LLM-assistant lane (interpretation summaries over
  variant evidence) and a vector index of structure annotations.
- **Multi-entity PAE:** v6 PAE files list one entry per chain; BioStream consumes the
  first (SECURITY_AUDIT.md §10.9). Surface per-chain matrices when complexes land.
- **Auth:** none yet — add OIDC/API tokens before public hosting.
