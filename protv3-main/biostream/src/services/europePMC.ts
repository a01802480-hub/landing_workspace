/** Europe PMC REST API client — biomedical literature with annotations. */
const BASE = 'http://localhost:8000/europe-pmc'

export const EuropePMCClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async search(query: string, resultType = 'core', limit = 10, page = 1) {
    const r = await fetch(`${BASE}/search?query=${encodeURIComponent(query)}&result_type=${resultType}&limit=${limit}&page=${page}`); return r.json()
  },
  async getArticle(pmid: string) { const r = await fetch(`${BASE}/article/${pmid}`); return r.json() },
  async getCitations(pmid: string, limit = 10) { const r = await fetch(`${BASE}/citations/${pmid}?limit=${limit}`); return r.json() },
  async getReferences(pmid: string, limit = 10) { const r = await fetch(`${BASE}/references/${pmid}?limit=${limit}`); return r.json() },
  async getDataLinks(pmid: string) { const r = await fetch(`${BASE}/datalinks/${pmid}`); return r.json() },
}
