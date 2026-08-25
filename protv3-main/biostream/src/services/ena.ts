/** ENA (European Nucleotide Archive) client — nucleotide sequences. */
const BASE = 'http://localhost:8000/ena'

export const ENAClient = {
  async discover() { const r = await fetch(`${BASE}/discover`); return r.json() },
  async search(params: Record<string, string | number>) {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    const r = await fetch(`${BASE}/search?${qs}`); return r.json()
  },
  async fetch(accession: string, format = 'json') { const r = await fetch(`${BASE}/fetch/${accession}?format=${format}`); return r.json() },
  async filereport(accession: string, result = 'read_run', fields = 'study_accession,run_accession,fastq_ftp') {
    const r = await fetch(`${BASE}/filereport?accession=${accession}&result=${result}&fields=${encodeURIComponent(fields)}`); return r.json()
  },
  async taxonomy(taxId: string) { const r = await fetch(`${BASE}/taxonomy/${taxId}`); return r.json() },
}
