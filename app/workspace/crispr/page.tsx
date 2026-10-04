"use client";

/**
 * CRISPR workspace — one workflow across three design engines:
 *
 *   CHOPCHOP     general sgRNA design + upstream off-target prediction
 *   CRISPR-GATE  knockout-first ranking + a knockout planning wizard
 *   CRISPR-P 2.0 plant-optimized scoring (U3/U6 windows)
 *
 * Layout: target inputs + tool tabs on top; results as a SnapGene-style
 * guide overview track (PAM ticks per strand, rank labels), the ranked
 * guide table, off-target detail, and — for CRISPR-GATE — the knockout
 * plan that exports to JSON or launches a Nextflow validation pipeline.
 */
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiValidated } from "@/lib/api";
import { useSgRnaDesign, type CrisprTool } from "@/lib/crispr";
import { DnaRegistrySchema, type DnaRegistry } from "@/lib/validation";
import { mulberry32 } from "@/lib/geometry";
import { sliceRegion } from "@/lib/sequences";
import { useWorkspace } from "@/lib/workspaceStore";
import { Panel } from "@/components/workspace/panels/Panel";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { CrisprToolSwitcher } from "@/components/workspace/crispr/CrisprToolSwitcher";
import { PamTrack } from "@/components/workspace/crispr/PamTrack";
import { SgRnaTable } from "@/components/workspace/crispr/SgRnaTable";
import { OffTargetList } from "@/components/workspace/crispr/OffTargetList";
import { CrisprGateWizard } from "@/components/workspace/crispr/CrisprGateWizard";

/** Deterministic synthetic target (seeded) — a 300-nt coding-like stretch
 *  with naturally occurring NGG sites for the demo button. */
function demoSequence(): string {
  const rng = mulberry32(20261003);
  const bases = "ACGT";
  let seq = "ATG";
  while (seq.length < 300) seq += bases[Math.floor(rng() * 4)];
  return seq;
}

export default function CrisprPage() {
  const workspace = useWorkspace();
  const [tool, setTool] = useState<CrisprTool>("crispr_gate");
  const [geneLabel, setGeneLabel] = useState("BRCA1");
  const [organism, setOrganism] = useState("Homo sapiens");
  const [sequence, setSequence] = useState("");
  const [registry, setRegistry] = useState<DnaRegistry | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [workspaceNote, setWorkspaceNote] = useState<string | null>(null);
  const { state, submit } = useSgRnaDesign();

  const busy = state.kind === "running";

  /** Pull the target sequence from the DNA workspace's registry (pBR322 by
   *  default) — the two tools share one sequence source. */
  const fetchFromDna = useCallback(async () => {
    setRegistryError(null);
    try {
      const reg = await apiValidated("/dna/registry/J01749", DnaRegistrySchema);
      setRegistry(reg);
      setSequence(reg.sequence.slice(0, 400));
      setGeneLabel(reg.accession);
    } catch (e) {
      setRegistryError(e instanceof Error ? e.message : "Registry fetch failed.");
    }
  }, []);

  /** The bridge: the shared workspace store's sequence + selection become
   *  the design target — exactly what the flow builder's tool nodes send. */
  const useWorkspaceSequence = useCallback(() => {
    const seq = workspace.sequence?.seq;
    if (!seq) {
      setWorkspaceNote("No sequence in the workspace yet — open the DNA workspace and load or drop a file.");
      return;
    }
    const region = workspace.selection ? sliceRegion(seq, workspace.selection) : seq.slice(0, 10_000);
    setSequence(region.length > 10_000 ? region.slice(0, 10_000) : region);
    setGeneLabel(workspace.sequence?.name ?? geneLabel);
    setWorkspaceNote(
      workspace.selection
        ? `workspace selection ${workspace.selection.start.toLocaleString()}–${workspace.selection.end.toLocaleString()} · ${region.length} nt`
        : `whole workspace sequence (capped at 10,000 nt) · ${region.length} nt`,
    );
  }, [workspace.sequence, workspace.selection, geneLabel]);

  /** Deep-link prefill: ?tool=chopchop&start=…&end=… (from the flow builder
   *  or the DNA properties sidebar). */
  const applyPrefill = useCallback(
    (toolId: string | null, startStr: string | null, endStr: string | null) => {
      if (toolId === "chopchop" || toolId === "crispr_gate" || toolId === "crispr_p") setTool(toolId);
      if (!workspace.sequence?.seq) return;
      const start = startStr ? parseInt(startStr, 10) : NaN;
      const end = endStr ? parseInt(endStr, 10) : NaN;
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        const region = sliceRegion(workspace.sequence.seq, { start, end });
        setSequence(region.slice(0, 10_000));
        setGeneLabel(workspace.sequence.name);
        setWorkspaceNote(`flow-builder selection ${start.toLocaleString()}–${end.toLocaleString()} · ${region.length} nt`);
      }
    },
    [workspace.sequence],
  );

  const run = () => void submit(sequence, tool, geneLabel.trim(), organism.trim());

  const results = state.kind === "done" ? state.results : null;
  const selectedGuide = useMemo(
    () => results?.find((g) => g.id === selectedId) ?? null,
    [results, selectedId],
  );

  return (
    <ToolScroll>
      {/* Query-param prefill (flow builder / DNA sidebar deep links). */}
      <Suspense fallback={null}>
        <PrefillReader onPrefill={applyPrefill} />
      </Suspense>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">CRISPR design</h1>
        <p className="mt-2 max-w-2xl text-mist">
          CHOPCHOP, CRISPR-GATE and CRISPR-P 2.0 in one workflow — PAM-annotated guide
          tracks, ranked guides, off-target detail, and a knockout plan that flows
          straight into a Nextflow pipeline.
        </p>
      </header>

      {/* ── Target & tool ─────────────────────────────────────────────── */}
      <Panel title="Target & tool" note="paste a target sequence or pull one from the DNA workspace" className="mb-6" bodyClassName="p-4">
        <PanelBoundary title="CRISPR target form" className="h-full">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-wide text-mist/60 uppercase">Gene / locus</span>
              <input
                value={geneLabel}
                onChange={(e) => setGeneLabel(e.target.value)}
                className="glass-panel w-40 px-3 py-2 font-mono text-sm text-frost focus:border-glow-violet/50 focus:outline-none"
                aria-label="Gene or locus label"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-wide text-mist/60 uppercase">Organism</span>
              <input
                value={organism}
                onChange={(e) => setOrganism(e.target.value)}
                className="glass-panel w-40 px-3 py-2 font-mono text-sm text-frost focus:border-glow-violet/50 focus:outline-none"
                aria-label="Organism"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSequence(demoSequence())} className="btn-ghost !px-3 !py-2 text-xs">
                Demo target
              </button>
              <button type="button" onClick={fetchFromDna} className="btn-ghost !px-3 !py-2 text-xs">
                From DNA registry
              </button>
              <button
                type="button"
                onClick={useWorkspaceSequence}
                disabled={!workspace.sequence}
                className="btn-ghost !px-3 !py-2 text-xs disabled:opacity-40"
                title="Use the sequence (and selection) currently in the workspace store"
              >
                Use workspace sequence
              </button>
            </div>
          </div>

          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="80–10,000 nt target sequence (A/C/G/T) — the design scan finds NGG guides on both strands."
            aria-label="Target sequence"
            className="glass-panel mt-3 w-full resize-y px-3 py-2 font-mono text-[11px] leading-5 text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
          />
          {registryError && <p className="mt-2 text-xs text-[#c13b3b]">{registryError}</p>}
          {workspaceNote && <p className="mt-2 text-[10px] text-[#0ca30c]">{workspaceNote}</p>}
          {registry && (
            <p className="mt-1 text-[10px] text-mist/60">
              pulled {registry.accession} ({registry.length} bp, first 400 nt) — design runs on this slice
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CrisprToolSwitcher active={tool} onChange={setTool} disabled={busy} />
            <button type="button" onClick={run} disabled={busy || !sequence} className="btn-primary ml-auto !px-4 !py-2 text-xs disabled:opacity-50">
              {busy ? "Designing…" : "Design guides"}
            </button>
          </div>
        </PanelBoundary>
      </Panel>

      {/* ── Running / error states ────────────────────────────────────── */}
      {state.kind === "running" && (
        <div className="glass-panel h-40 p-1">
          <PanelSkeleton variant="sequence" caption="Scanning PAM motifs and ranking guides…" />
        </div>
      )}
      {state.kind === "error" && (
        <div className="glass-panel mb-6 p-4" role="alert">
          <p className="text-sm font-medium text-frost">The design did not complete</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-mist/80">{state.detail}</p>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────── */}
      {results && (
        <>
          <Panel
            title="Guide overview"
            note={`${results.length} guides · ${sequence.length} nt · ${tool}`}
            className="mb-6"
            bodyClassName="p-4"
          >
            <PanelBoundary title="Guide overview track" className="h-full">
              <PamTrack
                sequence={sequence}
                guides={results}
                selectedId={selectedId}
                onSelect={setSelectedId}
                hoverId={hoverId}
                onHover={setHoverId}
              />
            </PanelBoundary>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Ranked guides" note="click a row to inspect" className="lg:col-span-2" bodyClassName="p-4">
              <PanelBoundary title="Guide table" className="h-full">
                <SgRnaTable
                  guides={results}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  hoverId={hoverId}
                  onHover={setHoverId}
                />
              </PanelBoundary>
            </Panel>

            <Panel title="Off-targets" note={selectedGuide ? `guide #${selectedGuide.id.split("-").pop()}` : undefined} bodyClassName="p-4">
              <PanelBoundary title="Off-target detail" className="h-full">
                <OffTargetList guide={selectedGuide} />
              </PanelBoundary>
            </Panel>
          </div>

          {tool === "crispr_gate" && (
            <Panel title="CRISPR-GATE knockout plan" note="choose a guide → confirm → Nextflow" className="mt-6" bodyClassName="p-4">
              <PanelBoundary title="Knockout wizard" className="h-full">
                <CrisprGateWizard
                  guides={results}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  geneLabel={geneLabel}
                  organism={organism}
                  sequenceLength={sequence.length}
                  disabled={busy}
                />
              </PanelBoundary>
            </Panel>
          )}
        </>
      )}
    </ToolScroll>
  );
}

/** Reads ?tool=&start=&end= (from the flow builder or the DNA sidebar)
 *  exactly once, into the page. */
function PrefillReader({
  onPrefill,
}: {
  onPrefill: (tool: string | null, start: string | null, end: string | null) => void;
}) {
  const search = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const tool = search.get("tool");
    const start = search.get("start");
    const end = search.get("end");
    if (!tool && !start && !end) return;
    fired.current = true;
    onPrefill(tool, start, end);
  }, [search, onPrefill]);

  return null;
}
