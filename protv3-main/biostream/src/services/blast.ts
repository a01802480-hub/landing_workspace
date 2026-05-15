// Auto-generated API client for NCBI BLAST
// Source: NCBI Tools

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class BLASTClient {
  static readonly API_NAME = "NCBI BLAST";
  static readonly CATEGORY = "search";
  static readonly BASE_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi";
  static readonly PREFIX = "/blast";

  static async job(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/blast/job`;
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
    const url = `${API_CONFIG.BACKEND_URL}/blast/status/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async result(params?: { [key: string]: string }): Promise<any> {
    const jobId = params?.job_id;
    const url = `${API_CONFIG.BACKEND_URL}/blast/result/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/blast/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
