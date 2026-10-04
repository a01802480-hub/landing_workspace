# Sequence canvas, browser parsing & the visual pipeline builder

Phase 2 of the workspace architecture (2026-10-03): the seqviz canvas,
universal browser file parsing, the ProtoFlow-style node canvas, and the
frontend → external-tool bridge. Phase 1 (the lib/ layer, deduplication,
CRISPR/Nextflow APIs) is documented in `WORKSPACE_ARCHITECTURE.md` and
`CRISPR_NEXTFLOW_INTEGRATION.md`.

## 1. The shared viewer state (`lib/workspaceStore.tsx`)

One provider (mounted in `app/workspace/layout.tsx`) holds:

```ts
WorkspaceSequence {
  name, seq, circular,
  annotations   // seqviz shape: 1-based inclusive {name,start,end,direction,color}
  features      // raw rows for the feature table
  enzymes       // {name, ranges[]} for seqviz enzyme ticks
  source        // "backend" | "file" | "demo"
}
selection: {start, end} | null      // 1-based inclusive
```

**Every consumer reads this one object**: the seqviz canvas, the classic
maps, the properties sidebar, the feature table, the flow builder's
Sequence Node, and the CRISPR workspace's "Use workspace sequence" button.
A selection made on the map is exactly what a tool node sends upstream —
no page-to-page serialization. The sequence persists to localStorage
(validated on restore, ≤ 100 kb guard).

## 2. seqviz canvas (`components/workspace/dna/SeqVizViewer.tsx`)

- seqviz renders the real maps (annotation rails, enzyme ticks, index
  ruler, circular view) from the store's annotations/enzymes.
- `viewer` modes: `both` (linear + circular, default), `linear`, `circular`.
- `onSelection` updates the shared store; the store's selection highlights
  on the canvas (violet, labeled).
- Loaded client-side only (`dynamic(..., { ssr: false })`); a load failure
  degrades through the surrounding PanelBoundary — the classic hand-rolled
  maps (LinearMap/CircularMap) remain available via the "Classic maps"
  toolbar toggle, so the workspace never loses its map renderer.

Layout (Benchling/SnapGene-style):
```
toolbar:   GenBank load · presets · canvas toggle · viewer mode · copy/FASTA/BLAST/PDF · dropzone
center:    seqviz canvas
right:     SequenceProperties  (length · GC% · Tm · annotations · selection + "design guides in region")
bottom:    FeatureTable        (sortable, click row → selects region on canvas)
status:    selection metadata · source badge · link to the flow builder
```

## 3. Universal browser parsing (`lib/sequences.ts` + `FileDropzone.tsx`)

`.gb` / `.gbk` / `.dna` (binary SnapGene) / `.fa` / `.fasta` files parse
**in the browser** via `@teselagen/bio-parsers` (universal entry:
`anyToJson` — it dispatches on file extension and reads File objects
itself, ArrayBuffer for binary formats), adapted once by
`teselagenToViewer` (TeselaGen 0-based start/end-exclusive → seqviz
1-based inclusive) and handed to the store. The heavy parser is a dynamic
import — it never loads until a file is dropped. Fallback path: FASTA
parses through the minimal built-in `fastaToViewer` if the library is
unavailable; other formats report a designed error, never a silent failure.
Backend GenBank records flow through the same shape via `registryToViewer`.

## 4. Flow builder (`app/workspace/flows` + `components/flows/`)

ProtoFlow-style canvas on `@xyflow/react`:

- **Sequence Node** (one per canvas) — reads the workspace store; shows
  name/length/topology and the live selection chip.
- **Tool Nodes** — `Run CHOPCHOP`, `Run CRISPR-GATE`, `Run CRISPR-P 2.0`,
  `Nextflow Pipeline` — each with typed params edited in the inspector.
- Palette items drag onto the canvas (`dataTransfer` MIME
  `application/protheon-flow`); edges connect sequence → tools
  (`animated` by default). Canvas persists to localStorage, shape-guarded.
- **Run semantics**: tool nodes navigate to their workspace carrying the
  store's selection in the URL —
  `/workspace/crispr?tool=chopchop&start=…&end=…` or
  `/workspace/pipelines?run=<pipeline>`. The target page applies the
  prefill once (Suspense-wrapped search-param reader) — launch stays a
  human action.

## 5. The frontend → backend bridge (objective 5)

Two complementary paths deliver selected regions to external tools:

1. **Client-sliced** (default UI path): the store's selection is sliced
   client-side (`sliceRegion`) and POSTed as the design `sequence` — used
   by the CRISPR page's "Use workspace sequence" and the flow builder.
2. **Server-sliced** (API-level): `POST /api/crispr/design` accepts
   optional `region_start` / `region_end` (1-based inclusive). The backend
   validates (both present, end ≥ start, within sequence, ≥ 80 nt → 422
   fail-closed) and scans only the slice; guide coordinates in results are
   region-relative. Covered by `test_design_region_bridge`.

Nextflow receives regions as string params (`guides`, `target`, any
region text) via `POST /api/nextflow/runs {pipeline, params}` — the same
pass-through the knockout wizard and the flow builder already use.

## 6. Tooling baseline (created in this phase)

`package.json` (next 16 · react 19 · zod · lucide · gsap · three/R3F ·
3dmol · seqviz · @teselagen/bio-parsers · @xyflow/react), `tsconfig.json`
(`@/*` → root), `next.config.mjs` (static export for Cloudflare Pages,
`transpilePackages: ["3dmol"]`), `postcss.config.mjs` (Tailwind v4), and
the missing `@theme` color tokens in `app/globals.css` (`frost`, `mist`,
`ink-950`, `glow-violet`, `glow-cyan` — the classes every component was
already using had no definition anywhere).

Run: `npm install && npm run dev` (frontend, :3000) +
`python -m uvicorn app.main:app --port 8000` (backend).
