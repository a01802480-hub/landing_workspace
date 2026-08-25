import { AlignmentSettings, AlignmentResult } from '../types'

// Use environment variable for backend URL, with a fallback for local development.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// ─── Client-side fallback: Needleman-Wunsch global alignment ────────────────

const BLOSUM62_MATRIX: Record<string, Record<string, number>> = {
  A: { A: 4, R:-1, N:-2, D:-2, C: 0, Q:-1, E:-1, G: 0, H:-2, I:-1, L:-1, K:-1, M:-1, F:-2, P:-1, S: 1, T: 0, W:-3, Y:-2, V: 0 },
  R: { A:-1, R: 5, N: 0, D:-2, C:-3, Q: 1, E: 0, G:-2, H: 0, I:-3, L:-2, K: 2, M:-1, F:-3, P:-2, S:-1, T:-1, W:-3, Y:-2, V:-3 },
  N: { A:-2, R: 0, N: 6, D: 1, C:-3, Q: 0, E: 0, G: 0, H: 1, I:-3, L:-3, K: 0, M:-2, F:-3, P:-2, S: 1, T: 0, W:-4, Y:-2, V:-3 },
  D: { A:-2, R:-2, N: 1, D: 6, C:-3, Q: 0, E: 2, G:-1, H:-1, I:-3, L:-4, K:-1, M:-3, F:-3, P:-1, S: 0, T:-1, W:-4, Y:-3, V:-3 },
  C: { A: 0, R:-3, N:-3, D:-3, C: 9, Q:-3, E:-4, G:-3, H:-3, I:-1, L:-1, K:-3, M:-1, F:-2, P:-3, S:-1, T:-1, W:-2, Y:-2, V:-1 },
  Q: { A:-1, R: 1, N: 0, D: 0, C:-3, Q: 5, E: 2, G:-2, H: 0, I:-3, L:-2, K: 1, M: 0, F:-3, P:-1, S: 0, T:-1, W:-2, Y:-1, V:-2 },
  E: { A:-1, R: 0, N: 0, D: 2, C:-4, Q: 2, E: 5, G:-2, H: 0, I:-3, L:-3, K: 1, M:-2, F:-3, P:-1, S: 0, T:-1, W:-3, Y:-2, V:-2 },
  G: { A: 0, R:-2, N: 0, D:-1, C:-3, Q:-2, E:-2, G: 6, H:-2, I:-4, L:-4, K:-2, M:-3, F:-3, P:-2, S: 0, T:-2, W:-2, Y:-3, V:-3 },
  H: { A:-2, R: 0, N: 1, D:-1, C:-3, Q: 0, E: 0, G:-2, H: 8, I:-3, L:-3, K:-1, M:-2, F:-1, P:-2, S:-1, T:-2, W:-2, Y: 2, V:-3 },
  I: { A:-1, R:-3, N:-3, D:-3, C:-1, Q:-3, E:-3, G:-4, H:-3, I: 4, L: 2, K:-3, M: 1, F: 0, P:-3, S:-2, T:-1, W:-3, Y:-1, V: 3 },
  L: { A:-1, R:-2, N:-3, D:-4, C:-1, Q:-2, E:-3, G:-4, H:-3, I: 2, L: 4, K:-2, M: 2, F: 0, P:-3, S:-2, T:-1, W:-2, Y:-1, V: 1 },
  K: { A:-1, R: 2, N: 0, D:-1, C:-3, Q: 1, E: 1, G:-2, H:-1, I:-3, L:-2, K: 5, M:-1, F:-3, P:-1, S: 0, T:-1, W:-3, Y:-2, V:-2 },
  M: { A:-1, R:-1, N:-2, D:-3, C:-1, Q: 0, E:-2, G:-3, H:-2, I: 1, L: 2, K:-1, M: 5, F: 0, P:-2, S:-1, T:-1, W:-1, Y:-1, V: 1 },
  F: { A:-2, R:-3, N:-3, D:-3, C:-2, Q:-3, E:-3, G:-3, H:-1, I: 0, L: 0, K:-3, M: 0, F: 6, P:-4, S:-2, T:-2, W: 1, Y: 3, V:-1 },
  P: { A:-1, R:-2, N:-2, D:-1, C:-3, Q:-1, E:-1, G:-2, H:-2, I:-3, L:-3, K:-1, M:-2, F:-4, P: 7, S:-1, T:-1, W:-4, Y:-3, V:-2 },
  S: { A: 1, R:-1, N: 1, D: 0, C:-1, Q: 0, E: 0, G: 0, H:-1, I:-2, L:-2, K: 0, M:-1, F:-2, P:-1, S: 4, T: 1, W:-3, Y:-2, V:-2 },
  T: { A: 0, R:-1, N: 0, D:-1, C:-1, Q:-1, E:-1, G:-2, H:-2, I:-1, L:-1, K:-1, M:-1, F:-2, P:-1, S: 1, T: 5, W:-2, Y:-2, V: 0 },
  W: { A:-3, R:-3, N:-4, D:-4, C:-2, Q:-2, E:-3, G:-2, H:-2, I:-3, L:-2, K:-3, M:-1, F: 1, P:-4, S:-3, T:-2, W:11, Y: 2, V:-3 },
  Y: { A:-2, R:-2, N:-2, D:-3, C:-2, Q:-1, E:-2, G:-3, H: 2, I:-1, L:-1, K:-2, M:-1, F: 3, P:-3, S:-2, T:-2, W: 2, Y: 7, V:-1 },
  V: { A: 0, R:-3, N:-3, D:-3, C:-1, Q:-2, E:-2, G:-3, H:-3, I: 3, L: 1, K:-2, M: 1, F:-1, P:-2, S:-2, T: 0, W:-3, Y:-1, V: 4 },
};

function nwAlign(
  seq1: string, seq2: string,
  gapPenalty: number,
): { aligned1: string; aligned2: string; score: number } {
  const n = seq1.length
  const m = seq2.length

  // DP matrix
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] + gapPenalty
  for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] + gapPenalty

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const aa1 = seq1[i - 1].toUpperCase()
      const aa2 = seq2[j - 1].toUpperCase()
      const matchScore = (BLOSUM62_MATRIX[aa1]?.[aa2]) ?? -4
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + matchScore,
        dp[i - 1][j] + gapPenalty,
        dp[i][j - 1] + gapPenalty,
      )
    }
  }

  // Traceback
  let i = n, j = m
  let aligned1 = '', aligned2 = ''
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const aa1 = seq1[i - 1].toUpperCase()
      const aa2 = seq2[j - 1].toUpperCase()
      const diag = (BLOSUM62_MATRIX[aa1]?.[aa2]) ?? -4
      if (dp[i][j] === dp[i - 1][j - 1] + diag) {
        aligned1 = seq1[i - 1] + aligned1
        aligned2 = seq2[j - 1] + aligned2
        i--; j--
        continue
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + gapPenalty) {
      aligned1 = seq1[i - 1] + aligned1
      aligned2 = '-' + aligned2
      i--
    } else {
      aligned1 = '-' + aligned1
      aligned2 = seq2[j - 1] + aligned2
      j--
    }
  }

  return { aligned1, aligned2, score: dp[n][m] }
}

/**
 * Client-side local alignment fallback.
 * Used when the backend is unreachable — provides instant results.
 */
function localAlignment(seq1: string, seq2: string, settings: AlignmentSettings): AlignmentResult {
  const gapPenalty = -(settings.gapOpenPenalty || 10)
  const { aligned1, aligned2 } = nwAlign(seq1, seq2, gapPenalty)

  let identical = 0, gaps = 0, alignedLen = 0
  for (let k = 0; k < aligned1.length; k++) {
    if (aligned1[k] !== '-' && aligned2[k] !== '-') alignedLen++
    if (aligned1[k] === aligned2[k] && aligned1[k] !== '-') identical++
    if (aligned1[k] === '-' || aligned2[k] === '-') gaps++
  }

  const identity = alignedLen > 0 ? (identical / alignedLen) * 100 : 0
  const coverage = seq1.length > 0 ? (alignedLen / seq1.length) * 100 : 0
  const adjScore = identical * 10 - gaps * (settings.gapOpenPenalty || 10)

  return {
    query: seq1,
    subject: seq2,
    alignedQuery: aligned1,
    alignedSubject: aligned2,
    identity: parseFloat(identity.toFixed(2)),
    coverage: parseFloat(coverage.toFixed(2)),
    score: parseFloat(adjScore.toFixed(2)),
    algorithm: settings.algorithm,
    rawAlignment: `CLUSTAL W (local fallback)\n\nseq1      ${aligned1}\nseq2      ${aligned2}`,
  }
}

// ─── Main alignment function ─────────────────────────────────────────────────

/**
 * Sequence alignment using backend ClustalOmega with client-side fallback.
 * Tries the FastAPI backend at /align first; falls back to local Needleman-Wunsch
 * if the backend is unreachable.
 */
export async function simulateAlignment(seq1: string, seq2: string, settings: AlignmentSettings): Promise<AlignmentResult> {
  console.log(`🚀 Alignment: engine=${settings.engine || 'clustalo'}, seq1 length=${seq1.length}, seq2 length=${seq2.length}`)

  // ── Try backend first ──
  try {
    console.log(`📡 Connecting to backend at ${BACKEND_URL}/align...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout for initial response

    const response = await fetch(`${BACKEND_URL}/align`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sequence1: seq1,
        sequence2: seq2,
        engine: settings.engine || 'clustalo',
        run_uniprot: settings.runUniprot || false,
        run_sift: settings.runSift || false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      if (data.status === 'success' && data.message) {
        const rawAlignmentText: string = data.message
        console.log('✅ Backend alignment received')

        // Parse Clustal output
        const lines = rawAlignmentText.split('\n').filter(l => l.trim() !== '')
        const seqData: Record<string, string> = {}

        for (const line of lines) {
          if (line.includes('CLUSTAL') || line.includes('*') || line.includes(':') || line.includes('.')) continue
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 2) {
            const name = parts[0]
            const seqPart = parts[1]
            if (name && seqPart && /^[A-Z-]+$/i.test(seqPart)) {
              seqData[name] = (seqData[name] || '') + seqPart
            }
          }
        }

        const names = Object.keys(seqData)
        const alignedQuery = names.length > 0 ? seqData[names[0]] : ''
        const alignedSubject = names.length > 1 ? seqData[names[1]] : ''

        if (alignedQuery && alignedSubject) {
          let identical = 0, gaps = 0, alignedLen = 0
          for (let i = 0; i < alignedQuery.length; i++) {
            if (alignedQuery[i] !== '-' && alignedSubject[i] !== '-') alignedLen++
            if (alignedQuery[i] === alignedSubject[i] && alignedQuery[i] !== '-') identical++
            if (alignedQuery[i] === '-' || alignedSubject[i] === '-') gaps++
          }
          return {
            query: seq1, subject: seq2,
            alignedQuery, alignedSubject,
            identity: parseFloat((alignedLen > 0 ? (identical / alignedLen) * 100 : 0).toFixed(2)),
            coverage: parseFloat((seq1.length > 0 ? (alignedLen / seq1.length) * 100 : 0).toFixed(2)),
            score: parseFloat((identical * 10 - gaps * (settings.gapOpenPenalty || 10)).toFixed(2)),
            algorithm: settings.algorithm,
            rawAlignment: rawAlignmentText,
            uniprot: data.uniprot || undefined,
            sift: data.sift || undefined,
          }
        }
      }
      throw new Error(`Backend returned unexpected format: ${data.status}`)
    }

    // If backend responded with error, throw so we fall back to local
    console.warn(`Backend returned ${response.status}, falling back to local alignment...`)
    throw new Error(`Backend error: ${response.status}`)

  } catch (error) {
    // ── Fallback: client-side Needleman-Wunsch ──
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('⚠️  Backend unreachable. Using local alignment fallback (Needleman-Wunsch).')
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('⚠️  Backend timed out. Using local alignment fallback.')
    } else {
      console.warn('⚠️  Backend error, falling back to local alignment:', error)
    }

    try {
      console.log('🔄 Running client-side Needleman-Wunsch alignment...')
      const result = localAlignment(seq1, seq2, settings)
      console.log('✅ Local alignment complete:', {
        identity: result.identity + '%',
        coverage: result.coverage + '%',
        score: result.score,
      })
      return result
    } catch (fallbackError) {
      // Ultimate fallback: simple character-by-character alignment
      console.warn('⚠️  Local alignment also failed, using basic fallback:', fallbackError)
      const maxLen = Math.max(seq1.length, seq2.length)
      const aq = seq1.padEnd(maxLen, '-')
      const sb = seq2.padEnd(maxLen, '-')
      let identical = 0, gaps = 0
      for (let i = 0; i < maxLen; i++) {
        if (aq[i] === '-' || sb[i] === '-') gaps++
        else if (aq[i] === sb[i]) identical++
      }
      return {
        query: seq1, subject: seq2,
        alignedQuery: aq, alignedSubject: sb,
        identity: maxLen > 0 ? parseFloat(((identical / maxLen) * 100).toFixed(2)) : 0,
        coverage: 100,
        score: identical * 10 - gaps * (settings.gapOpenPenalty || 10),
        algorithm: settings.algorithm,
        rawAlignment: `Basic alignment\n\nseq1  ${aq}\nseq2  ${sb}`,
      }
    }
  }
}
