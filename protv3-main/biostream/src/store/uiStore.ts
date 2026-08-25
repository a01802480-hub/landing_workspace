/**
 * Zustand store for UI state — active tab, sidebar visibility,
 * inspector panel content, global search, and selection state.
 */
import { create } from 'zustand'
import { BioFile, AlignmentResult } from '../types'

export type TabId =
  | 'dashboard'
  | 'sequences'
  | 'alignment'
  | 'worksheet'
  | 'api-runner'
  | 'api-worksheet'
  | 'detail'
  | 'alignment-view'
  | 'alignment-worksheet'
  | 'uniprot-services'

export type InspectorContent =
  | { type: 'sequence'; file: BioFile }
  | { type: 'alignment'; result: AlignmentResult }
  | { type: 'api-result'; data: Record<string, unknown> }
  | { type: 'empty' }
  | null

export type SidebarPanel = 'entity-browser' | 'search' | 'none'

interface UIState {
  // Active tab
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Panels
  showEntityBrowser: boolean
  toggleEntityBrowser: () => void
  setShowEntityBrowser: (show: boolean) => void

  showInspector: boolean
  toggleInspector: () => void
  setShowInspector: (show: boolean) => void

  // Inspector content
  inspectorContent: InspectorContent
  setInspectorContent: (content: InspectorContent) => void

  // Selection
  selectedFile: BioFile | null
  setSelectedFile: (file: BioFile | null) => void

  selectedAlignmentResult: AlignmentResult | null
  setSelectedAlignmentResult: (result: AlignmentResult | null) => void

  // Global search
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  toggleSearch: () => void

  // Plus menu
  plusMenuOpen: boolean
  setPlusMenuOpen: (open: boolean) => void
  togglePlusMenu: () => void

  // Sidebar panel
  activeSidebarPanel: SidebarPanel
  setActiveSidebarPanel: (panel: SidebarPanel) => void

  // Loading overlay
  globalLoading: boolean
  setGlobalLoading: (loading: boolean) => void

  // Keyboard shortcut help
  showShortcutHelp: boolean
  setShowShortcutHelp: (show: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab, selectedFile: null, selectedAlignmentResult: null }),

  showEntityBrowser: true,
  toggleEntityBrowser: () => set(s => ({ showEntityBrowser: !s.showEntityBrowser })),
  setShowEntityBrowser: (show) => set({ showEntityBrowser: show }),

  showInspector: true,
  toggleInspector: () => set(s => ({ showInspector: !s.showInspector })),
  setShowInspector: (show) => set({ showInspector: show }),

  inspectorContent: null,
  setInspectorContent: (content) => set({ inspectorContent: content }),

  selectedFile: null,
  setSelectedFile: (file) =>
    set({
      selectedFile: file,
      inspectorContent: file ? { type: 'sequence', file } : null,
    }),

  selectedAlignmentResult: null,
  setSelectedAlignmentResult: (result) =>
    set({
      selectedAlignmentResult: result,
      inspectorContent: result ? { type: 'alignment', result } : null,
    }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  toggleSearch: () => set(s => ({ searchOpen: !s.searchOpen })),

  plusMenuOpen: false,
  setPlusMenuOpen: (open) => set({ plusMenuOpen: open }),
  togglePlusMenu: () => set(s => ({ plusMenuOpen: !s.plusMenuOpen })),

  activeSidebarPanel: 'entity-browser',
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),

  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  showShortcutHelp: false,
  setShowShortcutHelp: (show) => set({ showShortcutHelp: show }),
}))
