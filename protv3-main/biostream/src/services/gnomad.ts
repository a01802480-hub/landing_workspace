/** gnomAD REST API client — population variant frequencies and gene constraint. */
const BASE = 'http://localhost:8000/gnomad'

export const gnomADClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async getGene(geneSymbol: string, dataset = 'gnomad_r4') { const r = await fetch(`${BASE}/gene/${geneSymbol}?dataset=${dataset}`); return r.json() },
  async getVariant(variantId: string, dataset = 'gnomad_r4') { const r = await fetch(`${BASE}/variant/${encodeURIComponent(variantId)}?dataset=${dataset}`); return r.json() },
  async getRegion(chrom: string, start: number, stop: number, dataset = 'gnomad_r4') {
    const r = await fetch(`${BASE}/region?chrom=${chrom}&start=${start}&stop=${stop}&dataset=${dataset}`); return r.json()
  },
  async geneCoverage(geneSymbol: string, dataset = 'gnomad_r4') { const r = await fetch(`${BASE}/coverage/${geneSymbol}?dataset=${dataset}`); return r.json() },
}
