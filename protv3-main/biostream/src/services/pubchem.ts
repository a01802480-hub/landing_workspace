/** PubChem PUG-REST API client — chemical compounds, substances, assays. */
const BASE = 'http://localhost:8000/pubchem'

export const PubChemClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async searchCompounds(q: string, limit = 10) { const r = await fetch(`${BASE}/compound/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async getCompound(cid: string) { const r = await fetch(`${BASE}/compound/${cid}`); return r.json() },
  async getCompoundProperties(cid: string, properties?: string) {
    const props = properties || 'MolecularFormula,MolecularWeight,CanonicalSMILES,IUPACName'
    const r = await fetch(`${BASE}/compound/${cid}/property?properties=${encodeURIComponent(props)}`); return r.json()
  },
  async searchAssays(q: string, limit = 10) { const r = await fetch(`${BASE}/assay/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async getAssay(aid: string) { const r = await fetch(`${BASE}/assay/${aid}`); return r.json() },
  async compoundTargets(cid: string) { const r = await fetch(`${BASE}/target/compound/${cid}`); return r.json() },
}
