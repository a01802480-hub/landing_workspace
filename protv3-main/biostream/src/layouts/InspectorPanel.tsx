/**
 * InspectorPanel — Context-sensitive right panel.
 * Benchling-style: changes content based on selection.
 */
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useEntityStore } from '../store/entityStore'
import { useEffect } from 'react'

export function InspectorPanel() {
  const showInspector = useUIStore(s => s.showInspector)
  const inspectorContent = useUIStore(s => s.inspectorContent)
  const selectedFile = useUIStore(s => s.selectedFile)
  const selectedAlignmentResult = useUIStore(s => s.selectedAlignmentResult)
  const alignmentResult = useWorkspaceStore(s => s.alignmentResult)
  const entities = useEntityStore(s => s.entities)

  const activeResult = selectedAlignmentResult || alignmentResult

  // Register selected file as entity when inspector opens
  useEffect(() => {
    if (selectedFile) {
      const entityId = `sequence-${selectedFile.id}`
      if (!entities[entityId]) {
        useEntityStore.getState().addEntity({
          id: entityId,
          type: 'sequence',
          name: selectedFile.name,
          description: `${selectedFile.type === 'protein' ? 'Protein' : 'DNA'} sequence (${selectedFile.sequence.length} residues)`,
          tags: [selectedFile.type],
          relationships: [],
          metadata: {
            length: selectedFile.sequence.length,
            type: selectedFile.type,
            createdAt: selectedFile.createdAt instanceof Date ? selectedFile.createdAt.toISOString() : new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    }
  }, [selectedFile, entities])

  if (!showInspector) return null

  return (
    <div className="w-72 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-9 flex items-center px-3 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {inspectorContent?.type === 'sequence' ? 'Sequence Properties' :
           inspectorContent?.type === 'alignment' ? 'Alignment Properties' :
           inspectorContent?.type === 'api-result' ? 'API Result' :
           'Inspector'}
        </span>
        <button
          onClick={() => useUIStore.getState().setShowInspector(false)}
          className="ml-auto w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Sequence properties */}
        {inspectorContent?.type === 'sequence' && inspectorContent.file && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Name</label>
              <p className="text-xs text-slate-700 mt-0.5">{inspectorContent.file.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Type</label>
                <p className="text-xs text-slate-700 mt-0.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    inspectorContent.file.type === 'protein'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {inspectorContent.file.type === 'protein' ? 'Protein' : 'DNA'}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Length</label>
                <p className="text-xs text-slate-700 mt-0.5 font-mono">{inspectorContent.file.sequence.length} bp</p>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Sequence Preview</label>
              <div className="mt-1 p-2 bg-slate-50 rounded border border-slate-100">
                <p className="text-[10px] font-mono text-slate-600 break-all leading-relaxed">
                  {inspectorContent.file.sequence.slice(0, 120)}
                  {inspectorContent.file.sequence.length > 120 && '...'}
                </p>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Created</label>
              <p className="text-xs text-slate-700 mt-0.5">
                {inspectorContent.file.createdAt instanceof Date
                  ? inspectorContent.file.createdAt.toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Alignment properties */}
        {inspectorContent?.type === 'alignment' && activeResult && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Algorithm</label>
              <p className="text-xs text-slate-700 mt-0.5">{activeResult.algorithm}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Identity</label>
                <p className="text-xs font-mono font-semibold text-emerald-600 mt-0.5">
                  {activeResult.identity.toFixed(1)}%
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Coverage</label>
                <p className="text-xs font-mono text-slate-700 mt-0.5">
                  {activeResult.coverage.toFixed(1)}%
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Score</label>
                <p className="text-xs font-mono text-slate-700 mt-0.5">
                  {activeResult.score.toFixed(0)}
                </p>
              </div>
            </div>
            {activeResult.queryName && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Query</label>
                <p className="text-xs text-slate-700 mt-0.5">{activeResult.queryName}</p>
              </div>
            )}
            {activeResult.subjectName && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Subject</label>
                <p className="text-xs text-slate-700 mt-0.5">{activeResult.subjectName}</p>
              </div>
            )}
            {activeResult.aminoAcidPositions && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Positions Analyzed</label>
                <p className="text-xs text-slate-700 mt-0.5 font-mono">{activeResult.aminoAcidPositions.length} residues</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!inspectorContent && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-12">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-slate-400">Select a sequence or alignment to view properties</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-8 flex items-center justify-between px-3 border-t border-slate-100 bg-slate-50">
        <span className="text-[10px] text-slate-400">⌘I to toggle</span>
      </div>
    </div>
  )
}
