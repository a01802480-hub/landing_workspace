/**
 * BenchlingLayout — The main four-panel application shell.
 * Layout: LeftNavIconBar | EntityBrowser | WorkspacePanel | InspectorPanel
 * with a TopBar spanning the content area.
 */
import { ErrorBoundary } from '../components/error/ErrorBoundary'
import { LeftNavIconBar } from './LeftNavIconBar'
import { EntityBrowser } from './EntityBrowser'
import { WorkspacePanel } from './WorkspacePanel'
import { InspectorPanel } from './InspectorPanel'
import { TopBar } from './TopBar'
import { GlobalSearchBar } from '../components/search/GlobalSearchBar'
import { useUIStore } from '../store/uiStore'
import { useEffect } from 'react'

export function BenchlingLayout() {
  const searchOpen = useUIStore(s => s.searchOpen)
  const setSearchOpen = useUIStore(s => s.setSearchOpen)

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K — Global search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      // Cmd+B / Ctrl+B — Toggle entity browser
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        useUIStore.getState().toggleEntityBrowser()
      }
      // Cmd+I / Ctrl+I — Toggle inspector
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        useUIStore.getState().toggleInspector()
      }
      // Escape — Close modals
      if (e.key === 'Escape') {
        setSearchOpen(false)
        useUIStore.getState().setShowShortcutHelp(false)
      }
      // ? — Show shortcut help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        useUIStore.getState().setShowShortcutHelp(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSearchOpen])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100">
      {/* Main horizontal layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 1. Left Icon Nav */}
        <ErrorBoundary>
          <LeftNavIconBar />
        </ErrorBoundary>

        {/* 2. Entity Browser (collapsible) */}
        <ErrorBoundary>
          <EntityBrowser />
        </ErrorBoundary>

        {/* 3. Center: Workspace (TopBar + Tab content) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TopBar />
          <ErrorBoundary>
            <WorkspacePanel />
          </ErrorBoundary>
        </div>

        {/* 4. Inspector Panel (collapsible) */}
        <ErrorBoundary>
          <InspectorPanel />
        </ErrorBoundary>
      </div>

      {/* Global search overlay */}
      {searchOpen && <GlobalSearchBar onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
