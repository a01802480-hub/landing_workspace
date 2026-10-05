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
import { setPendingGuide } from "@/lib/plasmid";
import { useIde } from "@/lib/ide";
import type { SgRna } from "@/lib/validation";
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
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manualGuides, setManualGuides] = useState<SgRna[]>([]);
  const [mSpacer, setMSpacer] = useState("");
  const [mPam, setMPam] = useState("NGG");
  const [mStart, setMStart] = useState("");
  const [mEnd, setMEnd] = useState("");
  const [mStrand, setMStrand] = useState<"+" | "-">("+");
  const [manualError, setManualError] = useState<string | null>(null);
  const { selectTab } = useIde();
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
  const allGuides = useMemo(() => [...(results ?? []), ...manualGuides], [results, manualGuides]);
  const activeGuides = useMemo(() => allGuides.filter((g) => !excludedIds.has(g.id)), [allGuides, excludedIds]);
  const selectedGuide = useMemo(
    () => allGuides.find((g) => g.id === selectedId) ?? null,
    [allGuides, selectedId],
  );

  const toggleExcluded = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addManualGuide = () => {
    const spacer = mSpacer.replace(/\s+/g, "").toUpperCase();
    const start = parseInt(mStart, 10);
    const end = parseInt(mEnd, 10);
    setManualError(null);
    if (!/^[ACGT]{20}$/.test(spacer)) {
      setManualError("The spacer must be exactly 20 nt of A/C/G/T.");
      return;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end > sequence.length || start > end) {
      setManualError(`Positions must be 1–${sequence.length.toLocaleString()} with start ≤ end.`);
      return;
    }
    if (manualGuides.some((g) => g.sequence === spacer)) {
      setManualError("That spacer is already in the list.");
      return;
    }
    setManualGuides((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        sequence: spacer,
        pam: mPam.trim().toUpperCase().slice(0, 10) || "NGG",
        start,
        end,
        strand: mStrand,
        gc: Math.round(((spacer.match(/[GC]/g)?.length ?? 0) / 20) * 100),
        on_target_score: -1, // manual — the UI renders "manual", never a fabricated score
        off_target_count: 0,
        off_targets: [],
        efficiency_note: "manually entered — upstream scoring not run",
      },
    ]);
    setMSpacer("");
    setMStart("");
    setMEnd("");
  };

  const designPlasmid = () => {
    if (!selectedGuide) return;
    setPendingGuide({
      spacer: selectedGuide.sequence,
      pam: selectedGuide.pam,
      strand: selectedGuide.strand === "-" ? "-" : "+",
      gene: geneLabel.trim(),
      spacerStart: selectedGuide.start,
      spacerEnd: selectedGuide.end,
    });
    selectTab("dna");
  };

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
                guides={activeGuides}
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
                  guides={allGuides}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  hoverId={hoverId}
                  onHover={setHoverId}
                  excludedIds={excludedIds}
                  onToggleExcluded={toggleExcluded}
                />
              </PanelBoundary>
            </Panel>

            <Panel title="Off-targets" note={selectedGuide ? `guide #${selectedGuide.id.split("-").pop()}` : undefined} bodyClassName="p-4">
              <PanelBoundary title="Off-target detail" className="h-full">
                <OffTargetList guide={selectedGuide} />
              </PanelBoundary>
            </Panel>
          </div>

          {/* Guide actions: exclude/reset, manual entry, plasmid handoff */}
          <Panel title="Guide actions" note="edit the result set — then design the plasmid" className="mt-6" bodyClassName="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip !py-0.5 text-[9px]">
                {excludedIds.size} excluded · {activeGuides.length} active
              </span>
              {excludedIds.size > 0 && (
                <button type="button" onClick={() => setExcludedIds(new Set())} className="btn-ghost !px-2.5 !py-1 text-[10px]">
                  reset exclusions
                </button>
              )}
              <button
                type="button"
                onClick={designPlasmid}
                disabled={!selectedGuide || excludedIds.has(selectedGuide.id)}
                className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px] disabled:opacity-40"
              >
                Design plasmid with this guide
              </button>
              {selectedGuide && (
                <span className="stat-num ml-auto font-mono text-[10px] text-mist/70">
                  {selectedGuide.sequence} {selectedGuide.pam} · {selectedGuide.start}–{selectedGuide.end} ({selectedGuide.strand})
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-950/5 pt-3">
              <label className="flex flex-col gap-1">
                <span className="text-[9px] tracking-wide text-mist/60 uppercase">spacer (20 nt)</span>
                <input value={mSpacer} onChange={(e) => setMSpacer(e.target.value)} aria-label="Manual spacer"
                  className="glass-panel w-44 px-2 py-1.5 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] tracking-wide text-mist/60 uppercase">PAM</span>
                <input value={mPam} onChange={(e) => setMPam(e.target.value)} aria-label="Manual PAM"
                  className="glass-panel w-16 px-2 py-1.5 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] tracking-wide text-mist/60 uppercase">start</span>
                <input value={mStart} onChange={(e) => setMStart(e.target.value.replace(/[^0-9]/g, ""))} aria-label="Manual start"
                  className="glass-panel w-20 px-2 py-1.5 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] tracking-wide text-mist/60 uppercase">end</span>
                <input value={mEnd} onChange={(e) => setMEnd(e.target.value.replace(/[^0-9]/g, ""))} aria-label="Manual end"
                  className="glass-panel w-20 px-2 py-1.5 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] tracking-wide text-mist/60 uppercase">strand</span>
                <select value={mStrand} onChange={(e) => setMStrand(e.target.value === "-" ? "-" : "+")} aria-label="Manual strand"
                  className="glass-panel px-2 py-1.5 text-xs text-frost focus:border-glow-violet/50 focus:outline-none">
                  <option value="+">+</option>
                  <option value="-">−</option>
                </select>
              </label>
              <button type="button" onClick={addManualGuide} disabled={sequence.length === 0}
                className="btn-ghost !px-3 !py-1.5 text-[11px] disabled:opacity-40">
                + add guide
              </button>
            </div>
            {manualError && <p role="alert" className="mt-2 text-[10px] text-[#c13b3b]">{manualError}</p>}
          </Panel>

          {tool === "crispr_gate" && (
            <Panel title="CRISPR-GATE knockout plan" note="choose a guide → confirm → Nextflow" className="mt-6" bodyClassName="p-4">
              <PanelBoundary title="Knockout wizard" className="h-full">
                <CrisprGateWizard
                  guides={activeGuides}
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
 *  into the page — once per distinct parameter signature, so the
 *  keep-alive IDE tab re-fires when a new run targets it. */
function PrefillReader({
  onPrefill,
}: {
  onPrefill: (tool: string | null, start: string | null, end: string | null) => void;
}) {
  const search = useSearchParams();
  const last = useRef<string>("");

  useEffect(() => {
    const tool = search.get("tool");
    const start = search.get("start");
    const end = search.get("end");
    if (!tool && !start && !end) return;
    const key = `${tool}|${start}|${end}`;
    if (last.current === key) return;
    last.current = key;
    onPrefill(tool, start, end);
  }, [search, onPrefill]);

  return null;
}
