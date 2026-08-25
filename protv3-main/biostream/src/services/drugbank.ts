/** DrugBank REST API client — drug data and interactions. */
const BASE = 'http://localhost:8000/drugbank'

export const DrugBankClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async search(q: string, limit = 10) { const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async getDrug(drugId: string) { const r = await fetch(`${BASE}/drug/${drugId}`); return r.json() },
  async getTarget(targetId: string) { const r = await fetch(`${BASE}/target/${targetId}`); return r.json() },
}
