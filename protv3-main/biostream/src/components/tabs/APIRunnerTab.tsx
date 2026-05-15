import { useState, useEffect } from 'react';
import { Play, Download, AlertCircle, Loader, ChevronDown, X, Save, Database, Activity } from 'lucide-react';
import { getAllAPIs, APIRegistry, getAPIByName, getAPIsByCategory } from '../../services/api';
import { BLOSUM_MATRICES, getMatrixList, getMatrixDescription } from '../../utils/blosumMatrices';

interface APIResult {
  apiName: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  data: any;
  jobId?: string;
  category?: string;
}

export default function APIRunnerTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('alignment');
  const [selectedAPI, setSelectedAPI] = useState<APIRegistry | null>(null);
  const [inputData, setInputData] = useState<{ [key: string]: any }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<APIResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatrix, setSelectedMatrix] = useState('BLOSUM62');
  const [jobStatuses, setJobStatuses] = useState<{ [key: string]: string }>({});
  const [showMatrixInfo, setShowMatrixInfo] = useState(false);
  const [savedToWorksheet, setSavedToWorksheet] = useState<{ [key: string]: boolean }>({});

  const apis = getAllAPIs();
  const categories = Array.from(new Set(apis.map(api => api.category))).sort();
  const apisByCategory = (category: string) => apis.filter(api => api.category === category);

  // Auto-select first API when category changes
  useEffect(() => {
    const categoryAPIs = apisByCategory(selectedCategory);
    if (categoryAPIs.length > 0 && (!selectedAPI || selectedAPI.category !== selectedCategory)) {
      setSelectedAPI(categoryAPIs[0]);
    }
  }, [selectedCategory]);

  const handleAPISelect = (api: APIRegistry) => {
    setSelectedAPI(api);
    setInputData({});
    setError(null);
  };

  const handleInputChange = (key: string, value: any) => {
    setInputData(prev => ({ ...prev, [key]: value }));
  };

  const handleRunAPI = async () => {
    if (!selectedAPI) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = selectedAPI.client;
      let result: any;

      // Prepare input data with matrix if applicable
      const inputDataWithMatrix = {
        ...inputData,
        matrix: selectedMatrix
      };

      // Call the appropriate method based on API type
      if (client.predict) {
        result = await client.predict(inputDataWithMatrix);
      } else if (client.job) {
        result = await client.job(inputDataWithMatrix);
      } else if (client.search) {
        result = await client.search(inputData);
      } else if (client.lookup) {
        result = await client.lookup(inputData);
      } else if (client.pathway) {
        result = await client.pathway(inputData);
      } else if (client.discover) {
        result = await client.discover();
      } else {
        throw new Error('No suitable method found for this API');
      }

      const apiResult: APIResult = {
        apiName: selectedAPI.name,
        timestamp: new Date(),
        status: result.status === 'error' ? 'error' : 'success',
        data: result,
        jobId: result.job_id || result.id,
        category: selectedAPI.category
      };

      setResults(prev => [apiResult, ...prev]);
      
      // If job-based, start polling for status
      if (selectedAPI.supportsJobQueue && result.job_id) {
        pollJobStatus(selectedAPI, result.job_id);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to run API');
      const apiResult: APIResult = {
        apiName: selectedAPI.name,
        timestamp: new Date(),
        status: 'error',
        data: { error: err.message },
        category: selectedAPI.category
      };
      setResults(prev => [apiResult, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const pollJobStatus = async (api: APIRegistry, jobId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        let status: any;
        if (api.client.status) {
          status = await api.client.status({ job_id: jobId });
        }

        setJobStatuses(prev => ({
          ...prev,
          [jobId]: status?.status || 'unknown'
        }));

        if (status?.status === 'COMPLETED' || status?.status === 'completed') {
          // Try to fetch results
          if (api.client.result) {
            const jobResult = await api.client.result({ job_id: jobId });
            setResults(prev => prev.map(r => 
              r.jobId === jobId 
                ? { ...r, data: jobResult, status: 'success' as const }
                : r
            ));
          }
        } else if (attempts < maxAttempts && status?.status !== 'FAILED' && status?.status !== 'failed') {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch (err: any) {
        console.error('Poll error:', err);
      }
    };

    poll();
  };

  const handleExportResult = (result: APIResult) => {
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.apiName}-${result.timestamp.getTime()}.json`;
    a.click();
  };

  const handleSaveToWorksheet = (result: APIResult) => {
    // Dispatch custom event to notify APIWorksheetTab
    const event = new CustomEvent('saveToWorksheet', {
      detail: {
        timestamp: result.timestamp,
        apiName: result.apiName,
        category: result.category || 'other',
        status: result.status,
        inputData: inputData,
        result: result.data,
        notes: '',
        jobId: result.jobId
      }
    });
    window.dispatchEvent(event);
    
    setSavedToWorksheet(prev => ({
      ...prev,
      [result.timestamp.getTime().toString()]: true
    }));
  };

  const handleClearResults = () => {
    setResults([]);
    setJobStatuses({});
    setSavedToWorksheet({});
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* API Selection Panel */}
      <div className="border-b border-slate-700 p-4 bg-slate-800">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          Select API to Execute
        </h2>
        
        {/* Category Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-slate-300">API Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)} ({apisByCategory(category).length})
              </option>
            ))}
          </select>
        </div>

        {/* API List for Selected Category - Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {apisByCategory(selectedCategory).map(api => (
            <button
              key={api.name}
              onClick={() => handleAPISelect(api)}
              className={`p-3 rounded text-left text-sm transition-all border ${
                selectedAPI?.name === api.name
                  ? 'border-blue-500 bg-blue-900/50 text-blue-200 shadow-lg shadow-blue-500/20'
                  : 'border-slate-600 bg-slate-700 hover:border-slate-500 hover:bg-slate-600'
              }`}
            >
              <div className="font-semibold">{api.name}</div>
              <div className="text-xs text-slate-400 mt-1 line-clamp-2">{api.description}</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {api.requiresSequence && (
                  <span className="text-[10px] px-2 py-0.5 bg-orange-900/50 text-orange-300 rounded">
                    Seq Required
                  </span>
                )}
                {api.supportsJobQueue && (
                  <span className="text-[10px] px-2 py-0.5 bg-green-900/50 text-green-300 rounded">
                    Async
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Input Panel */}
        <div className="w-1/2 border-r border-slate-700 overflow-y-auto p-4">
          {selectedAPI ? (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedAPI.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">{selectedAPI.description}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-slate-700 rounded capitalize">
                  {selectedAPI.subcategory}
                </span>
              </div>

              {/* Parameters */}
              <div className="space-y-4 mb-6">
                {/* Substitution Matrix Selector */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">Substitution Matrix</label>
                    <button
                      onClick={() => setShowMatrixInfo(!showMatrixInfo)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {showMatrixInfo ? 'Hide Info' : 'Show Info'}
                    </button>
                  </div>
                  <select
                    value={selectedMatrix}
                    onChange={(e) => setSelectedMatrix(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {getMatrixList().map(matrix => (
                      <option key={matrix} value={matrix}>{matrix}</option>
                    ))}
                  </select>
                  
                  {showMatrixInfo && (
                    <div className="mt-2 p-3 bg-slate-800 rounded border border-slate-700">
                      <p className="text-xs text-slate-300 mb-2">
                        {getMatrixDescription(selectedMatrix)}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-slate-400">
                          <strong>BLOSUM45:</strong> Distant sequences
                        </div>
                        <div className="text-slate-400">
                          <strong>BLOSUM50:</strong> Moderately distant
                        </div>
                        <div className="text-slate-400">
                          <strong>BLOSUM62:</strong> Standard general purpose
                        </div>
                        <div className="text-slate-400">
                          <strong>BLOSUM80:</strong> Very close sequences
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sequence Input (for APIs that require it) */}
                {selectedAPI.requiresSequence && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Protein/DNA Sequence (FASTA format)
                    </label>
                    <textarea
                      value={inputData.sequence || ''}
                      onChange={(e) => handleInputChange('sequence', e.target.value)}
                      placeholder={`>sequence_id\nMEDVQQDQDV...`}
                      className="w-full h-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Query/Search Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">Query/Search Term</label>
                  <input
                    type="text"
                    value={inputData.query || ''}
                    onChange={(e) => handleInputChange('query', e.target.value)}
                    placeholder="e.g., human, BRCA1, P53, UniProt ID"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Program/Algorithm Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Program/Algorithm</label>
                  <select
                    value={inputData.program || 'blastp'}
                    onChange={(e) => handleInputChange('program', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="blastp">Protein BLAST (BLASTP)</option>
                    <option value="blastn">Nucleotide BLAST (BLASTN)</option>
                    <option value="blastx">Translated DNA → Protein (BLASTX)</option>
                    <option value="tblastn">Protein → Translated DNA (TBLASTN)</option>
                    <option value="hmmscan">HMM Scan (HMMER)</option>
                    <option value="phmmer">Profile HMM Search (PHMMER)</option>
                  </select>
                </div>

                {/* E-value Threshold */}
                <div>
                  <label className="block text-sm font-medium mb-2">E-value Threshold</label>
                  <input
                    type="number"
                    value={inputData.evalue || 0.001}
                    onChange={(e) => handleInputChange('evalue', parseFloat(e.target.value))}
                    placeholder="0.001"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                    step="0.0001"
                  />
                  <p className="text-xs text-slate-400 mt-1">Lower values = more stringent (default: 0.001)</p>
                </div>

                {/* Max Results */}
                <div>
                  <label className="block text-sm font-medium mb-2">Maximum Results</label>
                  <input
                    type="number"
                    value={inputData.max_results || 100}
                    onChange={(e) => handleInputChange('max_results', parseInt(e.target.value))}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Additional Parameters for Specific APIs */}
                {selectedAPI.name === 'SIFT' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Variant Position</label>
                    <input
                      type="text"
                      value={inputData.position || ''}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      placeholder="e.g., A123V (Alanine at position 123 to Valine)"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Run Button */}
              <button
                onClick={handleRunAPI}
                disabled={isLoading}
                className={`w-full py-3 rounded font-medium flex items-center justify-center gap-2 transition-colors ${
                  isLoading
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Execute {selectedAPI.name}
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded flex gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-200">{error}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Select an API to begin
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="w-1/2 overflow-y-auto p-4 bg-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Results ({results.length})
            </h3>
            {results.length > 0 && (
              <button
                onClick={handleClearResults}
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No results yet. Run an API to see results here.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded border-l-4 transition-all ${
                    result.status === 'success'
                      ? 'border-green-600 bg-green-900/20'
                      : result.status === 'error'
                      ? 'border-red-600 bg-red-900/20'
                      : 'border-yellow-600 bg-yellow-900/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {result.apiName}
                        <span className="text-xs px-2 py-0.5 bg-slate-700 rounded capitalize">
                          {result.category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {result.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {result.jobId && jobStatuses[result.jobId] && (
                        <span className="text-xs px-2 py-1 bg-slate-700 rounded">
                          {jobStatuses[result.jobId]}
                        </span>
                      )}
                      {!savedToWorksheet[result.timestamp.getTime().toString()] && (
                        <button
                          onClick={() => handleSaveToWorksheet(result)}
                          className="text-slate-400 hover:text-blue-400 transition-colors"
                          title="Save to Worksheet"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleExportResult(result)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        title="Export as JSON"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {result.status === 'error' ? (
                    <div className="text-xs text-red-300 font-mono bg-slate-900/50 p-2 rounded max-h-32 overflow-y-auto">
                      {typeof result.data.error === 'string'
                        ? result.data.error
                        : JSON.stringify(result.data.error, null, 2)}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300 font-mono bg-slate-900/50 p-2 rounded max-h-32 overflow-y-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
