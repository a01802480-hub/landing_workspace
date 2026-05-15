// Auto-generated API client for NCBI E-utilities
// Source: NCBI Tools

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class NCBIClient {
  static readonly API_NAME = "NCBI E-utilities";
  static readonly CATEGORY = "search";
  static readonly BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
  static readonly PREFIX = "/ncbi";

  static async search(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/ncbi/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async fetch(params?: { [key: string]: string }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/ncbi/fetch`;
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(url + queryString);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/ncbi/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
