/**
 * EntityBrowser — Collapsible left panel showing workspaces, files, and entities.
 * Benchling-style hierarchical entity tree.
 */
import { useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useUIStore } from '../store/uiStore'
import { BioFile } from '../types'

export function EntityBrowser() {
  const navigate = useNavigate()
  const workspaces = useWorkspaceStore(s => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore(s => s.setActiveWorkspace)
  const showEntityBrowser = useUIStore(s => s.showEntityBrowser)
  const setActiveTab = useUIStore(s => s.setActiveTab)
  const setSelectedFile = useUIStore(s => s.setSelectedFile)
  const addWorkspace = useWorkspaceStore(s => s.addWorkspace)

  if (!showEntityBrowser) return null

  const handleFileClick = (file: BioFile) => {
    setSelectedFile(file)
    setActiveTab('detail')
    navigate(`/workspace/detail/${file.id}`)
  }

  const handleNewWorkspace = async () => {
    const name = prompt('Workspace name:')
    if (name?.trim()) {
      await addWorkspace(name.trim())
    }
  }

  return (
    <div className="w-60 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={handleNewWorkspace}
          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="New Workspace"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto py-1">
        {workspaces.map(ws => {
          const isActive = ws.id === activeWorkspaceId
          const fileCount = ws.files?.length || ws.sequenceCount || 0

          return (
            <div key={ws.id}>
              {/* Workspace item */}
              <button
                onClick={() => setActiveWorkspace(ws.id)}
                className={`
                  w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors group
                  ${isActive
                    ? 'bg-indigo-50 border-r-2 border-indigo-500'
                    : 'hover:bg-slate-50 border-r-2 border-transparent'
                  }
                `}
              >
                <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={isActive ? 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z' : 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'} />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {ws.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {fileCount} {fileCount === 1 ? 'sequence' : 'sequences'}
                  </div>
                </div>
              </button>

              {/* File list (only for active workspace) */}
              {isActive && ws.files && ws.files.length > 0 && (
                <div className="ml-5 border-l border-slate-100">
                  {ws.files.map(file => (
                    <button
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      className="w-full flex items-center gap-2 pl-4 pr-2 py-1 hover:bg-slate-50 text-left transition-colors group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        file.type === 'protein' ? 'bg-emerald-400' : 'bg-blue-400'
                      }`} />
                      <span className="text-[11px] text-slate-600 truncate flex-1 group-hover:text-slate-900">
                        {file.name}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase">
                        {file.type === 'protein' ? 'AA' : 'DNA'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="h-8 flex items-center justify-between px-3 border-t border-slate-100 bg-slate-50">
        <span className="text-[10px] text-slate-400">
          {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] text-slate-400">
          ⌘B
        </span>
      </div>
    </div>
  )
}
