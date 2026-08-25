/**
 * Zustand store for API execution state.
 * Tracks all API calls: history, job status, results.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type APIJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface APIExecutionEntry {
  id: string
  apiName: string
  category: string
  status: APIJobStatus
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt: string
  completedAt?: string
  jobId?: string
  notes?: string
  starred?: boolean
}

interface APIState {
  // Execution history
  entries: APIExecutionEntry[]
  activeEntries: Map<string, APIExecutionEntry> // by jobId for polling

  // Actions
  addEntry: (entry: APIExecutionEntry) => void
  updateEntry: (id: string, updates: Partial<APIExecutionEntry>) => void
  removeEntry: (id: string) => void
  clearHistory: () => void
  starEntry: (id: string) => void

  // Stats
  stats: () => { total: number; success: number; error: number; pending: number }

  // Polling
  addPollingJob: (jobId: string, entry: APIExecutionEntry) => void
  removePollingJob: (jobId: string) => void
}

let entryCounter = 0
function nextId(): string {
  entryCounter++
  return `api-${Date.now()}-${entryCounter}`
}

export const useAPIStore = create<APIState>()(
  persist(
    (set, get) => ({
      entries: [],
      activeEntries: new Map(),

      addEntry: (entry) => {
        const withId = { ...entry, id: entry.id || nextId() }
        set(state => ({ entries: [withId, ...state.entries] }))
      },

      updateEntry: (id, updates) => {
        set(state => ({
          entries: state.entries.map(e => (e.id === id ? { ...e, ...updates } : e)),
        }))
      },

      removeEntry: (id) => {
        set(state => ({
          entries: state.entries.filter(e => e.id !== id),
        }))
      },

      clearHistory: () => set({ entries: [] }),

      starEntry: (id) => {
        set(state => ({
          entries: state.entries.map(e => (e.id === id ? { ...e, starred: !e.starred } : e)),
        }))
      },

      stats: () => {
        const { entries } = get()
        return {
          total: entries.length,
          success: entries.filter(e => e.status === 'completed').length,
          error: entries.filter(e => e.status === 'failed').length,
          pending: entries.filter(e => e.status === 'pending' || e.status === 'running').length,
        }
      },

      addPollingJob: (jobId, entry) => {
        set(state => {
          const next = new Map(state.activeEntries)
          next.set(jobId, entry)
          return { activeEntries: next }
        })
      },

      removePollingJob: (jobId) => {
        set(state => {
          const next = new Map(state.activeEntries)
          next.delete(jobId)
          return { activeEntries: next }
        })
      },
    }),
    {
      name: 'biostream-api-store',
      partialize: (state) => ({
        entries: state.entries.slice(0, 500), // Keep last 500 entries
      }),
      // Map is not serializable, so don't persist activeEntries
    }
  )
)
