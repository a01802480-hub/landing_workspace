import React, { useState, useEffect } from 'react';
import { Book, ChevronDown, Play, Server, FileJson, PlusSquare } from 'lucide-react';
import axios from 'axios';

// Get backend URL from environment variable or default to localhost
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// --- TYPE DEFINITIONS ---

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
}

interface ApiInfo {
  name: string;
  folder_name: string;
  base_url: string;
  prefix: string;
  category: string;
  endpoints_count: number;
  source: string;
  description: string;
  discovered_at: string;
  status: string;
  endpoints?: ApiEndpoint[]; // Will be fetched on demand
}

type CategorizedApis = Record<string, ApiInfo[]>;

interface ApiExplorerTabProps {
  onAddResultToWorksheet: (result: {name: string, data: any}) => void;
}

// --- HELPER COMPONENTS ---

const ApiForm = ({ endpoint, onExecute, loading }: { endpoint: ApiEndpoint, onExecute: (params: any, body: any) => void, loading: boolean }) => {
  const [params, setParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');

  const pathParams = endpoint.path.match(/\{(\w+)\}/g)?.map(p => p.slice(1, -1)) || [];

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(params, body ? JSON.parse(body) : null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="font-bold text-slate-700">{endpoint.method} {endpoint.path}</h4>
      <p className="text-xs text-slate-500">{endpoint.description}</p>
      
      {pathParams.length > 0 && (
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Path Parameters</label>
          {pathParams.map(param => (
            <input
              key={param}
              type="text"
              placeholder={param}
              value={params[param] || ''}
              onChange={(e) => handleParamChange(param, e.target.value)}
              className="mt-1 w-full p-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          ))}
        </div>
      )}

      {endpoint.method === 'POST' && (
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Request Body (JSON)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{ "key": "value" }'
            className="mt-1 w-full h-32 p-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
          />
        </div>
      )}

      <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
        {loading ? 'Executing...' : <><Play size={16} /> Execute</>}
      </button>
    </form>
  );
};


// --- MAIN COMPONENT ---

function ApiExplorerTab({ onAddResultToWorksheet }: ApiExplorerTabProps) {
  const [categorizedApis, setCategorizedApis] = useState<CategorizedApis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [selectedApi, setSelectedApi] = useState<ApiInfo | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const fetchApis = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BACKEND_URL}/discover-all`);
        setCategorizedApis(response.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch APIs:", err);
        setError("Failed to load API registry. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    fetchApis();
  }, []);

  const handleSelectApi = async (api: ApiInfo) => {
    setSelectedApi(api);
    setSelectedEndpoint(null);
    setExecutionResult(null);
    setExecutionError(null);

    if (!api.endpoints) {
      try {
        const response = await axios.get(`${BACKEND_URL}${api.prefix}/discover`);
        const updatedApi = { ...api, endpoints: response.data.endpoints };
        
        setCategorizedApis(prev => {
          if (!prev) return null;
          const newCategorizedApis = { ...prev };
          const categoryApis = newCategorizedApis[api.category];
          const apiIndex = categoryApis.findIndex(a => a.name === api.name);
          if (apiIndex !== -1) {
            categoryApis[apiIndex] = updatedApi;
          }
          return newCategorizedApis;
        });
        setSelectedApi(updatedApi);

      } catch (err) {
        console.error(`Failed to discover endpoints for ${api.name}:`, err);
        setExecutionError(`Could not fetch endpoints for ${api.name}.`);
      }
    }
  };

  const handleExecute = async (pathParams: Record<string, string>, body: any) => {
    if (!selectedApi || !selectedEndpoint) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);

    let url = `${BACKEND_URL}${selectedApi.prefix}${selectedEndpoint.path}`;
    for (const key in pathParams) {
      url = url.replace(`{${key}}`, encodeURIComponent(pathParams[key]));
    }

    try {
      const response = await axios({
        method: selectedEndpoint.method,
        url: url,
        data: body,
      });
      setExecutionResult(response.data);
    } catch (err: any) {
      console.error("API execution failed:", err);
      const detail = err.response?.data?.detail || err.message;
      setExecutionError(`Request failed: ${detail}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading API Registry...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500 bg-red-50 rounded-lg">{error}</div>;
  }

  return (
    <div className="flex h-full bg-white animate-in fade-in duration-500">
      <div className="w-1/3 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
            <Server size={16} className="text-indigo-600" />
            API Explorer
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {categorizedApis && Object.entries(categorizedApis).map(([category, apis]) => (
            <div key={category} className="p-4 border-b border-slate-100">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">{category}</h3>
              <ul className="space-y-1">
                {apis.map(api => (
                  <li key={api.name}>
                    <button onClick={() => handleSelectApi(api)} className={`w-full text-left p-2 rounded-lg text-xs font-semibold ${selectedApi?.name === api.name ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-slate-100'}`}>
                      {api.name}
                    </button>
                    {selectedApi?.name === api.name && api.endpoints && (
                      <ul className="pl-4 mt-1 space-y-1 border-l-2 border-indigo-200">
                        {api.endpoints.map(ep => (
                          <li key={ep.path + ep.method}>
                            <button onClick={() => setSelectedEndpoint(ep)} className={`w-full text-left p-1.5 rounded-md text-xs ${selectedEndpoint === ep ? 'bg-indigo-200' : 'hover:bg-slate-100'}`}>
                              <span className={`font-bold w-12 inline-block ${ep.method === 'GET' ? 'text-green-600' : 'text-blue-600'}`}>{ep.method}</span>
                              <span className="font-mono">{ep.path}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="w-2/3 p-6 overflow-y-auto">
        {!selectedApi && <div className="flex flex-col items-center justify-center h-full text-slate-400"><Book size={48} className="mb-4" /><h3 className="font-bold text-lg">Select an API</h3><p className="text-sm">Choose an API from the left panel to see its endpoints.</p></div>}
        {selectedApi && !selectedEndpoint && <div className="flex flex-col items-center justify-center h-full text-slate-400"><ChevronDown size={48} className="mb-4" /><h3 className="font-bold text-lg">Select an Endpoint</h3><p className="text-sm">Choose an endpoint for <span className="font-bold text-slate-600">{selectedApi.name}</span> to continue.</p></div>}
        {selectedApi && selectedEndpoint && (
          <div className="space-y-6">
            <ApiForm endpoint={selectedEndpoint} onExecute={handleExecute} loading={isExecuting} />
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2 mb-2"><FileJson size={16} /> Result</h3>
              {executionError && <div className="p-4 text-red-700 bg-red-50 rounded-lg text-xs">{executionError}</div>}
              {executionResult && (
                <div>
                  <button onClick={() => onAddResultToWorksheet({name: `${selectedApi.name}: ${selectedEndpoint.path}`, data: executionResult})} className="mb-2 px-3 py-1 bg-green-100 text-green-800 rounded-md text-xs font-semibold flex items-center gap-1"><PlusSquare size={14} /> Add to Worksheet</button>
                  <pre className="bg-slate-900 text-white p-4 rounded-lg text-xs overflow-x-auto max-h-96">{JSON.stringify(executionResult, null, 2)}</pre>
                </div>
              )}
              {!isExecuting && !executionResult && !executionError && <div className="text-center py-10 text-slate-400"><p className="text-sm">Result will be displayed here.</p></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApiExplorerTab;