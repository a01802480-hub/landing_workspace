/**
 * Recent API Results Widget — shows latest API executions.
 */
import { WidgetShell } from './WidgetShell'
import { useAPIStore } from '../../store/apiStore'

export function RecentResultsWidget({ onRemove }: { onRemove?: () => void }) {
  const entries = useAPIStore(s => s.entries)
  const clearHistory = useAPIStore(s => s.clearHistory)
  const recent = entries.slice(0, 15)

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    failed: 'bg-red-50 text-red-600 border-red-200',
    running: 'bg-blue-50 text-blue-600 border-blue-200',
    pending: 'bg-amber-50 text-amber-600 border-amber-200',
  }

  return (
    <WidgetShell
      title="Recent API Results"
      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
      color="purple"
      onRemove={onRemove}
      actions={
        entries.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-[9px] text-slate-400 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
        )
      }
    >
      <div className="p-2">
        {recent.length === 0 && (
          <p className="text-[10px] text-slate-400 text-center py-6">
            No API results yet. Run an API to see results here.
          </p>
        )}

        {recent.length > 0 && (
          <div className="space-y-1 max-h-[260px] overflow-y-auto">
            {recent.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 transition-colors group"
              >
                {/* Status dot */}
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.status === 'completed' ? 'bg-emerald-400' :
                  entry.status === 'failed' ? 'bg-red-400' :
                  entry.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-amber-400'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-slate-700 truncate">
                    {entry.apiName}
                  </div>
                  <div className="text-[8px] text-slate-400 truncate">
                    {new Date(entry.startedAt).toLocaleTimeString()}
                    {entry.completedAt && ` · ${((new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime()) / 1000).toFixed(1)}s`}
                  </div>
                </div>

                <span className={`text-[8px] px-1 py-0.5 rounded border font-medium ${statusColors[entry.status] || statusColors.pending}`}>
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats bar */}
        {entries.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-3 text-[9px] text-slate-400">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {entries.filter(e => e.status === 'completed').length} ok
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {entries.filter(e => e.status === 'failed').length} err
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {entries.filter(e => e.status === 'pending' || e.status === 'running').length} pending
            </span>
          </div>
        )}
      </div>
    </WidgetShell>
  )
}
