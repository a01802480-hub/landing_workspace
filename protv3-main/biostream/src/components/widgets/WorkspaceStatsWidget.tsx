/**
 * Workspace Stats Widget — overview of current workspace.
 */
import { WidgetShell } from './WidgetShell'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useAPIStore } from '../../store/apiStore'
import { useEntityStore } from '../../store/entityStore'

export function WorkspaceStatsWidget({ onRemove }: { onRemove?: () => void }) {
  const workspaces = useWorkspaceStore(s => s.workspaces)
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)
  const entries = useAPIStore(s => s.entries)
  const entities = useEntityStore(s => s.entities)

  const ws = activeWorkspace()
  const totalFiles = workspaces.reduce((sum, w) => sum + (w.files?.length || 0), 0)
  const totalSequences = workspaces.reduce((sum, w) => sum + (w.files?.reduce((s, f) => s + (f.sequence?.length || 0), 0) || 0), 0)
  const apiSuccess = entries.filter(e => e.status === 'completed').length
  const entityCount = Object.keys(entities).length
  const activeFileCount = ws?.files?.length || 0

  const stats = [
    { label: 'Workspaces', value: workspaces.length, icon: '📁', color: 'text-indigo-600' },
    { label: 'Files', value: totalFiles, icon: '🧬', color: 'text-emerald-600' },
    { label: 'Residues', value: totalSequences.toLocaleString(), icon: '🔬', color: 'text-blue-600' },
    { label: 'API Calls', value: apiSuccess, icon: '⚡', color: 'text-amber-600' },
    { label: 'Entities', value: entityCount, icon: '🔗', color: 'text-purple-600' },
    { label: 'Active Files', value: activeFileCount, icon: '📋', color: 'text-rose-600' },
  ]

  return (
    <WidgetShell
      title="Workspace Overview"
      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
      color="slate"
      onRemove={onRemove}
      minHeight="200px"
    >
      <div className="p-3">
        {/* Current workspace */}
        {ws && (
          <div className="mb-3 pb-3 border-b border-slate-100">
            <div className="text-[9px] font-semibold text-slate-400 uppercase mb-1">Current Workspace</div>
            <div className="text-xs font-semibold text-slate-800">{ws.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {ws.files?.length || 0} sequences · Created {ws.createdAt instanceof Date ? ws.createdAt.toLocaleDateString() : '—'}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map(stat => (
            <div key={stat.label} className="text-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="text-lg mb-0.5">{stat.icon}</div>
              <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[8px] text-slate-400 font-medium uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-1">
          <button
            onClick={() => useWorkspaceStore.getState().addWorkspace('New Workspace ' + new Date().toLocaleDateString())}
            className="flex-1 text-[9px] py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-colors"
          >
            + New Workspace
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'api-runner' } }))}
            className="flex-1 text-[9px] py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-medium transition-colors"
          >
            Run API
          </button>
        </div>
      </div>
    </WidgetShell>
  )
}
