/** IntAct molecular interactions REST API client. */
const BASE = 'http://localhost:8000/intact'

export const IntActClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async search(q: string, limit = 10) { const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`); return r.json() },
  async getInteraction(interactionId: string) { const r = await fetch(`${BASE}/interaction/${interactionId}`); return r.json() },
  async network(query: string, limit = 50) { const r = await fetch(`${BASE}/network?query=${encodeURIComponent(query)}&limit=${limit}`); return r.json() },
}
