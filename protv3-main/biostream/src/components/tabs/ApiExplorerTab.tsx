import React, { useState, useEffect } from 'react';
import { Book, ChevronDown, Play, Server, FileJson, PlusSquare, Info } from 'lucide-react';
import axios from 'axios';

// Get backend URL from environment variable or default to localhost
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// --- TYPE DEFINITIONS ---

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  query_hint?: string;         // Hint for what to put in the query/path params
  example_params?: string;     // Example parameter value
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
  query_hint?: string;         // General hint about what queries this API accepts
  endpoints?: ApiEndpoint[];   // Will be fetched on demand
}

type CategorizedApis = Record<string, ApiInfo[]>;

interface ApiExplorerTabProps {
  onAddResultToWorksheet: (result: {name: string, data: any}) => void;
}

// --- HELPER COMPONENTS ---

// --- PARAM HINT MAPPING ---
// Human-readable hints for common path parameter names
const PARAM_HINTS: Record<string, string> = {
  uniprot_id: 'e.g. P00519 (UniProt accession)',
  accession: 'e.g. P00519 (accession number)',
  id: 'e.g. P00519 or CHEMBL12',
  ids: 'e.g. P00519,P68871 (comma-separated)',
  db: 'e.g. pathway, module, disease, drug, compound, genes',
  db1: 'e.g. pathway (source DB)',
  db2: 'e.g. disease (target DB)',
  query: 'e.g. insulin receptor (search term)',
  gene: 'e.g. BRCA2 (gene symbol)',
  protein: 'e.g. P53 (protein name or ID)',
  molecule: 'e.g. CHEMBL12 (molecule ID)',
  target: 'e.g. EGFR (target name or ID)',
  disease: 'e.g. diabetes (disease name)',
  specie: 'e.g. human, mouse (species name)',
  organism: 'e.g. 9606 (human NCBI taxon ID)',
  variant: 'e.g. rs334 (dbSNP ID)',
  study: 'e.g. GCST000001 (GWAS study ID)',
  term: 'e.g. apoptosis (ontology term)',
  sequence: 'e.g. MKFLILFNILV... (protein/DNA sequence)',
  email: 'e.g. user@example.com',
  format: 'e.g. json, xml, fasta',
};

function getParamHint(paramName: string, endpoint?: ApiEndpoint): string {
  // First check if the endpoint has a query_hint
  if (endpoint?.query_hint) {
    // If it's a generic hint that applies to all params
    const lowerHint = endpoint.query_hint.toLowerCase();
    if (lowerHint.includes(paramName.toLowerCase())) {
      // Extract specific hint from the query_hint string
      const match = endpoint.query_hint.match(new RegExp(`${paramName}\\s*[:=]\\s*([^,;]+)`, 'i'));
      if (match) return match[1].trim();
    }
    return endpoint.query_hint;
  }
  // Then check the common hints
  for (const [key, hint] of Object.entries(PARAM_HINTS)) {
    if (paramName.toLowerCase().includes(key.toLowerCase())) {
      return hint;
    }
  }
  return `Enter ${paramName.replace(/_/g, ' ')}`;
}

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
      <h4 className="font-bold text-slate-700">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-2 ${endpoint.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{endpoint.method}</span>
        <code className="text-xs font-mono">{endpoint.path}</code>
      </h4>
      <p className="text-xs text-slate-500 leading-relaxed">{endpoint.description}</p>

      {endpoint.query_hint && (
        <div className="flex items-start gap-1.5 px-2.5 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
          <Info size={13} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-indigo-600 leading-relaxed">{endpoint.query_hint}</p>
        </div>
      )}

      {pathParams.length > 0 && (
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Path Parameters</label>
          {pathParams.map(param => (
            <div key={param} className="mt-1">
              <input
                type="text"
                placeholder={getParamHint(param, endpoint)}
                value={params[param] || ''}
                onChange={(e) => handleParamChange(param, e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none transition-colors"
                required
              />
              <p className="text-[9px] text-slate-400 mt-0.5 ml-0.5">{param} — {getParamHint(param, endpoint)}</p>
            </div>
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
                    <button
                      onClick={() => handleSelectApi(api)}
                      className={`w-full text-left p-2 rounded-lg transition-colors ${selectedApi?.name === api.name ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-slate-100'}`}
                    >
                      <div className="text-xs font-semibold">{api.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {api.description || 'No description available'}
                      </div>
                      {api.query_hint && (
                        <div className="text-[9px] text-indigo-500 mt-0.5 italic">
                          Query: {api.query_hint}
                        </div>
                      )}
                    </button>
                    {selectedApi?.name === api.name && api.endpoints && (
                      <ul className="pl-4 mt-1 space-y-1 border-l-2 border-indigo-200">
                        {api.endpoints.map(ep => (
                          <li key={ep.path + ep.method}>
                            <button
                              onClick={() => setSelectedEndpoint(ep)}
                              className={`w-full text-left p-1.5 rounded-md text-xs transition-colors ${selectedEndpoint === ep ? 'bg-indigo-200' : 'hover:bg-slate-100'}`}
                            >
                              <span className={`font-bold w-10 inline-block text-[10px] ${ep.method === 'GET' ? 'text-green-600' : 'text-blue-600'}`}>{ep.method}</span>
                              <span className="font-mono text-[10px]">{ep.path}</span>
                              {ep.description && (
                                <span className="block text-[9px] text-slate-400 mt-0.5 ml-10">{ep.description}</span>
                              )}
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