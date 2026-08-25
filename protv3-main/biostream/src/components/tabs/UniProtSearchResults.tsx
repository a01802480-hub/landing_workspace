// UniProtSearchResults.tsx - Clean, readable display of UniProt search results
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Dna, MapPin, BookOpen, Link, ExternalLink, Download } from 'lucide-react';

interface UniProtEntry {
  primaryAccession: string;
  secondaryAccessions?: string[];
  entryType: string;
  proteinDescription?: {
    recommendedName?: {
      fullName?: string;
      shortNames?: Array<{ value: string }>;
    };
    submissionNames?: Array<{ value: string }>;
  };
  gene?: Array<{
    primary?: string;
    synonyms?: Array<{ value: string }>;
  }>;
  organism?: {
    scientificName: string;
    commonName?: string;
  };
  sequence?: {
    value: string;
    length: number;
    molWeight: number;
  };
  features?: Array<{
    type: string;
    description?: string;
    location?: any;
  }>;
  comments?: Array<{
    commentType: string;
    texts?: Array<{ value: string }>;
  }>;
  references?: Array<{
    citation?: {
      title?: string;
      authors?: string;
    };
  }>;
  [key: string]: any;
}

interface UniProtSearchResultsProps {
  results: any;
}

const UniProtSearchResults: React.FC<UniProtSearchResultsProps> = ({ results }) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<UniProtEntry | null>(null);

  const resultsData = results?.data || results;
  const entries: UniProtEntry[] = resultsData?.results || [];
  const totalCount = resultsData?.pagination?.totalEntries || entries.length;

  const toggleEntry = (accession: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(accession)) {
      newExpanded.delete(accession);
    } else {
      newExpanded.add(accession);
    }
    setExpandedEntries(newExpanded);
  };

  const formatSequence = (seq: string, maxLength: number = 80) => {
    if (seq.length <= maxLength) return seq;
    return seq.slice(0, maxLength) + '...';
  };

  const getEntryColor = (entryType: string) => {
    if (entryType.includes('Swiss-Prot') || entryType.includes('reviewed')) {
      return 'border-green-500 bg-green-50';
    }
    return 'border-blue-500 bg-blue-50';
  };

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Dna size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 text-lg font-medium">No results found</p>
        <p className="text-gray-500 text-sm mt-2">Try a different search query</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Search Results
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Found <span className="font-semibold text-indigo-600">{totalCount}</span> protein entries
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              ✅ Reviewed (Swiss-Prot)
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              📋 Unreviewed (TrEMBL)
            </span>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {entries.map((entry, idx) => {
          const isExpanded = expandedEntries.has(entry.primaryAccession);
          const entryColor = getEntryColor(entry.entryType || '');

          return (
            <div
              key={entry.primaryAccession || idx}
              className={`border-l-4 rounded-lg shadow-sm ${entryColor}`}
            >
              {/* Entry Header - Always Visible */}
              <div
                className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                onClick={() => toggleEntry(entry.primaryAccession)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Accession & Type */}
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        className="text-gray-600 hover:text-gray-900"
                        title={isExpanded ? 'Collapse details' : 'Expand details'}
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <span className="font-mono font-bold text-lg text-indigo-700">
                        {entry.primaryAccession}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.entryType?.includes('reviewed') || entry.entryType?.includes('Swiss-Prot')
                          ? 'bg-green-200 text-green-800'
                          : 'bg-blue-200 text-blue-800'
                      }`}>
                        {entry.entryType?.includes('reviewed') || entry.entryType?.includes('Swiss-Prot')
                          ? 'Reviewed'
                          : 'Unreviewed'}
                      </span>
                    </div>

                    {/* Protein Name */}
                    <h4 className="font-semibold text-gray-900 text-base ml-7 mb-1">
                      {entry.proteinDescription?.recommendedName?.fullName?.value ||
                       entry.proteinDescription?.recommendedName?.fullName ||
                       entry.proteinDescription?.submissionNames?.[0]?.value ||
                       'Unnamed Protein'}
                    </h4>

                    {/* Gene & Organism */}
                    <div className="flex items-center gap-4 ml-7 text-sm text-gray-600">
                      {entry.gene?.[0]?.primary && (
                        <span className="flex items-center gap-1">
                          <Dna size={14} className="text-purple-600" />
                          <strong>Gene:</strong> {entry.gene[0].primary}
                        </span>
                      )}
                      {entry.organism?.scientificName && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} className="text-green-600" />
                          <strong>Organism:</strong> {entry.organism.scientificName}
                        </span>
                      )}
                      {entry.sequence && (
                        <span className="flex items-center gap-1">
                          <BookOpen size={14} className="text-orange-600" />
                          <strong>Length:</strong> {entry.sequence.length} aa
                        </span>
                      )}
                    </div>
                  </div>

                  {/* External Link */}
                  <a
                    href={`https://www.uniprot.org/uniprotkb/${entry.primaryAccession}/entry`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-100 rounded transition-colors"
                    title="View on UniProt"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-white/70 p-4 space-y-4">
                  {/* Secondary Accessions */}
                  {entry.secondaryAccessions && entry.secondaryAccessions.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <Link size={14} />
                        Secondary Accessions
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {entry.secondaryAccessions.map((acc: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono">
                            {acc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gene Synonyms */}
                  {entry.gene?.[0]?.synonyms && entry.gene[0].synonyms.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Gene Synonyms</h5>
                      <div className="flex flex-wrap gap-2">
                        {entry.gene[0].synonyms.map((syn: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-mono">
                            {syn.value || syn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sequence */}
                  {entry.sequence?.value && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <BookOpen size={14} />
                        Protein Sequence ({entry.sequence.length} amino acids)
                      </h5>
                      <div className="bg-gray-900 text-green-400 font-mono text-sm p-3 rounded-lg overflow-x-auto">
                        {formatSequence(entry.sequence.value, 100)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(entry.sequence.value);
                        }}
                        className="mt-2 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <Download size={12} />
                        Copy Full Sequence
                      </button>
                    </div>
                  )}

                  {/* Comments/Annotations */}
                  {entry.comments && entry.comments.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Annotations</h5>
                      <div className="space-y-2">
                        {entry.comments
                          .filter((c: any) => c.commentType && c.texts?.length > 0)
                          .slice(0, 3)
                          .map((comment: any, i: number) => (
                            <div key={i} className="bg-white border border-gray-200 rounded p-2">
                              <span className="text-xs font-semibold text-indigo-600 block mb-1">
                                {comment.commentType}
                              </span>
                              <p className="text-xs text-gray-700">
                                {comment.texts[0].value}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Full Details Button */}
                  <div className="flex justify-end pt-2 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEntry(entry);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                      View Full Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full Details Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Full Entry Details: {selectedEntry.primaryAccession}
              </h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-600 hover:text-gray-900"
                title="Close details"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(selectedEntry, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniProtSearchResults;
