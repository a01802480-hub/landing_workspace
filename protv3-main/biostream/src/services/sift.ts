// Auto-generated API client for SIFT
// Source: SIFT Variant Effect Prediction

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class SIFTClient {
  static readonly API_NAME = "SIFT";
  static readonly CATEGORY = "variant";
  static readonly BASE_URL = "https://sift.bii.a-star.edu.sg/www/";
  static readonly PREFIX = "/sift";

  static async predict(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/sift/predict`;
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
    const url = `${API_CONFIG.BACKEND_URL}/sift/status/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async result(params?: { [key: string]: string }): Promise<any> {
    const jobId = params?.job_id;
    const url = `${API_CONFIG.BACKEND_URL}/sift/result/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/sift/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
