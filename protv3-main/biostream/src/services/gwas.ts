/** GWAS Catalog REST API client — genome-wide association studies. */
const BASE = 'http://localhost:8000/gwas'

export const GWASCatalogClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async searchStudies(params: Record<string, string | number>) {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    const r = await fetch(`${BASE}/studies/search?${qs}`); return r.json()
  },
  async getStudy(studyId: string) { const r = await fetch(`${BASE}/studies/${studyId}`); return r.json() },
  async searchAssociations(params: Record<string, string | number>) {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    const r = await fetch(`${BASE}/associations/search?${qs}`); return r.json()
  },
  async searchVariants(q: string, limit = 10) { const r = await fetch(`${BASE}/variants/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async searchTraits(q: string, limit = 10) { const r = await fetch(`${BASE}/traits/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
}
