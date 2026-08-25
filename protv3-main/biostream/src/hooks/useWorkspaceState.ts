import { useState, useCallback, useMemo, useEffect, useReducer } from 'react'
import { Workspace, AlignmentResult } from '../types'
import { getMockWorkspaces } from '../utils/mockData'
import {
  fetchWorkspaces,
  createWorkspace,
  addFileToWorkspaceApi,
  WorkspaceData,
  WorkspaceFile,
} from '../services/workspace'

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
      return { ...state, activeTab: action.payload }
    case 'SET_SHOW_SETTINGS_SIDEBAR':
      return { ...state, showSettingsSidebar: action.payload }
    case 'SET_SHOW_PLUS_MENU':
      return { ...state, showPlusMenu: action.payload }
    case 'SET_SELECTED_DETAIL_FILE':
      return { ...state, selectedDetailFile: action.payload }
    case 'SET_SELECTED_ALIGNMENT_RESULT':
      return { ...state, selectedAlignmentResult: action.payload }
    default:
      return state
  }
}

function toWorkspace(d: WorkspaceData): Workspace {
  return {
    id: d.id,
    name: d.name,
    owner: d.owner,
    description: d.description,
    sequenceCount: d.sequenceCount,
    files: (d.files || []).map((f: WorkspaceFile) => ({
      id: f.id,
      name: f.name,
      type: f.type as 'protein' | 'dna',
      sequence: f.sequence,
      createdAt: new Date(f.createdAt),
    })),
    createdAt: new Date(d.createdAt),
  }
}

export const useWorkspaceState = () => {
  // UI reducer
  const [uiState, dispatch] = useReducer(uiReducer, {
    activeTab: 'sequence',
    showSettingsSidebar: true,
    showPlusMenu: false,
    selectedDetailFile: null,
    selectedAlignmentResult: null,
  })

  const { activeTab, showSettingsSidebar, showPlusMenu, selectedDetailFile, selectedAlignmentResult } = uiState

  // Workspace state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(getMockWorkspaces())
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch workspaces from backend on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchWorkspaces()
        if (!cancelled && data.length > 0) {
          setWorkspaces(data.map(toWorkspace))
        }
      } catch (err) {
        console.warn('Backend unavailable, using mock workspaces:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Auto-select first workspace
  useEffect(() => {
    if (!selectedProjectId && workspaces.length > 0) {
      setSelectedProjectId(workspaces[0].id)
    }
  }, [workspaces, selectedProjectId])

  // Memoized active project
  const activeProject = useMemo(() => {
    if (!selectedProjectId) return null
    return workspaces.find(w => w.id === selectedProjectId) || null
  }, [workspaces, selectedProjectId])

  // --- Callbacks ---

  const switchTab = useCallback((tab: typeof activeTab) => {
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

  const openDetailView = useCallback((file: import('../types').BioFile | null) => {
    if (file) {
      dispatch({ type: 'SET_SELECTED_DETAIL_FILE', payload: file })
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'detail' })
    } else {
      dispatch({ type: 'SET_SELECTED_DETAIL_FILE', payload: null })
    }
  }, [])

  const openAlignmentView = useCallback((alignment: AlignmentResult | null) => {
    if (alignment) {
      dispatch({ type: 'SET_SELECTED_ALIGNMENT_RESULT', payload: alignment })
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'alignment-view' })
    } else {
      dispatch({ type: 'SET_SELECTED_ALIGNMENT_RESULT', payload: null })
    }
  }, [])

  const addFolder = useCallback(async (name: string) => {
    // Try backend first
    const created = await createWorkspace(name).catch(() => null)
    if (created) {
      const ws = toWorkspace(created)
      setWorkspaces(prev => [ws, ...prev])
      setSelectedProjectId(ws.id)
      return
    }
    // Fallback: local-only
    const newFolder: Workspace = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      owner: 'Santiago Arizpe Dueñas',
      description: 'Newly created folder',
      sequenceCount: 0,
      files: [],
      createdAt: new Date(),
    }
    setWorkspaces(prev => [newFolder, ...prev])
    setSelectedProjectId(newFolder.id)
  }, [])

  const addFileToWorkspace = useCallback(async (workspaceId: string, file: import('../types').BioFile) => {
    // Try backend first
    addFileToWorkspaceApi(workspaceId, {
      name: file.name,
      type: file.type,
      sequence: file.sequence,
    }).then(backendFile => {
      if (backendFile) {
        setWorkspaces(prev =>
          prev.map(w => {
            if (w.id !== workspaceId) return w
            const existingFiles = w.files ?? []
            return {
              ...w,
              files: [...existingFiles, {
                id: backendFile.id,
                name: backendFile.name,
                type: backendFile.type as 'protein' | 'dna',
                sequence: backendFile.sequence,
                createdAt: new Date(backendFile.createdAt),
              }],
              sequenceCount: (w.sequenceCount || 0) + 1,
            }
          })
        )
      }
    }).catch(() => {})

    // Also update local state immediately for responsiveness
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.id !== workspaceId) return w
        const existingFiles = w.files ?? []
        return {
          ...w,
          files: [...existingFiles, file],
          sequenceCount: (w.sequenceCount || 0) + 1,
        }
      })
    )
  }, [])

  const setLastAlignmentResult = useCallback((result: AlignmentResult | null) => {
    dispatch({ type: 'SET_SELECTED_ALIGNMENT_RESULT', payload: result })
  }, [])

  return {
    activeTab,
    switchTab,
    workspaces,
    activeProject,
    addFolder,
    showSettingsSidebar,
    toggleSettingsSidebar,
    showPlusMenu,
    togglePlusMenu,
    closePlusMenu,
    selectedProject: selectedProjectId,
    setSelectedProject: setSelectedProjectId,
    addFileToWorkspace,
    alignmentResult,
    setLastAlignmentResult,
    selectedDetailFile,
    openDetailView,
    selectedAlignmentResult,
    openAlignmentView,
    loading,
  }
}
