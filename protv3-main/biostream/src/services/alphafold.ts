// Auto-generated API client for AlphaFold
// Source: AlphaFold DB

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class AlphaFoldClient {
  static readonly API_NAME = "AlphaFold DB";
  static readonly CATEGORY = "structure";
  static readonly BASE_URL = "https://alphafoldserver.com/fetch/";
  static readonly PREFIX = "/alphafold";

  static async predict(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/alphafold/predict`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async status(params?: { [key: string]: string }): Promise<any> {
    const jobId = params?.job_id;
    const url = `${API_CONFIG.BACKEND_URL}/alphafold/status/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async result(params?: { [key: string]: string }): Promise<any> {
    const jobId = params?.job_id;
    const url = `${API_CONFIG.BACKEND_URL}/alphafold/result/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/alphafold/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
