// Auto-generated API client for Gene Ontology
// Source: Gene Ontology Consortium

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class GeneOntologyClient {
  static readonly API_NAME = "Gene Ontology";
  static readonly CATEGORY = "annotation";
  static readonly BASE_URL = "https://api.geneontology.org/";
  static readonly PREFIX = "/geneontology";

  static async search(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/geneontology/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async lookup(params?: { [key: string]: string }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/geneontology/lookup`;
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(url + queryString);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/geneontology/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
