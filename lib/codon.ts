/**
 * codon.ts — DNA ↔ amino-acid helpers (standard genetic code).
 * Pure functions; the DNA workspace renders ORF translations with these.
 */

const COMPLEMENT: Record<string, string> = {
  A: "T", T: "A", G: "C", C: "G",
  R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K",
  B: "V", V: "B", D: "H", H: "D", N: "N",
};

const CODON_TABLE: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

/** Reverse complement of a nucleotide sequence (unknown bases pass through). */
export function reverseComplement(seq: string): string {
  return seq
    .split("")
    .reverse()
    .map((b) => COMPLEMENT[b.toUpperCase()] ?? b)
    .join("");
}

/**
 * Translate a nucleotide sequence from `offset` (0-based frame) to the end.
 * Unknown/ambiguous codons render as "X"; stop codons as "*".
 */
export function translate(seq: string, offset: number): string {
  const out: string[] = [];
  for (let i = offset; i + 2 < seq.length; i += 3) {
    out.push(CODON_TABLE[seq.slice(i, i + 3).toUpperCase()] ?? "X");
  }
  return out.join("");
}
