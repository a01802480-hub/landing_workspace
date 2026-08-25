/**
 * GlobalSearchBar — Cmd+K command palette overlay.
 * Searches across all entity types using simple substring matching.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEntityStore, Entity } from '../../store/entityStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'

interface GlobalSearchBarProps {
  onClose: () => void
}

export function GlobalSearchBar({ onClose }: GlobalSearchBarProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const entities = useEntityStore(s => s.entities)
  const workspaces = useWorkspaceStore(s => s.workspaces)
  const setActiveWorkspace = useWorkspaceStore(s => s.setActiveWorkspace)
  const setActiveTab = useUIStore(s => s.setActiveTab)
  const setSelectedFile = useUIStore(s => s.setSelectedFile)

  // Build searchable items from all sources
  const searchItems = useCallback((): (Entity & { action: () => void })[] => {
    const items: (Entity & { action: () => void })[] = []

    // Add all registered entities
    Object.values(entities).forEach(entity => {
      items.push({
        ...entity,
        action: () => {
          if (entity.type === 'sequence') {
            const fileId = entity.id.replace('sequence-', '')
            const ws = workspaces.find(w => w.files?.some(f => f.id === fileId))
            if (ws) {
              setActiveWorkspace(ws.id)
              const file = ws.files?.find(f => f.id === fileId)
              if (file) {
                setSelectedFile(file)
              }
              setActiveTab('detail')
              navigate(`/workspace/detail/${fileId}`)
            }
          } else if (entity.type === 'workspace') {
            setActiveWorkspace(entity.id)
            setActiveTab('sequences')
            navigate('/workspace/sequences')
          } else if (entity.type === 'alignment') {
            setActiveTab('alignment-view')
            navigate('/workspace/alignment-view')
          }
          onClose()
        },
      })
    })

    // Add workspaces that aren't registered as entities yet
    workspaces.forEach(ws => {
      if (!entities[ws.id]) {
        items.push({
          id: ws.id,
          type: 'workspace',
          name: ws.name,
          description: `${ws.sequenceCount || ws.files?.length || 0} sequences`,
          tags: [],
          relationships: [],
          metadata: {},
          createdAt: ws.createdAt instanceof Date ? ws.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          action: () => {
            setActiveWorkspace(ws.id)
            setActiveTab('sequences')
            navigate('/workspace/sequences')
            onClose()
          },
        })
      }

      // Add files from each workspace
      ws.files?.forEach(file => {
        const fileId = `sequence-${file.id}`
        if (!entities[fileId]) {
          items.push({
            id: fileId,
            type: 'sequence',
            name: file.name,
            description: `${file.type === 'protein' ? 'Protein' : 'DNA'} · ${file.sequence.length} bp`,
            tags: [file.type],
            relationships: [{ targetId: ws.id, type: 'belongs-to' }],
            metadata: { length: file.sequence.length },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            action: () => {
              setActiveWorkspace(ws.id)
              setSelectedFile(file)
              setActiveTab('detail')
              navigate(`/workspace/detail/${file.id}`)
              onClose()
            },
          })
        }
      })
    })

    return items
  }, [entities, workspaces, setActiveWorkspace, setActiveTab, setSelectedFile, navigate, onClose])

  const filtered = query.trim()
    ? searchItems().filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(query.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
      )
    : searchItems()

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'sequence': return '🧬'
      case 'alignment': return '📊'
      case 'workspace': return '📁'
      case 'api-result': return '⚡'
      case 'notebook-entry': return '📝'
      default: return '📄'
    }
  }

  const typeColor = (type: string) => {
    switch (type) {
      case 'sequence': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'alignment': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'workspace': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'api-result': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Search panel */}
      <div className="relative w-[560px] max-h-[60vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entities, sequences, workspaces..."
            className="flex-1 text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-400 font-sans">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-400">No results found</p>
            </div>
          )}

          {filtered.slice(0, 20).map((item, i) => (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`
                w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                ${i === selectedIndex
                  ? 'bg-indigo-50'
                  : 'hover:bg-slate-50'
                }
              `}
            >
              <span className="text-lg shrink-0">{typeIcon(item.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {item.name}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-400 truncate">
                    {item.description}
                  </div>
                )}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeColor(item.type)}`}>
                {item.type}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
