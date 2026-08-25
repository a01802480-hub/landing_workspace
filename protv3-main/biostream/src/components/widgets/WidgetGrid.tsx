/**
 * WidgetGrid — responsive CSS grid dashboard.
 * Users can add/remove/rearrange widgets on their workspace.
 */
import { useState, useCallback } from 'react'
import { GoogleCalendarWidget } from './GoogleCalendarWidget'
import { APIRunnerWidget } from './APIRunnerWidget'
import { SequenceBrowserWidget } from './SequenceBrowserWidget'
import { RecentResultsWidget } from './RecentResultsWidget'
import { WorkspaceStatsWidget } from './WorkspaceStatsWidget'
import { QuickAlignmentWidget } from './QuickAlignmentWidget'

type WidgetId =
  | 'calendar'
  | 'api-runner'
  | 'sequences'
  | 'recent-results'
  | 'stats'
  | 'quick-alignment'

interface WidgetConfig {
  id: WidgetId
  label: string
  icon: string
  color: string
  defaultVisible: boolean
}

const WIDGET_REGISTRY: WidgetConfig[] = [
  { id: 'calendar', label: 'Calendar', icon: '📅', color: 'rose', defaultVisible: true },
  { id: 'api-runner', label: 'API Runner', icon: '⚡', color: 'indigo', defaultVisible: true },
  { id: 'sequences', label: 'Sequences', icon: '🧬', color: 'emerald', defaultVisible: true },
  { id: 'quick-alignment', label: 'Quick Alignment', icon: '📊', color: 'blue', defaultVisible: true },
  { id: 'recent-results', label: 'Recent Results', icon: '📈', color: 'purple', defaultVisible: true },
  { id: 'stats', label: 'Stats', icon: '📋', color: 'slate', defaultVisible: true },
]

export function WidgetGrid() {
  const [visibleWidgets, setVisibleWidgets] = useState<Set<WidgetId>>(
    new Set(WIDGET_REGISTRY.filter(w => w.defaultVisible).map(w => w.id))
  )
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid')

  const toggleWidget = useCallback((id: WidgetId) => {
    setVisibleWidgets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const removeWidget = useCallback((id: WidgetId) => {
    setVisibleWidgets(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const hiddenWidgets = WIDGET_REGISTRY.filter(w => !visibleWidgets.has(w.id))

  const renderWidget = (id: WidgetId) => {
    const onRemove = () => removeWidget(id)
    switch (id) {
      case 'calendar': return <GoogleCalendarWidget onRemove={onRemove} />
      case 'api-runner': return <APIRunnerWidget onRemove={onRemove} />
      case 'sequences': return <SequenceBrowserWidget onRemove={onRemove} />
      case 'recent-results': return <RecentResultsWidget onRemove={onRemove} />
      case 'stats': return <WorkspaceStatsWidget onRemove={onRemove} />
      case 'quick-alignment': return <QuickAlignmentWidget onRemove={onRemove} />
      default: return null
    }
  }

  const visibleList = WIDGET_REGISTRY.filter(w => visibleWidgets.has(w.id))

  return (
    <div className="min-h-0 flex-1 flex flex-col bg-slate-50">
      {/* Widget toolbar */}
      <div className="h-8 flex items-center gap-2 px-3 border-b border-slate-200 bg-white shrink-0">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          Dashboard
        </span>

        <div className="flex-1" />

        {/* Layout toggle */}
        <div className="flex items-center bg-slate-100 rounded p-0.5">
          <button
            onClick={() => setLayoutMode('grid')}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${layoutMode === 'grid' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            title="Grid layout"
            aria-label="Grid layout"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button
            onClick={() => setLayoutMode('list')}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${layoutMode === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            title="List layout"
            aria-label="List layout"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </button>
        </div>

        {/* Add widget button */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={hiddenWidgets.length === 0}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Widget
          </button>

          {showAddMenu && hiddenWidgets.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                {hiddenWidgets.map(w => (
                  <button
                    key={w.id}
                    onClick={() => { toggleWidget(w.id); setShowAddMenu(false) }}
                    className="w-full text-left px-3 py-2 text-[11px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <span>{w.icon}</span>
                    <span className="font-medium">{w.label}</span>
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full bg-${w.color}-400`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Widget count */}
        <span className="text-[9px] text-slate-400">
          {visibleWidgets.size}/{WIDGET_REGISTRY.length}
        </span>
      </div>

      {/* Widget grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {layoutMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-min">
            {visibleList.map(w => (
              <div key={w.id} className="min-h-[200px]">
                {renderWidget(w.id)}
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {visibleList.map(w => (
              <div key={w.id}>
                {renderWidget(w.id)}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {visibleWidgets.size === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="text-4xl">🧩</div>
              <p className="text-sm font-medium text-slate-600">No widgets visible</p>
              <p className="text-xs text-slate-400">Click "Add Widget" to customize your dashboard</p>
              <button
                onClick={() => setVisibleWidgets(new Set(WIDGET_REGISTRY.map(w => w.id)))}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Restore All Widgets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
