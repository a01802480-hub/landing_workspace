"use client";

/**
 * DNA workspace — the Benchling/SnapGene-style sequence canvas.
 *
 * Layout: action toolbar on top; the seqviz canvas in the center (linear /
 * circular / both), the properties sidebar (length · GC · Tm · selection)
 * on the right, and the feature annotation table docked at the bottom.
 *
 * Two sequence sources feed the shared workspace store:
 *  - backend GenBank registry (Entrez fetch, Zod-validated)
 *  - in-browser parsing of .gb / .dna (binary SnapGene) / .fa via
 *    FileDropzone + @teselagen/bio-parsers
 * The store is the single source of truth — seqviz, the classic maps, the
 * properties sidebar, the feature table, the flow builder and the CRISPR
 * tools all read the same sequence + selection.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { apiValidated } from "@/lib/api";
import { downloadText } from "@/lib/export";
import { fmt } from "@/lib/format";
import { gcPercent } from "@/lib/dna";
import { registryToViewer, sliceRegion, meltingTemp } from "@/lib/sequences";
import { DnaRegistrySchema, type DnaRegistry } from "@/lib/validation";
import { useWorkspace } from "@/lib/workspaceStore";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { SplitPane } from "@/components/workspace/shell/SplitPane";
import { LinearMap, type DnaSelection } from "@/components/workspace/dna/LinearMap";
import { CircularMap } from "@/components/workspace/dna/CircularMap";
import { SeqVizViewer } from "@/components/workspace/dna/SeqVizViewer";
import { SequenceProperties } from "@/components/workspace/dna/SequenceProperties";
import { FeatureTable } from "@/components/workspace/dna/FeatureTable";
import { FileDropzone } from "@/components/workspace/dna/FileDropzone";

const PRESETS = [
  { acc: "J01749", label: "pBR322" },
  { acc: "NC_002013", label: "E. coli K-12 genome (big — slow)" },
];

const ACCESSION_RE = /^[A-Z]{1,4}_?\d{1,6}(\.\d+)?$/;

type CanvasMode = "seqviz" | "classic";
type SeqVizMode = "both" | "linear" | "circular";

export default function DnaPage() {
  const { sequence, selection, setSequence, setSelection } = useWorkspace();
  const [acc, setAcc] = useState("J01749");
  const [registry, setRegistry] = useState<DnaRegistry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("seqviz");
  const [seqvizMode, setSeqvizMode] = useState<SeqVizMode>("both");
  const [copied, setCopied] = useState(false);
  const booted = useRef(false);

  const load = useCallback(
    async (accession: string) => {
      const clean = accession.trim().toUpperCase();
      if (!ACCESSION_RE.test(clean)) {
        setFormError(`“${clean}” is not a GenBank accession (e.g. J01749).`);
        return;
      }
      setFormError(null);
      setLoading(true);
      setError(null);
      try {
        const reg = await apiValidated(`/dna/registry/${clean}`, DnaRegistrySchema);
        setRegistry(reg);
        setSequence(registryToViewer(reg));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load the sequence registry.");
      } finally {
        setLoading(false);
      }
    },
    [setSequence],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (!sequence) void load("J01749");
  }, [load, sequence]);

  const copySequence = async () => {
    if (!sequence) return;
    try {
      await navigator.clipboard.writeText(sequence.seq);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  const downloadFasta = () => {
    if (!sequence) return;
    const chunks: string[] = [];
    for (let i = 0; i < sequence.seq.length; i += 80) chunks.push(sequence.seq.slice(i, i + 80));
    downloadText(`${sequence.name.replace(/\s+/g, "_")}.fasta`, `>${sequence.name}\n${chunks.join("\n")}`);
  };

  const selSeq = sequence && selection ? sliceRegion(sequence.seq, selection) : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Action toolbar ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-3">
        <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5" role="toolbar" aria-label="DNA tools">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(acc);
            }}
            className="flex min-w-0 flex-1 flex-col gap-1"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[10px] tracking-wide text-mist/70 uppercase">GenBank</span>
              <input
                value={acc}
                onChange={(e) => {
                  setAcc(e.target.value);
                  setFormError(null);
                }}
                placeholder="e.g. J01749"
                aria-label="GenBank accession"
                className="glass-panel min-w-0 flex-1 px-3 py-1.5 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
              />
              <button type="submit" disabled={loading} className="btn-primary !px-4 !py-1.5 text-xs">
                {loading ? "Loading…" : "Load"}
              </button>
            </div>
            {formError && (
              <p role="alert" className="px-3 text-[11px] text-[#c13b3b]">
                {formError}
              </p>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-1.5 border-l border-ink-950/10 pl-4">
            {PRESETS.map((p) => (
              <button
                key={p.acc}
                type="button"
                onClick={() => {
                  setAcc(p.acc);
                  void load(p.acc);
                }}
                className="chip transition-colors duration-300 ease-out hover:border-glow-violet/40 hover:text-frost"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 border-l border-ink-950/10 pl-4" role="radiogroup" aria-label="Canvas mode">
            <span className="text-[10px] tracking-wide text-mist/70 uppercase">Canvas</span>
            {(["seqviz", "classic"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={canvasMode === m}
                onClick={() => setCanvasMode(m)}
                className={`chip transition-colors duration-300 ease-out ${
                  canvasMode === m ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                }`}
              >
                {m === "seqviz" ? "SeqViz" : "Classic maps"}
              </button>
            ))}
          </div>

          {canvasMode === "seqviz" && (
            <div className="flex items-center gap-1.5 border-l border-ink-950/10 pl-4" role="radiogroup" aria-label="Viewer layout">
              <span className="text-[10px] tracking-wide text-mist/70 uppercase">View</span>
              {(["both", "linear", "circular"] as const).map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={seqvizMode === v}
                  onClick={() => setSeqvizMode(v)}
                  className={`chip transition-colors duration-300 ease-out ${
                    seqvizMode === v ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 border-l border-ink-950/10 pl-4">
            <button type="button" onClick={copySequence} disabled={!sequence} className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1 text-xs disabled:opacity-40">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#0ca30c]" /> Copied
                </>
              ) : (
                "Copy"
              )}
            </button>
            <button type="button" onClick={downloadFasta} disabled={!sequence} className="btn-ghost !px-3 !py-1 text-xs disabled:opacity-40">
              FASTA
            </button>
            {sequence && (
              <form action="https://blast.ncbi.nlm.nih.gov/Blast.cgi" method="POST" target="_blank" rel="noreferrer">
                <input type="hidden" name="PROGRAM" value="blastn" />
                <input type="hidden" name="DATABASE" value="nt" />
                <input type="hidden" name="QUERY" value={sequence.seq} />
                <button type="submit" className="btn-ghost !px-3 !py-1 text-xs">
                  BLAST
                </button>
              </form>
            )}
            <button type="button" onClick={() => window.print()} className="btn-ghost !px-3 !py-1 text-xs">
              PDF
            </button>
          </div>

          <div className="w-full">
            <FileDropzone className="max-w-md" />
          </div>
        </div>
      </div>

      {/* ── Canvas + properties ───────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-3 px-4 py-3">
        <section className="glass-card relative min-h-0 overflow-hidden" aria-label="Sequence canvas">
          {loading && !registry && !sequence ? (
            <PanelSkeleton variant="viewer" caption="Fetching the sequence registry…" />
          ) : error && !registry && !sequence ? (
            <div className="panel-fallback absolute inset-0 m-auto max-w-md">
              <span className="panel-fallback-icon" aria-hidden>
                <TriangleAlert className="h-4.5 w-4.5" />
              </span>
              <p className="text-sm font-medium text-frost">Sequence registry unavailable</p>
              <p className="mt-1 text-xs text-mist/80">{error}</p>
              <button type="button" onClick={() => void load(acc)} className="btn-ghost mt-4 !px-4 !py-1.5 text-xs">
                Retry
              </button>
            </div>
          ) : sequence ? (
            canvasMode === "seqviz" ? (
              <PanelBoundary title="SeqViz canvas" className="h-full">
                <SeqVizViewer
                  name={sequence.name}
                  seq={sequence.seq}
                  annotations={sequence.annotations}
                  enzymes={sequence.enzymes}
                  viewer={seqvizMode}
                  selection={selection}
                  onSelection={setSelection}
                />
              </PanelBoundary>
            ) : registry ? (
              <SplitPane
                direction="row"
                storageKey="dna:split"
                initial={60}
                minFirst={35}
                minSecond={28}
                className="h-full"
                first={
                  <PanelBoundary title="Linear sequence map" className="h-full">
                    <LinearMap
                      registry={registry}
                      zoom={60}
                      showComplement
                      showOrfs
                      selection={selection ? ({ start: selection.start, end: selection.end } satisfies DnaSelection) : null}
                      hoverBp={null}
                      focusBp={null}
                      onSelect={(sel: DnaSelection) => setSelection({ start: sel.start, end: sel.end })}
                      onHover={() => {}}
                    />
                  </PanelBoundary>
                }
                second={
                  <PanelBoundary title="Circular plasmid map" className="h-full">
                    <CircularMap
                      registry={registry}
                      selection={selection ? ({ start: selection.start, end: selection.end } satisfies DnaSelection) : null}
                      hoverBp={null}
                      focusBp={null}
                      onSelect={(sel: DnaSelection) => setSelection({ start: sel.start, end: sel.end })}
                      onHover={() => {}}
                    />
                  </PanelBoundary>
                }
              />
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-sm text-mist/60">
                The classic maps need a backend registry record — load a GenBank accession first.
              </p>
            )
          ) : (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-mist/60">
              Drop a .gb / .dna / .fa file anywhere in the toolbar, or load a GenBank accession.
            </p>
          )}
        </section>

        <aside className="glass-card min-h-0 overflow-hidden">
          <PanelBoundary title="Sequence properties" className="h-full">
            <SequenceProperties />
          </PanelBoundary>
        </aside>
      </div>

      {/* ── Feature table ─────────────────────────────────────────────── */}
      <div className="h-48 shrink-0 px-4">
        <section className="glass-card h-full overflow-hidden px-4 py-3" aria-label="Feature annotations">
          <PanelBoundary title="Feature table" className="h-full">
            <FeatureTable />
          </PanelBoundary>
        </section>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-2 pb-3">
        <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs">
          <span className="text-mist/70">Selection</span>
          {selection && sequence ? (
            <>
              <span className="stat-num font-semibold text-frost">
                {selection.start.toLocaleString()}–{selection.end.toLocaleString()}
              </span>
              <span className="stat-num text-mist/80">{selection.end - selection.start + 1} bp</span>
              <span className="stat-num text-mist/80">GC {gcPercent(selSeq).toFixed(1)}%</span>
              <span className="stat-num text-mist/80">Tm {fmt(meltingTemp(selSeq), 1)} °C</span>
              {selSeq.length <= 40 && <span className="truncate font-mono text-[10px] text-mist/60">{selSeq}</span>}
            </>
          ) : (
            <span className="text-mist/60">click a feature or drag on the map</span>
          )}
          <span className="ml-auto text-mist/60">
            {sequence ? `${sequence.accession ?? sequence.name} · ${sequence.seq.length.toLocaleString()} bp · ${sequence.circular ? "circular" : "linear"} · ${sequence.source}` : ""}
          </span>
          <a href="/workspace/flows" className="inline-flex items-center gap-1 text-glow-violet/80 transition-colors duration-300 ease-out hover:text-frost">
            Flow builder <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
