# Workspace Architecture — the unified Protheon frontend

Refactored 2026-10-03. This is the canonical map of the workspace frontend:
where every component lives, which logic was deduplicated, and the contracts
a new panel must satisfy.

## 1. Folder & component structure

```
lib/                              ← the shared layer every component imports
  api.ts             CSRF-aware fetch + apiValidated (Zod gate on every payload)
  validation.ts      Zod schemas mirroring backend routes field-for-field
  types.ts           shared domain interfaces (StructureModel, VariantImpact…)
  format.ts          fmt, STATUS tones, plddtBand/PLDDT_BANDS, writheColor*,
                     domainColor, hexToRgb, chunkString, MARKER
  persistence.ts     guarded localStorage + usePersistentState (validated restore)
  motion.ts          useIsomorphicLayoutEffect · usePrefersReducedMotion
  gsap.ts            single GSAP entry point (registers ScrollTrigger once)
  geometry.ts        Vec3, normalizePoints, buildBackboneGeometry, mulberry32
  dna.ts             BASE_COLORS, enzyme/feature palettes, gcPercent, toFasta,
                     digestFragments, gelY, mmRate, doseResponse
  codon.ts           reverseComplement, translate (standard genetic code)
  export.ts          downloadText / downloadCsv (single download implementation)
  tools.ts           ★ THE tool registry — hub cards, TopBar titles and the
                     SideRail all derive from WORKSPACE_TOOLS
  crispr.ts          useSgRnaDesign (submit + poll), CRISPR_TOOLS catalog
  nextflow.ts        usePipelines / useLaunchRun / usePipelineRun / useRuns
  ide.tsx            IdeProvider/useIde — IDE tab state, hash-routed (#dna)
  resources.ts       Resource registry types + parseFileToResources (the one
                     import pipeline: bio-parsers → viewer state / dataframe)
  dataframe.ts       parseDataframe (CSV/TSV, quote-aware, capped)
  dag.ts             buildDagPayload (canvas → POST /dag/runs) · useDagRun
                     (EventSource + seq-dedupe + polling fallback) · useDagRuns
  dagContext.tsx     DagRunsProvider — one shared poll for TopBar + sidebar

components/workspace/
  ide/               OverviewTab (the former hub content, hash-linked cards)
  shell/             SideRail (hash links into the IDE) · TopBar (active-tab
                     title + run chip) · ToolTabs (keep-alive tab strip) ·
                     ResourceSidebar (global resources, file-drop target,
                     draggable rows, DAG-runs section) · SplitPane · ToolScroll
                     · HealthChip
  panels/            Panel (chrome) · PanelBoundary (error boundary) ·
                     PanelSkeleton (loading) · ScoreCard/ScoreRow · StatTile ★
  sequence/          SequenceTrack · PlddtStrip · PlddtLegend ★
  charts/            LineChart (SVG engine) · PlddtChart · WritheChart · PaeHeatmap
  tracks/            FeatureTrack ★ (shared Gantt math: regionLeft/Width/Slice)
  dna/               LinearMap (dual strand + ORFs) · CircularMap (SVG plasmid)
                     · SeqVizViewer · FileDropzone (→ parseFileToResources)
  comparative/       AlignmentViewer · DomainTrack · OrthologCard · MsaPanel ·
                     alignmentStyle ★ (shared match/mismatch/gap contract)
  variants/          ConsensusMeter
  crispr/            CrisprToolSwitcher · PamTrack · SgRnaTable · OffTargetList ·
                     CrisprGateWizard
  pipelines/         PipelineCard · WorkflowStepList · PipelineLogViewer
  interactions/      DockingPanel · SolventPanel · UnfoldingViewer
  lab/               GelSimulation · KineticsPanel · MmParticleSim ·
                     DenaturationPanel · DoseResponsePanel

components/flows/
  FlowCanvas.tsx     controlled React Flow canvas — input/tool/compute nodes,
                     status badges, palette/resource/OS-file drops
  RunMonitor.tsx     live run panel (node chips, pipeline steps, event log)
  (antigravity/ bits/ three/ landing/ — unchanged)

app/workspace/
  layout.tsx         Benchling shell: ClinicalBackdrop + SideRail +
                     ResourceSidebar + TopBar, wrapped in WorkspaceProvider ·
                     IdeProvider · DagRunsProvider
  page.tsx           ★ the unified IDE — every tool is a lazy keep-alive tab
                     (mounted once, display:none when inactive; hash-routed
                     via lib/ide.tsx). Split view renders dna + flows
                     side-by-side in SplitPane. OverviewTab holds the former
                     hub content. Legacy /workspace/<tool> routes stay live.
  structure/         3D flagship: TabBar + SplitPane + synced panel stack
  dna/               linear/circular maps, toolbar, status bar
  flows/             ★ node library + inspector + RunMonitor; "Run workflow"
                     serializes the canvas to POST /dag/runs and renders SSE
                     events as per-node badges
  crispr/            ★ target input + tool tabs → PamTrack + table + off-targets
                     + CRISPR-GATE knockout wizard
  pipelines/         ★ template catalog + live run monitor (steps + log tail)
  interactions/ comparative/ variants/ lab/
```

★ = created or deduplicated in this refactor.

## 1b. The DAG execution loop (frontend → backend)

`lib/dag.ts buildDagPayload` resolves the canvas (resource ids → inline
payloads; live sequence → current selection) into the POST /dag/runs
payload, with per-node client-side validation. The FastAPI engine
(`backend/app/services/dag.py`) validates fail-closed (Kahn cycle check,
sequence-producing predecessors), executes topologically on a dedicated
worker loop — tool nodes call `services/crispr.scan_guides` off the event
loop, compute nodes drive `services/nextflow` — and streams JSON events
(replay-then-live SSE on `GET /dag/runs/{id}/stream`). `useDagRun`
consumes the stream with per-event seq-dedupe and a polling fallback.
Everything is `source: "demo"` until the upstream adapters
(CHOPCHOP / CRISPR-P / Tower) are configured.

## 1c. The Benchling-style design surface (2026-10-04)

The workspace now follows the Benchling workflow: one connected surface
where editing, annotations, CRISPR design, plasmid assembly, digests and
PROVENANCE live together.

- **Sequence editor + provenance** — `lib/audit.ts` (EditOps, hash-chained
  audit log with a genesis snapshot; `verifyHistory` is a forward replay),
  `components/workspace/dna/SequenceEditor.tsx` (free letter editing,
  50 bp lines + ruler, selection quick-ops, annotate), `HistoryPanel.tsx`
  (verify badge + JSON provenance report export). Store actions:
  `editSequence` / `recordAuditNote` / `annotateSelection` in
  `lib/workspaceStore.tsx`; `revision` on WorkspaceSequence is the seqviz
  remount key. Client-side enzyme scanning in `lib/enzymes.ts` (classic
  maps derive from the store via `viewerToRegistry` — never stale).
- **Plasmid builder** — `lib/plasmid.ts` (blueprint part lists: gRNA/U6,
  T7 IVT, custom; real published part sequences), `PlasmidBuilder.tsx`
  (edit any part → assemble → insert/replace/new → audit + resource),
  `DigestPanel.tsx` + `GelSimulation.tsx` (moved from the retired lab) —
  digests verify the EDITED sequence and record into the audit log.
- **CRISPR is editable and feeds plasmid design** — SgRnaTable exclusion
  checkboxes, manual guide entry (score rendered "manual", never
  fabricated), "Design plasmid with this guide" → pending guide →
  PlasmidBuilder spacer prefill.
- **Interactions** — one shared ProteinPicker (PDB or UniProt/AlphaFold)
  + 8 solvent models with per-solvent geometry parameters (seed /
  core_attack / collapse / dcm_dt / axis) in
  `backend/app/services/biophysics.py`; `UnfoldingViewer` is fully
  parameterized — different solvents unfold the same protein differently.
- **Comparative** — fixed ortholog dashboard removed; search (new
  `GET /comparative/search`) + FASTA paste → on-demand pairwise (local
  Needleman–Wunsch) and MSA (Clustal job, shared `lib/msa.ts`
  `useMsaJob`; `MsaPanel` refactored onto it).
- **Variants** — `POST /variants/scan` all-substitutions job
  (`backend/app/services/variantscan.py`, worker-loop executed):
  pLDDT from one model fetch, AlphaMissense per position (per-position
  degradation), VEP batched ≤20 notations for flagged positions only.
  `lib/variants.ts` polls with partial results; row click renders the
  same four verdict cards (extracted to `components/workspace/variants/
  VariantCards.tsx`).
- **Lab retired** — removed from `WORKSPACE_TOOLS`/`WorkspaceTabId`;
  route + files stay dormant; its gel lives on in the DNA Digest panel.

## 2. What was merged (the old → new map)

The seven flat `components/workspace/*.tsx` files were moved into their
domain folders and deduplicated:

| Old path | New path | Changed |
|---|---|---|
| `AlignmentViewer.tsx` | `comparative/AlignmentViewer.tsx` | colors come from shared `alignmentStyle` |
| `ConsensusMeter.tsx` | `variants/ConsensusMeter.tsx` | unchanged logic |
| `DomainTrack.tsx` | `comparative/DomainTrack.tsx` | position math from `tracks/FeatureTrack` |
| `HealthChip.tsx` | `shell/HealthChip.tsx` | unchanged |
| `OrthologCard.tsx` | `comparative/OrthologCard.tsx` | unchanged |
| `PlddtStrip.tsx` | `sequence/PlddtStrip.tsx` | legend from shared `PlddtLegend` |
| `ScoreCard.tsx` | `panels/ScoreCard.tsx` | unchanged |

Logic that existed in 2–3 copies is now a single implementation:

- **pLDDT band legend** — `sequence/PlddtLegend` replaces the hand-rolled
  chips in PlddtStrip, the 3D viewer overlay and the chart tooltips.
- **Match/mismatch/gap colors** — `comparative/alignmentStyle` is the one
  contract; both the pairwise viewer and the MSA panel read it.
- **Track math** — `tracks/FeatureTrack.regionLeft/Width/Slice` is used by
  DomainTrack, the DNA feature strip and the CRISPR PAM track.
- **KPI tiles** — `panels/StatTile` (with a `dense` variant) replaces the
  hub's, comparative's and structure's hand-rolled stat blocks.
- **Tool registry** — `lib/tools.ts` is the single source for the hub
  cards, TopBar titles and SideRail navigation (previously 3 hard-coded lists).
- **File downloads** — `lib/export.downloadText/downloadCsv` replaces the
  ad-hoc blob/anchor code in the PAE heatmap, the FASTA button and the lab.
- **Missing `lib/` layer** — created in full: the previous components
  imported `@/lib/*` (api, validation, format, types, persistence, dna,
  codon, motion, export, gsap, geometry) but the directory did not exist.

## 3. Contracts a new panel must satisfy

1. **Panel chrome**: `Panel title note actions` + body wrapped in
   `PanelBoundary` (crash → designed fallback, never a white page).
2. **Data**: every fetch goes through `apiValidated(path, ZodSchema)` —
   a malformed payload becomes a thrown Error, never an undefined access.
3. **Loading**: `PanelSkeleton variant` (viewer/chart/sequence/heatmap/stats).
4. **Colors**: from `lib/format`/`lib/dna` scales only, always paired with
   a label (the "never color-alone" rule).
5. **Persistence**: `usePersistentState` with a validator — localStorage
   is untrusted input.
6. **Motion**: `usePrefersReducedMotion` gates anything animated; no
   transition faster than 300 ms.
7. **XSS**: labels render as React text nodes — never
   `dangerouslySetInnerHTML`, never markup built from data.

## 4. Notes

- The frontend imports `@/lib/*` paths; the tsconfig alias must map
  `@/*` → repo root (the repo root currently has no `package.json` /
  `tsconfig.json` — see `CRISPR_NEXTFLOW_INTEGRATION.md` §5 for the
  suggested tooling baseline).
- `lib/validation.ts` is the runtime mirror of `backend/app/routes/`.
  When a backend route changes shape, update both.
