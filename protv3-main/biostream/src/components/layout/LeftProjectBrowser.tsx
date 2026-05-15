import { Workspace } from '../../types'

interface LeftProjectBrowserProps {
  selectedProject: string
  onProjectSelect: (projectId: string) => void
  workspaces: Workspace[] // NEW: Accept live data as a prop
}

/**
 * Left Project Browser component
 * Displays live list of active workspaces passed from the App state
 */
function LeftProjectBrowser({ selectedProject, onProjectSelect, workspaces }: LeftProjectBrowserProps) {
  // REMOVED: const workspaces = getMockWorkspaces() 

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-[10px] font-black text-gray-400 mb-4 tracking-widest uppercase">Workspaces</h2>

        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => onProjectSelect(workspace.id)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${
                selectedProject === workspace.id
                  ? 'bg-white border-indigo-200 shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-gray-200/50'
              }`}
            >
              <div className={`font-bold text-sm ${selectedProject === workspace.id ? 'text-indigo-600' : 'text-gray-700'}`}>
                {workspace.name}
              </div>
              <div className="text-[10px] mt-1 text-gray-400 font-medium uppercase tracking-tight">
                {workspace.owner}
              </div>
              <div className="text-[10px] mt-2 text-indigo-400 font-bold">
                {workspace.sequenceCount} SEQUENCES
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LeftProjectBrowser