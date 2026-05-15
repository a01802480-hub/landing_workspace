import { useState } from 'react'

interface SequenceEditorUIProps {
  sequence: string
  onSequenceChange: (newSequence: string) => void
  sequenceType: 'dna' | 'protein'
}

/**
 * Enhanced sequence editor with position numbers and hover information
 * Shows aminoacid/nucleotide positions in increments of 5
 * Displays position info on hover
 */
export function SequenceEditorUI({ sequence, onSequenceChange, sequenceType }: SequenceEditorUIProps) {
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)

  const getCharColor = (char: string): string => {
    const c = char.toUpperCase()

    if (sequenceType === 'dna') {
      if (c === 'A') return 'bg-red-100 text-red-700'
      if (c === 'T') return 'bg-blue-100 text-blue-700'
      if (c === 'G') return 'bg-yellow-100 text-yellow-700'
      if (c === 'C') return 'bg-green-100 text-green-700'
      return 'bg-slate-100 text-slate-600'
    }

    // PROTEIN
    if ('AILMFVPWG'.includes(c)) return 'bg-orange-100 text-orange-700'
    if ('STCNQ'.includes(c)) return 'bg-green-100 text-green-700'
    if ('DEKHR'.includes(c)) return 'bg-blue-100 text-blue-700'
    if ('FWY'.includes(c)) return 'bg-purple-100 text-purple-700'
    return 'bg-slate-100 text-slate-600'
  }

  const handleCharChange = (position: number, newChar: string) => {
    const charToAdd = newChar.charAt(0).toUpperCase()
    if (!charToAdd) return

    const chars = sequence.split('')
    chars[position] = charToAdd
    onSequenceChange(chars.join(''))
    setSelectedPosition(position)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, position: number) => {
    const char = e.key.toUpperCase()

    // Allow DNA/Protein letters and -
    const allowedChars = sequenceType === 'dna' ? 'ATGC-' : 'ACDEFGHIKLMNPQRSTVWY-'

    if (allowedChars.includes(char)) {
      e.preventDefault()
      handleCharChange(position, char)
      // Move to next position
      if (position < sequence.length - 1) {
        const nextElement = document.getElementById(`pos-${position + 1}`)
        if (nextElement) {
          nextElement.focus()
        }
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (position > 0) {
        const chars = sequence.split('')
        chars.splice(position, 1)
        onSequenceChange(chars.join(''))
        const prevElement = document.getElementById(`pos-${position - 1}`)
        if (prevElement) {
          prevElement.focus()
        }
      }
    } else if (e.key === 'Delete') {
      e.preventDefault()
      const chars = sequence.split('')
      chars.splice(position, 1)
      onSequenceChange(chars.join(''))
    } else if (e.key === 'ArrowLeft' && position > 0) {
      const prevElement = document.getElementById(`pos-${position - 1}`)
      if (prevElement) {
        prevElement.focus()
      }
    } else if (e.key === 'ArrowRight' && position < sequence.length - 1) {
      const nextElement = document.getElementById(`pos-${position + 1}`)
      if (nextElement) {
        nextElement.focus()
      }
    }
  }

  // Group sequence into lines of 80 characters
  const lines = sequence.match(/.{1,80}/g) || []

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <span className="font-bold">💡 Tips:</span> Click on any amino acid to edit. Type a letter to change it, use arrow keys to navigate, Backspace to delete.
      </div>

      {/* Editable Sequence Display */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 overflow-x-auto">
        {lines.map((line, lineIdx) => {
          const lineStart = lineIdx * 80
          return (
            <div key={lineIdx} className="mb-6 font-mono text-sm">
              {/* SEQUENCE */}
              <div className="flex gap-1 flex-wrap">
                {line.split('').map((char, charIdx) => {
                  const globalPos = lineStart + charIdx
                  const displayPos = globalPos + 1

                  return (
                    <div
                      key={`line-${lineIdx}-char-${charIdx}`}
                      className="relative group"
                      onMouseEnter={() => setHoveredPosition(globalPos)}
                      onMouseLeave={() => setHoveredPosition(null)}
                    >
                      <div
                        id={`pos-${globalPos}`}
                        tabIndex={0}
                        onClick={() => setSelectedPosition(globalPos)}
                        onKeyDown={(e) => handleKeyDown(e, globalPos)}
                        className={`w-6 h-6 flex items-center justify-center rounded cursor-text border-2 transition-all ${
                          selectedPosition === globalPos
                            ? 'border-indigo-500 shadow-md ring-2 ring-indigo-200'
                            : hoveredPosition === globalPos
                              ? 'border-slate-400 shadow-sm'
                              : 'border-slate-200'
                        } ${getCharColor(char)} font-bold text-xs`}
                      >
                        {char}
                      </div>

                      {/* HOVER TOOLTIP */}
                      {(hoveredPosition === globalPos || selectedPosition === globalPos) && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10 pointer-events-none">
                          Position: {displayPos}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* POSITION RULER - Shows numbers every 5 positions */}
              <div className="flex gap-1 flex-wrap mt-2 text-slate-400 text-xs font-mono">
                {line.split('').map((_, charIdx) => {
                  const globalPos = lineStart + charIdx
                  const displayPos = globalPos + 1

                  // Show number every 5 positions, empty space otherwise
                  if (displayPos % 5 === 0) {
                    return (
                      <div key={`ruler-${charIdx}`} className="w-6 h-4 flex items-center justify-center text-xs font-bold">
                        {displayPos}
                      </div>
                    )
                  } else {
                    return <div key={`ruler-${charIdx}`} className="w-6"></div>
                  }
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-indigo-50 rounded border border-indigo-200">
          <div className="text-[10px] font-bold text-indigo-600">TOTAL LENGTH</div>
          <div className="text-lg font-bold text-indigo-700">{sequence.length}</div>
        </div>
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <div className="text-[10px] font-bold text-green-600">GAPS (-)</div>
          <div className="text-lg font-bold text-green-700">{(sequence.match(/-/g) || []).length}</div>
        </div>
        <div className="p-2 bg-purple-50 rounded border border-purple-200">
          <div className="text-[10px] font-bold text-purple-600">LINES</div>
          <div className="text-lg font-bold text-purple-700">{lines.length}</div>
        </div>
      </div>
    </div>
  )
}
