'use client';

import { useState, useEffect } from 'react'
import { useWorkspaceState } from './hooks/useWorkspaceState'
import { BioFile, Workspace } from './types'
import { processFastaFile } from './utils/fastaParser'
import LeftNavSidebar from './components/layout/LeftNavSidebar'
import LeftProjectBrowser from './components/layout/LeftProjectBrowser'
import MainWorkspace from './components/layout/MainWorkspace'
import RightSettingsSidebar from './components/layout/RightSettingsSidebar'
import ProjectHomePage from './components/layout/ProjectHomePage'
import NewAnalysisPage from './components/layout/NewAnalysisPage'
import SequenceReviewPage from './components/layout/SequenceReviewPage'

/**
 * BioStream Main Application Component
 * Redesigned with project selection, analysis flow, and enhanced workspace
 */
function App() {
  // ============================================================================
  // ALL HOOKS MUST BE AT THE TOP - before ANY conditional returns or logic
  // ============================================================================
  
  // Custom hook for workspace state management
  const workspaceState = useWorkspaceState()
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  
  // Comparison files state for alignment
  const [comparisonFiles, setComparisonFiles] = useState<import('./types').BioFile[] | null>(null)
  
  // Navigation state for new flow
  const [currentView, setCurrentView] = useState<'home' | 'new-analysis' | 'sequence-review' | 'workspace'>('home')
  const [uploadedSequences, setUploadedSequences] = useState<BioFile[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = localStorage.getItem('isAuthenticated')
      if (authStatus === 'true') {
        setIsAuthenticated(true)
      } else {
        // Redirect to landing page sign-in
        window.location.href = 'http://localhost:3000/signin'
      }
      setAuthChecking(false)
    }

    checkAuth()
  }, [])

  // ============================================================================
  // NOW we can destructure workspace state safely
  // ============================================================================
  const {
    activeTab,          // Currently active tab ('sequence', 'alignment', 'worksheet')
    switchTab,          // Function to change the active tab
    showSettingsSidebar,// Boolean controlling if the right sidebar is visible
    toggleSettingsSidebar,// Function to toggle the right sidebar
    showPlusMenu,       // Boolean controlling the '+' dropdown menu
    togglePlusMenu,     // Function to toggle that '+' menu
    closePlusMenu,      // Function to explicitly close that '+' menu
    selectedProject,    // The string ID of the currently selected workspace
    setSelectedProject, // Function to change the selected workspace ID
    workspaces,         // Array of all workspaces
    activeProject,      // The actual Workspace object matching the selected ID
    addFolder,          // Function to create and add a new folder/workspace
    addFileToWorkspace, // Function to add a , file into a workspace
    setLastAlignmentResult, // Function to store alignment result for worksheet
    selectedDetailFile, // Selected file for detail view
    openDetailView,     // Function to open detail view for a file
    selectedAlignmentResult, // Selected alignment result
    openAlignmentView,  // Function to open alignment viewer
  } = workspaceState

  // ============================================================================
  // Event handlers and helper functions (these are fine anywhere after hooks)
  // ============================================================================

  // Handle creating a new analysis
  const handleCreateNewAnalysis = () => {
    setCurrentView('new-analysis')
  }

  // Handle sequences from paste or upload
  const handleSequencesReady = (sequences: BioFile[], workspaceId?: string) => {
    setUploadedSequences(sequences)
    if (workspaceId) {
      setCurrentWorkspaceId(workspaceId)
    }
    setCurrentView('sequence-review')
  }

  // Handle starting workspace with reviewed sequences
  const handleStartWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    setSelectedProject(workspaceId)
    
    // Add all sequences to the workspace
    uploadedSequences.forEach(sequence => {
      addFileToWorkspace(workspaceId, sequence)
    })
    
    setCurrentView('workspace')
  }

  // Handle opening existing workspace
  const handleOpenWorkspace = (workspaceId: string) => {
    setSelectedProject(workspaceId)
    setCurrentWorkspaceId(workspaceId)
    setCurrentView('workspace')
  }

  // Function passed to RightSettingsSidebar to start alignment flow and switch to the correct tab
  const handleTriggerAlignment = (fileA: BioFile, fileB: BioFile) => {
    setComparisonFiles([fileA, fileB])
    switchTab('alignment')
  }

  // NEW: Handle alignment completion - store result and auto-switch to worksheet tab
  const handleAlignmentComplete = (result: import('./types').AlignmentResult | null) => {
    console.log('Alignment complete, storing result:', result)
    setLastAlignmentResult(result)
    // Auto-switch to worksheet tab to display results
    if (result) {
      console.log('Auto-switching to worksheet tab...')
      switchTab('worksheet')
    }
  }

  // NEW: Handle opening an alignment from the worksheet
  const handleOpenAlignmentWorksheet = (result: import('./types').AlignmentResult) => {
    setLastAlignmentResult(result)
    switchTab('alignment-worksheet')
  }

  // Reads sequence text from selected files and adds them to the current workspace.
  const readFileText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result?.toString() || '')
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })

  const handleUploadSequences = async (workspaceId: string, fileList: FileList) => {
    const uploadedEntries: BioFile[] = []
    
    console.log('UPLOAD STARTED:', { workspaceId, filesCount: fileList.length })
    
    // Process each uploaded file
    for (const file of Array.from(fileList)) {
      console.log(`Processing file: ${file.name}`)
      const content = await readFileText(file)
      console.log(`File content length: ${content.length}`)
      console.log(`File content preview:`, content.substring(0, 200))
      
      // Use the new FASTA parser that handles multiple sequences/isoforms
      // This will create separate BioFile objects for each sequence in the FASTA
      const bioFiles = processFastaFile(file.name, content, workspaceId)
      
      console.log(`PARSED RESULT:`, { 
        filesCreated: bioFiles.length,
        files: bioFiles.map(f => ({
          name: f.name,
          type: f.type,
          sequenceLength: f.sequence.length,
          sequencePreview: f.sequence.substring(0, 50)
        }))
      })
      
      uploadedEntries.push(...bioFiles)
      
      // Log if multiple sequences were detected and separated
      if (bioFiles.length > 1) {
        console.log(`Parsed ${bioFiles.length} sequences from ${file.name}`)
      }
    }

    console.log(`ADDING ${uploadedEntries.length} ENTRIES TO WORKSPACE`)
    uploadedEntries.forEach((entry) => {
      console.log(`Adding file:`, entry.name, 'Seq length:', entry.sequence.length)
      addFileToWorkspace(workspaceId, entry)
    })
  }

  // Debug: Check if state is initialized properly on every render
  console.log('App rendered:', { 
    currentView,
    activeTab, 
    activeProject, 
    showSettingsSidebar,
    workspacesCount: workspaces.length 
  })

  // ============================================================================
  // CONDITIONAL RENDERING - All hooks have been called, so this is safe now
  // ============================================================================

  // Show loading while checking authentication
  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-indigo-900 text-white font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-50">Verifying Authentication...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-indigo-900 text-white font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-50">Redirecting to Sign In...</p>
        </div>
      </div>
    )
  }

  // LOADING STATE - Wait for workspace initialization
  if (workspaces.length > 0 && !activeProject && currentView === 'workspace') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-indigo-900 text-white font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-50">Initializing Workspace...</p>
        </div>
      </div>
    )
  }

  // Error state: no workspaces means nothing can run
  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="flex h-screen w-screen bg-red-50 items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-red-700">ERROR: No workspaces available</p>
          <p className="text-red-600">workspaces count: {workspaces?.length || 0}</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // VIEW ROUTING - Render different views based on currentView state
  // ============================================================================

  // Project Home Page - Entry point with new analysis, settings, recent projects
  if (currentView === 'home') {
    return (
      <ProjectHomePage
        workspaces={workspaces}
        onCreateNewAnalysis={handleCreateNewAnalysis}
        onOpenWorkspace={handleOpenWorkspace}
      />
    )
  }

  // New Analysis Page - Choose between paste FASTA or upload files
  if (currentView === 'new-analysis') {
    return (
      <NewAnalysisPage
        onBack={() => setCurrentView('home')}
        onSequencesReady={handleSequencesReady}
      />
    )
  }

  // Sequence Review Page - Review all uploaded sequences before starting
  if (currentView === 'sequence-review') {
    return (
      <SequenceReviewPage
        sequences={uploadedSequences}
        onBack={() => setCurrentView('new-analysis')}
        onStartWorkspace={handleStartWorkspace}
        workspaces={workspaces}
        onCreateWorkspace={addFolder}
      />
    )
  }

  // ============================================================================
  // MAIN WORKSPACE VIEW - The full workspace with all features
  // ============================================================================
  return (
    // Wraps everything in a full-screen, unscrollable flex box
    <div className="flex h-screen w-screen bg-white overflow-hidden selection:bg-indigo-100">
      
      {/* 1. LEFT GLOBAL NAVIGATION
          Handles the Plus Menu and main tool switching
      */}
      <LeftNavSidebar
        showPlusMenu={showPlusMenu}
        togglePlusMenu={togglePlusMenu}
        closePlusMenu={closePlusMenu}
        onAddFolder={addFolder}
        onGoHome={() => setCurrentView('home')}
      />

      {/* 2. PROJECT BROWSER 
          Displays the list of folders. Updates instantly when a new folder is added.
      */}
      <LeftProjectBrowser
        selectedProject={selectedProject || ''}
        onProjectSelect={setSelectedProject}
        workspaces={workspaces}
      />

      {/* 3. CENTRAL WORKSPACE
          Contains the Map, Alignment, and Worksheet tabs.
          Uses 'activeProject' to display the correct folder name/data.
      */}
      <MainWorkspace
        activeTab={activeTab}
        onTabSwitch={switchTab}
        activeProject={activeProject}
        comparisonFiles={comparisonFiles}
        onUploadSequences={handleUploadSequences}
        toggleSettingsSidebar={toggleSettingsSidebar}
        onAlignmentComplete={handleAlignmentComplete}
        selectedDetailFile={selectedDetailFile}
        openDetailView={openDetailView}
        selectedAlignmentResult={selectedAlignmentResult}
        openAlignmentView={openAlignmentView}
      />

      {/* 4. RIGHT PROPERTIES SIDEBAR
          Contextual tools for selecting sequences to align.
          Conditionally rendered based on 'showSettingsSidebar' boolean.
      */}
      {showSettingsSidebar && (
        <RightSettingsSidebar
          workspaces={workspaces}
          onTriggerAlignment={handleTriggerAlignment}
        />
      )}
    </div>
  )
}

export default App