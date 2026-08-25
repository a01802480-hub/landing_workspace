/** PRIDE / ProteomeXchange REST API client — mass spectrometry proteomics. */
const BASE = 'http://localhost:8000/pride'

export const PRIDEClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async listProjects(limit = 10, page = 0) { const r = await fetch(`${BASE}/projects?limit=${limit}&page=${page}`); return r.json() },
  async getProject(accession: string) { const r = await fetch(`${BASE}/project/${accession}`); return r.json() },
  async search(q: string, limit = 10) { const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
}
