/**
 * format.ts — shared formatting, status colors and domain color scales.
 *
 * Single source of truth for every color contract in the workspace
 * (the "never color-alone" rule lives here: each scale ships with a
 * label or numeric pair so consumers always render text alongside).
 */

/* ── Status tones ─────────────────────────────────────────────────────────── */

/** Clinical status palette — validated light-mode contrast pairs. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#9a6b00",
  critical: "#c13b3b",
  neutral: "#898781",
} as const;

/* ── Number / string helpers ──────────────────────────────────────────────── */

/** Fixed-digit format that trims trailing zeros: fmt(80.50, 1) → "80.5". */
export function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number(n.toFixed(digits)).toString();
}

/** Split a string into fixed-size chunks (alignment rows, sequence wrap). */
export function chunkString(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

/** "#rrggbb" → [r, g, b] (0–255); used by canvas heatmaps and three.js. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ── pLDDT band scale (canonical AlphaFold colors) ────────────────────────── */

export interface PlddtBand {
  /** The band's ≥ threshold. */
  from: number;
  color: string;
  label: string;
  /** Human-readable range, e.g. "70–90". */
  range: string;
}

export const PLDDT_BANDS: readonly PlddtBand[] = [
  { from: 90, color: "#0053d6", label: "Very high", range: "90–100" },
  { from: 70, color: "#65cbf3", label: "Confident", range: "70–90" },
  { from: 50, color: "#ffdb13", label: "Low", range: "50–70" },
  { from: 0, color: "#ff7d45", label: "Very low", range: "<50" },
];

/** Band for a pLDDT value — the canonical AlphaFold confidence bins. */
export function plddtBand(v: number): PlddtBand {
  return PLDDT_BANDS.find((b) => v >= b.from) ?? PLDDT_BANDS[PLDDT_BANDS.length - 1];
}

/* ── Backbone writhe (diverging violet ↔ blue) ────────────────────────────── */

const WRITHE_NEG: [number, number, number] = [144, 133, 233]; // #9085e9
const WRITHE_ZERO: [number, number, number] = [138, 143, 158];
const WRITHE_POS: [number, number, number] = [57, 135, 229]; // #3987e5

/** Diverging writhe color for CSS consumers. */
export function writheColor(v: number, extent: number): string {
  const [r, g, b] = writheColorRgb(v, extent);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Diverging writhe color as an 0–255 tuple (three.js instanced meshes). */
export function writheColorRgb(v: number, extent: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v / Math.max(0.05, extent)));
  const [a, b] = t < 0 ? [WRITHE_NEG, WRITHE_ZERO] : [WRITHE_ZERO, WRITHE_POS];
  const u = Math.abs(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}

/* ── Domain / annotation categorical slots ────────────────────────────────── */

/** Fixed categorical order — validator-passed slots, light-mode contrast. */
const DOMAIN_SLOTS = [
  "#2a78d6", // domain (blue)
  "#0e9e7a", // family (teal)
  "#8e5bd8", // repeat (violet)
  "#d17a2a", // conserved site (amber)
  "#3a8fc4", // active site (sky)
  "#b04a8e", // binding site (magenta)
  "#5f7f3a", // PTM (olive)
  "#c94f4f", // other (soft red)
] as const;

const OTHER_TYPES = new Set(["other", "unintegrated", "coiled_coil", "signal_peptide", "transmembrane"]);

export function domainColor(type: string): string {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return DOMAIN_SLOTS[h % DOMAIN_SLOTS.length];
}

/** Rare entry types additionally carry a texture in DomainTrack. */
export function domainIsOther(type: string): boolean {
  return OTHER_TYPES.has(type) || type.toLowerCase().includes("other");
}

/* ── Marker accents ───────────────────────────────────────────────────────── */

export const MARKER = {
  /** Catalytic residues — amber, matches the mutation markers. */
  residue: "#c98500",
  /** Metal ions — violet dot with glow. */
  metal: "#6d5ae0",
} as const;
