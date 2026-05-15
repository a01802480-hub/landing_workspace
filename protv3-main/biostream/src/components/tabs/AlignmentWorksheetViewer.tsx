import React, { useState, useCallback, useRef } from 'react';
import { AlignmentResult, AlignmentMutation } from '../../types';
import { ChevronLeft, Download, Edit2, Save, X, FileSpreadsheet, Image, FileText, Code, Activity, Database, FlaskConical } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Advanced Alignment WORKSHEET VIEWER
 * 
 * This component provides a comprehensive, Benchling-style alignment viewer with:
 * 1. High-fidelity sequence alignment visualization with conservation histogram
 * 2. Color-coded amino acids (Zappo color scheme)
 * 3. Position ruler beneath sequences
 * 4. Sequence headers with red bounding boxes for metadata
 * 5. Interactive Excel-style worksheet table for mutations
 * 6. Advanced download dropdown with multiple export formats
 * 
 * The file name follows the format: "alignment of sequences [name1] and [name2]"
 */

interface AlignmentWorksheetViewerProps {
  alignment: AlignmentResult;
  onBack: () => void;
  onUpdateAlignment?: (updatedAlignment: AlignmentResult) => void;
}

// Zappo color scheme for amino acids (industry standard)
const ZAPPO_COLORS: Record<string, { bg: string; text: string }> = {
  // Hydrophobic / Aliphatic
  A: { bg: '#B4B4B4', text: '#000' }, // Alanine - light gray
  V: { bg: '#B4B4B4', text: '#000' }, // Valine - light gray
  L: { bg: '#B4B4B4', text: '#000' }, // Leucine - light gray
  I: { bg: '#B4B4B4', text: '#000' }, // Isoleucine - light gray
  M: { bg: '#B4B4B4', text: '#000' }, // Methionine - light gray
  
  // Aromatic
  F: { bg: '#B4B4FF', text: '#000' }, // Phenylalanine - light blue
  W: { bg: '#B4B4FF', text: '#000' }, // Tryptophan - light blue
  Y: { bg: '#B4B4FF', text: '#000' }, // Tyrosine - light blue
  
  // Positive / Basic
  K: { bg: '#FF6666', text: '#000' }, // Lysine - red
  R: { bg: '#FF6666', text: '#000' }, // Arginine - red
  H: { bg: '#FFCCCC', text: '#000' }, // Histidine - light red
  
  // Negative / Acidic
  D: { bg: '#6666FF', text: '#fff' }, // Aspartic acid - blue
  E: { bg: '#6666FF', text: '#fff' }, // Glutamic acid - blue
  
  // Polar / Uncharged
  S: { bg: '#FF9966', text: '#000' }, // Serine - orange
  T: { bg: '#FF9966', text: '#000' }, // Threonine - orange
  N: { bg: '#FF9966', text: '#000' }, // Asparagine - orange
  Q: { bg: '#FF9966', text: '#000' }, // Glutamine - orange
  C: { bg: '#FFD700', text: '#000' }, // Cysteine - gold
  G: { bg: '#FFD700', text: '#000' }, // Glycine - gold
  P: { bg: '#FFD700', text: '#000' }, // Proline - gold
  
  // Gap
  '-': { bg: '#FFFFFF', text: '#999' },
};

/**
 * Get color for a specific amino acid
 */
const getAAColour = (aa: string): { bg: string; text: string } => {
  return ZAPPO_COLORS[aa.toUpperCase()] || { bg: '#FFFFFF', text: '#000' };
};

/**
 * Calculate conservation score for a column in the alignment
 * Returns a value between 0 (no conservation) and 1 (fully conserved)
 */
const calculateConservation = (queryAA: string, subjectAA: string): number => {
  if (queryAA === '-' || subjectAA === '-') return 0;
  if (queryAA === subjectAA) return 1;
  return 0.3; // Partial conservation for similar amino acids
};

/**
 * Parse aligned sequences to extract mutations/disparities
 * This algorithm identifies mismatches and deletions between the two sequences
 */
const parseMutations = (querySeq: string, subjectSeq: string): AlignmentMutation[] => {
  const mutations: AlignmentMutation[] = [];
  let queryPos = 0;
  let subjectPos = 0;

  // Iterate through each position in the aligned sequences
  for (let i = 0; i < querySeq.length; i++) {
    const queryAA = querySeq[i];
    const subjectAA = subjectSeq[i];

    // Track actual positions (excluding gaps)
    if (queryAA !== '-') queryPos++;
    if (subjectAA !== '-') subjectPos++;

    // Identify mismatches (both have amino acids but they differ)
    if (queryAA !== '-' && subjectAA !== '-' && queryAA !== subjectAA) {
      mutations.push({
        id: `mut-${i}`,
        index: i + 1,
        mutation: `${queryAA}${subjectPos}${subjectAA}`, // e.g., "R94S"
        queryAA,
        subjectAA,
        position: subjectPos,
        isEditable: false,
      });
    }
    // Identify deletions in query (gap in query, amino acid in subject)
    else if (queryAA === '-' && subjectAA !== '-') {
      mutations.push({
        id: `del-${i}`,
        index: i + 1,
        mutation: `${subjectAA}${subjectPos}del`, // e.g., "E148del"
        queryAA: '-',
        subjectAA,
        position: subjectPos,
        isEditable: false,
      });
    }
    // Identify deletions in subject (amino acid in query, gap in subject)
    else if (queryAA !== '-' && subjectAA === '-') {
      mutations.push({
        id: `del-${i}`,
        index: i + 1,
        mutation: `${queryAA}${queryPos}del`, // e.g., "K72del"
        queryAA,
        subjectAA: '-',
        position: queryPos,
        isEditable: false,
      });
    }
  }

  return mutations;
};

/**
 * Main Alignment Worksheet Viewer Component
 */
const AlignmentWorksheetViewer: React.FC<AlignmentWorksheetViewerProps> = ({
  alignment,
  onBack,
  onUpdateAlignment,
}) => {
  // Defensive check: ensure alignment data exists
  if (!alignment) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">⚠️</div>
          <p className="text-gray-600 text-lg font-bold">No alignment data available</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Back to Worksheet
          </button>
        </div>
      </div>
    );
  }

  // State for editing modes
  const [editedQuery, setEditedQuery] = useState(alignment.editableAlignedQuery || alignment.alignedQuery);
  const [editedSubject, setEditedSubject] = useState(alignment.editableAlignedSubject || alignment.alignedSubject);
  const [mutations, setMutations] = useState<AlignmentMutation[]>(
    alignment.editableMutations || parseMutations(
      alignment.editableAlignedQuery || alignment.alignedQuery,
      alignment.editableAlignedSubject || alignment.alignedSubject
    )
  );
  const [showMatches, setShowMatches] = useState(true);
  const [showMismatches, setShowMismatches] = useState(true);

  console.log('🔬 AlignmentWorksheetViewer rendering:', {
    name: alignment.name,
    hasQuery: !!alignment.alignedQuery,
    hasSubject: !!alignment.alignedSubject,
    queryLength: alignment.alignedQuery?.length || 0,
    subjectLength: alignment.alignedSubject?.length || 0,
  });
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingSequence, setEditingSequence] = useState<'query' | 'subject' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Ref for shared scroll container
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // State for download dropdown
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState({
    exportAlignmentPNG: false,
    exportAlignmentPDF: false,
    exportWorksheetCSV: false,
    exportWorksheetXLSX: false,
    exportRawFastas: false,
  });

  // State for post-alignment analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<string | null>(null);

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
          aligned_query: editedQuery,
          aligned_subject: editedSubject,
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

      // Notify parent component of update
      if (onUpdateAlignment) {
        onUpdateAlignment(updatedAlignment);
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

  /**
   * Generate the file name following the format: "alignment of sequences [name1] and [name2]"
   */
  const generateFileName = (): string => {
    const name1 = alignment.queryName || 'Query';
    const name2 = alignment.subjectName || 'Subject';
    return `alignment of sequences ${name1} and ${name2}`;
  };

  /**
   * Handle clicking on a mutation cell to edit it
   */
  const handleCellClick = useCallback((mutationId: string, currentValue: string) => {
    setEditingCell(mutationId);
    setEditValue(currentValue);
  }, []);

  /**
   * Save the edited mutation cell
   */
  const handleSaveCell = useCallback(() => {
    if (!editingCell) return;

    // Update the mutations array with the new value
    const updatedMutations = mutations.map(mut =>
      mut.id === editingCell ? { ...mut, mutation: editValue } : mut
    );

    setMutations(updatedMutations);
    setEditingCell(null);
    setEditValue('');

    // If there's an update callback, notify parent
    if (onUpdateAlignment) {
      onUpdateAlignment({
        ...alignment,
        editableMutations: updatedMutations,
      });
    }
  }, [editingCell, editValue, mutations, onUpdateAlignment, alignment]);

  /**
   * Handle saving edited sequences (called after inline editing)
   */
  const handleSaveSequences = useCallback(() => {
    // Re-parse mutations with new sequences
    const newMutations = parseMutations(editedQuery, editedSubject);
    setMutations(newMutations);

    if (onUpdateAlignment) {
      onUpdateAlignment({
        ...alignment,
        editableAlignedQuery: editedQuery,
        editableAlignedSubject: editedSubject,
        editableMutations: newMutations,
      });
    }
  }, [editedQuery, editedSubject, alignment, onUpdateAlignment]);

  /**
   * Handle download confirmation
   */
  const handleConfirmDownload = useCallback(() => {
    // Execute downloads based on selected options
    if (downloadOptions.exportWorksheetCSV) {
      exportAsCSV();
    }
    if (downloadOptions.exportRawFastas) {
      exportAsFasta();
    }
    if (downloadOptions.exportAlignmentPNG || downloadOptions.exportAlignmentPDF) {
      // Placeholder for PNG/PDF export - would require html2canvas or jsPDF
      alert('PNG/PDF export will be implemented with html2canvas/jsPDF library');
    }

    // Reset dropdown and options
    setShowDownloadDropdown(false);
    setDownloadOptions({
      exportAlignmentPNG: false,
      exportAlignmentPDF: false,
      exportWorksheetCSV: false,
      exportWorksheetXLSX: false,
      exportRawFastas: false,
    });
  }, [downloadOptions]);

  /**
   * Export mutations as CSV
   */
  const exportAsCSV = useCallback(() => {
    const headers = ['Mismatch_N (Index)', 'Mutation_M (Description)'];
    const rows = mutations.map(m => [m.index.toString(), m.mutation]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generateFileName()}_worksheet.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [mutations]);

  /**
   * Export sequences as FASTA
   */
  const exportAsFasta = useCallback(() => {
    const fastaContent = `>${alignment.queryName || 'Query'}\n${editedQuery}\n\n>${alignment.subjectName || 'Subject'}\n${editedSubject}`;
    
    const blob = new Blob([fastaContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generateFileName()}.fasta`;
    link.click();
    URL.revokeObjectURL(url);
  }, [alignment, editedQuery, editedSubject]);

  // Use edited sequences (always use the edited versions since we support inline editing)
  const querySeq = editedQuery;
  const subjectSeq = editedSubject;

  // Calculate conservation scores for the histogram
  const conservationScores = Array.from({ length: querySeq.length }, (_, i) => {
    return calculateConservation(querySeq[i], subjectSeq[i]);
  });

  // Generate position ruler (every 10 positions)
  const positionRuler = Array.from({ length: Math.ceil(querySeq.length / 10) }, (_, i) => ({
    position: (i + 1) * 10,
    offset: i * 10,
  }));

  /**
   * Render a single amino acid cell with proper coloring and inline editing support
   */
  const renderAACell = (aa: string, key: string, sequenceType: 'query' | 'subject', index: number) => {
    const colors = getAAColour(aa);
    const isCurrentlyEditing = editingSequence === sequenceType && editingIndex === index;
    
    if (isCurrentlyEditing) {
      return (
        <input
          key={key}
          type="text"
          maxLength={1}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.toUpperCase())}
          onBlur={() => {
            // Save the edit
            const newSequence = sequenceType === 'query' 
              ? editedQuery.substring(0, index) + editValue + editedQuery.substring(index + 1)
              : editedSubject.substring(0, index) + editValue + editedSubject.substring(index + 1);
            
            if (sequenceType === 'query') {
              setEditedQuery(newSequence);
            } else {
              setEditedSubject(newSequence);
            }
            
            setEditingSequence(null);
            setEditingIndex(null);
            setEditValue('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setEditingSequence(null);
              setEditingIndex(null);
              setEditValue('');
            }
          }}
          className="w-4 h-4 text-[9px] font-bold text-center border-2 border-indigo-500 focus:outline-none"
          style={{
            backgroundColor: '#FEF08A',
            fontFamily: 'monospace',
          }}
          autoFocus
        />
      );
    }
    
    return (
      <span
        key={key}
        className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold border border-gray-300 cursor-pointer hover:border-indigo-400 hover:scale-110 transition-all"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          fontFamily: 'monospace',
        }}
        title={aa === '-' ? 'Gap' : `Amino acid: ${aa} (Click to edit)`}
        onClick={() => {
          setEditingSequence(sequenceType);
          setEditingIndex(index);
          setEditValue(aa);
        }}
      >
        {aa}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* HEADER BAR */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-slate-50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 hover:bg-white rounded text-slate-700 hover:text-indigo-600 transition font-medium text-sm"
          >
            <ChevronLeft size={18} />
            Back to Worksheet
          </button>

          {/* ANALYSIS BUTTONS - Run SIFT/UniProt */}
          <div className="flex gap-2">
            <button
              onClick={() => handleRunAnalysis('sift')}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-bold rounded shadow-md transition"
            >
              {isAnalyzing && analysisType === 'sift' ? (
                <Activity className="animate-spin" size={16} />
              ) : (
                <FlaskConical size={16} />
              )}
              Run SIFT
            </button>
            <button
              onClick={() => handleRunAnalysis('uniprot')}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded shadow-md transition"
            >
              {isAnalyzing && analysisType === 'uniprot' ? (
                <Activity className="animate-spin" size={16} />
              ) : (
                <Database size={16} />
              )}
              Run UniProt
            </button>

            {/* ADVANCED DOWNLOAD BUTTON */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded shadow-md transition"
              >
                <Download size={16} />
                Download
              </button>

              {/* Download Dropdown Modal */}
              {showDownloadDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Export Options</h3>
                    
                    <div className="space-y-3">
                      {/* Export Alignment (PNG/PDF) */}
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={downloadOptions.exportAlignmentPNG || downloadOptions.exportAlignmentPDF}
                          onChange={(e) => {
                            setDownloadOptions(prev => ({
                              ...prev,
                              exportAlignmentPNG: e.target.checked,
                              exportAlignmentPDF: e.target.checked,
                            }));
                          }}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <Image size={16} className="text-gray-600" />
                        <div>
                          <div className="text-xs font-bold text-gray-700">Export Alignment</div>
                          <div className="text-[10px] text-gray-500">PNG / PDF</div>
                        </div>
                      </label>

                      {/* Export Worksheet (CSV/XLSX) */}
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={downloadOptions.exportWorksheetCSV || downloadOptions.exportWorksheetXLSX}
                          onChange={(e) => {
                            setDownloadOptions(prev => ({
                              ...prev,
                              exportWorksheetCSV: e.target.checked,
                              exportWorksheetXLSX: e.target.checked,
                            }));
                          }}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <FileSpreadsheet size={16} className="text-gray-600" />
                        <div>
                          <div className="text-xs font-bold text-gray-700">Export Worksheet</div>
                          <div className="text-[10px] text-gray-500">CSV / XLSX</div>
                        </div>
                      </label>

                      {/* Export Raw Fastas */}
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={downloadOptions.exportRawFastas}
                          onChange={(e) => {
                            setDownloadOptions(prev => ({
                              ...prev,
                              exportRawFastas: e.target.checked,
                            }));
                          }}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <Code size={16} className="text-gray-600" />
                        <div>
                          <div className="text-xs font-bold text-gray-700">Export Raw Fastas</div>
                          <div className="text-[10px] text-gray-500">FASTA format</div>
                        </div>
                      </label>
                    </div>

                    {/* Confirm Download Button */}
                    <button
                      onClick={handleConfirmDownload}
                      disabled={!Object.values(downloadOptions).some(v => v)}
                      className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition"
                    >
                      Confirm Download
                    </button>

                    {/* Cancel Button */}
                    <button
                      onClick={() => setShowDownloadDropdown(false)}
                      className="w-full mt-2 px-4 py-2 text-gray-600 text-xs hover:bg-gray-100 rounded transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FILE TITLE */}
        <h2 className="text-base font-bold text-slate-800 mb-1">{generateFileName()}</h2>
        
        {/* METADATA TAGS */}
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
          {mutations.length > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">
              🔴 {mutations.length} Mutations
            </span>
          )}
        </div>
      </div>

      {/* SCROLLABLE CONTENT AREA */}
      <div className="flex-1 overflow-auto p-4 space-y-6 bg-gray-50">
        {/* BENCHMARK-STYLE ALIGNMENT VIEWER */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          {/* Sequence Headers with Red Bounding Boxes */}
          <div className="mb-4 space-y-2">
            {/* Query Header */}
            <div className="flex items-center gap-3 p-2 border-2 border-red-500 rounded bg-red-50">
              <div className="flex-1">
                <div className="text-xs font-bold text-gray-800">{alignment.queryName || 'Query Sequence'}</div>
                {alignment.queryOrganism && (
                  <div className="text-[10px] text-gray-600">Organism: {alignment.queryOrganism}</div>
                )}
                {alignment.queryGeneId && (
                  <div className="text-[10px] text-gray-600">Gene ID: {alignment.queryGeneId}</div>
                )}
              </div>
              <div className="text-[10px] font-mono text-gray-500">
                Length: {querySeq.replace(/-/g, '').length} aa
              </div>
            </div>

            {/* Subject Header */}
            <div className="flex items-center gap-3 p-2 border-2 border-red-500 rounded bg-red-50">
              <div className="flex-1">
                <div className="text-xs font-bold text-gray-800">{alignment.subjectName || 'Subject Sequence'}</div>
                {alignment.subjectOrganism && (
                  <div className="text-[10px] text-gray-600">Organism: {alignment.subjectOrganism}</div>
                )}
                {alignment.subjectGeneId && (
                  <div className="text-[10px] text-gray-600">Gene ID: {alignment.subjectGeneId}</div>
                )}
              </div>
              <div className="text-[10px] font-mono text-gray-500">
                Length: {subjectSeq.replace(/-/g, '').length} aa
              </div>
            </div>
          </div>

          {/* Conservation Histogram - Mismatches highlighted in bright red */}
          <div className="mb-2 h-10 bg-gray-100 rounded border border-gray-200 relative overflow-hidden">
            <div className="absolute inset-0 flex items-end">
              {conservationScores.map((score, i) => {
                // Check if this position is a mismatch
                const isMismatch = querySeq[i] !== '-' && subjectSeq[i] !== '-' && querySeq[i] !== subjectSeq[i];
                const isGap = querySeq[i] === '-' || subjectSeq[i] === '-';
                
                return (
                  <div
                    key={i}
                    className="flex-1 transition-all"
                    style={{
                      height: `${score * 100}%`,
                      backgroundColor: isMismatch ? '#FF0000' : (isGap ? '#E5E7EB' : '#9CA3AF'),
                      opacity: isMismatch ? 1 : (0.3 + score * 0.7),
                    }}
                    title={`Position ${i + 1}: ${isMismatch ? 'MISMATCH' : (score === 1 ? 'Identical' : score > 0.5 ? 'Similar' : 'Different')}`}
                  />
                );
              })}
            </div>
            <div className="absolute top-0 left-0 text-[8px] text-gray-500 px-1">Conservation</div>
          </div>

          {/* Aligned Sequences - Single Shared Scroll Container */}
          <div className="font-mono text-xs bg-white rounded border border-gray-200 overflow-hidden">
            {/* Shared Scrollable Area */}
            <div className="overflow-x-auto" ref={scrollRef}>
              <div className="inline-block min-w-max">
                {/* Query Sequence */}
                <div className="flex items-center mb-1 px-3 py-1">
                  <div className="w-20 text-[9px] font-bold text-gray-600 flex-shrink-0 pr-2 sticky left-0 bg-white z-10">Query:</div>
                  <div className="inline-flex whitespace-nowrap">
                    {querySeq.split('').map((aa, i) => renderAACell(aa, `q-${i}`, 'query', i))}
                  </div>
                </div>

                {/* Subject Sequence */}
                <div className="flex items-center mb-1 px-3 py-1">
                  <div className="w-20 text-[9px] font-bold text-gray-600 flex-shrink-0 pr-2 sticky left-0 bg-white z-10">Subject:</div>
                  <div className="inline-flex whitespace-nowrap">
                    {subjectSeq.split('').map((aa, i) => renderAACell(aa, `s-${i}`, 'subject', i))}
                  </div>
                </div>

                {/* Position Ruler */}
                <div className="flex items-center border-t border-gray-200 pt-2 px-3">
                  <div className="w-20 text-[9px] font-bold text-gray-600 flex-shrink-0 pr-2 sticky left-0 bg-white z-10">Position:</div>
                  <div className="inline-flex whitespace-nowrap h-5 relative">
                    {positionRuler.map(({ position, offset }) => (
                      <div
                        key={position}
                        className="absolute text-[8px] text-gray-500 font-bold"
                        style={{ left: `${offset * 16}px` }}
                      >
                        {position}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inline Editing Info */}
          <div className="mt-2 text-[10px] text-gray-500 px-3 py-2 bg-blue-50 rounded border border-blue-200">
            💡 <strong className="text-blue-700">Tip:</strong> Click any amino acid to edit it directly. Press Enter to save or Escape to cancel.
          </div>
        </div>

        {/* EXCEL-STYLE WORKSHEET TABLE */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-slate-50 to-white border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">📊 Alignment Analysis</h3>
                <p className="text-[10px] text-gray-500 mt-1">
                  Toggle between matches and mismatches to analyze your alignment
                </p>
              </div>
              
              {/* Match/Mismatch Toggle Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMatches(!showMatches)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                    showMatches
                      ? 'bg-green-600 text-white shadow-md hover:bg-green-700'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <span className="text-lg">{showMatches ? '✅' : '⬜'}</span>
                  Matches
                </button>
                <button
                  onClick={() => setShowMismatches(!showMismatches)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                    showMismatches
                      ? 'bg-red-600 text-white shadow-md hover:bg-red-700'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <span className="text-lg">{showMismatches ? '❌' : '⬜'}</span>
                  Mismatches
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3 mt-3">
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <p className="text-[10px] text-green-700 font-semibold">✅ Matches</p>
                <p className="text-xl font-bold text-green-800">
                  {querySeq.split('').filter((aa, i) => aa === subjectSeq[i] && aa !== '-').length}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-[10px] text-red-700 font-semibold">❌ Mismatches</p>
                <p className="text-xl font-bold text-red-800">
                  {querySeq.split('').filter((aa, i) => aa !== '-' && subjectSeq[i] !== '-' && aa !== subjectSeq[i]).length}
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-2">
                <p className="text-[10px] text-gray-700 font-semibold">➖ Gaps</p>
                <p className="text-xl font-bold text-gray-800">
                  {querySeq.split('').filter((aa, i) => aa === '-' || subjectSeq[i] === '-').length}
                </p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded p-2">
                <p className="text-[10px] text-indigo-700 font-semibold">📊 Identity</p>
                <p className="text-xl font-bold text-indigo-800">
                  {alignment.identity?.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* MUTATION TABLE - Only show mismatches when enabled */}
          {showMismatches && mutations.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="p-3 bg-red-50 border-b border-red-200">
                <h4 className="text-sm font-bold text-red-800">❌ Mismatches ({mutations.length} found)</h4>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-red-100 border-b border-red-200">
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-red-800 uppercase">
                      Mismatch_N (Index)
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-red-800 uppercase">
                      Mutation_M (Description)
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-red-800 uppercase">
                      Query AA
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-red-800 uppercase">
                      Subject AA
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-red-800 uppercase">
                      Position
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mutations.map((mutation, idx) => (
                    <tr
                      key={mutation.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      {/* Mismatch_N (Index) */}
                      <td className="px-4 py-2 text-sm font-mono font-bold text-gray-800">
                        {mutation.index}
                      </td>
                      
                      {/* Mutation_M (Description) - EDITABLE WITH YELLOW HIGHLIGHT */}
                      <td className="px-4 py-2">
                        {editingCell === mutation.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 px-2 py-1 border-2 border-indigo-500 rounded text-sm font-mono font-bold focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCell();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                            <button
                              onClick={handleSaveCell}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              <Save size={12} />
                            </button>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleCellClick(mutation.id, mutation.mutation)}
                            className="px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded text-sm font-mono font-bold text-gray-800 cursor-pointer hover:bg-yellow-200 transition inline-block"
                            title="Click to edit"
                          >
                            {mutation.mutation}
                          </div>
                        )}
                      </td>
                      
                      {/* Query AA */}
                      <td className="px-4 py-2">
                        {renderAACell(mutation.queryAA, `mq-${mutation.id}`)}
                      </td>
                      
                      {/* Subject AA */}
                      <td className="px-4 py-2">
                        {renderAACell(mutation.subjectAA, `ms-${mutation.id}`)}
                      </td>
                      
                      {/* Position */}
                      <td className="px-4 py-2 text-sm font-mono text-gray-600">
                        #{mutation.position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : showMismatches ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm font-bold text-green-700">No mismatches found!</p>
              <p className="text-xs text-green-600 mt-1">Sequences are identical at all positions</p>
            </div>
          ) : null}

          {/* MATCHES TABLE - Show when enabled */}
          {showMatches && (
            <div className="overflow-x-auto border-t border-gray-200">
              <div className="p-3 bg-green-50 border-b border-green-200">
                <h4 className="text-sm font-bold text-green-800">✅ Matches (Identical Positions)</h4>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-green-100 border-b border-green-200">
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-green-800 uppercase">
                      Position
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-green-800 uppercase">
                      Amino Acid
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-green-800 uppercase">
                      Query
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-green-800 uppercase">
                      Subject
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-green-800 uppercase">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {querySeq.split('').map((aa, i) => {
                    if (aa === subjectSeq[i] && aa !== '-') {
                      return (
                        <tr key={`match-${i}`} className="border-b border-green-100 hover:bg-green-50">
                          <td className="px-4 py-2 text-sm font-mono font-bold text-green-800">
                            #{i + 1}
                          </td>
                          <td className="px-4 py-2">
                            {renderAACell(aa, `match-${i}`)}
                          </td>
                          <td className="px-4 py-2 text-sm font-mono text-green-700">
                            {aa}
                          </td>
                          <td className="px-4 py-2 text-sm font-mono text-green-700">
                            {subjectSeq[i]}
                          </td>
                          <td className="px-4 py-2 text-xs text-green-600">
                            ✅ Identical
                          </td>
                        </tr>
                      );
                    }
                    return null;
                  }).filter(Boolean)}
                </tbody>
              </table>
            </div>
          )}

          {!showMatches && !showMismatches && (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-600">Enable matches or mismatches to view alignment analysis</p>
            </div>
          )}
        </div>

        {/* SIFT PREDICTIONS SECTION */}
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
            <div className="mt-3 p-2 bg-purple-50 rounded text-[10px] text-purple-700">
              <strong>Note:</strong> SIFT scores ≤ 0.05 are predicted deleterious (red), 0.05-0.10 are borderline (orange), and &gt; 0.10 are tolerated (green). BLOSUM62 shows substitution scores.
            </div>
          </div>
        )}

        {/* UNIPROT RESULTS SECTION */}
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

        {/* COLOR LEGEND */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="text-xs font-bold text-gray-700 mb-3">Zappo Color Scheme Legend:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['A', 'V', 'L', 'I', 'M'].map(aa => renderAACell(aa, `leg-hydro-${aa}`))}
              </div>
              <span className="text-[10px] text-gray-600">Hydrophobic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['F', 'W', 'Y'].map(aa => renderAACell(aa, `leg-arom-${aa}`))}
              </div>
              <span className="text-[10px] text-gray-600">Aromatic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['K', 'R', 'H'].map(aa => renderAACell(aa, `leg-pos-${aa}`))}
              </div>
              <span className="text-[10px] text-gray-600">Positive/Basic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['D', 'E'].map(aa => renderAACell(aa, `leg-neg-${aa}`))}
              </div>
              <span className="text-[10px] text-gray-600">Negative/Acidic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['S', 'T', 'N', 'Q'].map(aa => renderAACell(aa, `leg-polar-${aa}`))}
              </div>
              <span className="text-[10px] text-gray-600">Polar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['C', 'G', 'P'].map(aa => renderAACell(aa, `leg-special-${aa}`))}
              </div>
              <span className="text-[10px] text-gray-600">Special</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlignmentWorksheetViewer;
