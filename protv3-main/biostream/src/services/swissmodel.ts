// Auto-generated API client for SWISS-MODEL
// Source: SWISS-MODEL Structure Prediction

const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
};

export class SwissModelClient {
  static readonly API_NAME = "SWISS-MODEL";
  static readonly CATEGORY = "structure";
  static readonly BASE_URL = "https://swissmodel.expasy.org/";
  static readonly PREFIX = "/swissmodel";

  static async predict(data?: { [key: string]: any }): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/swissmodel/predict`;
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
    const url = `${API_CONFIG.BACKEND_URL}/swissmodel/status/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async result(params?: { [key: string]: string }): Promise<any> {
    const jobId = params?.job_id;
    const url = `${API_CONFIG.BACKEND_URL}/swissmodel/result/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  static async discover(): Promise<any> {
    const url = `${API_CONFIG.BACKEND_URL}/swissmodel/discover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
}
