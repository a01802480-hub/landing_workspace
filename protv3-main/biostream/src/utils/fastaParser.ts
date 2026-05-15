import { BioFile } from '../types'

export interface ParsedFastaSequence {
  header: string
  sequence: string
  proteinName: string
  isoformNumber: number
}

/**
 * Parses a FASTA file content string into individual sequences
 * Separates multiple sequences in a single FASTA file into an array of sequences
 * Each sequence retains its header information and is assigned an isoform number
 * 
 * @param content - Raw FASTA file content
 * @returns Array of parsed FASTA sequences with header and cleaned sequence
 */
export function parseFastaSequences(content: string): ParsedFastaSequence[] {
  console.log('🔍 PARSE FASTA SEQUENCES START')
  console.log('📝 Input content length:', content.length)
  
  const sequences: ParsedFastaSequence[] = []
  const lines = content.trim().split('\n')
  
  console.log('📋 Total lines:', lines.length)
  
  let currentHeader = ''
  let currentSequence = ''
  let sequenceCount: { [key: string]: number } = {}

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    const trimmed = line.trim()
    
    if (!trimmed) {
      console.log(`Line ${lineIdx}: (empty)`)
      continue
    }
    
    console.log(`Line ${lineIdx}: "${trimmed.substring(0, 60)}..."`)
    
    if (trimmed.startsWith('>')) {
      // SAVE: Previous sequence if exists
      if (currentHeader && currentSequence) {
        const proteinName = extractProteinName(currentHeader)
        
        if (!sequenceCount[proteinName]) {
          sequenceCount[proteinName] = 0
        }
        sequenceCount[proteinName]++
        
        const parsed = {
          header: currentHeader,
          sequence: currentSequence,
          proteinName,
          isoformNumber: sequenceCount[proteinName],
        }
        
        console.log(`  ✅ SAVED SEQUENCE: ${proteinName} (${currentSequence.length}bp)`)
        sequences.push(parsed)
      }
      
      // START: New sequence
      currentHeader = trimmed.substring(1)
      currentSequence = ''
      console.log(`  📌 NEW HEADER: "${currentHeader}"`)
    } else {
      // ACCUMULATE: Sequence data (remove spaces, keep letters and gaps)
      const cleaned = trimmed.replace(/\s+/g, '').replace(/\d+/g, '')
      currentSequence += cleaned
      console.log(`  ➕ ADDED: ${cleaned.length} chars (total so far: ${currentSequence.length})`)
    }
  }
  
  // SAVE: Last sequence
  if (currentHeader && currentSequence) {
    const proteinName = extractProteinName(currentHeader)
    
    if (!sequenceCount[proteinName]) {
      sequenceCount[proteinName] = 0
    }
    sequenceCount[proteinName]++
    
    const parsed = {
      header: currentHeader,
      sequence: currentSequence,
      proteinName,
      isoformNumber: sequenceCount[proteinName],
    }
    
    console.log(`  ✅ SAVED FINAL SEQUENCE: ${proteinName} (${currentSequence.length}bp)`)
    sequences.push(parsed)
  }
  
  console.log('✅ PARSE COMPLETE:', { totalSequences: sequences.length, sequences: sequences.map(s => ({ name: s.proteinName, len: s.sequence.length })) })
  return sequences
}

/**
 * Extracts the protein name from a FASTA header
 * Handles common FASTA header formats:
 * - ">protein_name" -> "protein_name"
 * - ">protein_name isoform 1" -> "protein_name"
 * - ">sp|UniProt|protein_name" -> "protein_name"
 * 
 * @param header - FASTA header line (without '>')
 * @returns Cleaned protein name
 */
function extractProteinName(header: string): string {
  // Get the first word/identifier before space, pipe, or other delimiters
  const match = header.match(/^[\w.-]+|(?<=\|)[\w.-]+/i)
  if (match) {
    return match[0]
  }
  return 'Unknown'
}

/**
 * Creates BioFile objects from parsed FASTA sequences
 * Generates filenames following the convention: proteinName_isoform_##.fasta
 * 
 * @param sequences - Array of parsed FASTA sequences
 * @param workspaceId - ID of the workspace to add files to
 * @param fileType - Type of file ('protein' or 'dna')
 * @returns Array of BioFile objects ready to be added to workspace
 */
export function createBioFilesFromSequences(
  sequences: ParsedFastaSequence[],
  workspaceId: string,
  fileType: 'protein' | 'dna' = 'protein'
): BioFile[] {
  console.log('🔧 CREATE BIO FILES FROM SEQUENCES:', { count: sequences.length, type: fileType })
  
  const bioFiles = sequences.map((seq) => {
    // Format: proteinName_isoform_01, proteinName_isoform_02, etc.
    const isoformLabel = String(seq.isoformNumber).padStart(2, '0')
    const fileName = `${seq.proteinName}_isoform_${isoformLabel}.fasta`
    
    const bioFile: BioFile = {
      id: `${workspaceId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: fileName,
      type: fileType,
      sequence: seq.sequence,
      createdAt: new Date(),
    }
    
    console.log(`  ✅ Created BioFile: ${bioFile.name} (${bioFile.sequence.length} bp)`)
    return bioFile
  })
  
  console.log(`✅ CREATED ${bioFiles.length} BIOFILES`)
  return bioFiles
}

/**
 * Processes a single FASTA file and converts it to multiple BioFile objects
 * This is the main entry point for file upload handling
 * 
 * @param fileName - Original file name
 * @param fileContent - Content of the FASTA file
 * @param workspaceId - ID of the workspace
 * @returns Array of BioFile objects, one per sequence in the FASTA
 */
export function processFastaFile(
  fileName: string,
  fileContent: string,
  workspaceId: string
): BioFile[] {
  console.log('📂 PROCESS FASTA FILE:', { fileName, contentLength: fileContent.length, workspaceId })
  
  // Determine file type from extension
  const ext = fileName.toLowerCase()
  const fileType = ext.endsWith('.faa') || ext.endsWith('.fasta') || ext.endsWith('.fa') || ext.endsWith('.pep') 
    ? 'protein' 
    : 'dna'
  
  console.log(`  📌 Detected file type: ${fileType}`)
  
  // Parse the FASTA content
  const sequences = parseFastaSequences(fileContent)
  
  console.log(`  ✅ Parsed ${sequences.length} sequences`)
  
  // If only one sequence, keep the original filename
  if (sequences.length === 1) {
    const seq = sequences[0]
    const bioFile: BioFile = {
      id: `${workspaceId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: fileName, // Keep original name for single sequence
      type: fileType,
      sequence: seq.sequence,
      createdAt: new Date(),
    }
    
    console.log(`✅ SINGLE SEQUENCE - Using original filename: ${fileName}`)
    console.log(`   Sequence length: ${bioFile.sequence.length}`)
    return [bioFile]
  }
  
  console.log(`🔀 MULTIPLE SEQUENCES DETECTED - Creating isoform files`)
  // If multiple sequences, create separate files with isoform naming
  return createBioFilesFromSequences(sequences, workspaceId, fileType)
}
