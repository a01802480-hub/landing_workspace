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

components/workspace/
  shell/             SideRail · TopBar · TabBar · SplitPane · ToolScroll · HealthChip
  panels/            Panel (chrome) · PanelBoundary (error boundary) ·
                     PanelSkeleton (loading) · ScoreCard/ScoreRow · StatTile ★
  sequence/          SequenceTrack · PlddtStrip · PlddtLegend ★
  charts/            LineChart (SVG engine) · PlddtChart · WritheChart · PaeHeatmap
  tracks/            FeatureTrack ★ (shared Gantt math: regionLeft/Width/Slice)
  dna/               LinearMap (dual strand + ORFs) · CircularMap (SVG plasmid)
  comparative/       AlignmentViewer · DomainTrack · OrthologCard · MsaPanel ·
                     alignmentStyle ★ (shared match/mismatch/gap contract)
  variants/          ConsensusMeter
  crispr/            CrisprToolSwitcher · PamTrack · SgRnaTable · OffTargetList ·
                     CrisprGateWizard
  pipelines/         PipelineCard · WorkflowStepList · PipelineLogViewer
  interactions/      DockingPanel · SolventPanel · UnfoldingViewer
  lab/               GelSimulation · KineticsPanel · MmParticleSim ·
                     DenaturationPanel · DoseResponsePanel
  (antigravity/ bits/ three/ landing/ — unchanged)

app/workspace/
  layout.tsx         Benchling shell: ClinicalBackdrop + SideRail + TopBar
  page.tsx           hub — KPI StatTiles + tool cards from WORKSPACE_TOOLS
  structure/         3D flagship: TabBar + SplitPane + synced panel stack
  dna/               linear/circular maps, toolbar, status bar
  crispr/            ★ target input + tool tabs → PamTrack + table + off-targets
                     + CRISPR-GATE knockout wizard
  pipelines/         ★ template catalog + live run monitor (steps + log tail)
  interactions/ comparative/ variants/ lab/
```

★ = created or deduplicated in this refactor.

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
