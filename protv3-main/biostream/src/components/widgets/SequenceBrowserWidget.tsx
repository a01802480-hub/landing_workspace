/**
 * Sequence Browser Widget — quick access to workspace sequences.
 * Select, view, and open sequences directly from the dashboard.
 */
import { WidgetShell } from './WidgetShell'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'

export function SequenceBrowserWidget({ onRemove }: { onRemove?: () => void }) {
  const workspaces = useWorkspaceStore(s => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId)
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)
  const setSelectedFile = useUIStore(s => s.setSelectedFile)

  const ws = activeWorkspace()
  const files = ws?.files || []

  const handleFileClick = (file: any) => {
    setSelectedFile(file)
    // Navigate to detail
    window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'detail', fileId: file.id } }))
  }

  return (
    <WidgetShell
      title="Sequences"
      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
      color="emerald"
      onRemove={onRemove}
    >
      <div className="p-2">
        {!ws && (
          <p className="text-[10px] text-slate-400 text-center py-6">Select a workspace to view sequences</p>
        )}

        {ws && files.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[10px] text-slate-400">No sequences in this workspace</p>
            <p className="text-[9px] text-slate-300 mt-1">Upload FASTA files or paste sequences</p>
          </div>
        )}

        {ws && files.length > 0 && (
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {files.map(file => (
              <button
                key={file.id}
                onClick={() => handleFileClick(file)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 transition-colors text-left group"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${file.type === 'protein' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-slate-700 truncate group-hover:text-indigo-600">
                    {file.name}
                  </div>
                  <div className="text-[8px] text-slate-400">
                    {file.type?.toUpperCase()} · {file.sequence?.length || 0} bp
                  </div>
                </div>
                <svg className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Workspace switcher */}
        {workspaces.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <span className="text-[8px] font-semibold text-slate-400 uppercase">Workspace</span>
            <select
              value={activeWorkspaceId || ''}
              onChange={e => useWorkspaceStore.getState().setActiveWorkspace(e.target.value)}
              className="w-full mt-1 text-[10px] px-2 py-1 border border-slate-200 rounded bg-white"
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.files?.length || 0} seqs)</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </WidgetShell>
  )
}
