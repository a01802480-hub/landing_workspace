import { ChevronLeft, Copy, Download } from 'lucide-react'
import { AlignmentResult } from '../../types'

interface AlignmentViewerTabProps {
  alignment: AlignmentResult | null
  onBack: () => void
}

/**
 * AlignmentViewerTab - Display alignment results with colors
 * Shows the raw alignment output from ClustalOmega with colored sequences
 */
function AlignmentViewerTab({ alignment, onBack }: AlignmentViewerTabProps) {
  if (!alignment) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">📊</div>
          <p className="text-slate-500 text-sm font-medium">No alignment data</p>
        </div>
      </div>
    )
  }

  const getCharColor = (char: string, index: number, seq1Length: number): string => {
    // Check if this is a matching position (from comparison line)
    const seq1 = alignment.alignedQuery
    const seq2 = alignment.alignedSubject
    
    if (index >= seq1.length || index >= seq2.length) return 'text-slate-400'

    const c1 = seq1[index].toUpperCase()
    const c2 = seq2[index].toUpperCase()

    // Identical match
    if (c1 === c2 && c1 !== '-') return 'text-green-600 font-bold bg-green-50'
    // Similar/conservative
    if (char === ':') return 'text-blue-600 font-bold bg-blue-50'
    // Weak similarity
    if (char === '.') return 'text-yellow-600 font-bold bg-yellow-50'
    // No similarity
    if (char === ' ') return 'text-red-600'
    // Gap
    if (c1 === '-' || c2 === '-') return 'text-slate-300'

    return 'text-slate-600'
  }

  const getSequenceColor = (char: string, type: 'dna' | 'protein'): string => {
    const c = char.toUpperCase()
    
    if (type === 'dna') {
      if (c === 'A') return 'text-red-600 font-bold'
      if (c === 'T') return 'text-blue-600 font-bold'
      if (c === 'G') return 'text-yellow-600 font-bold'
      if (c === 'C') return 'text-green-600 font-bold'
      if (c === '-') return 'text-slate-300'
      return 'text-slate-400'
    }

    // PROTEIN
    if ('AILMFVPWG'.includes(c)) return 'text-orange-600 font-bold'
    if ('STCNQ'.includes(c)) return 'text-green-600 font-bold'
    if ('DEKHR'.includes(c)) return 'text-blue-600 font-bold'
    if ('FWY'.includes(c)) return 'text-purple-600 font-bold'
    if (c === '-') return 'text-slate-300'
    return 'text-slate-400'
  }

  const copyAlignment = () => {
    let text = `${alignment.queryName || 'Query'}\n${alignment.alignedQuery}\n`
    text += `${alignment.subjectName || 'Subject'}\n${alignment.alignedSubject}\n`
    navigator.clipboard.writeText(text)
    alert('✅ Alignment copied to clipboard')
  }

  const downloadAlignment = () => {
    const text = `${alignment.queryName || 'Query'}\n${alignment.alignedQuery}\n\n${alignment.subjectName || 'Subject'}\n${alignment.alignedSubject}\n`
    const url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    const link = document.createElement('a')
    link.href = url
    link.download = `alignment_${alignment.queryName || 'seq1'}_vs_${alignment.subjectName || 'seq2'}.txt`
    link.click()
  }

  const guessType = (): 'dna' | 'protein' => {
    const seq = alignment.alignedQuery.replace(/-/g, '')
    const dnaChars = (seq.match(/[ATGC]/gi) || []).length
    return dnaChars / seq.length > 0.8 ? 'dna' : 'protein'
  }

  const seqType = guessType()

  return (
    <div className="flex flex-col h-full bg-white">
      {/* HEADER */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-slate-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 hover:bg-white rounded text-slate-700 hover:text-indigo-600 transition"
          >
            <ChevronLeft size={18} />
            Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={copyAlignment}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded"
            >
              <Copy size={14} />
              Copy
            </button>
            <button
              onClick={downloadAlignment}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>

        {/* ALIGNMENT INFO */}
        <h2 className="text-sm font-bold text-slate-800 mb-2">
          {alignment.queryName || 'Sequence 1'} vs {alignment.subjectName || 'Sequence 2'}
        </h2>
        <div className="flex gap-3">
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
            Algorithm: {alignment.algorithm}
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded">
            Identity: {alignment.identity}%
          </span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
            Coverage: {alignment.coverage}%
          </span>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">
            Score: {alignment.score}
          </span>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="bg-slate-50 border-b border-slate-100 p-3 grid grid-cols-4 gap-2">
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">QUERY LENGTH</div>
          <div className="text-base font-bold text-indigo-600">{alignment.query.length}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">SUBJECT LENGTH</div>
          <div className="text-base font-bold text-purple-600">{alignment.subject.length}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">ALIGNED QUERY</div>
          <div className="text-base font-bold text-emerald-600">{alignment.alignedQuery.length}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">ALIGNED SUBJECT</div>
          <div className="text-base font-bold text-orange-600">{alignment.alignedSubject.length}</div>
        </div>
      </div>

      {/* ALIGNMENT DISPLAY */}
      <div className="flex-1 overflow-auto p-4 bg-white font-mono text-sm space-y-6">
        {/* QUERY SEQUENCE */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 bg-indigo-100 px-2 py-1 rounded inline-block">
            {alignment.queryName || 'Query Sequence'}
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
            <div className="flex flex-wrap gap-0.5 break-words">
              {alignment.alignedQuery.split('').map((char, idx) => (
                <span
                  key={`q-${idx}`}
                  className={`${getSequenceColor(char, seqType)} ${char === '-' ? 'text-slate-300' : ''}`}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* COMPARISON LINE */}
        {alignment.rawAlignment && (
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2 bg-slate-100 px-2 py-1 rounded inline-block">
              Conservation (*, :, .)
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto text-center text-slate-600 font-bold tracking-wider">
              {(() => {
                const lines = alignment.rawAlignment.split('\n')
                const compLine = lines.find((l) => l.match(/^[ *.:/]+$/))
                return compLine || '✔️ Perfect match indicators'
              })()}
            </div>
          </div>
        )}

        {/* SUBJECT SEQUENCE */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 bg-purple-100 px-2 py-1 rounded inline-block">
            {alignment.subjectName || 'Subject Sequence'}
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
            <div className="flex flex-wrap gap-0.5 break-words">
              {alignment.alignedSubject.split('').map((char, idx) => (
                <span
                  key={`s-${idx}`}
                  className={`${getSequenceColor(char, seqType)} ${char === '-' ? 'text-slate-300' : ''}`}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LEGEND */}
      <div className="border-t border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="font-bold text-slate-600 mb-2">Color Guide for Conservation:</div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 bg-green-600 rounded"></span>
            <span>* (identical)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 bg-blue-600 rounded"></span>
            <span>: (similar)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 bg-yellow-600 rounded"></span>
            <span>. (weak)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 bg-red-600 rounded"></span>
            <span>Space (different)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlignmentViewerTab
