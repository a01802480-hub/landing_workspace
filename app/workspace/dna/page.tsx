"use client";

/**
 * DNA workspace — Benchling-style sequence & plasmid maps.
 *
 * Left: dual-stranded linear sequence map (ruler, base-colored strands,
 * restriction cut ticks, ORF translations, drag selection). Right: the
 * interactive circular plasmid map. The two are synchronized in both
 * directions through hover/selection. A top toolbar carries the actions
 * (Copy, FASTA, BLAST, Print/PDF, search, zoom); a persistent bottom
 * status bar reports selection metadata.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { apiValidated } from "@/lib/api";
import { toFasta, gcPercent } from "@/lib/dna";
import { DnaRegistrySchema, type DnaRegistry } from "@/lib/validation";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { SplitPane } from "@/components/workspace/shell/SplitPane";
import { LinearMap, type DnaSelection } from "@/components/workspace/dna/LinearMap";
import { CircularMap } from "@/components/workspace/dna/CircularMap";

const PRESETS = [
  { acc: "J01749", label: "pBR322" },
  { acc: "NC_002013", label: "E. coli K-12 genome (big — slow)" },
];

const ACCESSION_RE = /^[A-Z]{1,4}_?\d{1,6}(\.\d+)?$/;

export default function DnaPage() {
  const [acc, setAcc] = useState("J01749");
  const [registry, setRegistry] = useState<DnaRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(60);
  const [showComplement, setShowComplement] = useState(true);
  const [showOrfs, setShowOrfs] = useState(false);
  const [selection, setSelection] = useState<DnaSelection | null>(null);
  const [hoverBp, setHoverBp] = useState<number | null>(null);
  const [focusBp, setFocusBp] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const booted = useRef(false);

  const load = useCallback(async (accession: string) => {
    const clean = accession.trim().toUpperCase();
    if (!ACCESSION_RE.test(clean)) {
      setFormError(`“${clean}” is not a GenBank accession (e.g. J01749).`);
      return;
    }
    setFormError(null);
    setLoading(true);
    setError(null);
    setSelection(null);
    try {
      setRegistry(await apiValidated(`/dna/registry/${clean}`, DnaRegistrySchema));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the sequence registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void load("J01749");
  }, [load]);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const record = await apiValidated("/dna/ingest", DnaRegistrySchema, {
        method: "POST",
        body: form,
        timeoutMs: 60_000,
      });
      setRegistry(record);
      setSelection(null);
      setAcc(record.accession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse the uploaded file.");
    } finally {
      setUploading(false);
    }
  };

  const jumpTo = (e: React.FormEvent) => {
    e.preventDefault();
    const bp = parseInt(search, 10);
    if (!Number.isInteger(bp) || !registry || bp < 1 || bp > registry.length) return;
    setFocusBp(bp);
    setSelection({ start: bp, end: bp });
  };

  const copySequence = async () => {
    if (!registry) return;
    try {
      await navigator.clipboard.writeText(registry.sequence);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  const downloadFasta = () => {
    if (!registry) return;
    const blob = new Blob([toFasta(registry)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${registry.accession}.fasta`;
    document.body.appendChild(a);
    a.click();
    try {
      document.body.removeChild(a);
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(url);
  };

  const selSeq = registry && selection ? registry.sequence.slice(selection.start - 1, selection.end) : "";

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

          <div className="flex flex-wrap items-center gap-1.5 border-l border-ink-950/10 pl-4" role="radiogroup" aria-label="Zoom level">
            <span className="text-[10px] tracking-wide text-mist/70 uppercase">Zoom</span>
            {[30, 60, 120].map((z) => (
              <button
                key={z}
                role="radio"
                aria-checked={zoom === z}
                onClick={() => setZoom(z)}
                className={`chip transition-colors duration-300 ease-out ${
                  zoom === z ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                }`}
              >
                {z} bp
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 border-l border-ink-950/10 pl-4">
            <button
              type="button"
              role="switch"
              aria-checked={showComplement}
              onClick={() => setShowComplement((v) => !v)}
              className={`chip transition-colors duration-300 ease-out ${showComplement ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"}`}
            >
              Complement
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={showOrfs}
              onClick={() => setShowOrfs((v) => !v)}
              className={`chip transition-colors duration-300 ease-out ${showOrfs ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"}`}
            >
              ORFs
            </button>
            <form onSubmit={jumpTo} className="flex items-center gap-1.5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="bp"
                aria-label="Jump to base position"
                className="glass-panel w-20 px-2 py-1 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
              />
              <button type="submit" className="btn-ghost !px-3 !py-1 text-xs">
                Go
              </button>
            </form>
          </div>

          <div className="flex items-center gap-1.5 border-l border-ink-950/10 pl-4">
            <input
              ref={fileRef}
              type="file"
              accept=".gb,.gbk,.fa,.fasta,.txt"
              onChange={onFileChosen}
              className="hidden"
              aria-label="Upload GenBank or FASTA file"
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost !px-3 !py-1 text-xs">
              {uploading ? "Parsing…" : "Upload .gb / .fa"}
            </button>
            <button type="button" onClick={copySequence} className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1 text-xs">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#0ca30c]" /> Copied
                </>
              ) : (
                "Copy"
              )}
            </button>
            <button type="button" onClick={downloadFasta} className="btn-ghost !px-3 !py-1 text-xs">
              FASTA
            </button>
            {registry && (
              <form action="https://blast.ncbi.nlm.nih.gov/Blast.cgi" method="POST" target="_blank" rel="noreferrer">
                <input type="hidden" name="PROGRAM" value="blastn" />
                <input type="hidden" name="DATABASE" value="nt" />
                <input type="hidden" name="QUERY" value={registry.sequence} />
                <button type="submit" className="btn-ghost !px-3 !py-1 text-xs">
                  BLAST
                </button>
              </form>
            )}
            <button type="button" onClick={() => window.print()} className="btn-ghost !px-3 !py-1 text-xs">
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Split workspace ────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 px-4 py-3">
        {loading && !registry ? (
          <PanelSkeleton variant="viewer" caption="Fetching the GenBank registry…" />
        ) : error && !registry ? (
          <div className="panel-fallback mx-auto max-w-md">
            <span className="panel-fallback-icon" aria-hidden>
              <TriangleAlert className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-medium text-frost">Sequence registry unavailable</p>
            <p className="mt-1 text-xs text-mist/80">{error}</p>
            <button type="button" onClick={() => void load(acc)} className="btn-ghost mt-4 !px-4 !py-1.5 text-xs">
              Retry
            </button>
          </div>
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
                <section className="glass-card flex h-full flex-col overflow-hidden" aria-label="Linear sequence map">
                  <LinearMap
                    registry={registry}
                    zoom={zoom}
                    showComplement={showComplement}
                    showOrfs={showOrfs}
                    selection={selection}
                    hoverBp={hoverBp}
                    focusBp={focusBp}
                    onSelect={setSelection}
                    onHover={setHoverBp}
                  />
                </section>
              </PanelBoundary>
            }
            second={
              <PanelBoundary title="Circular plasmid map" className="h-full">
                <section className="glass-card relative h-full overflow-hidden p-2" aria-label="Circular plasmid map">
                  <CircularMap
                    registry={registry}
                    selection={selection}
                    hoverBp={hoverBp}
                    focusBp={focusBp}
                    onSelect={(sel) => {
                      setSelection(sel);
                      setFocusBp(sel.start);
                    }}
                    onHover={setHoverBp}
                  />
                </section>
              </PanelBoundary>
            }
          />
        ) : null}
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-3">
        <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs">
          <span className="text-mist/70">Selection</span>
          {selection && registry ? (
            <>
              <span className="stat-num font-semibold text-frost">
                {selection.start.toLocaleString()}–{selection.end.toLocaleString()}
              </span>
              <span className="stat-num text-mist/80">{selection.end - selection.start + 1} bp</span>
              <span className="stat-num text-mist/80">GC {gcPercent(selSeq).toFixed(1)}%</span>
              {selSeq.length <= 40 && <span className="truncate font-mono text-[10px] text-mist/60">{selSeq}</span>}
            </>
          ) : (
            <span className="text-mist/60">drag on the linear map or click the circular map</span>
          )}
          <span className="ml-auto text-mist/60">
            {registry ? `${registry.accession} · ${registry.name} · ${registry.topology}` : ""}
          </span>
          <a href="/workspace/lab" className="inline-flex items-center gap-1 text-glow-violet/80 transition-colors duration-300 ease-out hover:text-frost">
            In silico lab <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
