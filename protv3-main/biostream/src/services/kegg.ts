/** KEGG REST API client — pathways, metabolism, compounds. */
const BASE = 'http://localhost:8000/kegg'

export const KEGGClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async list(db: string) { const r = await fetch(`${BASE}/list/${db}`); return r.json() },
  async get(ids: string) { const r = await fetch(`${BASE}/get/${encodeURIComponent(ids)}`); return r.json() },
  async find(db: string, query: string) { const r = await fetch(`${BASE}/find/${db}/${encodeURIComponent(query)}`); return r.json() },
  async conv(db1: string, db2: string, ids: string) { const r = await fetch(`${BASE}/conv/${db1}/${db2}/${encodeURIComponent(ids)}`); return r.json() },
  async link(db1: string, db2: string, ids: string) { const r = await fetch(`${BASE}/link/${db1}/${db2}/${encodeURIComponent(ids)}`); return r.json() },
}
