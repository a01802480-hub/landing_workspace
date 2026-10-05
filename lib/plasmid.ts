/**
 * plasmid.ts — plasmid blueprint assembly.
 *
 * A blueprint is an ordered part list; assembly concatenates the parts
 * into one sequence with an annotation per part. The blueprint is the
 * starting point only — every part (and the assembled result) is fully
 * editable, in the builder and then in the workspace sequence editor.
 * Assembly goes through store.editSequence, so it lands in the audit log
 * as a replayable op.
 */
import { annotationColor, type ViewerAnnotation, type ViewerFeature } from "./sequences";
import { storageRead, storageWrite } from "./persistence";

export interface PlasmidPart {
  id: string;
  name: string;
  role: "backbone" | "promoter" | "spacer" | "scaffold" | "terminator" | "insert" | "custom";
  seq: string;
  note?: string;
  locked?: boolean;
}

export interface PlasmidBlueprint {
  id: string;
  name: string;
  description: string;
  circular: boolean;
  /** Assembly order = array order. */
  parts: PlasmidPart[];
}

/** Real published sequences where known (pX330 U6, chimeric sgRNA
 *  scaffold, T7, SV40 polyA) — no placeholders pretending to be parts. */
const U6_PROMOTER =
  "GAGGGCCTATTTCCCATGATTCCTTCATATTTGCATATACGATACAAGGCTGTTAGAGAGATAATTAGAATTAATTTGACTGTAAACACAAAGATATTAGTACAAAATACGTGACGTAGAAAGTAATAATTTCTTGGGTAGTTTGCAGTTTTAAAATTATGTTTTAAAATGGACTATCATATGCTTACCGTAACTTGAAAGTATTTCGATTTCTTGGCTTTATATATCTTGTGGAAAGGACGAAACACC";
const SGRNA_SCAFFOLD = "GTTTTAGAGCTAGAAATAGCAAGTTAAAATAAGGCTAGTCCGTTATCAACTTGAAAAAGTGGCACCGAGTCGGTGC";
const POLYT = "TTTTTT";
const T7_PROMOTER = "TAATACGACTCACTATAGGG";
const SV40_POLYA =
  "AACTTGTTTATTGCAGCTTATAATGGTTACAAATAAAGCAATAGCATCACAAATTTCACAAATAAAGCATTTTTTTCACTGCATTCTAGTTGTGGTTTGTCCAAACTCATCAATGTATCTTAT";

export const SPACER_SLOT = "NNNNNNNNNNNNNNNNNNNN";

export function blueprintParts(): PlasmidBlueprint[] {
  return [
    {
      id: "grna-u6",
      name: "gRNA expression plasmid (U6)",
      description: "U6 promoter → guide spacer → sgRNA scaffold → polyT terminator. Circular; the backbone part is the current workspace sequence when circular.",
      circular: true,
      parts: [
        {
          id: "backbone",
          name: "backbone",
          role: "backbone",
          seq: "",
          note: "the current workspace sequence (circular) is used as the backbone when available",
        },
        { id: "u6", name: "U6 promoter", role: "promoter", seq: U6_PROMOTER, locked: true },
        {
          id: "spacer",
          name: "guide spacer",
          role: "spacer",
          seq: SPACER_SLOT,
          note: "20-nt guide spacer — replace with the CRISPR result or type it",
        },
        { id: "scaffold", name: "sgRNA scaffold", role: "scaffold", seq: SGRNA_SCAFFOLD, locked: true },
        { id: "polyt", name: "polyT terminator", role: "terminator", seq: POLYT, locked: true },
      ],
    },
    {
      id: "t7-ivt",
      name: "T7 IVT template",
      description: "T7 promoter → insert → SV40 polyA. Linear template for in vitro transcription.",
      circular: false,
      parts: [
        { id: "t7", name: "T7 promoter", role: "promoter", seq: T7_PROMOTER, locked: true },
        {
          id: "insert",
          name: "insert",
          role: "insert",
          seq: "",
          note: "paste the sequence to transcribe (or leave empty and type it)",
        },
        { id: "sv40", name: "SV40 polyA", role: "terminator", seq: SV40_POLYA, locked: true },
      ],
    },
    {
      id: "custom",
      name: "Custom ordered assembly",
      description: "An empty ordered part list — add parts from the resource sidebar, the current selection, or paste them.",
      circular: true,
      parts: [],
    },
  ];
}

export function makePart(id: string, name: string, seq: string, note?: string): PlasmidPart {
  return { id, name, role: "custom", seq: seq.replace(/\s+/g, "").toUpperCase(), note };
}

/** Concatenate parts into a sequence with one annotation per part span. */
export function assembleBlueprint(
  name: string,
  circular: boolean,
  parts: PlasmidPart[],
): { seq: string; annotations: ViewerAnnotation[]; features: ViewerFeature[] } {
  const clean = parts.map((p) => ({ ...p, seq: p.seq.replace(/\s+/g, "").toUpperCase() }));
  const seq = clean.map((p) => p.seq).join("");
  const annotations: ViewerAnnotation[] = [];
  const features: ViewerFeature[] = [];
  let cursor = 0;
  clean.forEach((part, i) => {
    if (!part.seq) return;
    const start = cursor + 1;
    const end = cursor + part.seq.length;
    annotations.push({
      name: part.name || `part ${i + 1}`,
      start,
      end,
      direction: 1,
      color: annotationColor(i),
      type: part.role,
    });
    features.push({
      key: `${part.role}:${start}:${end}:${i}`,
      name: part.name || `part ${i + 1}`,
      type: part.role,
      start,
      end,
      strand: 1,
      color: annotationColor(i),
    });
    cursor = end;
  });
  return { seq, annotations, features };
}

/* ── CRISPR → plasmid handoff ─────────────────────────────────────────────── */

export interface PendingGuide {
  spacer: string;
  pam: string;
  strand: "+" | "-";
  gene: string;
  spacerStart: number;
  spacerEnd: number;
}

const PENDING_KEY = "plasmid:pending-guide";

export function setPendingGuide(g: PendingGuide): void {
  storageWrite(PENDING_KEY, g);
}

export function takePendingGuide(): PendingGuide | null {
  const stored = storageRead<unknown>(PENDING_KEY);
  storageWrite(PENDING_KEY, null);
  if (typeof stored !== "object" || stored === null) return null;
  const v = stored as Partial<PendingGuide>;
  if (typeof v.spacer !== "string" || !/^[ACGTN]{20}$/i.test(v.spacer)) return null;
  return {
    spacer: v.spacer.toUpperCase(),
    pam: typeof v.pam === "string" ? v.pam.slice(0, 10) : "",
    strand: v.strand === "-" ? "-" : "+",
    gene: typeof v.gene === "string" ? v.gene.slice(0, 80) : "",
    spacerStart: typeof v.spacerStart === "number" ? v.spacerStart : 0,
    spacerEnd: typeof v.spacerEnd === "number" ? v.spacerEnd : 0,
  };
}
