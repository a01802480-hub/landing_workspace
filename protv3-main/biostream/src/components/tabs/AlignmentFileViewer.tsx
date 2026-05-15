import React, { useState } from 'react';
import { AlignmentResult } from '../../types';
import { parseAlignedSequences, formatSequenceWithPositions, generateAlignmentFileName } from '../../utils/alignmentParser';
import { ChevronLeft, Download, Edit2, Save, X } from 'lucide-react';

interface AlignmentFileViewerProps {
  alignment: AlignmentResult;
  onBack: () => void;
  onUpdateAlignment?: (updatedAlignment: AlignmentResult) => void;
}

/**
 * Comprehensive alignment viewer that displays:
 * - Alignment file with proper naming
 * - Amino acids as colored squares with letters inside
 * - Position numbers every 5 residues
 * - Differences list in V2A notation with positions
 * - Editable sequences
 */
const AlignmentFileViewer: React.FC<AlignmentFileViewerProps> = ({
  alignment,
  onBack,
  onUpdateAlignment,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuery, setEditedQuery] = useState(alignment.alignedQuery || '');
  const [editedSubject, setEditedSubject] = useState(alignment.alignedSubject || '');

  if (!alignment) return null;

  const fileName = alignment.name || generateAlignmentFileName(
    alignment.queryName || 'Query',
    alignment.subjectName || 'Subject'
  );

  // Use editable sequences if in edit mode, otherwise use original
  const querySequence = isEditing ? editedQuery : (alignment.editableAlignedQuery || alignment.alignedQuery);
  const subjectSequence = isEditing ? editedSubject : (alignment.editableAlignedSubject || alignment.alignedSubject);

  // Parse differences
  const differences = parseAlignedSequences(querySequence, subjectSequence);

  /**
   * Get background color for a character based on residue type
   */
  const getCharBgColor = (char: string): string => {
    const c = char.toUpperCase();

    if (c === '-') return 'bg-gray-200 text-gray-600'; // Gap

    // PROTEIN - Amino acid coloring
    if ('AILMFVPWG'.includes(c)) return 'bg-orange-500 text-white'; // Hydrophobic
    if ('STCNQ'.includes(c)) return 'bg-green-500 text-white'; // Polar
    if ('DEKHR'.includes(c)) return 'bg-blue-500 text-white'; // Charged
    if ('FWY'.includes(c)) return 'bg-purple-500 text-white'; // Aromatic
    return 'bg-gray-300 text-gray-700';
  };

  /**
   * Download the alignment as a text file
   */
  const handleDownload = () => {
    const content = `Alignment: ${fileName}
Algorithm: ${alignment.algorithm}
Identity: ${alignment.identity?.toFixed(2)}%
Coverage: ${alignment.coverage?.toFixed(2)}%
Score: ${alignment.score?.toFixed(2)}

Query Sequence (${alignment.queryName}):
${querySequence}

Subject Sequence (${alignment.subjectName}):
${subjectSequence}

Differences (${differences.length} total):
${differences.map(d => `Position ${d.queryPosition}/${d.subjectPosition}: ${d.notation}`).join('\n')}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Save edited sequences
   */
  const handleSaveEdit = () => {
    const updatedAlignment = {
      ...alignment,
      editableAlignedQuery: editedQuery,
      editableAlignedSubject: editedSubject,
    };
    
    if (onUpdateAlignment) {
      onUpdateAlignment(updatedAlignment);
    }
    
    setIsEditing(false);
  };

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditedQuery(alignment.alignedQuery || '');
    setEditedSubject(alignment.alignedSubject || '');
    setIsEditing(false);
  };

  const queryLines = formatSequenceWithPositions(querySequence, 60, 5);
  const subjectLines = formatSequenceWithPositions(subjectSequence, 60, 5);

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
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
            >
              <Download size={14} />
              Download
            </button>
            {!isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditedQuery(querySequence);
                  setEditedSubject(subjectSequence);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
              >
                <Edit2 size={14} />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded"
                >
                  <Save size={14} />
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-xs font-bold rounded"
                >
                  <X size={14} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* File Name */}
        <h2 className="text-sm font-bold text-slate-800 mb-2">{fileName}</h2>
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
          {isEditing && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded animate-pulse">
              ✏️ EDITING MODE
            </span>
          )}
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
          <div className="text-[8px] font-bold text-slate-500 mb-1">DIFFERENCES</div>
          <div className="text-base font-bold text-orange-600">{differences.length}</div>
        </div>
      </div>

      {/* Aligned Sequences */}
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-50">
        {/* Query Sequence */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-3 pb-2 border-b border-gray-200">
            <h4 className="text-sm font-bold text-gray-800 font-mono">
              {alignment.queryName || 'Query Sequence'}
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Length: {querySequence.replace(/-/g, '').length} residues | 
              Aligned length: {querySequence.length} (with gaps)
            </p>
          </div>

          <div className="font-mono text-xs overflow-x-auto">
            {queryLines.map((line, lineIdx) => (
              <div key={lineIdx} className="flex items-start gap-2 mb-1">
                <div className="flex flex-wrap gap-0 flex-1">
                  {line.chars.map((char, charIdx) => (
                    <div key={charIdx} className="relative inline-flex flex-col items-center">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded ${getCharBgColor(char)} border border-gray-300`}
                        title={`Position: ${line.positions[charIdx]}`}
                      >
                        {char}
                      </span>
                      {line.positionLabels[charIdx] !== null && (
                        <span className="text-[8px] text-gray-500 font-mono mt-0.5 leading-none">
                          {line.positionLabels[charIdx]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject Sequence */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-3 pb-2 border-b border-gray-200">
            <h4 className="text-sm font-bold text-gray-800 font-mono">
              {alignment.subjectName || 'Subject Sequence'}
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Length: {subjectSequence.replace(/-/g, '').length} residues | 
              Aligned length: {subjectSequence.length} (with gaps)
            </p>
          </div>

          <div className="font-mono text-xs overflow-x-auto">
            {subjectLines.map((line, lineIdx) => (
              <div key={lineIdx} className="flex items-start gap-2 mb-1">
                <div className="flex flex-wrap gap-0 flex-1">
                  {line.chars.map((char, charIdx) => (
                    <div key={charIdx} className="relative inline-flex flex-col items-center">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded ${getCharBgColor(char)} border border-gray-300`}
                        title={`Position: ${line.positions[charIdx]}`}
                      >
                        {char}
                      </span>
                      {line.positionLabels[charIdx] !== null && (
                        <span className="text-[8px] text-gray-500 font-mono mt-0.5 leading-none">
                          {line.positionLabels[charIdx]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Differences List */}
        {differences.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="mb-3 pb-2 border-b border-gray-200">
              <h4 className="text-sm font-bold text-gray-800">
                🔴 Sequence Differences ({differences.length})
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Notation: V2A means Valine changed to Alanine at position 2
              </p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {differences.map((diff, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100"
                >
                  <span className="text-xs font-bold text-gray-600 min-w-[80px]">
                    #{diff.queryPosition}/{diff.subjectPosition}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${getCharBgColor(diff.queryAA)} border border-gray-300`}>
                      {diff.queryAA}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${getCharBgColor(diff.subjectAA)} border border-gray-300`}>
                      {diff.subjectAA}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-600 ml-2">
                      {diff.notation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {differences.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-sm font-bold text-green-700">Sequences are identical!</p>
            <p className="text-xs text-green-600 mt-1">No differences found between aligned sequences</p>
          </div>
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

export default AlignmentFileViewer;
