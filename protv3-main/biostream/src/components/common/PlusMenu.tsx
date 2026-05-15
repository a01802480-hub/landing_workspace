import { useRef } from 'react'
import { FolderPlus, Upload, Zap } from 'lucide-react'

interface PlusMenuProps {
  show: boolean
  onClose: () => void
  onAddFolder: (name: string) => void // Prop to send data back to the hook
}

/**
 * PlusMenu component
 * Features dynamic folder creation and sequence file uploading logic
 */
function PlusMenu({ show, onClose, onAddFolder }: PlusMenuProps) {
  // Reference to the hidden file input for sequence uploads
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!show) return null

  /**
   * Triggers the folder creation flow
   */
  const handleCreateFolder = () => {
    const folderName = window.prompt("Enter new workspace name:")
    if (folderName && folderName.trim() !== "") {
      onAddFolder(folderName.trim())
      onClose()
    }
  }

  /**
   * Opens the file explorer for sequence uploading
   */
  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  /**
   * Handles the file selection for .faa or .gbk files
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      alert(`Preparing to upload: ${file.name}. (Logic to parse FASTA goes here)`)
      onClose()
    }
  }

  const menuItems = [
    { 
      icon: FolderPlus, 
      label: 'New Folder', 
      action: handleCreateFolder 
    },
    { 
      icon: Upload, 
      label: 'Upload Sequence (.faa, .gbk)', 
      action: triggerFileUpload 
    },
    { 
      icon: Zap, 
      label: 'New Analysis', 
      action: () => alert('Starting new comparative analysis workflow...') 
    },
  ]

  return (
    <>
      {/* Hidden input for file uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".faa,.fasta,.gbk,.txt"
        onChange={handleFileChange}
      />

      <div className="absolute top-16 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-left-2 duration-200">
        <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Quick Actions
        </div>
        
        {menuItems.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              onClick={item.action}
              className="w-56 px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-3 text-gray-700 transition-colors group"
            >
              <Icon size={18} className="text-gray-400 group-hover:text-indigo-600" />
              <span className="text-sm font-medium group-hover:text-indigo-900">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      
      {/* Backdrop to close menu when clicking outside */}
      <div 
        className="fixed inset-0 z-[90]" 
        onClick={onClose}
      />
    </>
  )
}

export default PlusMenu