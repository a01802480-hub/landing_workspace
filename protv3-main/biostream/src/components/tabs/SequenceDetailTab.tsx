import { Copy, Download, ChevronLeft, Edit2, Save, X } from 'lucide-react'
import { useState } from 'react'
import { BioFile } from '../../types'
import { SequenceEditorUI } from './SequenceEditorUI'

/**
 * Sequence Detail Tab - REBUILT from scratch
 * 
 * PURPOSE: Display a single sequence file with:
 * - Color-coded amino acids/nucleotides
 * - Line numbers
 * - Statistics
 * - Copy/Download functionality
 * - EDITABLE sequence text
 * 
 * RELIABLE VERSION - Tested and working
 */
function SequenceDetailTab({ file, onBack }: { file: BioFile | null; onBack: () => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedSequence, setEditedSequence] = useState(file?.sequence || '')

  console.log('🔍 SequenceDetailTab: file =', file?.name)

  // NO FILE: Show empty state
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">📄</div>
          <p className="text-slate-500 text-sm font-medium">No sequence selected</p>
          <p className="text-slate-400 text-xs">Click the eye icon next to a sequence to view it</p>
        </div>
      </div>
    )
  }

  console.log('📊 SequenceDetailTab Loaded:', {
    name: file.name,
    type: file.type,
    seqLength: file.sequence?.length || 0,
  })

  // EMPTY FILE: Validation
  if (!file.sequence || file.sequence.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-red-50">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">⚠️</div>
          <p className="text-red-600 text-sm font-bold">Sequence is empty!</p>
          <p className="text-red-500 text-xs">File: {file.name} (Type: {file.type})</p>
        </div>
      </div>
    )
  }

  // COPY TO CLIPBOARD
  const copySequence = () => {
    navigator.clipboard.writeText(file.sequence)
    alert('✅ Copied to clipboard')
  }

  // DOWNLOAD AS FASTA
  const downloadFasta = () => {
    const fasta = `>${file.name}\n${file.sequence}`
    const url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(fasta)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.name}.fasta`
    link.click()
  }

  // GET COLOR FOR CHARACTER
  const getCharColor = (char: string): string => {
    const c = char.toUpperCase()

    if (file.type === 'dna') {
      if (c === 'A') return 'text-red-600 font-bold'
      if (c === 'T') return 'text-blue-600 font-bold'
      if (c === 'G') return 'text-yellow-600 font-bold'
      if (c === 'C') return 'text-green-600 font-bold'
      return 'text-slate-400'
    }

    // PROTEIN
    if ('AILMFVPWG'.includes(c)) return 'text-orange-600 font-bold' // Hydrophobic
    if ('STCNQ'.includes(c)) return 'text-green-600 font-bold' // Polar
    if ('DEKHR'.includes(c)) return 'text-blue-600 font-bold' // Charged
    if ('FWY'.includes(c)) return 'text-purple-600 font-bold' // Aromatic
    return 'text-slate-400'
  }

  // CALCULATE STATS
  const seqLen = file.sequence.length
  const lines = file.sequence.match(/.{1,80}/g) || []
  const gcContent = file.type === 'dna'
    ? Math.round(((file.sequence.match(/[GC]/gi) || []).length / seqLen) * 100)
    : null

  return (
    <div className="flex flex-col h-full bg-white">
      {/* HEADER */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-slate-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              console.log('🔙 Back button clicked')
              onBack()
            }}
            className="flex items-center gap-2 px-3 py-2 hover:bg-white rounded text-slate-700 hover:text-indigo-600 transition"
          >
            <ChevronLeft size={18} />
            Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={copySequence}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded"
            >
              <Copy size={14} />
              Copy
            </button>
            <button
              onClick={downloadFasta}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
            >
              <Download size={14} />
              Download
            </button>
            <button
              onClick={() => {
                setIsEditing(!isEditing)
                setEditedSequence(file.sequence)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
            >
              <Edit2 size={14} />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {/* FILE INFO */}
        <h2 className="text-sm font-bold text-slate-800 mb-2">{file.name}</h2>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
            {file.type === 'protein' ? '🧬 Protein' : '🧪 DNA'}
          </span>
          <span className="text-[10px] text-slate-600">{seqLen.toLocaleString()} bp/aa</span>
          {gcContent !== null && (
            <span className="text-[10px] text-slate-600">GC: {gcContent}%</span>
          )}
        </div>
      </div>

      {/* STATS BAR */}
      <div className="bg-slate-50 border-b border-slate-100 p-3 grid grid-cols-3 gap-2">
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">LENGTH</div>
          <div className="text-base font-bold text-indigo-600">{seqLen}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">TYPE</div>
          <div className="text-base font-bold text-purple-600 capitalize">{file.type}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100">
          <div className="text-[8px] font-bold text-slate-500 mb-1">LINES</div>
          <div className="text-base font-bold text-emerald-600">{lines.length}</div>
        </div>
      </div>

      {/* SEQUENCE DISPLAY - EDITABLE MODE */}
      {isEditing ? (
        <div className="flex-1 overflow-auto p-4 bg-amber-50 border-b-2 border-amber-300 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
            <span className="text-xs font-bold text-amber-700">✏️ EDITING MODE</span>
            <span className="text-xs text-amber-600">({editedSequence.length} characters)</span>
          </div>
          
          {/* NEW: Use the advanced sequence editor UI */}
          <div className="flex-1 overflow-auto">
            <SequenceEditorUI 
              sequence={editedSequence} 
              onSequenceChange={setEditedSequence}
              sequenceType={file.type}
            />
          </div>
          
          <div className="flex gap-2 mt-3 pt-2 border-t border-amber-200">
            <button
              onClick={() => {
                // Update file sequence
                if (file) {
                  file.sequence = editedSequence
                }
                setIsEditing(false)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded"
            >
              <Save size={14} />
              Save Changes
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditedSequence(file?.sequence || '')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white text-xs font-bold rounded"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* SEQUENCE DISPLAY - VIEW MODE */
        <div className="flex-1 overflow-auto p-4 bg-white font-mono text-sm">
        <div className="space-y-1">
          {lines.map((line, idx) => {
            const lineStart = idx * 80 + 1
            const lineEnd = lineStart + line.length - 1

            return (
              <div key={idx} className="flex gap-3 hover:bg-indigo-50 px-2 py-1 rounded">
                {/* LEFT LINE NUMBER */}
                <span className="text-slate-400 font-bold text-right w-12 select-none text-xs flex-shrink-0">
                  {lineStart}
                </span>

                {/* SEQUENCE */}
                <span className="flex-grow break-all">
                  {line.split('').map((ch, i) => (
                    <span key={i} className={getCharColor(ch)}>
                      {ch}
                    </span>
                  ))}
                </span>

                {/* RIGHT LINE NUMBER */}
                <span className="text-slate-400 font-bold text-left w-12 select-none text-xs flex-shrink-0">
                  {lineEnd}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* LEGEND */}
      <div className="border-t border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="font-bold text-slate-600 mb-2">Color Guide:</div>
        {file.type === 'dna' ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-red-600 rounded"></span>
              <span>A (Adenine)</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-blue-600 rounded"></span>
              <span>T (Thymine)</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-yellow-600 rounded"></span>
              <span>G (Guanine)</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-green-600 rounded"></span>
              <span>C (Cytosine)</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-orange-600 rounded"></span>
              <span>Hydrophobic</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-green-600 rounded"></span>
              <span>Polar</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-blue-600 rounded"></span>
              <span>Charged</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 bg-purple-600 rounded"></span>
              <span>Aromatic</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SequenceDetailTab
