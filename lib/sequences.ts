/**
 * sequences.ts — sequence statistics and the bio-parsers adapter.
 *
 * One shared shape flows through the whole workspace ("the viewer state"):
 *
 *   WorkspaceSequence { name, seq, circular, annotations, features, source }
 *
 * - `annotations` are seqviz-style (1-based inclusive, {name,start,end,direction}).
 * - `features` keep the raw rows for the feature table.
 * The DNA canvas (seqviz), the properties sidebar, the feature table, the
 * CRISPR workspace and the flow builder all read this one object from
 * lib/workspaceStore.tsx.
 */

export interface ViewerAnnotation {
  name: string;
  start: number; // 1-based inclusive
  end: number; // 1-based inclusive
  direction: 1 | -1;
  color?: string;
  type?: string;
}

export interface ViewerFeature {
  key: string;
  name: string;
  type: string;
  start: number;
  end: number;
  strand: number;
  product?: string;
  /** Same categorical color the canvas annotation carries. */
  color?: string;
}

export interface WorkspaceSequence {
  name: string;
  seq: string; // uppercase, no whitespace
  circular: boolean;
  annotations: ViewerAnnotation[];
  features: ViewerFeature[];
  enzymes: { name: string; ranges: { start: number; end: number }[] }[];
  source: "backend" | "file" | "demo";
  accession?: string;
}

export interface SequenceSelection {
  start: number; // 1-based inclusive
  end: number; // 1-based inclusive
}

/* ── Statistics ───────────────────────────────────────────────────────────── */

/** GC content of a sequence (or region), 0–100. */
export function gcPercent(seq: string): number {
  const clean = seq.toUpperCase();
  if (!clean.length) return 0;
  let gc = 0;
  for (const b of clean) if (b === "G" || b === "C") gc++;
  return (gc / clean.length) * 100;
}

/** Approximate duplex melting temperature at 0.05 M Na⁺.
 *  Wallace rule below 14 nt; the long-form approximation above. */
export function meltingTemp(seq: string): number {
  const clean = seq.toUpperCase();
  const n = clean.length;
  if (n === 0) return 0;
  const gc = gcPercent(clean);
  if (n < 14) {
    return 64.9 + (41 * (gc * n * 0.01 - 16.4)) / n;
  }
  return 59.9 + 0.41 * gc - 600 / n;
}

/** Slice a 1-based inclusive region out of a sequence. */
export function sliceRegion(seq: string, region: SequenceSelection): string {
  return seq.slice(Math.max(0, region.start - 1), region.end);
}

/* ── Adapters ─────────────────────────────────────────────────────────────── */

export interface SeqVizAnnotation {
  name: string;
  start: number;
  end: number;
  direction: 1 | -1;
  color?: string;
}

const FEATURE_PALETTE = ["#2a78d6", "#0e9e7a", "#8e5bd8", "#d17a2a", "#b04a8e", "#3a8fc4", "#5f7f3a", "#c94f4f"] as const;

/** Categorical color by feature index — same palette as lib/dna.featureColor. */
export function annotationColor(index: number): string {
  return FEATURE_PALETTE[index % FEATURE_PALETTE.length];
}

/**
 * Convert a TeselaGen SequenceData (the @teselagen/bio-parsers output for
 * .gb / .dna / .fa files) into the workspace's viewer state.
 *
 * TeselaGen features are 0-based start-inclusive / end-exclusive; seqviz
 * annotations are 1-based inclusive — the +1 / +0 shift happens here and
 * only here.
 */
export function teselagenToViewer(parsed: {
  name?: string;
  sequence?: string;
  circular?: boolean;
  features?: { name?: string; type?: string; start: number; end: number; strand?: number }[];
  description?: string;
}): WorkspaceSequence {
  const seq = (parsed.sequence ?? "").toUpperCase().replace(/\s+/g, "");
  const annotations: ViewerAnnotation[] = [];
  const features: ViewerFeature[] = [];

  (parsed.features ?? [])
    .filter((f) => f.start !== undefined && f.end !== undefined && f.start < f.end)
    .slice(0, 200)
    .forEach((f, i) => {
      const start = f.start + 1; // 0-based → 1-based inclusive
      const end = f.end; // exclusive end stays the inclusive 1-based end
      const direction: 1 | -1 = f.strand === -1 ? -1 : 1;
      annotations.push({
        name: f.name ?? f.type ?? "feature",
        start,
        end,
        direction,
        color: annotationColor(i),
      });
      features.push({
        key: `${f.type ?? "feature"}:${start}:${end}:${i}`,
        name: f.name ?? f.type ?? "feature",
        type: f.type ?? "feature",
        start,
        end,
        strand: direction,
        color: annotationColor(i),
      });
    });

  return {
    name: parsed.name?.trim() || "Imported sequence",
    seq,
    circular: parsed.circular ?? false,
    annotations,
    features,
    enzymes: [],
    source: "file",
  };
}

/**
 * Convert a backend DnaRegistry payload (lib/validation.ts) into the
 * viewer state. Registry features are 1-based inclusive and already carry
 * strand; sites are 0-based cut positions — both shift once, here.
 */
export function registryToViewer(reg: {
  accession: string;
  name: string;
  length: number;
  topology: string;
  sequence: string;
  features: { type: string; label?: string; product?: string; start: number; end: number; strand: number }[];
  sites: { enzyme: string; start: number; motif: string }[];
}): WorkspaceSequence {
  const annotations: ViewerAnnotation[] = [];
  const features: ViewerFeature[] = [];
  reg.features
    .filter((f) => !["source", "old_sequence"].includes(f.type))
    .slice(0, 200)
    .forEach((f, i) => {
      const direction: 1 | -1 = f.strand === -1 ? -1 : 1;
      annotations.push({
        name: f.label ?? f.type,
        start: f.start,
        end: f.end,
        direction,
        color: annotationColor(i),
        type: f.type,
      });
      features.push({
        key: `${f.type}:${f.start}:${f.end}:${i}`,
        name: f.label ?? f.type,
        type: f.type,
        start: f.start,
        end: f.end,
        strand: f.strand,
        product: f.product,
        color: annotationColor(i),
      });
    });

  // Group cut sites per enzyme into seqviz enzyme ranges (1-based inclusive).
  const byEnzyme = new Map<string, { start: number; end: number }[]>();
  for (const s of reg.sites) {
    const list = byEnzyme.get(s.enzyme) ?? [];
    list.push({ start: s.start + 1, end: s.start + s.motif.length });
    byEnzyme.set(s.enzyme, list);
  }

  return {
    name: reg.name || reg.accession,
    seq: reg.sequence,
    circular: reg.topology.toLowerCase() === "circular",
    annotations,
    features,
    enzymes: [...byEnzyme.entries()].map(([name, ranges]) => ({ name, ranges })),
    source: "backend",
    accession: reg.accession,
  };
}

/**
 * Minimal in-browser FASTA parser (fallback path when the heavy parser is
 * unavailable or for plain-text pastes). Strict: header ids only.
 */
export function fastaToViewer(text: string, name?: string): WorkspaceSequence {
  const lines = text.split(/\r?\n/);
  let header = "";
  const chunks: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(">")) {
      if (!header) header = line.slice(1).trim();
      continue;
    }
    chunks.push(line.replace(/\s+/g, "").toUpperCase());
  }
  const seq = chunks.join("");
  return {
    name: name ?? (header ? header.split(/\s+/)[0] : "Pasted sequence"),
    seq,
    circular: false,
    annotations: [],
    features: [],
    enzymes: [],
    source: "file",
  };
}
