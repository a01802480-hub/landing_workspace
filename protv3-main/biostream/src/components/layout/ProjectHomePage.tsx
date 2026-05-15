import { useState } from 'react'
import { Workspace } from '../../types'
import { Plus, Settings, Clock, FolderOpen } from 'lucide-react'

interface ProjectHomePageProps {
  workspaces: Workspace[]
  onCreateNewAnalysis: () => void
  onOpenWorkspace: (workspaceId: string) => void
}

export default function ProjectHomePage({
  workspaces,
  onCreateNewAnalysis,
  onOpenWorkspace
}: ProjectHomePageProps) {
  const [showSettings, setShowSettings] = useState(false)

  // Get recent projects (last 6)
  const recentProjects = workspaces
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BioStream</h1>
            <p className="text-sm text-gray-500 mt-1">Structural Biology Analysis Platform</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Settings"
          >
            <Settings className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* New Analysis Card */}
          <button
            onClick={onCreateNewAnalysis}
            className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 p-12 transition-all duration-300 text-left"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">New Analysis</h2>
                <p className="text-gray-500">Start a new protein or DNA sequence analysis</p>
              </div>
            </div>
          </button>

          {/* Settings Card */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl border-2 border-gray-200 hover:border-gray-400 p-12 transition-all duration-300 text-left"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Settings className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Settings</h2>
                <p className="text-gray-500">Configure your workspace preferences</p>
              </div>
            </div>
          </button>
        </div>

        {/* Recent Projects Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Recent Projects</h2>
            </div>
            <span className="text-sm text-gray-500">{workspaces.length} total</span>
          </div>

          {recentProjects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No projects yet</p>
              <p className="text-sm text-gray-400">Create your first analysis to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => onOpenWorkspace(workspace.id)}
                  className="group p-6 rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <FolderOpen className="w-8 h-8 text-indigo-600 group-hover:text-indigo-700" />
                    <span className="text-xs text-gray-400">
                      {new Date(workspace.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600">
                    {workspace.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{workspace.description}</p>
                  <div className="flex items-center text-xs text-gray-400">
                    <span>{workspace.sequenceCount} sequences</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings Panel (Collapsible) */}
        {showSettings && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in slide-in-from-top">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Alignment Method
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option>ClustalW</option>
                  <option>MUSCLE</option>
                  <option>MAFFT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sequence Type Detection
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input type="radio" name="seqType" className="mr-2" defaultChecked />
                    <span className="text-sm text-gray-700">Auto-detect</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="seqType" className="mr-2" />
                    <span className="text-sm text-gray-700">Always ask</span>
                  </label>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}