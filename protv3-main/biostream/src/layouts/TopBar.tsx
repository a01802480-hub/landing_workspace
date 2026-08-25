/**
 * TopBar — Global search, breadcrumbs, workspace selector, user menu.
 * Benchling-style top navigation bar.
 */
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'

export function TopBar() {
  const toggleSearch = useUIStore(s => s.toggleSearch)
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)

  const ws = activeWorkspace()

  return (
    <div className="h-11 border-b border-slate-200 bg-white flex items-center px-4 gap-3 shrink-0">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className="text-slate-400">Projects</span>
        <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium text-slate-700">
          {ws?.name || 'Select a workspace'}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search trigger */}
      <button
        onClick={toggleSearch}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors min-w-[240px]"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search entities, sequences, APIs...</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-slate-200 rounded font-sans text-slate-500">
          ⌘K
        </kbd>
      </button>

      {/* Workspace selector */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span>BioStream v3</span>
      </div>
    </div>
  )
}
