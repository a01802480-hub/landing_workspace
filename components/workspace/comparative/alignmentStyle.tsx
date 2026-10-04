"use client";

/**
 * alignmentStyle — the shared residue coloring contract for alignment
 * surfaces (pairwise AlignmentViewer + MSA panel): one ink for matches,
 * one amber for mismatches, muted for gaps — always shown with a labeled
 * legend so identity is never color-alone.
 */

export const ALIGNMENT_COLORS = {
  match: "#202a44",
  mismatch: "#9a6b00",
  gap: "#a3aec8",
  /** Chip border/text variant of the amber (light-surface contrast). */
  mismatchSoft: "#b07a00",
} as const;

/** The standard match/mismatch/gap legend chip row. */
export function AlignmentLegend() {
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs text-mist/80">
      <span className="chip !py-0.5">match</span>
      <span className="chip !border-[#c98500]/50 !py-0.5 !text-[#9a6b00]">mismatch</span>
      <span className="chip !py-0.5 !text-mist/50">gap</span>
    </span>
  );
}
