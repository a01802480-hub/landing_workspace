// UI Components and Tabs
import TabBar from '../common/TabBar'
import SequenceViewerTab from '../tabs/SequenceViewerTab'
import SequenceDetailTab from '../tabs/SequenceDetailTab'
import AlignmentEngineTab from '../tabs/AlignmentEngineTab'
import AlignmentViewerTab from '../tabs/AlignmentViewerTab'
import WorksheetTab from '../tabs/WorksheetTab'
import AlignmentWorksheetViewer from '../tabs/AlignmentWorksheetViewer'
import UniProtServicesTab from '../tabs/UniProtServicesTab'
import APIRunnerTab from '../tabs/APIRunnerTab'
import APIWorksheetTab from '../tabs/APIWorksheetTab'
// Type definitions
import { Workspace, BioFile, AlignmentResult } from '../../types'
// Icons for visual flair
import { LayoutGrid, PlusCircle, ArrowRight } from 'lucide-react'

// -----------------------------------------------------------------
// 1. COMPONENT PROPS INTERFACE
// -----------------------------------------------------------------
// This defines exactly what data this component expects to receive from its parent.
interface MainWorkspaceProps {
  // Limits activeTab to only these specific string values
  activeTab: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet'
    // A callback function to tell the parent component when a user clicks a new tab
  onTabSwitch: (tab: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet') => void
    // The currently selected project data. Can be null if no project is selected yet.
  activeProject: Workspace | null
    //files selected for comparison from the Right Sidebar. Can be null if none are selected.
  comparisonFiles: BioFile[] | null

  // Callback for uploading sequence files into this workspace
  onUploadSequences: (workspaceId: string, files: FileList) => void

    // A callback function to tell the parent to toggle the settings sidebar
  toggleSettingsSidebar: () => void
  // Callback when alignment is complete
  onAlignmentComplete: (result: AlignmentResult | null) => void
  // Selected file for detail view
  selectedDetailFile: BioFile | null
  // Callback to open detail view
  openDetailView: (file: BioFile | null) => void
  // Selected alignment result
  selectedAlignmentResult: AlignmentResult | null
  // Callback to open alignment view
  openAlignmentView: (alignment: AlignmentResult | null) => void
}

/**
 * MainWorkspace Component
 * * Central hub of the application. Manages the display of different 
 * bioinformatics tools (tabs) and handles the "No Project Selected" 
 * state to prevent application crashes during initialization.
 */
function MainWorkspace({
  activeTab,
  onTabSwitch,
  activeProject,
  comparisonFiles,
  onUploadSequences,
  onAlignmentComplete,
  selectedDetailFile,
  openDetailView,
  selectedAlignmentResult,
  openAlignmentView,
}: MainWorkspaceProps) {
  console.log('⚙️ MainWorkspace render:', { activeTab, hasDetailFile: !!selectedDetailFile, fileName: selectedDetailFile?.name })

  // Debug: Log which tab will render
  if (activeTab === 'sequence') console.log('📋 Should render SEQUENCE tab')
  if (activeTab === 'detail') console.log('📋 Should render DETAIL tab')
  if (activeTab === 'alignment') console.log('📋 Should render ALIGNMENT tab')
  if (activeTab === 'worksheet') console.log('📋 Should render WORKSHEET tab')

  // -----------------------------------------------------------------
  // 2. HELPER RENDER FUNCTION (Empty screen (only shows when no project is selected)
  // -----------------------------------------------------------------
  /**
   * RenderEmptyState Function
   * * Returns a professional "Empty State" UI when no project is active.
   * Guides the user to interact with the sidebar or create a new folder.
   */
  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-10 text-center animate-in fade-in duration-700">
      
      {/* Visual anchor: A large grid icon representing the workspace structure */}
      <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-sm flex items-center justify-center mb-8 border border-slate-100 ring-8 ring-slate-100/50">
        <LayoutGrid size={40} className="text-indigo-200" />
      </div>
      
      <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Your Workspace is Empty</h2>
      
      <p className="max-w-md text-slate-500 text-sm leading-relaxed mb-10">
        BioStream is ready for your comparative genomic analysis. 
        Start by creating a research folder to organize your sequences.
      </p>
      
      {/* Instruction Box: Directs the user to the Plus Button */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-indigo-200 group">
          <PlusCircle size={20} className="text-indigo-500 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 1</p>
            <p className="text-xs font-bold text-slate-700">Click the Plus button to add a folder</p>
          </div>
          <ArrowRight size={14} className="ml-4 text-slate-300" />
        </div>
      </div>

      {/* System Status Indicator */}
      <div className="mt-12 flex items-center gap-2 px-4 py-2 bg-indigo-50/50 rounded-full border border-indigo-100">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">
          Engine Initialized & Ready
        </span>
      </div>
    </div>
  );

  // -----------------------------------------------------------------
  // 3. GUARD CLAUSE
  // -----------------------------------------------------------------
  /**
   * Guard Clause
   * * If activeProject is null or undefined, we stop the normal rendering
   * and show the empty state instead. This prevents 'Property of null' errors.
   */
  if (!activeProject) {
    return renderEmptyState();
  }

  // Extract sequences from workspace files for UniProt services
  const frontendSequences = activeProject.files?.map(f => f.sequence) || [];
  // For now, backend sequences are the same (in a real app, these would be fetched from backend)
  const backendSequences = frontendSequences;

  // -----------------------------------------------------------------
  // 4. MAIN RENDER (When a project is selected)
  // -----------------------------------------------------------------
  /**
   * Displays the TabBar and the specific tool requested by the user.
   * Passes the activeProject data to each tab for context-specific analysis.
   */
  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-300">
      
      {/* NEW: TabBar receives a flag to show/hide the Alignment tab based on comparison state */}
      <TabBar 
        activeTab={activeTab} 
        onTabSwitch={onTabSwitch} 
        hasActiveAlignment={!!comparisonFiles} 
      />

      <div className="flex-1 overflow-auto bg-white">
        
        {/* NEW: Maps the 'sequence' tab to the Folder/File Explorer view */}
        {activeTab === 'sequence' && (
          <SequenceViewerTab project={activeProject} onUploadSequences={onUploadSequences} openDetailView={openDetailView} />
        )}
        
        {/* NEW: Detail view for individual sequence display */}
        {activeTab === 'detail' && (
          <SequenceDetailTab file={selectedDetailFile} onBack={() => onTabSwitch('sequence')} />
        )}
        
        {/* NEW: Renders the Alignment Engine only when the alignment tab is active */}
        {activeTab === 'alignment' && (
          <AlignmentEngineTab
            activeProject={activeProject}
            comparisonFiles={comparisonFiles}
            onAlignmentComplete={onAlignmentComplete}
            onTabSwitch={onTabSwitch}
          />
        )}

        {/* NEW: Renders the Alignment Viewer for displaying alignment results */}
        {activeTab === 'alignment-view' && (
          <AlignmentViewerTab alignment={selectedAlignmentResult} onBack={() => onTabSwitch('sequence')} />
        )}

        {/* NEW: Renders the Worksheet for the specific project context */}
        {activeTab === 'worksheet' && (
          <WorksheetTab 
            project={activeProject} 
            alignmentResult={selectedAlignmentResult}
            onAlignmentItemClick={(alignment) => {
              openAlignmentView(alignment);
              // Switch to a special alignment worksheet view
              onTabSwitch('alignment-worksheet');
            }}
            onFileClick={(file) => {
              openDetailView(file);
            }}
          />
        )}

        {/* Renders the Advanced Alignment Worksheet Viewer */}
        {activeTab === 'alignment-worksheet' && (
          <AlignmentWorksheetViewer
            alignment={selectedAlignmentResult!}
            onBack={() => onTabSwitch('worksheet')}
            onUpdateAlignment={(updatedAlignment) => {
              // Update the selected alignment result with edited data
              openAlignmentView(updatedAlignment);
            }}
          />
        )}

        {/* NEW: UniProt Services Tab - Search, validate, and resolve mismatches */}
        {activeTab === 'uniprot-services' && (
          <UniProtServicesTab
            frontendSequences={frontendSequences}
            backendSequences={backendSequences}
          />
        )}

        {/* NEW: API Runner Tab - Execute any of the 21 available APIs */}
        {activeTab === 'api-runner' && (
          <APIRunnerTab />
        )}

        {/* NEW: API Worksheet Tab - Manage API execution history and results */}
        {activeTab === 'api-worksheet' && (
          <APIWorksheetTab />
        )}
      </div>
    </div>
  )
}

export default MainWorkspace