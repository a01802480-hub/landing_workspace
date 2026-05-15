// Auto-generated API client for InterPro
// Source: EBI InterPro

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class InterProClient {
  static readonly API_NAME = "InterPro";
  static readonly CATEGORY = "annotation";
  static readonly BASE_URL = "https://www.ebi.ac.uk/interpro/api/";
  static readonly PREFIX = "/interpro";

  static async search(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/interpro/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async lookup(params?: { [key: string]: string }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/interpro/lookup`;
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(url + queryString);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/interpro/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
