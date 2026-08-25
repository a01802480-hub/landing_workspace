/** STRING database client — protein-protein interaction networks. */
const BASE = 'http://localhost:8000/string'

export const STRINGClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async network(params: Record<string, string | number>) {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    const r = await fetch(`${BASE}/network?${qs}`); return r.json()
  },
  async interactionPartners(params: Record<string, string | number>) {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    const r = await fetch(`${BASE}/interaction_partners?${qs}`); return r.json()
  },
  async enrichment(identifiers: string, species = 9606) {
    const r = await fetch(`${BASE}/enrichment?identifiers=${encodeURIComponent(identifiers)}&species=${species}`); return r.json()
  },
  async ppiEnrichment(identifiers: string, species = 9606) {
    const r = await fetch(`${BASE}/ppi_enrichment?identifiers=${encodeURIComponent(identifiers)}&species=${species}`); return r.json()
  },
  async functionalAnnotation(identifiers: string, species = 9606) {
    const r = await fetch(`${BASE}/functional_annotation?identifiers=${encodeURIComponent(identifiers)}&species=${species}`); return r.json()
  },
  async homology(identifiers: string, species = 9606) {
    const r = await fetch(`${BASE}/homology?identifiers=${encodeURIComponent(identifiers)}&species=${species}`); return r.json()
  },
}
