import React, { useState } from 'react'
// Lucide icons for searching, DNA representation, comparison actions, and closing
import { Search, Dna, ArrowRightLeft, X, Info } from 'lucide-react'
// Type definitions to ensure we handle Folders and BioFiles correctly
import { Workspace, BioFile } from '../../types'

// -----------------------------------------------------------------
// 1. COMPONENT PROPS INTERFACE
// -----------------------------------------------------------------
// This defines the data and functions the sidebar needs from the App state.
interface RightSidebarProps {
  // Access to all folders so the user can search for sequences across the whole app
  workspaces: Workspace[] 
  // The function to trigger the "Alignment Tab" once two sequences are picked
  onTriggerAlignment: (fileA: BioFile, fileB: BioFile) => void 
}

/**
 * RightSettingsSidebar Component
 * * Acts as the "Alignment Discovery Menu."
 * * Users can search for sequences (e.g., "Whale LIG1") and select two 
 * * different files to start a comparative analysis.
 */
function RightSettingsSidebar({ workspaces, onTriggerAlignment }: RightSidebarProps) {
  
  // -----------------------------------------------------------------
  // 2. COMPONENT STATE
  // -----------------------------------------------------------------
  // Tracks the text typed into the search bar
  const [query, setQuery] = useState('') 
  // Stores an array of exactly two selected files for comparison
  const [selected, setSelected] = useState<BioFile[]>([]) 

  // -----------------------------------------------------------------
  // 3. SEARCH LOGIC
  // -----------------------------------------------------------------
  /**
   * Flattening Logic:
   * * We take all Folders (Workspaces) and extract every individual BioFile 
   * * into one flat list so the user can search everything at once.
   */
  // We use optional chaining + default fallback because Workspaces may come without file list at this stage.
  const allAvailableFiles = workspaces.flatMap(folder => folder.files ?? [])
  
  /**
   * Filtering Logic:
   * * We look at the flat list and keep only the files whose names 
   * * match the user's search text (ignoring uppercase/lowercase).
   */
  const filteredFiles = allAvailableFiles.filter(file => 
    file.name.toLowerCase().includes(query.toLowerCase())
  )

  // -----------------------------------------------------------------
  // 4. SELECTION HANDLER
  // -----------------------------------------------------------------
  /**
   * handleSelect:
   * * If the file is already selected, it removes it (deselect).
   * * If not, it adds it to the "cart," but only allows a maximum of 2.
   */
  const handleSelect = (file: BioFile) => {
    // Check if the file clicked is already in our 'selected' list
    const isAlreadySelected = selected.find(s => s.id === file.id)
    
    if (isAlreadySelected) {
      // Remove it from the selection
      setSelected(selected.filter(s => s.id !== file.id)) 
    } else if (selected.length < 2) {
      // Add it to the selection only if we have room (max 2)
      setSelected([...selected, file]) 
    }
  }

  // -----------------------------------------------------------------
  // 5. MAIN RENDER
  // -----------------------------------------------------------------
  return (
    // The sidebar container: 320px wide (w-80), light gray background, left border
    <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col p-6 animate-in slide-in-from-right duration-300">
      
      {/* Sidebar Header Section */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Alignment Menu</h3>
        <Info size={14} className="text-slate-300 cursor-help" />
      </div>

      {/* SEARCH SECTION: The input box with a magnifying glass icon */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-2.5 text-slate-300" size={14} />
        <input 
          type="text"
          placeholder="Search all sequences..."
          // Tailwind: White background, rounded corners, indigo ring when clicked
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* RESULTS SECTION: A scrollable list of all found sequences */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredFiles.length > 0 ? (
          filteredFiles.map(file => (
            <button 
              key={file.id}
              onClick={() => handleSelect(file)}
              // Logic: If selected, turn indigo. If not, stay white/transparent.
              className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                selected.includes(file) 
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm' 
                  : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              {/* DNA Icon that changes color when selected */}
              <Dna size={16} className={selected.includes(file) ? 'text-indigo-600' : 'text-slate-300'} />
              
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${selected.includes(file) ? 'text-indigo-900' : 'text-slate-700'}`}>
                  {file.name}
                </p>
                <p className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-tighter">
                  {file.type} sequence
                </p>
              </div>

              {/* A small "X" button that only shows if the file is selected, to quickly deselect */}
              {selected.includes(file) && <X size={12} className="text-indigo-400" />}
            </button>
          ))
        ) : (
          // Message shown if the search query finds nothing
          <div className="text-center py-10">
            <p className="text-[10px] font-bold text-slate-300 uppercase italic">No matches found</p>
          </div>
        )}
      </div>

      {/* ACTION SECTION: The "Run Comparison" button */}
      {/* This only appears once exactly TWO sequences are selected */}
      <div className={`mt-6 pt-6 border-t border-slate-200 transition-all ${selected.length === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={() => {
            if (selected.length === 2) {
              onTriggerAlignment(selected[0], selected[1])
            }
          }}
          // A heavy indigo button with a shadow and a "slide-up" animation
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all"
        >
          <ArrowRightLeft size={18} />
          <span className="tracking-tight">Run Comparative Analysis</span>
        </button>
        <p className="text-center text-[9px] text-slate-400 mt-4 uppercase font-medium">Ready for comparison</p>
      </div>
    </div>
  )
}

export default RightSettingsSidebar