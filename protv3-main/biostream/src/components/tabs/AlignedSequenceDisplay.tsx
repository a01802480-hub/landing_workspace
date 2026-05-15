import React from 'react';

interface AlignedSequenceDisplayProps {
  sequenceName: string;
  alignedSequence: string;
  sequenceType?: 'protein' | 'dna';
}

/**
 * Displays an aligned sequence with:
 * - Position numbers every 5 amino acids
 * - Colored squares for each residue
 * - Proper alignment formatting
 */
const AlignedSequenceDisplay: React.FC<AlignedSequenceDisplayProps> = ({
  sequenceName,
  alignedSequence,
  sequenceType = 'protein',
}) => {
  const SEQUENCE_LINE_LENGTH = 60; // Characters per line

  /**
   * Get background color for a character based on residue type
   */
  const getCharBgColor = (char: string): string => {
    const c = char.toUpperCase();

    if (c === '-') return 'bg-gray-200 text-gray-600'; // Gap

    if (sequenceType === 'dna') {
      if (c === 'A') return 'bg-red-500 text-white';
      if (c === 'T') return 'bg-blue-500 text-white';
      if (c === 'G') return 'bg-yellow-500 text-black';
      if (c === 'C') return 'bg-green-500 text-white';
      return 'bg-gray-300 text-gray-700';
    }

    // PROTEIN - Amino acid coloring
    if ('AILMFVPWG'.includes(c)) return 'bg-orange-500 text-white'; // Hydrophobic
    if ('STCNQ'.includes(c)) return 'bg-green-500 text-white'; // Polar
    if ('DEKHR'.includes(c)) return 'bg-blue-500 text-white'; // Charged
    if ('FWY'.includes(c)) return 'bg-purple-500 text-white'; // Aromatic
    return 'bg-gray-300 text-gray-700';
  };

  /**
   * Format sequence into lines with position markers every 5 residues
   */
  const formatSequenceWithPositions = (sequence: string) => {
    const lines: Array<{ chars: string[]; positions: number[] }> = [];
    let currentLine: Array<{ char: string; position: number }> = [];
    let residueCount = 0;

    for (let i = 0; i < sequence.length; i++) {
      const char = sequence[i];
      
      // Only count non-gap characters as positions
      if (char !== '-') {
        residueCount++;
      }

      currentLine.push({ char, position: residueCount });

      // When line is full or we hit a position divisible by 5, add marker
      if (currentLine.length >= SEQUENCE_LINE_LENGTH) {
        const chars = currentLine.map(item => item.char);
        const positions = currentLine.map(item => item.position);
        lines.push({ chars, positions });
        currentLine = [];
      }
    }

    // Add remaining characters
    if (currentLine.length > 0) {
      const chars = currentLine.map(item => item.char);
      const positions = currentLine.map(item => item.position);
      lines.push({ chars, positions });
    }

    return lines;
  };

  const sequenceLines = formatSequenceWithPositions(alignedSequence);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Sequence Name Header */}
      <div className="mb-3 pb-2 border-b border-gray-200">
        <h4 className="text-sm font-bold text-gray-800 font-mono">{sequenceName}</h4>
        <p className="text-xs text-gray-500 mt-1">
          Length: {alignedSequence.replace(/-/g, '').length} residues | 
          Aligned length: {alignedSequence.length} (with gaps)
        </p>
      </div>

      {/* Sequence Display with Position Numbers */}
      <div className="font-mono text-xs overflow-x-auto">
        {sequenceLines.map((line, lineIdx) => {
          // Find the position number for residues at position 5, 10, 15, etc.
          const getPositionLabel = (charIdx: number) => {
            const position = line.positions[charIdx];
            // Show position number only if it's divisible by 5 or it's the first/last
            if (position % 5 === 0 || charIdx === 0 || charIdx === line.chars.length - 1) {
              return position;
            }
            return null;
          };

          return (
            <div key={lineIdx} className="flex items-start gap-2 mb-1">
              {/* Sequence with colored squares */}
              <div className="flex flex-wrap gap-0 flex-1">
                {line.chars.map((char, charIdx) => (
                  <div key={charIdx} className="relative inline-flex flex-col items-center">
                    {/* Colored square */}
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded ${getCharBgColor(char)} border border-gray-300`}
                      title={`Position: ${line.positions[charIdx]}`}
                    >
                      {char}
                    </span>
                    {/* Position number (only every 5 residues) */}
                    {getPositionLabel(charIdx) !== null && (
                      <span className="text-[8px] text-gray-500 font-mono mt-0.5 leading-none">
                        {getPositionLabel(charIdx)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlignedSequenceDisplay;
