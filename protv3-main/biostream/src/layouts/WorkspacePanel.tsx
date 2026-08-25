/**
 * WorkspacePanel — Central tab controller.
 * Reads route location and Zustand stores, renders the appropriate
 * tab component with all needed props bridged from stores.
 *
 * This replaces the old MainWorkspace.tsx prop-drilling pattern.
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useCallback } from 'react'
import { useUIStore, TabId } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { processFastaFile } from '../utils/fastaParser'
import { AlignmentResult } from '../types'

// Dashboard widget grid
import { WidgetGrid } from '../components/widgets/WidgetGrid'

// Tab components
import SequenceViewerTab from '../components/tabs/SequenceViewerTab'
import AlignmentEngineTab from '../components/tabs/AlignmentEngineTab'
import WorksheetTab from '../components/tabs/WorksheetTab'
import SequenceDetailTab from '../components/tabs/SequenceDetailTab'
import AlignmentViewerTab from '../components/tabs/AlignmentViewerTab'
import AlignmentWorksheetViewer from '../components/tabs/AlignmentWorksheetViewer'

interface TabDef {
  id: TabId
  label: string
  path: string
  icon?: string
}

const MAIN_TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/workspace', icon: '🧩' },
  { id: 'sequences', label: 'Sequences', path: '/workspace/sequences', icon: '🧬' },
  { id: 'alignment', label: 'Alignment', path: '/workspace/alignment', icon: '📊' },
  { id: 'worksheet', label: 'Worksheet', path: '/workspace/worksheet', icon: '📋' },
]

export function WorkspacePanel() {
  const navigate = useNavigate()
  const location = useLocation()

  // Stores
  const activeTab = useUIStore(s => s.activeTab)
  const setActiveTab = useUIStore(s => s.setActiveTab)
  const selectedFile = useUIStore(s => s.selectedFile)
  const setSelectedFile = useUIStore(s => s.setSelectedFile)
  const selectedAlignmentResult = useUIStore(s => s.selectedAlignmentResult)
  const setSelectedAlignmentResult = useUIStore(s => s.setSelectedAlignmentResult)

  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)
  const alignmentResult = useWorkspaceStore(s => s.alignmentResult)
  const setAlignmentResult = useWorkspaceStore(s => s.setAlignmentResult)
  const addFile = useWorkspaceStore(s => s.addFile)

  const ws = activeWorkspace()

  // Derive current "view" from location
  const pathname = location.pathname
  const isDetailView = pathname.includes('/detail/')
  const isAlignmentView = pathname.includes('/alignment-view') && !pathname.includes('/alignment-worksheet')
  const isAlignmentWorksheet = pathname.includes('/alignment-worksheet')
  const isMainView = !isDetailView && !isAlignmentView && !isAlignmentWorksheet

  // Extract fileId from detail route
  const detailFileId = isDetailView ? pathname.split('/detail/')[1] : null
  const detailFile = detailFileId
    ? (ws?.files?.find(f => f.id === detailFileId) || selectedFile)
    : selectedFile

  // Active alignment result
  const activeAlignment = selectedAlignmentResult || alignmentResult

  // --- Navigation ---
  const goToTab = useCallback((tab: TabId) => {
    setActiveTab(tab)
    const def = MAIN_TABS.find(t => t.id === tab)
    if (def) navigate(def.path)
  }, [setActiveTab, navigate])

  const goBack = useCallback(() => {
    setSelectedFile(null)
    setSelectedAlignmentResult(null)
    goToTab('dashboard')
  }, [setSelectedFile, setSelectedAlignmentResult, goToTab])

  // --- File handling ---
  const handleUploadSequences = useCallback(async (workspaceId: string, fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result?.toString() || '')
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      })
      const bioFiles = processFastaFile(file.name, content, workspaceId)
      for (const bf of bioFiles) {
        await addFile(workspaceId, bf)
      }
    }
  }, [addFile])

  // --- Alignment handling ---
  const handleAlignmentComplete = useCallback((result: AlignmentResult | null) => {
    setAlignmentResult(result)
    setSelectedAlignmentResult(result)
    if (result) {
      goToTab('worksheet')
    }
  }, [setAlignmentResult, setSelectedAlignmentResult, goToTab])

  // --- Detail handler ---
  const openDetailView = useCallback((file: import('../types').BioFile) => {
    setSelectedFile(file)
    setActiveTab('detail')
    navigate(`/workspace/detail/${file.id}`)
  }, [setSelectedFile, setActiveTab, navigate])

  // --- Render ---
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
      {/* Tab bar */}
      <div className="h-9 flex items-center border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
        {isMainView && MAIN_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => goToTab(tab.id)}
            className={`
              h-full flex items-center px-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === tab.id
                ? 'text-indigo-600 border-indigo-500 bg-indigo-50/50'
                : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }
            `}
          >
            {tab.label}
          </button>
        ))}

        {/* Back button for sub-views */}
        {!isMainView && (
          <button
            onClick={goBack}
            className="h-full flex items-center gap-1 px-3 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {/* Workspace indicator */}
        {ws && (
          <div className="ml-auto mr-3 text-[10px] text-slate-400 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {ws.name}
          </div>
        )}
      </div>

      {/* Tab content — min-h-0 is critical: allows flex children to shrink below content height so overflow-auto scrolls */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Empty workspace state */}
        {!ws && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 font-medium">No workspace selected</p>
              <p className="text-xs text-slate-400">Create or select a workspace from the left panel to get started.</p>
            </div>
          </div>
        )}

        {/* Dashboard — widget grid (always available) */}
        {isMainView && activeTab === 'dashboard' && <WidgetGrid />}

        {/* Main tabs (only when workspace exists) */}
        {ws && isMainView && activeTab === 'sequences' && (
          <SequenceViewerTab
            project={ws}
            onUploadSequences={handleUploadSequences}
            openDetailView={openDetailView}
          />
        )}
        {ws && isMainView && activeTab === 'alignment' && (
          <AlignmentEngineTab
            activeProject={ws}
            comparisonFiles={null}
            onAlignmentComplete={handleAlignmentComplete}
            onTabSwitch={(tab: string) => goToTab(tab as TabId)}
          />
        )}
        {ws && isMainView && activeTab === 'worksheet' && (
          <WorksheetTab
            project={ws}
            alignmentResult={activeAlignment}
            onAlignmentItemClick={(result: AlignmentResult) => {
              setSelectedAlignmentResult(result)
              setActiveTab('alignment-worksheet')
              navigate('/workspace/alignment-worksheet')
            }}
            onFileClick={openDetailView}
          />
        )}
        {/* Sub-views */}
        {isDetailView && (
          <SequenceDetailTab file={detailFile || null} onBack={goBack} />
        )}
        {isAlignmentView && activeAlignment && (
          <AlignmentViewerTab alignment={activeAlignment} onBack={goBack} />
        )}
        {isAlignmentWorksheet && activeAlignment && (
          <AlignmentWorksheetViewer alignment={activeAlignment} onBack={goBack} />
        )}
        {isAlignmentView && !activeAlignment && (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            No alignment selected. Run an alignment first.
          </div>
        )}
        {isAlignmentWorksheet && !activeAlignment && (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            No alignment selected. Run an alignment first.
          </div>
        )}
      </div>
    </div>
  )
}
