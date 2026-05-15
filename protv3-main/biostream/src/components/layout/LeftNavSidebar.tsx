import { LayoutDashboard, FolderOpen, Search, Plus, Home } from 'lucide-react'
import PlusMenu from '../common/PlusMenu'

interface LeftNavSidebarProps {
  showPlusMenu: boolean
  togglePlusMenu: () => void
  closePlusMenu: () => void
  onAddFolder: (name: string) => void
  onGoHome?: () => void
}

function LeftNavSidebar({ showPlusMenu, togglePlusMenu, closePlusMenu, onAddFolder, onGoHome }: LeftNavSidebarProps) {
  return (
    <div className="relative flex flex-col w-16 bg-gradient-to-b from-indigo-950 to-indigo-900 text-white shadow-lg z-50">
      <div className="flex flex-col items-center gap-6 pt-6">
        {/* Home Button */}
        {onGoHome && (
          <button 
            onClick={onGoHome}
            className="p-3 hover:bg-white/10 rounded-lg transition-colors"
            title="Go to Home"
          >
            <Home size={24} />
          </button>
        )}
        
        <button className="p-3 hover:bg-white/10 rounded-lg transition-colors"><LayoutDashboard size={24} /></button>
        <button className="p-3 hover:bg-white/10 rounded-lg transition-colors"><FolderOpen size={24} /></button>
        <button className="p-3 hover:bg-white/10 rounded-lg transition-colors"><Search size={24} /></button>

        {/* Plus Button */}
        <div className="relative">
          <button
            onClick={togglePlusMenu}
            className="p-3 bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors text-white shadow-lg"
            title="Add New Sequences"
          >
            <Plus size={24} />
          </button>
          {/* Pass the function to the PlusMenu */}
          <PlusMenu show={showPlusMenu} onClose={closePlusMenu} onAddFolder={onAddFolder} />
        </div>
      </div>

      <div className="mt-auto mb-6 flex justify-center">
        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold border-2 border-white/20">
          S
        </div>
      </div>
    </div>
  )
}

export default LeftNavSidebar