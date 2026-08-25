/**
 * API Runner Widget — compact in-workspace API execution.
 * Select API from dropdown, provide input, run, and see results inline.
 */
import { useState, useCallback } from 'react'
import { WidgetShell } from './WidgetShell'
import { ALL_APIS, APIRegistry } from '../../services/api'
import { useAPIStore } from '../../store/apiStore'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { key: 'all', label: 'All APIs', color: 'slate' },
  { key: 'alignment', label: 'Alignment', color: 'blue' },
  { key: 'search', label: 'Search', color: 'indigo' },
  { key: 'structure', label: 'Structure', color: 'emerald' },
  { key: 'genomics', label: 'Genomics', color: 'purple' },
  { key: 'annotation', label: 'Annotation', color: 'amber' },
  { key: 'pathway', label: 'Pathway', color: 'cyan' },
  { key: 'chemical', label: 'Chemical', color: 'rose' },
  { key: 'variant', label: 'Variant', color: 'orange' },
  { key: 'literature', label: 'Literature', color: 'slate' },
]

export function APIRunnerWidget({ onRemove }: { onRemove?: () => void }) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedAPI, setSelectedAPI] = useState<APIRegistry | null>(null)
  const [input, setInput] = useState('')
  const [results, setResults] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [inputMode, setInputMode] = useState<'sequence' | 'query' | 'ids'>('query')

  const addEntry = useAPIStore(s => s.addEntry)

  const filteredAPIs = selectedCategory === 'all'
    ? ALL_APIS
    : ALL_APIS.filter(a => a.category === selectedCategory || a.subcategory === selectedCategory)

  const handleRun = useCallback(async () => {
    if (!selectedAPI || !input.trim()) return
    setRunning(true)
    setResults(null)

    const entryId = `api-${Date.now()}`
    addEntry({
      id: entryId,
      apiName: selectedAPI.name,
      category: selectedAPI.category,
      status: 'running',
      input: { query: input, mode: inputMode },
      startedAt: new Date().toISOString(),
    })

    try {
      const client = selectedAPI.client
      let result: any

      // Try common method patterns
      if (typeof client.search === 'function') {
        result = await client.search(input)
      } else if (typeof client.query === 'function') {
        result = await client.query(input)
      } else if (typeof client.find === 'function') {
        result = await client.find(input)
      } else if (typeof client.get === 'function') {
        result = await client.get(input)
      } else if (typeof client.discover === 'function') {
        result = await client.discover()
      } else {
        result = { error: 'No suitable method found for this API' }
      }

      setResults(result)
      addEntry({
        id: entryId,
        apiName: selectedAPI.name,
        category: selectedAPI.category,
        status: 'completed',
        input: { query: input, mode: inputMode },
        output: result,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })
      toast.success(`${selectedAPI.name} completed`)
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown error'
      setResults({ error: errorMsg })
      addEntry({
        id: entryId,
        apiName: selectedAPI.name,
        category: selectedAPI.category,
        status: 'failed',
        input: { query: input, mode: inputMode },
        error: errorMsg,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })
      toast.error(`${selectedAPI.name} failed: ${errorMsg}`)
    } finally {
      setRunning(false)
    }
  }, [selectedAPI, input, inputMode, addEntry])

  return (
    <WidgetShell
      title="API Runner"
      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
      color="indigo"
      onRemove={onRemove}
      actions={
        <div className="flex items-center gap-0.5">
          {(['query','sequence','ids'] as const).map(m => (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors capitalize ${inputMode === m ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div className="p-2 space-y-2">
        {/* Category chips */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.slice(0, 8).map(cat => (
            <button
              key={cat.key}
              onClick={() => { setSelectedCategory(cat.key); setSelectedAPI(null) }}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                selectedCategory === cat.key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* API Selector */}
        <select
          value={selectedAPI?.name || ''}
          onChange={e => setSelectedAPI(ALL_APIS.find(a => a.name === e.target.value) || null)}
          className="w-full text-[10px] px-2 py-1.5 border border-slate-200 rounded bg-white focus:border-indigo-300 outline-none"
        >
          <option value="">Select an API ({filteredAPIs.length} available)</option>
          {filteredAPIs.map(api => (
            <option key={api.name} value={api.name}>{api.name} — {api.description}</option>
          ))}
        </select>

        {/* Input */}
        {selectedAPI && (
          <>
            {inputMode === 'sequence' ? (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Paste FASTA sequence or protein/DNA string..."
                rows={3}
                className="w-full text-[10px] font-mono px-2 py-1.5 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-indigo-300 outline-none resize-none"
              />
            ) : (
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={inputMode === 'ids' ? 'Enter IDs (comma-separated)...' : 'Enter search query...'}
                className="w-full text-[10px] px-2 py-1.5 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-indigo-300 outline-none"
                onKeyDown={e => { if (e.key === 'Enter') handleRun() }}
              />
            )}

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={running || !input.trim()}
              className={`w-full py-1.5 rounded text-[10px] font-semibold text-white transition-colors ${
                running
                  ? 'bg-indigo-300 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              } disabled:opacity-50`}
            >
              {running ? (
                <span className="flex items-center justify-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running {selectedAPI.name}...
                </span>
              ) : (
                `Run ${selectedAPI.name}`
              )}
            </button>
          </>
        )}

        {/* Results */}
        {results && (
          <div className="border border-slate-200 rounded overflow-hidden">
            <div className="h-6 flex items-center px-2 bg-slate-50 border-b border-slate-100">
              <span className="text-[9px] font-semibold text-slate-500 uppercase">
                {results.error ? 'Error' : 'Results'}
              </span>
              {!results.error && (
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(results, null, 2))}
                  className="ml-auto text-[9px] text-indigo-500 hover:text-indigo-700"
                >
                  Copy JSON
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto">
              <pre className={`text-[10px] p-2 whitespace-pre-wrap break-all font-mono leading-relaxed ${
                results.error ? 'text-red-600 bg-red-50' : 'text-slate-700 bg-white'
              }`}>
                {typeof results === 'string' ? results : JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  )
}
