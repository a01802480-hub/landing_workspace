import { AlignmentSettings, AlignmentResult } from '../types'

// Use environment variable for backend URL, with a fallback for local development.
// This makes the application more configurable and less prone to hardcoding issues.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Real sequence alignment using ClustalOmega backend
 * Calls the FastAPI backend at /align endpoint which submits to EBI ClustalOmega
 * Returns raw alignment output exactly as ClustalOmega provides it
 */
export async function simulateAlignment(seq1: string, seq2: string, settings: AlignmentSettings): Promise<AlignmentResult> {
  try {
    console.log(`🚀 Alignment: Attempting to connect to backend at ${BACKEND_URL}/align...`)
    console.log('📤 Sequence 1:', seq1.substring(0, 50) + '... (length: ' + seq1.length + ')')
    console.log('📤 Sequence 2:', seq2.substring(0, 50) + '... (length: ' + seq2.length + ')')
    console.log('⚙️  Settings:', JSON.stringify(settings, null, 2))
    console.log(`🔧 Engine selected: algorithm=${settings.algorithm}, engine=${settings.engine || 'clustalo'}`)
    
    const response = await fetch(`${BACKEND_URL}/align`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sequence1: seq1,
        sequence2: seq2,
        engine: settings.engine || 'clustalo',
        run_uniprot: settings.runUniprot || false,
        run_sift: settings.runSift || false
      }),
    })

    console.log('📡 Alignment: Response status:', response.status)
    
    let data;
    try {
      data = await response.json()
    } catch (e) {
      console.error('❌ Failed to parse response as JSON:', e)
      throw new Error(`Backend response not JSON. Status: ${response.status}. The backend might not be running.`)
    }
    
    console.log('📨 Alignment: Backend response:', data)
    
    // Log which engine was actually used by the backend
    if (data.engine || data.engine_used) {
      console.log(`✅ Backend confirms engine used: ${data.engine} (${data.engine_used || 'N/A'})`)
    }

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || `HTTP error! Status: ${response.status}`
      console.error('❌ Backend error:', errorMsg)
      throw new Error(`Backend error: ${errorMsg}`)
    }

    if (data.status === 'success') {
      // Get raw alignment text from ClustalOmega (clustal_num format)
      const rawAlignmentText = data.message
      // ADDED: Log the raw text from the backend for easier debugging.
      console.log('📝 Alignment: Raw text received from backend:\n', rawAlignmentText);
      
      // REWRITTEN: The original parser was too strict. This new parser is more robust
      // and handles common variations in Clustal output format.
      const lines = rawAlignmentText.split('\n').filter(line => line.trim() !== '');
      const seqData: Record<string, string> = {};
      
      console.log('🔍 Parsing alignment...');

      for (const line of lines) {
          // Skip header, footer, and comparison lines
          if (line.includes('CLUSTAL') || line.includes('*') || line.includes(':') || line.includes('.')) {
              continue;
          }
          
          const parts = line.trim().split(/\s+/);
          // A valid sequence line has at least a name and a sequence part.
          if (parts.length >= 2) {
              const name = parts[0];
              const seqPart = parts[1];
              
              // Basic validation that it's a sequence line (name exists, seqPart looks like a sequence)
              if (name && seqPart && /^[A-Z-]+$/.test(seqPart)) {
                  if (!seqData[name]) {
                      seqData[name] = '';
                  }
                  seqData[name] += seqPart;
              }
          }
      }

      console.log('📦 Parsed data object:', seqData);

      const names = Object.keys(seqData);
      const alignedQuery = names.length > 0 ? seqData[names[0]] : '';
      const alignedSubject = names.length > 1 ? seqData[names[1]] : '';

      if (!alignedQuery || !alignedSubject) {
        // ADDED: More descriptive error message.
        throw new Error("Could not parse aligned sequences from ClustalOmega output. The backend response format may have changed. Check console for raw output.");
      }

      // Calculate metrics based on the parsed sequences
      const len = alignedQuery.length;
      let identical = 0;
      let gaps = 0;
      let alignedLength = 0;

      for (let i = 0; i < len; i++) {
          if (alignedQuery[i] !== '-' && alignedSubject[i] !== '-') {
              alignedLength++;
          }
          if (alignedQuery[i] === alignedSubject[i] && alignedQuery[i] !== '-') {
              identical++;
          }
          if (alignedQuery[i] === '-' || alignedSubject[i] === '-') {
              gaps++;
          }
      }

      const identity = alignedLength > 0 ? (identical / alignedLength) * 100 : 0;
      const coverage = seq1.length > 0 ? (alignedLength / seq1.length) * 100 : 0;
      const score = identical * 10 - gaps * (settings.gapOpenPenalty || 10);

      return {
        query: seq1,
        subject: seq2,
        alignedQuery,
        alignedSubject,
        identity: parseFloat(identity.toFixed(2)),
        coverage: parseFloat(coverage.toFixed(2)),
        score: parseFloat(score.toFixed(2)),
        algorithm: settings.algorithm,
        // ADDED: Include the raw ClustalOmega output in the result object.
        rawAlignment: rawAlignmentText,
        // ADDED: Include UniProt and SIFT data if available
        uniprot: data.uniprot || undefined,
        sift: data.sift || undefined,
      };
    }

    throw new Error(`Backend returned: ${data.status} - ${data.message || data.detail || 'Unknown error'}`)
  } catch (error) {
    console.error('❌ Alignment: Error occurred:', error)

    // ADDED: Specific error handling for network failures.
    // This provides a much clearer error message to the user when the backend is not running.
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`Could not connect to the backend server at ${BACKEND_URL}. Please ensure the backend is running and accessible.`);
    }

    throw error
  }
}
