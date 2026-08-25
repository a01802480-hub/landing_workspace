/**
 * Quick Alignment Widget — select two sequences and run alignment inline.
 */
import { useState, useCallback } from 'react'
import { WidgetShell } from './WidgetShell'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { simulateAlignment } from '../../utils/alignmentEngine'
import { AlignmentSettings } from '../../types'
import toast from 'react-hot-toast'

export function QuickAlignmentWidget({ onRemove }: { onRemove?: () => void }) {
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)
  const setAlignmentResult = useWorkspaceStore(s => s.setAlignmentResult)
  const setSelectedAlignmentResult = useUIStore(s => s.setSelectedAlignmentResult)

  const ws = activeWorkspace()
  const files = ws?.files || []

  const [seq1Id, setSeq1Id] = useState('')
  const [seq2Id, setSeq2Id] = useState('')
  const [engine, setEngine] = useState<string>('clustalo')
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<{identity: number; coverage: number; score: number} | null>(null)

  const seq1 = files.find(f => f.id === seq1Id)
  const seq2 = files.find(f => f.id === seq2Id)

  const handleAlign = useCallback(async () => {
    if (!seq1 || !seq2) return
    setRunning(true)

    try {
      const settings: AlignmentSettings = {
        algorithm: 'ClustalW',
        engine: engine as any,
        gapOpenPenalty: 10,
        substitutionMatrix: 'BLOSUM62',
      }

      const result = await simulateAlignment(seq1.sequence, seq2.sequence, settings)
      setAlignmentResult(result)
      setSelectedAlignmentResult(result)
      setLastResult({
        identity: result.identity,
        coverage: result.coverage,
        score: result.score,
      })
      toast.success(`Alignment complete: ${result.identity.toFixed(1)}% identity`)
    } catch (err: any) {
      toast.error(`Alignment failed: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }, [seq1, seq2, engine, setAlignmentResult, setSelectedAlignmentResult])

  return (
    <WidgetShell
      title="Quick Alignment"
      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
      color="blue"
      onRemove={onRemove}
    >
      <div className="p-2 space-y-2">
        {/* Sequence A */}
        <div>
          <label className="text-[9px] font-semibold text-slate-500 uppercase">Sequence A</label>
          <select
            value={seq1Id}
            onChange={e => setSeq1Id(e.target.value)}
            className="w-full mt-0.5 text-[10px] px-2 py-1 border border-slate-200 rounded bg-white"
          >
            <option value="">Select sequence...</option>
            {files.map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.sequence?.length || 0}bp)</option>
            ))}
          </select>
          {seq1 && <div className="text-[8px] text-slate-400 mt-0.5 font-mono truncate">{seq1.sequence.slice(0, 40)}...</div>}
        </div>

        {/* Sequence B */}
        <div>
          <label className="text-[9px] font-semibold text-slate-500 uppercase">Sequence B</label>
          <select
            value={seq2Id}
            onChange={e => setSeq2Id(e.target.value)}
            className="w-full mt-0.5 text-[10px] px-2 py-1 border border-slate-200 rounded bg-white"
          >
            <option value="">Select sequence...</option>
            {files.filter(f => f.id !== seq1Id).map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.sequence?.length || 0}bp)</option>
            ))}
          </select>
          {seq2 && <div className="text-[8px] text-slate-400 mt-0.5 font-mono truncate">{seq2.sequence.slice(0, 40)}...</div>}
        </div>

        {/* Engine selector */}
        <div>
          <label className="text-[9px] font-semibold text-slate-500 uppercase">Engine</label>
          <select
            value={engine}
            onChange={e => setEngine(e.target.value)}
            className="w-full mt-0.5 text-[10px] px-2 py-1 border border-slate-200 rounded bg-white"
          >
            <option value="clustalo">Clustal Omega</option>
            <option value="mafft">MAFFT</option>
            <option value="muscle">MUSCLE</option>
            <option value="tcoffee">T-Coffee</option>
          </select>
        </div>

        {/* Run button */}
        <button
          onClick={handleAlign}
          disabled={running || !seq1 || !seq2}
          className={`w-full py-1.5 rounded text-[10px] font-semibold text-white transition-colors ${
            running ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {running ? 'Aligning...' : `Align ${seq1?.name?.split('.')[0] || 'A'} ↔ ${seq2?.name?.split('.')[0] || 'B'}`}
        </button>

        {/* Last result */}
        {lastResult && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center p-1.5 bg-emerald-50 rounded">
              <div className="text-xs font-bold text-emerald-600">{lastResult.identity.toFixed(1)}%</div>
              <div className="text-[8px] text-emerald-500">Identity</div>
            </div>
            <div className="text-center p-1.5 bg-blue-50 rounded">
              <div className="text-xs font-bold text-blue-600">{lastResult.coverage.toFixed(1)}%</div>
              <div className="text-[8px] text-blue-500">Coverage</div>
            </div>
            <div className="text-center p-1.5 bg-amber-50 rounded">
              <div className="text-xs font-bold text-amber-600">{lastResult.score.toFixed(0)}</div>
              <div className="text-[8px] text-amber-500">Score</div>
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  )
}
