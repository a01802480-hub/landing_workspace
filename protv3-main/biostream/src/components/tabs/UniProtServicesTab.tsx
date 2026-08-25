// UniProtServicesTab.tsx - Clean, working version
import React, { useState } from 'react';
import { Search, CheckCircle, AlertTriangle, Activity, Database } from 'lucide-react';
import { UniProtAPIClient } from '../../services/search/uniprot';
import UniProtSearchResults from './UniProtSearchResults';

interface UniProtServicesTabProps {
  frontendSequences?: string[];
  backendSequences?: string[];
}

const UniProtServicesTab: React.FC<UniProtServicesTabProps> = ({
  frontendSequences = [],
  backendSequences = []
}) => {
  const [activeService, setActiveService] = useState<'search' | 'validate'>('search');
  const [searchQuery, setSearchQuery] = useState('gene:BRCA1');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<string | null>(null);

  // Check API health
  const checkHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await UniProtAPIClient.health();
      setApiHealth(health.status);
    } catch (err: any) {
      setError(err.message);
      setApiHealth('unreachable');
    } finally {
      setLoading(false);
    }
  };

  // Search UniProt
  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await UniProtAPIClient.search({ query: searchQuery, size: 20 });
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message);
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Validate sequences by searching UniProt
  const handleValidate = async () => {
    try {
      setLoading(true);
      setError(null);

      const allSequences = [...frontendSequences, ...backendSequences];
      if (allSequences.length === 0) {
        setError('No sequences to validate. Upload sequences first.');
        return;
      }

      // Search UniProt for each sequence
      const validationPromises = allSequences.map(async (seq, idx) => {
        const headerMatch = seq.match(/^>(\S+)/);
        const searchQuery = headerMatch ? headerMatch[1] : seq.slice(0, 50);
        
        try {
          const results = await UniProtAPIClient.search({ 
            query: searchQuery, 
            size: 5 
          });
          
          return {
            index: idx,
            query: searchQuery,
            found: results?.results_count > 0,
            resultsCount: results?.results_count || 0,
            topMatch: results?.data?.results?.[0] || null,
            sequence: seq
          };
        } catch {
          return {
            index: idx,
            query: searchQuery,
            found: false,
            resultsCount: 0,
            topMatch: null,
            sequence: seq
          };
        }
      });

      const results = await Promise.all(validationPromises);
      setValidationResults({
        sequences_validated: results.length,
        all_valid: results.some(r => r.found),
        results: results
      });
    } catch (err: any) {
      setError(err.message);
      setValidationResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Database size={20} className="text-indigo-600" />
              UniProt Services
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Search and validate protein sequences against UniProt database
            </p>
          </div>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Activity size={14} />
            {apiHealth ? (apiHealth === 'healthy' ? '✅ Healthy' : '❌ Unreachable') : 'Check Health'}
          </button>
        </div>

        {/* Service Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveService('search')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              activeService === 'search'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Search size={14} className="inline mr-1" />
            Search
          </button>
          <button
            onClick={() => setActiveService('validate')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              activeService === 'validate'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <CheckCircle size={14} className="inline mr-1" />
            Validate
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" title="Dismiss error" aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-sm text-gray-600">Processing...</span>
        </div>
      )}

      {/* Service Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Search Service */}
        {activeService === 'search' && !loading && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search query (e.g., gene:BRCA1)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Search size={16} />
                Search
              </button>
            </div>

            {searchResults && (
              <UniProtSearchResults results={searchResults} />
            )}
          </div>
        )}

        {/* Validate Service */}
        {activeService === 'validate' && !loading && (
          <div className="space-y-4">
            <button
              onClick={handleValidate}
              disabled={frontendSequences.length === 0 && backendSequences.length === 0}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Validate {frontendSequences.length + backendSequences.length} Sequences
            </button>

            {validationResults && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    UniProt Validation Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded border">
                      <p className="text-sm text-gray-600">Sequences Searched</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {validationResults.sequences_validated}
                      </p>
                    </div>
                    <div className={`bg-white p-3 rounded border ${
                      validationResults.all_valid ? 'border-green-200' : 'border-orange-200'
                    }`}>
                      <p className="text-sm text-gray-600">Found in UniProt</p>
                      <p className={`text-2xl font-bold ${
                        validationResults.all_valid ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {validationResults.results.filter((r: any) => r.found).length} ✅
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {validationResults.results?.map((result: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        result.found
                          ? 'bg-green-50 border-green-200'
                          : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {result.found ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <AlertTriangle size={16} className="text-orange-600" />
                          )}
                          <span className="font-medium text-gray-900">
                            Sequence {result.index + 1}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {result.found ? `${result.resultsCount} matches` : 'Not found'}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-2">
                        Query: <span className="font-mono bg-white px-2 py-1 rounded">{result.query}</span>
                      </p>

                      {result.found && result.topMatch && (
                        <div className="mt-3 p-3 bg-white rounded border">
                          <p className="text-sm font-semibold text-indigo-700">
                            Top Match: {result.topMatch.primaryAccession}
                          </p>
                          <p className="text-xs text-gray-700 mt-1">
                            {result.topMatch.proteinDescription?.recommendedName?.fullName?.value || 
                             result.topMatch.proteinDescription?.recommendedName?.fullName || 'Unknown protein'}
                          </p>
                          {result.topMatch.organism?.scientificName && (
                            <p className="text-xs text-gray-600 mt-1">
                              Organism: {result.topMatch.organism.scientificName}
                            </p>
                          )}
                        </div>
                      )}

                      {!result.found && (
                        <p className="text-xs text-orange-700 mt-2">
                          ⚠️ No matching proteins found. Try searching with a gene name or accession.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UniProtServicesTab;
