# CRISPR tools + Nextflow — integration points & UI hooks

How the workspace connects CHOPCHOP, CRISPR-GATE, CRISPR-P 2.0 and
Nextflow, end to end: backend routes → services → frontend hooks → UI.

## 1. Architecture

```
Browser (Next.js)
  ├─ lib/crispr.ts        useSgRnaDesign(submit → poll)
  ├─ lib/nextflow.ts      usePipelines · useLaunchRun · usePipelineRun · useRuns
  └─ lib/validation.ts    SgRnaJobStatusSchema · PipelineStatusSchema · …
        │  apiValidated (CSRF double-submit, Zod-gated)
        ▼
FastAPI  /api/crispr/*    routes/crispr.py  → services/crispr.py
         /api/nextflow/*  routes/nextflow.py → services/nextflow.py
                │                     │
        local scoring core      Tower API (config-gated)
        (always available)      CHOPCHOP / CRISPR-P APIs (config-gated)
```

Upstream credentials (`nextflow_tower_token`) and tool base URLs live in
`backend/.env` (Settings in `backend/app/config.py`) — **server-side only**;
the browser never sees them. `/api/health` reports only *whether* each
integration is configured (`chopchop`, `crispr_p`, `nextflow_tower`).

## 2. CRISPR design API

| Endpoint | Purpose | Payload gate |
|---|---|---|
| `POST /api/crispr/design` | queue a design job | `tool` ∈ chopchop/crispr_gate/crispr_p · `sequence` `^[ACGTN\s]{80,10000}$` → `{job_id}` |
| `GET  /api/crispr/design/{job_id}` | poll | `{status, job_id, tool, results[], detail?}` — results match `SgRnaSchema` |

Guide shape (frontend `SgRnaSchema` in `lib/validation.ts`):

```ts
{ id, sequence, pam, start, end, strand: "+"|"-", gc,
  on_target_score: 0–100, off_target_count, off_targets[], self_comp?, efficiency_note? }
```

**Local scoring core** (`services/crispr.py`, always on): IUPAC-aware PAM
scan on both strands → 20-nt spacer extraction → GC / homopolymer /
self-complementarity → per-tool ranking:

- **CHOPCHOP-style** — GC 40–80% window, self-comp penalty, mild position bias.
- **CRISPR-GATE-style** — knockout ranking: strong early-CDS placement bias
  (truncating alleles).
- **CRISPR-P 2.0-style** — plant GC window (30–70%), U3/U6 notes.

**Upstream enrichment** (config-gated, honest degradation): when
`chopchop_base_url` / `crispr_p_base_url` are set, the service attaches
genome-wide off-target rows at the `enrich_off_targets` boundary (the one
place upstream JSON shapes are mapped — see `services/crispr.py` TODO).
When they are not set, guides ship with `efficiency_note: "off-target scan
unavailable (upstream not configured)"` and the UI prints **n/a** — off-target
numbers are never fabricated.

## 3. UI hooks

**`useSgRnaDesign()`** (`lib/crispr.ts`)
```ts
const { state, submit, reset } = useSgRnaDesign();
// state: {kind:"idle"} | {kind:"running", jobId} | {kind:"done", tool, results}
//        | {kind:"error", detail}
submit(sequence, tool, geneLabel, organism);  // client-side ACGTN gate first
```
Polls every 3 s (20 polls cap), mirrors the MSA job pattern exactly.

**`usePipelineRun(runId)` / `useLaunchRun()` / `usePipelines()` / `useRuns(k)`**
(`lib/nextflow.ts`) — the monitor polls every 2 s **only while the run is
active** (submitted/running) and stops at a terminal state.

## 4. Nextflow API

| Endpoint | Purpose |
|---|---|
| `GET  /api/nextflow/pipelines` | template catalog (`crispr-knockout`, `sgrna-offtarget`, `variant-impact`) |
| `POST /api/nextflow/runs` | `{pipeline, params}` → `{run_id}` |
| `GET  /api/nextflow/runs` | recent runs |
| `GET  /api/nextflow/runs/{id}` | `{run, steps[], log_tail[]}` — matches `PipelineStatusSchema` |
| `POST /api/nextflow/runs/{id}/cancel` | cancel a live run |

Two modes, always distinguished in the payload:
- **`source: "tower"`** — real compute via the Tower API (the submit call is
  the single TODO boundary in `services/nextflow.py`; token never leaves
  the server).
- **`source: "demo"`** — in-process simulator deriving step statuses from
  elapsed time (set `simulate_failure: "true"` in params to exercise the
  failure path). The UI badges this as **demo simulator** so simulated
  progress can never masquerade as compute.

## 5. The CRISPR → Nextflow handoff

`CrisprGateWizard` (confirm knockout plan) links to
`/workspace/pipelines?run=crispr-knockout&guides=<id>&target=<gene>`.
`PipelinesPage` reads the query once (Suspense-wrapped `PrefillReader`),
highlights the matching `PipelineCard` and prefills its params — launch
stays a human action.

## 6. Wiring checklist for a live deployment

1. `backend/.env`:
   ```
   CHOPCHOP_BASE_URL=…        # optional — enables off-target enrichment
   CRISPR_P_BASE_URL=…        # optional — plant off-target enrichment
   NEXTFLOW_TOWER_URL=…       # optional — real runs
   NEXTFLOW_TOWER_TOKEN=…     # optional — never exposed to the client
   ```
2. Register the routers — done (`backend/app/main.py` imports
   `crispr` and `nextflow`).
3. Frontend tooling baseline (repo root currently has none):
   `package.json` (next + react + zod + lucide-react + gsap + three +
   @react-three/fiber + @react-three/drei + 3dmol), `tsconfig.json` with
   `"paths": {"@/*": ["./*"]}`, `next.config.mjs`, `tailwind` + `postcss`
   config. The CSS token layer (`glass-card`, `chip`, `stat-num`,
   `skeleton`, `btn-*`, `panel-fallback`, `splitter`, `sequence-residue`,
   `status-dot`…) already exists in `app/globals.css`.
4. Tests: `backend/tests/test_crispr.py` covers the scanner (both strands,
   dedupe, hostile input), the job roundtrip and the Nextflow demo
   simulator's success/failure paths.
