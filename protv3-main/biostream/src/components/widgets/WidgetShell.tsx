/**
 * WidgetShell — wrapper for each dashboard widget.
 * Provides: title bar, collapse toggle, resize handle, action buttons.
 */
import { useState, useRef, useEffect } from 'react'

interface WidgetShellProps {
  title: string
  icon?: React.ReactNode
  color?: string           // accent color for the top border
  defaultCollapsed?: boolean
  onRemove?: () => void
  onRefresh?: () => void
  actions?: React.ReactNode
  children: React.ReactNode
  gridArea?: string        // CSS grid-area name
  minHeight?: string
}

export function WidgetShell({
  title,
  icon,
  color = 'indigo',
  defaultCollapsed = false,
  onRemove,
  onRefresh,
  actions,
  children,
  gridArea,
  minHeight = '280px',
}: WidgetShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const colorMap: Record<string, string> = {
    indigo: 'border-indigo-400',
    blue: 'border-blue-400',
    emerald: 'border-emerald-400',
    amber: 'border-amber-400',
    purple: 'border-purple-400',
    rose: 'border-rose-400',
    slate: 'border-slate-400',
    cyan: 'border-cyan-400',
  }

  const borderColor = colorMap[color] || colorMap.indigo

  return (
    <div
      className={`flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md ${gridArea ? '' : ''}`}
      style={{ gridArea, minHeight: collapsed ? undefined : minHeight }}
    >
      {/* Title bar */}
      <div className={`h-8 flex items-center gap-2 px-3 border-t-2 ${borderColor} bg-slate-50 shrink-0 select-none`}>
        {icon && <span className="text-sm shrink-0">{icon}</span>}
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide truncate">
          {title}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Custom actions */}
        {actions}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-white transition-colors"
            title="Refresh"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Menu */}
        {onRemove && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
              title="Widget menu"
              aria-label="Widget menu"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => { onRemove(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 transition-colors"
                >
                  Remove Widget
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}
