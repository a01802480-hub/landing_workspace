/**
 * enzymes.ts — client-side restriction-site scanning (port of the backend
 * `all_sites` semantics) so digests and classic-map enzyme ticks work
 * against the EDITED workspace sequence, not just NCBI accessions.
 *
 * Motif = canonical 5′→3′ recognition sequence; cut = top-strand cleavage
 * offset within the motif. Circular sequences wrap the scan by
 * (longest motif − 1) bases so junction-straddling sites are found and
 * positions are mapped modulo the length.
 */
import { apiValidated } from "./api";
import { DnaEnzymesSchema } from "./validation";

export interface EnzymeDef {
  name: string;
  motif: string;
  cut: number;
}

export interface ScannedSite {
  enzyme: string;
  start: number; // 0-based motif start
  cut: number; // 0-based top-strand cut position (mod length)
  motif: string;
}

let catalog: EnzymeDef[] | null = null;

/** Fetch the enzyme catalog once per session (module-cached). */
export async function loadEnzymeCatalog(): Promise<EnzymeDef[]> {
  if (catalog) return catalog;
  const res = await apiValidated("/dna/enzymes", DnaEnzymesSchema);
  catalog = res.enzymes;
  return catalog;
}

export function scanSites(seq: string, circular: boolean, enzymes: EnzymeDef[]): ScannedSite[] {
  if (enzymes.length === 0) return [];
  const sequence = seq.toUpperCase();
  const longest = Math.max(...enzymes.map((e) => e.motif.length));
  const scan = sequence + (circular ? sequence.slice(0, longest - 1) : "");
  const length = sequence.length;
  const out: ScannedSite[] = [];
  for (const enzyme of enzymes) {
    const motif = enzyme.motif.toUpperCase();
    const seen = new Set<number>();
    for (let i = 0; i <= scan.length - motif.length; i++) {
      if (!scan.startsWith(motif, i)) continue;
      const start = i % length;
      if (seen.has(start)) continue;
      seen.add(start);
      out.push({ enzyme: enzyme.name, start, cut: (start + enzyme.cut) % length, motif });
    }
  }
  return out;
}

/** seqviz-style enzyme ranges (1-based inclusive) per enzyme name. */
export function enzymeRanges(
  seq: string,
  circular: boolean,
  enzymes: EnzymeDef[],
): { name: string; ranges: { start: number; end: number }[] }[] {
  const sites = scanSites(seq, circular, enzymes);
  const byEnzyme = new Map<string, { start: number; end: number }[]>();
  for (const s of sites) {
    const list = byEnzyme.get(s.enzyme) ?? [];
    list.push({ start: s.start + 1, end: s.start + s.motif.length });
    byEnzyme.set(s.enzyme, list);
  }
  return [...byEnzyme.entries()].map(([name, ranges]) => ({ name, ranges }));
}

/** 0-based cut positions for the digest math (lib/dna.digestFragments). */
export function cutsForEnzymes(seq: string, circular: boolean, enzymes: EnzymeDef[], wanted: string[]): number[] {
  const wantedSet = new Set(wanted);
  return scanSites(seq, circular, enzymes)
    .filter((s) => wantedSet.has(s.enzyme))
    .map((s) => s.cut)
    .sort((a, b) => a - b);
}
