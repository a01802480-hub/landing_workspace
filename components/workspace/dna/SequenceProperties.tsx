"use client";

/**
 * SequenceProperties — the Benchling-style properties sidebar.
 * Reads the shared workspace store: length, GC content, melting
 * temperature (whole sequence + selected region), topology and source.
 * The selected region carries a direct "send to CRISPR" action — the
 * frontend → external-tool bridge in one click.
 */
import Link from "next/link";
import { Scissors } from "lucide-react";
import { fmt } from "@/lib/format";
import { gcPercent, meltingTemp, sliceRegion } from "@/lib/sequences";
import { useIde } from "@/lib/ide";
import { useWorkspace } from "@/lib/workspaceStore";

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-950/5 py-2 last:border-0">
      <dt className="shrink-0 text-[10px] tracking-wide text-mist/70 uppercase">{label}</dt>
      <dd className={`text-right text-xs text-frost/90 ${mono ? "stat-num" : ""}`}>{value}</dd>
    </div>
  );
}

export function SequenceProperties() {
  const { sequence, selection, setSelection } = useWorkspace();
  const { selectTab } = useIde();

  if (!sequence) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm leading-relaxed text-mist/70">
          No sequence loaded. Upload a .gb / .dna file, or load one from the toolbar.
        </p>
      </div>
    );
  }

  const region = selection ? sliceRegion(sequence.seq, selection) : "";
  const showRegion = selection && region.length > 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-2">
        <p className="truncate text-sm font-semibold text-frost" title={sequence.name}>
          {sequence.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-mist/70">
          <span className="chip !py-0.5">{sequence.circular ? "circular" : "linear"}</span>
          <span className="chip !py-0.5">{sequence.source}</span>
          {sequence.accession && <span className="stat-num">{sequence.accession}</span>}
        </p>
        {sequence.description && (
          <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-mist/70" title={sequence.description}>
            {sequence.description}
          </p>
        )}
      </div>

      <dl>
        <Row label="Length" value={`${sequence.seq.length.toLocaleString()} bp`} />
        <Row label="GC content" value={`${fmt(gcPercent(sequence.seq), 1)}%`} />
        <Row label="Melting temp" value={`${fmt(meltingTemp(sequence.seq), 1)} °C`} />
        <Row label="Annotations" value={String(sequence.annotations.length)} />
        <Row label="Enzyme sites" value={String(sequence.enzymes.length)} />
      </dl>

      <div className="mt-4 rounded-lg border border-ink-950/5 bg-ink-950/[0.03] p-3">
        <p className="text-[10px] tracking-[0.16em] text-mist/60 uppercase">Selection</p>
        {showRegion ? (
          <>
            <p className="stat-num mt-1.5 text-sm font-semibold text-frost">
              {selection!.start.toLocaleString()}–{selection!.end.toLocaleString()}
            </p>
            <dl className="mt-1">
              <Row label="Region" value={`${region.length} bp`} />
              <Row label="GC" value={`${fmt(gcPercent(region), 1)}%`} />
              <Row label="Tm" value={`${fmt(meltingTemp(region), 1)} °C`} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={{
                  pathname: "/workspace",
                  query: { from: "viewer", start: String(selection!.start), end: String(selection!.end) },
                  hash: "#crispr",
                }}
                scroll={false}
                onClick={() => selectTab("crispr")}
                className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px]"
              >
                <Scissors className="h-3 w-3" /> Design guides in region
              </Link>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="btn-ghost !px-3 !py-1.5 text-[11px]"
              >
                Clear
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-mist/70">
            Click a feature or drag on the map to select a region — the selection is what
            CRISPR tools and pipelines receive.
          </p>
        )}
      </div>
    </div>
  );
}
