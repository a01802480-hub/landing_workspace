/**
 * Parser for ClustalOmega alignment output
 * Converts clustal_num format into structured amino acid-level data
 */

// BLOSUM62 matrix for scoring aligned amino acids
// Each entry represents the score for aligning two specific amino acids
const BLOSUM62: { [key: string]: { [key: string]: number } } = {
  A: { A: 4, R: -1, N: -2, D: -2, C: 0, Q: -1, E: -1, G: 0, H: -2, I: -1, L: -1, K: -1, M: -1, F: -2, P: -1, S: 1, T: 0, W: -3, Y: -2, V: 0, '-': -4 },
  R: { A: -1, R: 5, N: 0, D: -2, C: -3, Q: 1, E: 0, G: -2, H: 0, I: -3, L: -2, K: 2, M: -1, F: -3, P: -2, S: -1, T: -1, W: -3, Y: -2, V: -3, '-': -4 },
  N: { A: -2, R: 0, N: 6, D: 1, C: -3, Q: 0, E: 0, G: 0, H: 1, I: -3, L: -3, K: 0, M: -2, F: -3, P: -2, S: 1, T: 0, W: -4, Y: -2, V: -3, '-': -4 },
  D: { A: -2, R: -2, N: 1, D: 6, C: -3, Q: 0, E: 2, G: -1, H: -1, I: -3, L: -4, K: -1, M: -3, F: -3, P: -1, S: 0, T: -1, W: -4, Y: -3, V: -3, '-': -4 },
  C: { A: 0, R: -3, N: -3, D: -3, C: 9, Q: -3, E: -4, G: -3, H: -3, I: -1, L: -1, K: -3, M: -1, F: -2, P: -3, S: -1, T: -1, W: -2, Y: -2, V: -1, '-': -4 },
  Q: { A: -1, R: 1, N: 0, D: 0, C: -3, Q: 5, E: 2, G: -2, H: 0, I: -3, L: -2, K: 1, M: 0, F: -3, P: -1, S: 0, T: -1, W: -2, Y: -1, V: -2, '-': -4 },
  E: { A: -1, R: 0, N: 0, D: 2, C: -4, Q: 2, E: 5, G: -2, H: 0, I: -3, L: -3, K: 1, M: -2, F: -3, P: -1, S: 0, T: -1, W: -3, Y: -2, V: -2, '-': -4 },
  G: { A: 0, R: -2, N: 0, D: -1, C: -3, Q: -2, E: -2, G: 6, H: -2, I: -4, L: -4, K: -2, M: -3, F: -3, P: -2, S: 0, T: -2, W: -2, Y: -3, V: -3, '-': -4 },
  H: { A: -2, R: 0, N: 1, D: -1, C: -3, Q: 0, E: 0, G: -2, H: 8, I: -3, L: -3, K: -1, M: -2, F: -1, P: -2, S: -1, T: -2, W: -2, Y: 2, V: -3, '-': -4 },
  I: { A: -1, R: -3, N: -3, D: -3, C: -1, Q: -3, E: -3, G: -4, H: -3, I: 4, L: 2, K: -3, M: 1, F: 0, P: -3, S: -2, T: -1, W: -3, Y: -1, V: 3, '-': -4 },
  L: { A: -1, R: -2, N: -3, D: -4, C: -1, Q: -2, E: -3, G: -4, H: -3, I: 2, L: 4, K: -2, M: 2, F: 0, P: -3, S: -2, T: -1, W: -2, Y: -1, V: 1, '-': -4 },
  K: { A: -1, R: 2, N: 0, D: -1, C: -3, Q: 1, E: 1, G: -2, H: -1, I: -3, L: -2, K: 5, M: -1, F: -3, P: -1, S: 0, T: -1, W: -3, Y: -2, V: -2, '-': -4 },
  M: { A: -1, R: -1, N: -2, D: -3, C: -1, Q: 0, E: -2, G: -3, H: -2, I: 1, L: 2, K: -1, M: 5, F: 0, P: -2, S: -1, T: -1, W: -1, Y: -1, V: 1, '-': -4 },
  F: { A: -2, R: -3, N: -3, D: -3, C: -2, Q: -3, E: -3, G: -3, H: -1, I: 0, L: 0, K: -3, M: 0, F: 6, P: -4, S: -2, T: -2, W: 1, Y: 3, V: -1, '-': -4 },
  P: { A: -1, R: -2, N: -2, D: -1, C: -3, Q: -1, E: -1, G: -2, H: -2, I: -3, L: -3, K: -1, M: -2, F: -4, P: 7, S: -1, T: -1, W: -4, Y: -3, V: -2, '-': -4 },
  S: { A: 1, R: -1, N: 1, D: 0, C: -1, Q: 0, E: 0, G: 0, H: -1, I: -2, L: -2, K: 0, M: -1, F: -2, P: -1, S: 4, T: 1, W: -3, Y: -2, V: -2, '-': -4 },
  T: { A: 0, R: -1, N: 0, D: -1, C: -1, Q: -1, E: -1, G: -2, H: -2, I: -1, L: -1, K: -1, M: -1, F: -2, P: -1, S: 1, T: 5, W: -2, Y: -2, V: 0, '-': -4 },
  W: { A: -3, R: -3, N: -4, D: -4, C: -2, Q: -2, E: -3, G: -2, H: -2, I: -3, L: -2, K: -3, M: -1, F: 1, P: -4, S: -3, T: -2, W: 11, Y: 2, V: -3, '-': -4 },
  Y: { A: -2, R: -2, N: -2, D: -3, C: -2, Q: -1, E: -2, G: -3, H: 2, I: -1, L: -1, K: -2, M: -1, F: 3, P: -3, S: -2, T: -2, W: 2, Y: 7, V: -1, '-': -4 },
  V: { A: 0, R: -3, N: -3, D: -3, C: -1, Q: -2, E: -2, G: -3, H: -3, I: 3, L: 1, K: -2, M: 1, F: -1, P: -2, S: -2, T: 0, W: -3, Y: -1, V: 4, '-': -4 },
  '-': { A: -4, R: -4, N: -4, D: -4, C: -4, Q: -4, E: -4, G: -4, H: -4, I: -4, L: -4, K: -4, M: -4, F: -4, P: -4, S: -4, T: -4, W: -4, Y: -4, V: -4, '-': 1 }
};

/**
 * Represents a single amino acid position in an alignment
 */
export interface AminoAcidPosition {
  position: number;           // Position in the alignment (1-indexed)
  aa1: string;               // Amino acid from sequence 1
  aa2: string;               // Amino acid from sequence 2
  blosum62Score: number;     // BLOSUM62 score for this pair
  isConserved: boolean;      // Whether the amino acids are identical
  conservation: 'identical' | 'similar' | 'different';
}

/**
 * Enhanced alignment result with amino acid-level details
 */
export interface EnhancedAlignmentResult {
  query: string;
  subject: string;
  algorithm: string;
  identity: number;
  coverage: number;
  score: number;
  alignedQuery: string;
  alignedSubject: string;
  // New fields for amino acid analysis
  queryName?: string;
  subjectName?: string;
  aminoAcidPositions: AminoAcidPosition[];
}

/**
 * Gets BLOSUM62 score for two amino acids
 * @param aa1 First amino acid
 * @param aa2 Second amino acid
 * @returns BLOSUM62 score, or -4 (worst) if lookup fails
 */
function getBLOSUM62Score(aa1: string, aa2: string): number {
  const key1 = aa1.toUpperCase();
  const key2 = aa2.toUpperCase();
  
  if (BLOSUM62[key1] && BLOSUM62[key1][key2] !== undefined) {
    return BLOSUM62[key1][key2];
  }
  return -4; // Default worst score
}

/**
 * Determines conservation level between two amino acids
 * @param aa1 First amino acid
 * @param aa2 Second amino acid
 * @returns Conservation type
 */
function getConservationLevel(aa1: string, aa2: string): 'identical' | 'similar' | 'different' {
  if (aa1.toUpperCase() === aa2.toUpperCase()) {
    return 'identical';
  }
  
  const score = getBLOSUM62Score(aa1, aa2);
  
  // Positive BLOSUM62 scores indicate similarity
  if (score > 0) {
    return 'similar';
  }
  
  return 'different';
}

/**
 * Parses ClustalOmega output (clustal_num format) into structured amino acid positions
 * @param alignmentText Raw alignment text from ClustalOmega
 * @param queryName Name/ID of query sequence
 * @param subjectName Name/ID of subject sequence
 * @returns Enhanced alignment result with amino acid-level data
 */
export function parseClustalOutput(
  alignmentText: string,
  alignedQuery: string,
  alignedSubject: string,
  queryName: string = 'Query',
  subjectName: string = 'Subject'
): AminoAcidPosition[] {
  const positions: AminoAcidPosition[] = [];
  
  // Validate that both sequences have the same length (they should after alignment)
  if (alignedQuery.length !== alignedSubject.length) {
    console.warn('Aligned sequences have different lengths');
    return positions;
  }
  
  // Process each position in the alignment
  for (let i = 0; i < alignedQuery.length; i++) {
    const aa1 = alignedQuery[i];
    const aa2 = alignedSubject[i];
    
    // Calculate BLOSUM62 score for this position pair
    const blosum62Score = getBLOSUM62Score(aa1, aa2);
    
    // Determine conservation level
    const conservation = getConservationLevel(aa1, aa2);
    const isConserved = conservation === 'identical';
    
    // Add to positions array
    positions.push({
      position: i + 1,          // Convert to 1-indexed
      aa1,
      aa2,
      blosum62Score,
      isConserved,
      conservation,
    });
  }
  
  return positions;
}

/**
 * Generates a CSV string from amino acid positions
 * Format: Position, Seq1 AA, Seq2 AA, BLOSUM62 Score, Conservation
 * @param positions Array of amino acid positions
 * @param seq1Name Name of first sequence
 * @param seq2Name Name of second sequence
 * @returns CSV formatted string
 */
export function generateAminoAcidCsv(
  positions: AminoAcidPosition[],
  seq1Name: string = 'Sequence1',
  seq2Name: string = 'Sequence2'
): string {
  // Build CSV header
  const headers = [
    'Position',
    `${seq1Name}_AA`,
    `${seq2Name}_AA`,
    'BLOSUM62_Score',
    'Conservation',
    'IsConserved'
  ];
  
  // Build CSV rows
  const rows = positions.map(pos => [
    pos.position.toString(),
    pos.aa1,
    pos.aa2,
    pos.blosum62Score.toString(),
    pos.conservation,
    pos.isConserved ? 'Yes' : 'No'
  ]);
  
  // Convert to CSV format
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ];
  
  return csvLines.join('\n');
}

/**
 * Downloads CSV content as a file
 * @param csvContent CSV formatted string
 * @param fileName Name of the file to download
 */
export function downloadCsv(csvContent: string, fileName: string = 'alignment.csv'): void {
  // Create a blob from the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Create a temporary URL for the blob
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // Set link attributes and trigger download
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
