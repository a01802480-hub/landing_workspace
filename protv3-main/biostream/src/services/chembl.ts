/** ChEMBL REST API client — bioactivity data for drug discovery. */
const BASE = 'http://localhost:8000/chembl'

export const ChEMBLClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async searchMolecules(q: string, limit = 10) { const r = await fetch(`${BASE}/molecule/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async getMolecule(chemblId: string) { const r = await fetch(`${BASE}/molecule/${chemblId}`); return r.json() },
  async searchTargets(q: string, limit = 10) { const r = await fetch(`${BASE}/target/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async getTarget(chemblId: string) { const r = await fetch(`${BASE}/target/${chemblId}`); return r.json() },
  async searchActivities(moleculeChemblId?: string, targetChemblId?: string, limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (moleculeChemblId) params.set('molecule_chembl_id', moleculeChemblId)
    if (targetChemblId) params.set('target_chembl_id', targetChemblId)
    const r = await fetch(`${BASE}/activity/search?${params}`); return r.json()
  },
  async searchDrugs(q: string, limit = 10) { const r = await fetch(`${BASE}/drug/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
}
