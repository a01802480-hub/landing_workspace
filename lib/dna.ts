/**
 * dna.ts — nucleotide palettes, digest math and the in silico assay models.
 * Pure functions: the DNA workspace, lab panels and CRISPR tracks all share
 * these (same enzyme color in the linear map, circular map and gel lane).
 */

/* ── Palettes ─────────────────────────────────────────────────────────────── */

/** Canonical base colors (Benchling/SnapGene convention). */
export const BASE_COLORS: Record<string, string> = {
  A: "#2e9e4f",
  C: "#3d7dd8",
  G: "#e8a33d",
  T: "#d1495b",
  N: "#898781",
};

const ENZYME_PALETTE = [
  "#2a78d6", "#0e9e7a", "#8e5bd8", "#d17a2a", "#b04a8e",
  "#3a8fc4", "#5f7f3a", "#c94f4f", "#3987e5", "#9085e9",
] as const;

const FEATURE_PALETTE = [
  "#2a78d6", "#0e9e7a", "#8e5bd8", "#d17a2a", "#b04a8e",
  "#3a8fc4", "#5f7f3a", "#c94f4f",
] as const;

/** Deterministic color per enzyme name (stable across pages/restarts). */
export function enzymeColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ENZYME_PALETTE[h % ENZYME_PALETTE.length];
}

/** Categorical color by feature index (fixed order, not color-alone). */
export function featureColor(index: number): string {
  return FEATURE_PALETTE[index % FEATURE_PALETTE.length];
}

/* ── Sequence helpers ─────────────────────────────────────────────────────── */

/** GC content of a nucleotide sequence, 0–100. */
export function gcPercent(seq: string): number {
  const clean = seq.toUpperCase();
  if (clean.length === 0) return 0;
  let gc = 0;
  for (const b of clean) if (b === "G" || b === "C") gc++;
  return (gc / clean.length) * 100;
}

/** FASTA serialization of a registry record (80-char wrapped sequence). */
export function toFasta(registry: { accession: string; name: string; sequence: string }): string {
  const header = `>${registry.accession} ${registry.name}`.trim();
  const chunks: string[] = [];
  for (let i = 0; i < registry.sequence.length; i += 80) chunks.push(registry.sequence.slice(i, i + 80));
  return `${header}\n${chunks.join("\n")}`;
}

/* ── Restriction digest ───────────────────────────────────────────────────── */

/**
 * Fragment sizes for a digest. `cuts` are 0-based positions; circular
 * topologies produce the wrap-around fragment and linear ones the flanking
 * pieces. Sorted descending (migration order on the gel).
 */
export function digestFragments(length: number, cuts: number[], topology: string): number[] {
  const sorted = [...new Set(cuts)].filter((c) => Number.isInteger(c) && c >= 0 && c < length).sort((a, b) => a - b);
  if (sorted.length === 0) return [length];
  const circular = topology.toLowerCase() === "circular";
  const fragments: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : circular ? sorted[0] + length : length;
    const size = next - sorted[i];
    if (size > 0) fragments.push(size);
  }
  if (!circular && sorted[0] > 0) fragments.push(sorted[0]);
  return fragments.sort((a, b) => b - a);
}

/* ── Agarose gel model ────────────────────────────────────────────────────── */

const GEL_WELL = 30;

/**
 * Absolute SVG y of a fragment band: migration ∝ log(size), normalized so
 * the largest ladder band (10 kb) sits just under the well and 1 bp sits at
 * the lane floor. `laneH` is the lane body height, `maxKb` the scale ceiling.
 */
export function gelY(size: number, laneH: number, maxKb: number): number {
  const t = Math.log10(Math.max(1, size)) / Math.log10(Math.max(2, maxKb) * 1000);
  return GEL_WELL + laneH * (1 - Math.min(1, Math.max(0, t)));
}

/* ── Assay models (in silico lab) ─────────────────────────────────────────── */

/** Michaelis–Menten rate: v = Vmax·[S] / (Km + [S]). */
export function mmRate(substrate: number, vmax: number, km: number): number {
  return (vmax * substrate) / (km + substrate);
}

/** Four-parameter logistic dose–response (top/bottom plateau). */
export function doseResponse(
  dose: number,
  bottom: number,
  top: number,
  ec50: number,
  hill: number,
): number {
  return bottom + (top - bottom) / (1 + Math.pow(Math.max(1e-9, ec50) / Math.max(1e-9, dose), hill));
}
