"use client";

/**
 * OffTargetList — off-target detail for the selected guide.
 * Honest degradation: without an upstream off-target source the list shows
 * the designed "scan unavailable" state instead of invented loci.
 */
import type { SgRna } from "@/lib/validation";

export function OffTargetList({ guide }: { guide: SgRna | null }) {
  if (!guide) {
    return <p className="px-2 text-sm text-mist/60">Select a guide to inspect its off-targets.</p>;
  }

  if (guide.off_targets.length === 0) {
    const unavailable = guide.efficiency_note?.includes("unavailable");
    return (
      <div className="rounded-lg border border-ink-950/5 bg-ink-950/[0.03] px-4 py-5">
        <p className="text-sm font-medium text-frost/90">
          {unavailable ? "Off-target scan unavailable" : "No off-targets reported"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-mist/70">
          {unavailable
            ? "This guide was ranked by the local scoring core. Connect CHOPCHOP (chopchop_base_url) or CRISPR-P to attach genome-wide specificity data — the workspace never fabricates off-target numbers."
            : "The upstream tool reported zero off-targets at its tolerance for this guide."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {guide.off_targets.map((ot, i) => (
        <li
          key={`${ot.locus}:${i}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-ink-950/5 px-3 py-2 text-xs"
        >
          <span className="min-w-0 truncate font-mono text-[11px] text-frost/90" title={ot.locus}>
            {ot.locus}
          </span>
          <span
            className="chip shrink-0"
            style={{
              borderColor: ot.mismatches <= 2 ? "#0ca30c55" : "#9a6b0055",
              color: ot.mismatches <= 2 ? "#0ca30c" : "#9a6b00",
            }}
          >
            {ot.mismatches} mm
          </span>
        </li>
      ))}
    </ul>
  );
}
