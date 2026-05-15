// Auto-generated API client for PDBe
// Source: PDB in Europe

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class PDBEClient {
  static readonly API_NAME = "PDBe (Protein Data Bank)";
  static readonly CATEGORY = "structure";
  static readonly BASE_URL = "https://www.ebi.ac.uk/pdbe/api/";
  static readonly PREFIX = "/pdbe";

  static async search(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/pdbe/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async lookup(params?: { [key: string]: string }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/pdbe/lookup`;
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(url + queryString);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/pdbe/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
