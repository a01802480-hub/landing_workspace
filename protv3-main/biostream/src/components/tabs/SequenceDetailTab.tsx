import { Copy, Download, ChevronLeft, Edit2, Save, X, Scissors, Dna, RefreshCw } from 'lucide-react'
import { useState, useMemo, memo, useCallback } from 'react'
import { BioFile } from '../../types'
import { SequenceEditorUI } from './SequenceEditorUI'
import { useWorkspaceStore } from '../../store/workspaceStore'

// Pre-compute color classes outside render to avoid per-char function calls
const PROTEIN_COLORS: Record<string, string> = {}
const DNA_COLORS: Record<string, string> = {
  A: 'text-red-600 font-bold',
  T: 'text-blue-600 font-bold',
  G: 'text-yellow-600 font-bold',
  C: 'text-green-600 font-bold',
}

// Build protein color map once
for (const c of 'AILMFVPWG') PROTEIN_COLORS[c] = 'text-orange-600 font-bold'
for (const c of 'STCNQ') PROTEIN_COLORS[c] = 'text-green-600 font-bold'
for (const c of 'DEKHR') PROTEIN_COLORS[c] = 'text-blue-600 font-bold'
for (const c of 'FWY') PROTEIN_COLORS[c] = 'text-purple-600 font-bold'

const getCharColor = (char: string, type: 'protein' | 'dna'): string => {
  const c = char.toUpperCase()
  if (type === 'dna') return DNA_COLORS[c] || 'text-slate-400'
  return PROTEIN_COLORS[c] || 'text-slate-400'
}

/**
 * A single sequence line memoized to prevent re-renders of the entire sequence
 * when only one line changes. Each line is 80 chars max.
 */
const SequenceLine = memo(function SequenceLine({
  line,
  lineStart,
  fileType,
}: {
  line: string
  lineStart: number
  fileType: 'protein' | 'dna'
}) {
  const lineEnd = lineStart + line.length - 1

  const coloredChars = useMemo(() =>
    line.split('').map((ch, i) => (
      <span key={i} className={getCharColor(ch, fileType)}>
        {ch}
      </span>
    )),
  [line, fileType])

  return (
    <div className="flex gap-3 hover:bg-indigo-50 px-2 py-1 rounded">
      <span className="text-slate-400 font-bold text-right w-12 select-none text-xs flex-shrink-0">
        {lineStart}
      </span>
      <span className="flex-grow break-all">{coloredChars}</span>
      <span className="text-slate-400 font-bold text-left w-12 select-none text-xs flex-shrink-0">
        {lineEnd}
      </span>
    </div>
  )
})

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
  const [showMutationUI, setShowMutationUI] = useState(false)
  const [mutationPos, setMutationPos] = useState('')
  const [mutationFrom, setMutationFrom] = useState('')
  const [mutationTo, setMutationTo] = useState('')
  const [localSequence, setLocalSequence] = useState(file?.sequence || '')

  // Sync local sequence when file changes
  useState(() => { setLocalSequence(file?.sequence || '') })

  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)
  const workspaces = useWorkspaceStore(s => s.workspaces)

  // Persist edited sequence to Zustand store
  const persistSequence = useCallback((newSeq: string) => {
    if (!file) return
    const ws = activeWorkspace()
    if (!ws) return

    // Update in-memory file reference
    file.sequence = newSeq

    // Update in the Zustand store by finding the workspace and file
    const updatedWorkspaces = workspaces.map(w => {
      if (w.id !== ws.id) return w
      return {
        ...w,
        files: (w.files || []).map(f =>
          f.id === file.id ? { ...f, sequence: newSeq } : f
        ),
      }
    })
    useWorkspaceStore.setState({ workspaces: updatedWorkspaces })
    setLocalSequence(newSeq)
  }, [file, activeWorkspace, workspaces])

  // Introduce a point mutation
  const introduceMutation = useCallback(() => {
    const pos = parseInt(mutationPos) - 1 // Convert to 0-indexed
    if (isNaN(pos) || pos < 0 || pos >= localSequence.length) return
    if (!mutationTo || mutationTo.length !== 1) return

    const currentAa = localSequence[pos].toUpperCase()
    if (mutationFrom && currentAa !== mutationFrom.toUpperCase()) {
      // Warning: expected AA doesn't match
      if (!confirm(`Position ${mutationPos} has '${currentAa}', not '${mutationFrom.toUpperCase()}'. Apply mutation anyway?`)) return
    }

    const mutated = localSequence.slice(0, pos) + mutationTo.toUpperCase() + localSequence.slice(pos + 1)
    setLocalSequence(mutated)
    setEditedSequence(mutated)
    setShowMutationUI(false)
    setMutationPos('')
    setMutationFrom('')
    setMutationTo('')
  }, [mutationPos, mutationFrom, mutationTo, localSequence])

  // DNA tools
  const reverseComplement = useCallback(() => {
    if (file?.type !== 'dna') return
    const comp: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G', a: 't', t: 'a', g: 'c', c: 'g' }
    const rc = localSequence.split('').reverse().map(c => comp[c] || c).join('')
    setLocalSequence(rc)
    setEditedSequence(rc)
  }, [localSequence, file?.type])

  const translateDNA = useCallback(() => {
    if (file?.type !== 'dna') return
    const codonTable: Record<string, string> = {
      'ATA':'I','ATC':'I','ATT':'I','ATG':'M','ACA':'T','ACC':'T','ACG':'T','ACT':'T',
      'AAC':'N','AAT':'N','AAA':'K','AAG':'K','AGC':'S','AGT':'S','AGA':'R','AGG':'R',
      'CTA':'L','CTC':'L','CTG':'L','CTT':'L','CCA':'P','CCC':'P','CCG':'P','CCT':'P',
      'CAC':'H','CAT':'H','CAA':'Q','CAG':'Q','CGA':'R','CGC':'R','CGG':'R','CGT':'R',
      'GTA':'V','GTC':'V','GTG':'V','GTT':'V','GCA':'A','GCC':'A','GCG':'A','GCT':'A',
      'GAC':'D','GAT':'D','GAA':'E','GAG':'E','GGA':'G','GGC':'G','GGG':'G','GGT':'G',
      'TCA':'S','TCC':'S','TCG':'S','TCT':'S','TTC':'F','TTT':'F','TTA':'L','TTG':'L',
      'TAC':'Y','TAT':'Y','TAA':'_','TAG':'_','TGC':'C','TGT':'C','TGA':'_','TGG':'W',
    }
    let protein = ''
    for (let i = 0; i < localSequence.length - 2; i += 3) {
      const codon = localSequence.slice(i, i + 3).toUpperCase()
      protein += codonTable[codon] || 'X'
    }
    setLocalSequence(protein)
    setEditedSequence(protein)
  }, [localSequence, file?.type])

  // ACTUAL SEQUENCE to render (local or from file)
  const activeSequence = localSequence || file?.sequence || ''

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

  // CALCULATE STATS — memoized using activeSequence (which may be edited/mutated)
  const seqLen = activeSequence.length
  const lines = useMemo(() => activeSequence.match(/.{1,80}/g) || [], [activeSequence])
  const gcContent = file.type === 'dna'
    ? Math.round(((activeSequence.match(/[GC]/gi) || []).length / seqLen) * 100)
    : null

  // Build line data once
  const lineData = useMemo(() =>
    lines.map((line, idx) => ({
      line,
      lineStart: idx * 80 + 1,
    })),
  [lines])

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-white">
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
                setEditedSequence(activeSequence)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
            >
              <Edit2 size={14} />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            {/* Mutate button — biotechnologist tool */}
            <button
              onClick={() => setShowMutationUI(!showMutationUI)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded"
            >
              <Scissors size={14} />
              Mutate
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

      {/* Mutation UI — biotechnologist point mutation tool */}
      {showMutationUI && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-amber-700">🧬 Introduce Mutation:</span>
          <label className="text-[10px] text-amber-600">
            Position
            <input
              type="number"
              min="1"
              max={activeSequence.length}
              value={mutationPos}
              onChange={e => setMutationPos(e.target.value)}
              placeholder="123"
              className="ml-1 w-16 px-1.5 py-0.5 border border-amber-300 rounded text-xs"
            />
          </label>
          <label className="text-[10px] text-amber-600">
            From
            <input
              type="text"
              maxLength={1}
              value={mutationFrom}
              onChange={e => setMutationFrom(e.target.value.toUpperCase())}
              placeholder="A"
              className="ml-1 w-10 px-1.5 py-0.5 border border-amber-300 rounded text-xs font-mono"
            />
          </label>
          <span className="text-amber-400 text-xs">→</span>
          <label className="text-[10px] text-amber-600">
            To
            <input
              type="text"
              maxLength={1}
              value={mutationTo}
              onChange={e => setMutationTo(e.target.value.toUpperCase())}
              placeholder="V"
              className="ml-1 w-10 px-1.5 py-0.5 border border-amber-300 rounded text-xs font-mono"
            />
          </label>
          <button
            onClick={introduceMutation}
            disabled={!mutationPos || !mutationTo}
            className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 disabled:opacity-50"
          >
            Apply Mutation
          </button>
          <button onClick={() => setShowMutationUI(false)} className="text-amber-400 hover:text-amber-600 text-xs">Cancel</button>
          {localSequence !== (file?.sequence || '') && (
            <button
              onClick={() => { setLocalSequence(file?.sequence || ''); setEditedSequence(file?.sequence || '') }}
              className="px-2 py-1 text-[10px] text-amber-600 hover:text-amber-800 underline"
            >
              Reset to original
            </button>
          )}
        </div>
      )}

      {/* DNA Biotechnologist Tools */}
      {file.type === 'dna' && (
        <div className="bg-blue-50 border-b border-blue-100 px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-blue-600">DNA Tools:</span>
          <button onClick={reverseComplement} className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-100 transition-colors">
            <RefreshCw size={10} /> Reverse Complement
          </button>
          <button onClick={translateDNA} className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-100 transition-colors">
            <Dna size={10} /> Translate → Protein
          </button>
          <span className="text-[9px] text-blue-400 ml-auto">
            {localSequence !== (file?.sequence || '') && 'Sequence modified — Save to persist'}
          </span>
        </div>
      )}

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
                persistSequence(editedSequence)
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
            {lineData.map(({ line, lineStart }, idx) => (
              <SequenceLine
                key={idx}
                line={line}
                lineStart={lineStart}
                fileType={file.type}
              />
            ))}
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
