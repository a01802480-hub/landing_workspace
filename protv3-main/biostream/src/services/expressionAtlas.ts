/** Expression Atlas REST API client — gene expression across species/conditions. */
const BASE = 'http://localhost:8000/expression-atlas'

export const ExpressionAtlasClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async search(q: string, species?: string, limit = 10) {
    const params = new URLSearchParams({ q, limit: String(limit) })
    if (species) params.set('species', species)
    const r = await fetch(`${BASE}/search?${params}`); return r.json()
  },
  async listExperiments(species?: string, limit = 10) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (species) params.set('species', species)
    const r = await fetch(`${BASE}/experiments?${params}`); return r.json()
  },
  async getGeneExpression(geneId: string) { const r = await fetch(`${BASE}/gene/${geneId}`); return r.json() },
  async baselineExpression(geneId: string, species = 'homo sapiens') { const r = await fetch(`${BASE}/baseline/${geneId}?species=${encodeURIComponent(species)}`); return r.json() },
}
