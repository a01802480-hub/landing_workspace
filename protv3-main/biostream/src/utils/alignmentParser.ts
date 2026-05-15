/**
 * Utility for parsing aligned sequences and extracting differences
 */

export interface AlignedPosition {
  position: number;           // 1-indexed position in the alignment
  queryAA: string;           // Amino acid in query sequence
  subjectAA: string;         // Amino acid in subject sequence
  queryPosition: number;     // Actual position in query (excluding gaps)
  subjectPosition: number;   // Actual position in subject (excluding gaps)
  isDifferent: boolean;      // Whether amino acids differ
  notation: string;          // e.g., "V2A" notation
}

/**
 * Parse two aligned sequences and extract all differences
 * @param alignedQuery - Query sequence with gaps
 * @param alignedSubject - Subject sequence with gaps
 * @returns Array of differences with V2A notation
 */
export function parseAlignedSequences(
  alignedQuery: string,
  alignedSubject: string
): AlignedPosition[] {
  const differences: AlignedPosition[] = [];
  let queryPos = 0;
  let subjectPos = 0;

  for (let i = 0; i < alignedQuery.length; i++) {
    const queryAA = alignedQuery[i];
    const subjectAA = alignedSubject[i];

    // Track actual positions (excluding gaps)
    if (queryAA !== '-') queryPos++;
    if (subjectAA !== '-') subjectPos++;

    // Only record differences if both positions have amino acids (not gaps)
    if (queryAA !== '-' && subjectAA !== '-' && queryAA !== subjectAA) {
      differences.push({
        position: i + 1,
        queryAA,
        subjectAA,
        queryPosition: queryPos,
        subjectPosition: subjectPos,
        isDifferent: true,
        notation: `${queryAA}${subjectPosition}${subjectAA}`,
      });
    }
  }

  return differences;
}

/**
 * Generate alignment file name from query and subject names
 */
export function generateAlignmentFileName(
  queryName: string,
  subjectName: string
): string {
  return `sequence ${queryName} - sequence ${subjectName} alignment`;
}

/**
 * Format sequence with position numbers every N residues
 */
export function formatSequenceWithPositions(
  sequence: string,
  charsPerLine: number = 60,
  positionInterval: number = 5
): Array<{
  chars: string[];
  positions: number[];
  positionLabels: Array<number | null>;
}> {
  const lines: Array<{ chars: string[]; positions: number[]; positionLabels: Array<number | null> }> = [];
  let currentPosition = 0;

  for (let i = 0; i < sequence.length; i += charsPerLine) {
    const lineChars = sequence.slice(i, i + charsPerLine).split('');
    const positions: number[] = [];
    const positionLabels: Array<number | null> = [];

    for (let j = 0; j < lineChars.length; j++) {
      if (lineChars[j] !== '-') {
        currentPosition++;
      }
      positions.push(currentPosition);

      // Add position label only at specified intervals
      if (currentPosition % positionInterval === 0) {
        positionLabels.push(currentPosition);
      } else {
        positionLabels.push(null);
      }
    }

    lines.push({ chars: lineChars, positions, positionLabels });
  }

  return lines;
}
