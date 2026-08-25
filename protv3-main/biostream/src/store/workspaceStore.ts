/**
 * Zustand store for workspace management.
 * Replaces useWorkspaceState.ts — eliminates props drilling.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Workspace, BioFile, AlignmentResult } from '../types'
import { getMockWorkspaces } from '../utils/mockData'
import {
  fetchWorkspaces,
  createWorkspace as apiCreateWorkspace,
  addFileToWorkspaceApi,
  WorkspaceData,
  WorkspaceFile,
} from '../services/workspace'

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

interface WorkspaceState {
  // Data
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  alignmentResult: AlignmentResult | null
  loading: boolean
  error: string | null

  // Computed helper
  activeWorkspace: () => Workspace | null

  // Actions
  loadWorkspaces: () => Promise<void>
  setActiveWorkspace: (id: string | null) => void
  addWorkspace: (name: string, description?: string) => Promise<Workspace | null>
  addFile: (workspaceId: string, file: BioFile) => Promise<void>
  removeFile: (workspaceId: string, fileId: string) => void
  setAlignmentResult: (result: AlignmentResult | null) => void
  clearError: () => void
}

/**
 * Recursively revive Date strings back to Date objects after JSON deserialization.
 * Zustand's persist middleware serializes Dates to ISO strings via JSON.stringify;
 * this reviver converts them back so .toLocaleDateString() and other Date methods work.
 */
function reviveDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(obj)) {
    // Looks like an ISO date string — attempt conversion
    const d = new Date(obj)
    if (!isNaN(d.getTime())) return d
  }
  if (Array.isArray(obj)) return obj.map(reviveDates)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Always convert 'createdAt' fields to Date objects
      if (key === 'createdAt' && typeof value === 'string') {
        const d = new Date(value)
        result[key] = isNaN(d.getTime()) ? value : d
      } else {
        result[key] = reviveDates(value)
      }
    }
    return result
  }
  return obj
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: getMockWorkspaces(),
      activeWorkspaceId: null,
      alignmentResult: null,
      loading: false,
      error: null,

      activeWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get()
        if (!activeWorkspaceId) return null
        return workspaces.find(w => w.id === activeWorkspaceId) || null
      },

      loadWorkspaces: async () => {
        // If we already have cached workspaces (from localStorage), use them immediately
        const current = get()
        if (current.workspaces.length > 0 && !current.activeWorkspaceId) {
          set({ activeWorkspaceId: current.workspaces[0].id })
        }

        set({ loading: true, error: null })
        try {
          const data = await fetchWorkspaces()
          if (data.length > 0) {
            const ws = data.map(toWorkspace)
            set(state => ({
              workspaces: ws,
              loading: false,
              // Auto-select first if none selected
              activeWorkspaceId: state.activeWorkspaceId || (ws.length > 0 ? ws[0].id : null),
            }))
          } else {
            set({ loading: false })
          }
        } catch (err) {
          console.warn('Backend unavailable, using cached/local workspaces:', err)
          set(state => ({
            loading: false,
            // Keep existing cached workspaces; auto-select first if needed
            activeWorkspaceId: state.activeWorkspaceId || (state.workspaces.length > 0 ? state.workspaces[0].id : null),
          }))
        }
      },

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      addWorkspace: async (name, description = '') => {
        // Optimistic local create
        const localId = Math.random().toString(36).substr(2, 9)
        const local: Workspace = {
          id: localId,
          name,
          owner: 'Santiago Arizpe Dueñas',
          description: description || 'New workspace',
          sequenceCount: 0,
          files: [],
          createdAt: new Date(),
        }
        set(state => ({
          workspaces: [local, ...state.workspaces],
          activeWorkspaceId: localId,
        }))

        // Try backend
        try {
          const created = await apiCreateWorkspace(name, description)
          if (created) {
            const ws = toWorkspace(created)
            set(state => ({
              workspaces: state.workspaces.map(w => w.id === localId ? ws : w),
              activeWorkspaceId: ws.id,
            }))
            return ws
          }
        } catch (err) {
          console.warn('Backend create failed, using local workspace:', err)
        }
        return local
      },

      addFile: async (workspaceId, file) => {
        // Optimistic local
        set(state => ({
          workspaces: state.workspaces.map(w => {
            if (w.id !== workspaceId) return w
            const existing = w.files ?? []
            return {
              ...w,
              files: [...existing, file],
              sequenceCount: (w.sequenceCount || 0) + 1,
            }
          }),
        }))

        // Try backend
        try {
          const backendFile = await addFileToWorkspaceApi(workspaceId, {
            name: file.name,
            type: file.type,
            sequence: file.sequence,
          })
          if (backendFile) {
            set(state => ({
              workspaces: state.workspaces.map(w => {
                if (w.id !== workspaceId) return w
                const existing = (w.files ?? []).filter(f => f.id !== file.id)
                return {
                  ...w,
                  files: [...existing, {
                    id: backendFile.id,
                    name: backendFile.name,
                    type: backendFile.type as 'protein' | 'dna',
                    sequence: backendFile.sequence,
                    createdAt: new Date(backendFile.createdAt),
                  }],
                }
              }),
            }))
          }
        } catch (err) {
          console.warn('Backend file add failed:', err)
        }
      },

      removeFile: (workspaceId, fileId) => {
        set(state => ({
          workspaces: state.workspaces.map(w => {
            if (w.id !== workspaceId) return w
            const files = (w.files ?? []).filter(f => f.id !== fileId)
            return { ...w, files, sequenceCount: files.length }
          }),
        }))
      },

      setAlignmentResult: (result) => set({ alignmentResult: result }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'biostream-workspaces',
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
      // Revive Date objects after JSON deserialization from localStorage
      merge: (persisted, current) => {
        const revived = reviveDates(persisted) as Partial<WorkspaceState>
        return {
          ...current,
          ...revived,
          // Preserve function properties from current state
          activeWorkspace: current.activeWorkspace,
          loadWorkspaces: current.loadWorkspaces,
          setActiveWorkspace: current.setActiveWorkspace,
          addWorkspace: current.addWorkspace,
          addFile: current.addFile,
          removeFile: current.removeFile,
          setAlignmentResult: current.setAlignmentResult,
          clearError: current.clearError,
        }
      },
    }
  )
)
