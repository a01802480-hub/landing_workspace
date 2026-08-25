/** ClinVar client via NCBI E-utilities — clinical variant interpretation. */
const BASE = 'http://localhost:8000/clinvar'

export const ClinVarClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async search(term: string, limit = 10) { const r = await fetch(`${BASE}/search?term=${encodeURIComponent(term)}&limit=${limit}`); return r.json() },
  async fetch(uid: string, rettype = 'variation') { const r = await fetch(`${BASE}/fetch/${uid}?rettype=${rettype}`); return r.json() },
  async summary(uid: string) { const r = await fetch(`${BASE}/summary/${uid}`); return r.json() },
}
