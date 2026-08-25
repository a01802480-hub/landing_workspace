/**
 * LeftNavIconBar — 56px vertical icon-only navigation.
 * Benchling-style persistent left icon dock.
 */
import { useNavigate } from 'react-router-dom'
import { useUIStore, TabId } from '../store/uiStore'

interface NavItem {
  id: TabId | 'home' | 'search'
  label: string
  icon: React.ReactNode
  shortcut?: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/workspace',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: 'sequences',
    label: 'Sequences',
    path: '/workspace/sequences',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'alignment',
    label: 'Alignment',
    path: '/workspace/alignment',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    id: 'worksheet',
    label: 'Worksheet',
    path: '/workspace/worksheet',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
]

export function LeftNavIconBar() {
  const navigate = useNavigate()
  const activeTab = useUIStore(s => s.activeTab)
  const setActiveTab = useUIStore(s => s.setActiveTab)
  const setSelectedFile = useUIStore(s => s.setSelectedFile)
  const setSelectedAlignmentResult = useUIStore(s => s.setSelectedAlignmentResult)
  const toggleEntityBrowser = useUIStore(s => s.toggleEntityBrowser)
  const toggleSearch = useUIStore(s => s.toggleSearch)
  const showEntityBrowser = useUIStore(s => s.showEntityBrowser)

  const user = { name: 'Santiago', initial: 'S' }

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'search') {
      toggleSearch()
      return
    }
    if (item.id === 'home') {
      setSelectedFile(null)
      setSelectedAlignmentResult(null)
      setActiveTab('dashboard')
      navigate('/workspace')
      return
    }
    // Clear any selected file/alignment when switching main tabs
    setSelectedFile(null)
    setSelectedAlignmentResult(null)
    setActiveTab(item.id)
    navigate(item.path)
  }

  return (
    <div className="w-14 h-full bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center py-3 gap-1 shrink-0">
      {/* Logo / Home */}
      <button
        onClick={() => {
          setSelectedFile(null)
          setSelectedAlignmentResult(null)
          setActiveTab('dashboard')
          navigate('/workspace')
        }}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-colors mb-2"
        title="BioStream Home"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </button>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 my-1" />

      {/* Nav items */}
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => handleNavClick(item)}
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group
            ${activeTab === item.id
              ? 'text-white bg-indigo-600 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
            }
          `}
          title={item.label}
        >
          {item.icon}
          {/* Tooltip on hover */}
          <span className="absolute left-full ml-3 px-2 py-1 text-xs bg-slate-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            {item.label}
          </span>
        </button>
      ))}

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 my-1" />

      {/* Entity browser toggle */}
      <button
        onClick={toggleEntityBrowser}
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group
          ${showEntityBrowser ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}
        `}
        title="Toggle Entity Browser"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="absolute left-full ml-3 px-2 py-1 text-xs bg-slate-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Entity Browser
        </span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
        {user.initial}
      </div>
    </div>
  )
}
