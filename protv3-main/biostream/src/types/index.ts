/**
 * Type definitions for BioStream application
 */
export interface BioFile {
  id: string;
  name: string;
  type: 'dna' | 'protein';
  sequence: string;
  createdAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  files: BioFile[];
  owner: string;
}

export interface Sequence {
  accession: string
  name: string
  organism: string
  length: number
  description: string
  sequence: string
  geneId?: string
}

export interface Workspace {
  id: string
  name: string
  owner: string
  description: string
  sequenceCount: number
  createdAt: Date
  files?: BioFile[]
}

// Represents a single amino acid position in an alignment with scoring and conservation info
export interface AminoAcidPosition {
  position: number;           // Position in the alignment (1-indexed)
  aa1: string;               // Amino acid from sequence 1
  aa2: string;               // Amino acid from sequence 2
  blosum62Score: number;     // BLOSUM62 score for this pair
  isConserved: boolean;      // Whether the amino acids are identical
  conservation: 'identical' | 'similar' | 'different';
}

/**
 * Represents UniProt protein information
 */
export interface UniprotProtein {
  accession: string
  proteinName: string
  organism: string
  geneName: string
  function: string
  sequence: string
  sequenceLength: number
  uniprot_url: string
  blast_score?: number
  evalue?: number
  identity?: number
}

/**
 * Represents SIFT prediction for a variant
 */
export interface SiftPrediction {
  position: number
  reference_aa: string
  variant_aa: string
  sift_score: number
  prediction: 'TOLERATED' | 'DELETERIOUS' | 'UNKNOWN'
  blosum62_score: number
}

export interface AlignmentResult {
  id?: string
  name?: string
  query: string
  subject: string
  algorithm: string
  identity: number
  coverage: number
  score: number
  alignedQuery: string
  alignedSubject: string
  // Sequence names from the alignment
  queryName?: string
  subjectName?: string
  // Amino acid-level position data with BLOSUM62 scores and conservation info
  aminoAcidPositions?: AminoAcidPosition[]
  // Raw alignment output from ClustalOmega (clustal_num format)
  rawAlignment?: string
  // Timestamp for when the alignment was created
  createdAt?: Date
  // Editable aligned sequences (for worksheet editing)
  editableAlignedQuery?: string
  editableAlignedSubject?: string
  // Additional metadata for worksheet view
  queryOrganism?: string
  subjectOrganism?: string
  queryGeneId?: string
  subjectGeneId?: string
  // Editable mutations list
  editableMutations?: AlignmentMutation[]
  // UniProt lookup results
  uniprot?: UniprotProtein[]
  // SIFT predictions
  sift?: SiftPrediction[]
}

/**
 * Represents a single mutation/disparity in the alignment
 * Used for the Excel-style editable worksheet
 */
export interface AlignmentMutation {
  id: string;                    // Unique ID for the mutation row
  index: number;                 // Position index in alignment
  mutation: string;              // e.g., "R94S", "E148del"
  queryAA: string;               // Amino acid in query
  subjectAA: string;             // Amino acid in subject
  position: number;              // Position number
  isEditable: boolean;           // Whether this row is currently being edited
}

export type WorksheetItem = Sequence | AlignmentResult

export interface WorksheetRow {
  id: string
  sequenceName: string
  species: string
  mutationScore: number
  apiStatus: 'pending' | 'success' | 'error'
}

export interface AlignmentSettings {
  algorithm: 'ClustalW' | 'MUSCLE' | 'TCoffee' | 'MAFFT' | 'Jalview'
  engine?: 'clustalo' | 'tcoffee' | 'mafft' | 'muscle' | 'jalview' // Backend engine name (lowercase)
  gapOpenPenalty: number
  substitutionMatrix: 'BLOSUM62' | 'PAM250'
  runUniprot?: boolean  // Whether to run UniProt lookup
  runSift?: boolean     // Whether to run SIFT predictions
}
