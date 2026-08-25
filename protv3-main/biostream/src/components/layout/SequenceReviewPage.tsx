import { useState } from 'react'
import { BioFile, Workspace } from '../../types'
import { ArrowLeft, Check, Plus, Dna, FileText } from 'lucide-react'

interface SequenceReviewPageProps {
  sequences: BioFile[]
  onBack: () => void
  onStartWorkspace: (workspaceId: string) => void
  workspaces: Workspace[]
  onCreateWorkspace: (name: string, description?: string) => void
}

export default function SequenceReviewPage({
  sequences,
  onBack,
  onStartWorkspace,
  workspaces,
  onCreateWorkspace
}: SequenceReviewPageProps) {
  const [selectedSequences, setSelectedSequences] = useState<Set<string>>(
    new Set(sequences.map(s => s.id))
  )
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDescription, setWorkspaceDescription] = useState('')
  const [useExistingWorkspace, setUseExistingWorkspace] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)

  // Toggle sequence selection
  const toggleSequence = (id: string) => {
    const newSelected = new Set(selectedSequences)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedSequences(newSelected)
  }

  // Select all sequences
  const selectAll = () => {
    setSelectedSequences(new Set(sequences.map(s => s.id)))
  }

  // Deselect all sequences
  const deselectAll = () => {
    setSelectedSequences(new Set())
  }

  // Handle starting workspace
  const handleStart = () => {
    if (selectedSequences.size === 0) {
      alert('Please select at least one sequence')
      return
    }

    setIsCreating(true)

    if (useExistingWorkspace && selectedWorkspaceId) {
      // Use existing workspace
      onStartWorkspace(selectedWorkspaceId)
    } else {
      // Create new workspace
      const name = workspaceName.trim() || `Analysis ${new Date().toLocaleDateString()}`
      const description = workspaceDescription.trim() || `Created with ${selectedSequences.size} sequences`
      
      onCreateWorkspace(name, description)
      
      // Wait a moment for workspace to be created, then use it
      setTimeout(() => {
        if (workspaces.length > 0) {
          const newWorkspace = workspaces[workspaces.length - 1]
          onStartWorkspace(newWorkspace.id)
        }
      }, 500)
    }
  }

  const selectedCount = selectedSequences.size
  const totalCount = sequences.length

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Go back"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review Sequences</h1>
              <p className="text-sm text-gray-500">
                {selectedCount} of {totalCount} sequences selected
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={selectAll}
              className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sequence List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Sequences</h2>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {sequences.map((sequence) => (
                  <div
                    key={sequence.id}
                    onClick={() => toggleSequence(sequence.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedSequences.has(sequence.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedSequences.has(sequence.id)
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300'
                        }`}>
                          {selectedSequences.has(sequence.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {sequence.type === 'protein' ? (
                              <Dna className="w-4 h-4 text-purple-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-600" />
                            )}
                            <h3 className="font-medium text-gray-900 truncate">
                              {sequence.name}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 font-mono truncate">
                            {sequence.sequence.substring(0, 80)}
                            {sequence.sequence.length > 80 ? '...' : ''}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                            <span>{sequence.sequence.length} residues</span>
                            <span className="capitalize">{sequence.type}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workspace Configuration */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Workspace Setup</h2>

              {/* Workspace Selection Toggle */}
              <div className="mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useExistingWorkspace}
                    onChange={(e) => setUseExistingWorkspace(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Use existing workspace
                  </span>
                </label>
              </div>

              {useExistingWorkspace ? (
                /* Existing Workspace Selection */
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Workspace
                  </label>
                  <select
                    value={selectedWorkspaceId}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Choose a workspace...</option>
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name} ({ws.sequenceCount} sequences)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* New Workspace Creation */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="My Analysis Project"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={workspaceDescription}
                      onChange={(e) => setWorkspaceDescription(e.target.value)}
                      placeholder="Brief description of your analysis..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total sequences:</span>
                    <span className="font-medium text-gray-900">{totalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Selected:</span>
                    <span className="font-medium text-indigo-600">{selectedCount}</span>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={isCreating || selectedCount === 0 || (useExistingWorkspace && !selectedWorkspaceId)}
                className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Start Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}