import { useState, useCallback, useMemo, useEffect, useReducer } from 'react'
import { Workspace, AlignmentResult } from '../types'
import { getMockWorkspaces } from '../utils/mockData'

interface UIState {
  activeTab: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet'
  showSettingsSidebar: boolean
  showPlusMenu: boolean
  selectedDetailFile: import('../types').BioFile | null
  selectedAlignmentResult: AlignmentResult | null
}

type UIAction =
  | { type: 'SET_ACTIVE_TAB'; payload: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet' }
  | { type: 'SET_SHOW_SETTINGS_SIDEBAR'; payload: boolean }
  | { type: 'SET_SHOW_PLUS_MENU'; payload: boolean }
  | { type: 'SET_SELECTED_DETAIL_FILE'; payload: import('../types').BioFile | null }
  | { type: 'SET_SELECTED_ALIGNMENT_RESULT'; payload: AlignmentResult | null }

const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      console.log('🔄 REDUCER: SET_ACTIVE_TAB from', state.activeTab, 'to', action.payload)
      return { ...state, activeTab: action.payload }
    case 'SET_SHOW_SETTINGS_SIDEBAR':
      return { ...state, showSettingsSidebar: action.payload }
    case 'SET_SHOW_PLUS_MENU':
      return { ...state, showPlusMenu: action.payload }
    case 'SET_SELECTED_DETAIL_FILE':
      console.log('🔄 REDUCER: SET_SELECTED_DETAIL_FILE to', action.payload?.name || '(null)')
      return { ...state, selectedDetailFile: action.payload }
    case 'SET_SELECTED_ALIGNMENT_RESULT':
      console.log('🔄 REDUCER: SET_SELECTED_ALIGNMENT_RESULT')
      return { ...state, selectedAlignmentResult: action.payload }
    default:
      return state
  }
}

export const useWorkspaceState = () => {
  // -----------------------------------------------------------------
  // 1. STATE MANAGEMENT
  // -----------------------------------------------------------------

  // NEW: Single UI state with reducer pattern - more robust than multiple useState calls
  const [uiState, dispatch] = useReducer(uiReducer, {
    activeTab: 'sequence',
    showSettingsSidebar: true,
    showPlusMenu: false,
    selectedDetailFile: null,
    selectedAlignmentResult: null,
  })

  // Extract from reducer state
  const { activeTab, showSettingsSidebar, showPlusMenu, selectedDetailFile, selectedAlignmentResult } = uiState

  // Log when activeTab changes
  useEffect(() => {
    console.log('🎯 STATE CHANGED: activeTab is now:', activeTab)
  }, [activeTab])

  // Log when selectedDetailFile changes
  useEffect(() => {
    console.log('📁 STATE CHANGED: selectedDetailFile is now:', selectedDetailFile?.name || '(null)')
  }, [selectedDetailFile])

  // Log when selectedAlignmentResult changes
  useEffect(() => {
    console.log('📊 STATE CHANGED: selectedAlignmentResult is now:', selectedAlignmentResult ? 'Alignment Result' : '(null)')
  }, [selectedAlignmentResult])

  // Workspace/Project state (separate from UI state)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(getMockWorkspaces())
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null)

  // -----------------------------------------------------------------
  // 2. EFFECTS (Side Effects)
  // -----------------------------------------------------------------

  // This auto-selects the first available workspace if none is currently selected.
  // It runs whenever the 'workspaces' list or the 'selectedProjectId' changes.
  useEffect(() => {
    if (!selectedProjectId && workspaces.length > 0) {
      setSelectedProjectId(workspaces[0].id)
    }
  }, [workspaces, selectedProjectId])

  // -----------------------------------------------------------------
  // 3. MEMOIZED VALUES
  // -----------------------------------------------------------------

  // Finds and returns the full workspace object matching the selected ID.
  // 'useMemo' ensures this heavy array lookup only runs when the list of 
  // workspaces changes or when a user selects a different ID.
  const activeProject = useMemo(() => {
    if (!selectedProjectId) return null
    return workspaces.find(w => w.id === selectedProjectId) || null
  }, [workspaces, selectedProjectId])

  // -----------------------------------------------------------------
  // 4. CALLBACKS (Action Handlers)
  // -----------------------------------------------------------------

  // UI State dispatch callbacks using reducer
  const switchTab = useCallback((tab: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet') => {
    console.log('🔄 switchTab called with:', tab)
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })
  }, [])

  const toggleSettingsSidebar = useCallback(() => {
    dispatch({ type: 'SET_SHOW_SETTINGS_SIDEBAR', payload: !showSettingsSidebar })
  }, [showSettingsSidebar])

  const togglePlusMenu = useCallback(() => {
    dispatch({ type: 'SET_SHOW_PLUS_MENU', payload: !showPlusMenu })
  }, [showPlusMenu])

  const closePlusMenu = useCallback(() => {
    dispatch({ type: 'SET_SHOW_PLUS_MENU', payload: false })
  }, [])

  // NEW: Set selected file for detail view AND switch to detail tab
  const openDetailView = useCallback((file: import('../types').BioFile | null) => {
    console.log('👁️ openDetailView called with file:', file?.name || '(null)')
    if (file) {
      dispatch({ type: 'SET_SELECTED_DETAIL_FILE', payload: file })
      console.log('   dispatching SET_ACTIVE_TAB to detail...')
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'detail' })
    } else {
      dispatch({ type: 'SET_SELECTED_DETAIL_FILE', payload: null })
    }
  }, [])

  // NEW: Open alignment result viewer
  const openAlignmentView = useCallback((alignment: AlignmentResult | null) => {
    console.log('📊 openAlignmentView called')
    if (alignment) {
      dispatch({ type: 'SET_SELECTED_ALIGNMENT_RESULT', payload: alignment })
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'alignment-view' })
    } else {
      dispatch({ type: 'SET_SELECTED_ALIGNMENT_RESULT', payload: null })
    }
  }, [])

  // Rest of callbacks using traditional setState
  const addFolder = useCallback((name: string) => {
    const newFolder: Workspace = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      owner: 'Santiago Arizpe Dueñas',
      description: 'Newly created folder',
      sequenceCount: 0,
      files: [],
      createdAt: new Date(),
    }
    setWorkspaces(prev => [newFolder, ...prev])
    setSelectedProjectId(newFolder.id) 
  }, [])

  const addFileToWorkspace = useCallback((workspaceId: string, file: import('../types').BioFile) => {
    console.log('➕ ADD FILE TO WORKSPACE:', { workspaceId, fileName: file.name, fileType: file.type, sequenceLength: file.sequence.length })
    
    setWorkspaces(prev => {
      const updated = prev.map(w => {
        if (w.id !== workspaceId) return w
        
        const existingFiles = w.files ?? []
        const newFiles = [...existingFiles, file]
        
        console.log(`  ✅ Added file to workspace "${w.name}"`)
        console.log(`  📊 Workspace now has ${newFiles.length} files`)
        
        return {
          ...w,
          files: newFiles,
          sequenceCount: (w.sequenceCount || 0) + 1,
        }
      })
      
      console.log(`✅ WORKSPACE STATE UPDATED - Total workspaces: ${updated.length}`)
      return updated
    })
  }, [])

  const setLastAlignmentResult = useCallback((result: AlignmentResult | null) => {
    console.log('📝 Setting alignment result:', result?.name || '(null)')
    // CRITICAL FIX: Update the REDUCER state, not the separate useState
    // This ensures the alignment result is passed to MainWorkspace and WorksheetTab
    dispatch({ type: 'SET_SELECTED_ALIGNMENT_RESULT', payload: result })
  }, [])

  // -----------------------------------------------------------------
  // 5. PUBLIC API
  // -----------------------------------------------------------------
  return {
    activeTab,           // From reducer state
    switchTab,           // Function to change tabs
    workspaces,
    activeProject,
    addFolder,
    showSettingsSidebar, // From reducer state
    toggleSettingsSidebar,
    showPlusMenu,        // From reducer state
    togglePlusMenu,
    closePlusMenu,
    selectedProject: selectedProjectId,
    setSelectedProject: setSelectedProjectId,
    addFileToWorkspace,
    alignmentResult,
    setLastAlignmentResult,
    selectedDetailFile,  // From reducer state
    openDetailView,
    selectedAlignmentResult, // From reducer state
    openAlignmentView,  // Function to open alignment viewer
  }
}