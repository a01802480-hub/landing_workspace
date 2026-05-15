import React, { useState } from 'react';
import { AlignmentResult, UniprotProtein, SiftPrediction } from '../../types';
import AlignedSequenceDisplay from './AlignedSequenceDisplay';
import { ChevronLeft, Download, Activity, Database, FlaskConical } from 'lucide-react';

interface AlignmentWorksheetViewProps {
  alignment: AlignmentResult;
  onBack: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Displays an alignment result in the worksheet with:
 * - Formatted file name (e.g., "NP_001275992.1_isoform_01.fasta - sequence NP_001275992.1_isoform_01.fasta alignment")
 * - Both aligned sequences with position numbers every 5 amino acids
 * - Colored squares for each residue
 * - Alignment metrics
 * - Download functionality
 * - Post-alignment analysis buttons (SIFT, UniProt)
 */
const AlignmentWorksheetView: React.FC<AlignmentWorksheetViewProps> = ({
  alignment,
  onBack,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<string | null>(null);

  if (!alignment) return null;

  /**
   * Generate a descriptive file name for the alignment
   */
  const getAlignmentFileName = () => {
    const queryName = alignment.queryName || alignment.query?.substring(0, 30) || 'Query';
    const subjectName = alignment.subjectName || alignment.subject?.substring(0, 30) || 'Subject';
    return `${queryName} - sequence ${subjectName} alignment`;
  };

  /**
   * Download the alignment as a FASTA-like file
   */
  const handleDownload = () => {
    const fileName = getAlignmentFileName();
    const fastaContent = `>${alignment.queryName || 'Query'}\n${alignment.alignedQuery}\n\n>${alignment.subjectName || 'Subject'}\n${alignment.alignedSubject}`;
    
    const blob = new Blob([fastaContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\s+/g, '_')}.fasta`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Run post-alignment analysis (SIFT or UniProt)
   */
  const handleRunAnalysis = async (type: 'sift' | 'uniprot') => {
    setIsAnalyzing(true);
    setAnalysisType(type);

    try {
      console.log(`Running ${type.toUpperCase()} analysis...`);
      
      const response = await fetch(`${BACKEND_URL}/analyze-alignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aligned_query: alignment.alignedQuery,
          aligned_subject: alignment.alignedSubject,
          original_query: alignment.query,
          original_subject: alignment.subject,
          run_sift: type === 'sift',
          run_uniprot: type === 'uniprot',
          matrix: 'BLOSUM62'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`${type.toUpperCase()} analysis completed:`, data);

      // Update alignment with new data
      const updatedAlignment = { ...alignment };
      if (type === 'sift' && data.sift) {
        updatedAlignment.sift = data.sift;
      }
      if (type === 'uniprot' && data.uniprot) {
        updatedAlignment.uniprot = data.uniprot;
      }

      alert(`${type.toUpperCase()} analysis completed successfully! Results are now available in the worksheet.`);
      
    } catch (error) {
      console.error(`${type.toUpperCase()} analysis failed:`, error);
      alert(`${type.toUpperCase()} analysis failed. Please check the console for details.`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisType(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-slate-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 hover:bg-white rounded text-slate-700 hover:text-indigo-600 transition"
          >
            <ChevronLeft size={18} />
            Back to Worksheet
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleRunAnalysis('sift')}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-bold rounded transition-colors"
            >
              {isAnalyzing && analysisType === 'sift' ? (
                <Activity className="animate-spin" size={14} />
              ) : (
                <FlaskConical size={14} />
              )}
              Run SIFT
            </button>
            <button
              onClick={() => handleRunAnalysis('uniprot')}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded transition-colors"
            >
              {isAnalyzing && analysisType === 'uniprot' ? (
                <Activity className="animate-spin" size={14} />
              ) : (
                <Database size={14} />
              )}
              Run UniProt
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
            >
              <Download size={14} />
              Download Alignment
            </button>
          </div>
        </div>

        {/* Alignment Info */}
        <h2 className="text-sm font-bold text-slate-800 mb-2">{getAlignmentFileName()}</h2>
        <div className="flex gap-2 flex-wrap">
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
            Algorithm: {alignment.algorithm}
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded">
            Identity: {alignment.identity?.toFixed(2)}%
          </span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
            Coverage: {alignment.coverage?.toFixed(2)}%
          </span>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">
            Score: {alignment.score?.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="bg-slate-50 border-b border-slate-100 p-3 grid grid-cols-4 gap-2">
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">IDENTITY</div>
          <div className="text-base font-bold text-green-600">{alignment.identity?.toFixed(2)}%</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">COVERAGE</div>
          <div className="text-base font-bold text-blue-600">{alignment.coverage?.toFixed(2)}%</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">SCORE</div>
          <div className="text-base font-bold text-purple-600">{alignment.score?.toFixed(2)}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">GAPS</div>
          <div className="text-base font-bold text-orange-600">
            {(alignment.alignedQuery?.match(/-/g) || []).length + (alignment.alignedSubject?.match(/-/g) || []).length}
          </div>
        </div>
      </div>

      {/* Aligned Sequences */}
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-50">
        {/* Query Sequence */}
        <AlignedSequenceDisplay
          sequenceName={alignment.queryName || 'Query Sequence'}
          alignedSequence={alignment.alignedQuery || ''}
          sequenceType="protein"
        />

        {/* Subject Sequence */}
        <AlignedSequenceDisplay
          sequenceName={alignment.subjectName || 'Subject Sequence'}
          alignedSequence={alignment.alignedSubject || ''}
          sequenceType="protein"
        />

        {/* SIFT Predictions Section */}
        {alignment.sift && alignment.sift.length > 0 && (
          <div className="bg-white border border-purple-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
              <FlaskConical size={16} />
              SIFT Variant Predictions ({alignment.sift.length} variants)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-purple-900">Position</th>
                    <th className="px-3 py-2 text-left font-bold text-purple-900">Variant</th>
                    <th className="px-3 py-2 text-left font-bold text-purple-900">SIFT Score</th>
                    <th className="px-3 py-2 text-left font-bold text-purple-900">Prediction</th>
                    <th className="px-3 py-2 text-left font-bold text-purple-900">BLOSUM62</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {alignment.sift.map((prediction, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/50">
                      <td className="px-3 py-2 font-mono">{prediction.position}</td>
                      <td className="px-3 py-2 font-mono font-bold">
                        {prediction.reference_aa}{prediction.position}{prediction.variant_aa}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${
                          prediction.sift_score <= 0.05 ? 'text-red-600' : 
                          prediction.sift_score <= 0.1 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {prediction.sift_score.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          prediction.prediction === 'DELETERIOUS' 
                            ? 'bg-red-100 text-red-700' 
                            : prediction.prediction === 'TOLERATED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {prediction.prediction}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <span className={`${
                          prediction.blosum62_score > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {prediction.blosum62_score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* UniProt Results Section */}
        {alignment.uniprot && alignment.uniprot.length > 0 && (
          <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
              <Database size={16} />
              UniProt Protein Matches ({alignment.uniprot.length} proteins)
            </h3>
            <div className="space-y-3">
              {alignment.uniprot.map((protein, idx) => (
                <div key={idx} className="border border-blue-100 rounded p-3 hover:bg-blue-50/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-blue-900 text-sm">{protein.proteinName}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        <span className="font-semibold">Accession:</span> {protein.accession}
                      </div>
                    </div>
                    <a
                      href={protein.uniprot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded"
                    >
                      View on UniProt
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-slate-500">Organism:</span>
                      <span className="ml-1 font-medium">{protein.organism}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Gene:</span>
                      <span className="ml-1 font-medium">{protein.geneName}</span>
                    </div>
                    {protein.blast_score !== undefined && (
                      <>
                        <div>
                          <span className="text-slate-500">BLAST Score:</span>
                          <span className="ml-1 font-bold text-blue-600">{protein.blast_score}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">E-value:</span>
                          <span className="ml-1 font-bold text-blue-600">{protein.evalue}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {protein.function && protein.function !== 'Unknown' && (
                    <div className="mt-2 pt-2 border-t border-blue-100">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">FUNCTION:</div>
                      <div className="text-xs text-slate-700">{protein.function}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Clustal Output (collapsible) */}
        {alignment.rawAlignment && (
          <details className="bg-gray-800 p-4 rounded-lg">
            <summary className="text-white font-bold cursor-pointer mb-2">
              📄 Raw Clustal Omega Output (click to expand)
            </summary>
            <pre className="text-white text-xs overflow-x-auto font-mono mt-2">
              {alignment.rawAlignment}
            </pre>
          </details>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="font-bold text-slate-600 mb-2">Amino Acid Color Guide:</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex gap-2 items-center">
            <span className="w-4 h-4 bg-orange-500 rounded text-white text-[9px] font-bold flex items-center justify-center">A</span>
            <span>Hydrophobic (AILMFVPWG)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-4 h-4 bg-green-500 rounded text-white text-[9px] font-bold flex items-center justify-center">S</span>
            <span>Polar (STCNQ)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-4 h-4 bg-blue-500 rounded text-white text-[9px] font-bold flex items-center justify-center">D</span>
            <span>Charged (DEKHR)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-4 h-4 bg-purple-500 rounded text-white text-[9px] font-bold flex items-center justify-center">F</span>
            <span>Aromatic (FWY)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlignmentWorksheetView;
