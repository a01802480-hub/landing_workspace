// Auto-generated API client for Reactome
// Source: Reactome Pathway Database

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class ReactomeClient {
  static readonly API_NAME = "Reactome";
  static readonly CATEGORY = "pathway";
  static readonly BASE_URL = "https://reactome.org/ContentService/";
  static readonly PREFIX = "/reactome";

  static async search(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/reactome/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async pathway(params?: { [key: string]: string }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/reactome/pathway`;
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(url + queryString);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/reactome/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
