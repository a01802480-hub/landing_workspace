/** Open Targets Platform GraphQL client — target-disease associations. */
const BASE = 'http://localhost:8000/open-targets'

export const OpenTargetsClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async graphql(query: string, variables?: Record<string, unknown>) {
    const r = await fetch(`${BASE}/graphql`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    }); return r.json()
  },
  async getTarget(ensemblId: string) { const r = await fetch(`${BASE}/target/${ensemblId}`); return r.json() },
  async getDisease(efoId: string) { const r = await fetch(`${BASE}/disease/${efoId}`); return r.json() },
  async searchAssociations(target?: string, disease?: string, limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (target) params.set('target', target)
    if (disease) params.set('disease', disease)
    const r = await fetch(`${BASE}/association?${params}`); return r.json()
  },
}
