import { useState } from 'react'
import { Workspace, BioFile } from '../../types'
import { Eye } from 'lucide-react'

interface Props {
  project: Workspace
  onUploadSequences: (workspaceId: string, files: FileList) => void
  openDetailView: (file: BioFile) => void
}

function SequenceViewerTab({ project, onUploadSequences, openDetailView }: Props) {
  const [showUploadPopup, setShowUploadPopup] = useState(false)

  // Add null check
  if (!project) {
    return <div className="flex items-center justify-center h-full text-slate-400">Loading project...</div>
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="border-b border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase">
            Active Workspace
          </span>
          <h1 className="text-sm font-bold text-slate-700">{project.name}</h1>
        </div>
        <button
          onClick={() => setShowUploadPopup(true)}
          className="py-1.5 px-3 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
        >
          Upload Sequence
        </button>
      </div>

      {showUploadPopup && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Upload New Sequence File</h3>
            <p className="text-[10px] text-slate-500 mb-3">Choose a local .fasta/.faa file to add to this folder.</p>
            <input
              type="file"
              accept=".fasta,.fa,.faa,.pep,.txt"
              multiple
              className="w-full text-xs mb-4"
              onChange={(e) => {
                if (e.target.files) {
                  onUploadSequences(project.id, e.target.files)
                  setShowUploadPopup(false)
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUploadPopup(false)}
                className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="text-xs text-slate-500 mb-3">{(project.files?.length || 0)} sequence(s) in this folder</div>
        {project.files && project.files.length > 0 ? (
          <div className="space-y-2">
            {project.files.map((file) => (
              <button
                key={file.id}
                onClick={() => {
                  console.log('👁️ SequenceViewerTab: Clicked eye icon for file:', file.name)
                  openDetailView(file)
                }}
                className="w-full p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="text-left flex-1">
                  <div className="font-medium text-slate-700 group-hover:text-indigo-700">{file.name}</div>
                  <div className="text-[9px] text-slate-400 mt-1">{file.sequence.length} bp/aa</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase text-slate-400 group-hover:text-indigo-600">{file.type}</span>
                  <Eye size={14} className="text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-40 text-slate-400">
            No sequences in "{project.name}" yet. Upload a .faa file to begin.
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-4 text-[10px] text-slate-400 font-mono text-center uppercase tracking-widest">
        Owner: {project.owner} | Created: {project.createdAt.toLocaleDateString()}
      </div>
    </div>
  )
}
export default SequenceViewerTab