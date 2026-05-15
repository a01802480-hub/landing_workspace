// Auto-generated API client for HMMER
// Source: HMMER Tools

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class HMMERClient {
  static readonly API_NAME = "HMMER";
  static readonly CATEGORY = "search";
  static readonly BASE_URL = "https://www.ebi.ac.uk/Tools/hmmer/";
  static readonly PREFIX = "/hmmer";

  static async job(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/hmmer/job`;
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
    const url = `${API_CONFIG.BACKEND_URL}/hmmer/status/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async result(params?: { [key: string]: string }): Promise<any> {
    const jobId = params?.job_id;
    const url = `${API_CONFIG.BACKEND_URL}/hmmer/result/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/hmmer/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
