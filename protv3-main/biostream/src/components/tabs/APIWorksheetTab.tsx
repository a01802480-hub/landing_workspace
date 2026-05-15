import { useState, useEffect } from 'react';
import { Trash2, Copy, Download, Filter, Plus, Edit2, Check, X } from 'lucide-react';
import { getAllAPIs } from '../../services/api';

interface APIWorksheetEntry {
  id: string;
  timestamp: Date;
  apiName: string;
  category: string;
  status: 'success' | 'error' | 'pending' | 'manual';
  inputData: any;
  result: any;
  notes: string;
  jobId?: string;
}

export default function APIWorksheetTab() {
  const [entries, setEntries] = useState<APIWorksheetEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<APIWorksheetEntry | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});
  const [showAddForm, setShowAddForm] = useState(false);

  const apis = getAllAPIs();
  const categories = Array.from(new Set(apis.map(api => api.category))).sort();

  // Listen for save-to-worksheet events from APIRunnerTab
  useEffect(() => {
    const handleSaveEvent = (event: CustomEvent) => {
      const entryData = event.detail;
      const newEntry: APIWorksheetEntry = {
        ...entryData,
        id: `entry-${Date.now()}`,
        timestamp: new Date(entryData.timestamp)
      };
      setEntries(prev => [newEntry, ...prev]);
    };

    window.addEventListener('saveToWorksheet', handleSaveEvent as EventListener);
    
    return () => {
      window.removeEventListener('saveToWorksheet', handleSaveEvent as EventListener);
    };
  }, []);

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    const statusMatch = filterStatus === 'all' || entry.status === filterStatus;
    const categoryMatch = filterCategory === 'all' || entry.category === filterCategory;
    return statusMatch && categoryMatch;
  });

  const handleAddEntry = (entry: Omit<APIWorksheetEntry, 'id'>) => {
    const newEntry: APIWorksheetEntry = {
      ...entry,
      id: `entry-${Date.now()}`
    };
    setEntries(prev => [newEntry, ...prev]);
    setShowAddForm(false);
  };

  const handleUpdateNotes = (entryId: string, notes: string) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.id === entryId ? { ...entry, notes } : entry
      )
    );
    setEditingNotes(prev => {
      const newEditing = { ...prev };
      delete newEditing[entryId];
      return newEditing;
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(entry => entry.id !== entryId));
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(null);
    }
  };

  const handleExportAll = () => {
    const data = {
      exportDate: new Date().toISOString(),
      totalEntries: entries.length,
      entries: entries
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-worksheet-${Date.now()}.json`;
    a.click();
  };

  const handleExportAsCSV = () => {
    const headers = ['Timestamp', 'API', 'Category', 'Status', 'Job ID', 'Notes'];
    const rows = entries.map(e => [
      e.timestamp.toISOString(),
      e.apiName,
      e.category,
      e.status,
      e.jobId || '-',
      `"${e.notes.replace(/"/g, '""')}"`
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-worksheet-${Date.now()}.csv`;
    a.click();
  };

  const statusCounts = {
    success: entries.filter(e => e.status === 'success').length,
    error: entries.filter(e => e.status === 'error').length,
    pending: entries.filter(e => e.status === 'pending').length,
    manual: entries.filter(e => e.status === 'manual').length
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 p-4 bg-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">API Execution Worksheet</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Manual Entry
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="p-2 bg-slate-700 rounded">
            <div className="text-xs text-slate-400">Success</div>
            <div className="text-xl font-bold text-green-400">{statusCounts.success}</div>
          </div>
          <div className="p-2 bg-slate-700 rounded">
            <div className="text-xs text-slate-400">Error</div>
            <div className="text-xl font-bold text-red-400">{statusCounts.error}</div>
          </div>
          <div className="p-2 bg-slate-700 rounded">
            <div className="text-xs text-slate-400">Pending</div>
            <div className="text-xl font-bold text-yellow-400">{statusCounts.pending}</div>
          </div>
          <div className="p-2 bg-slate-700 rounded">
            <div className="text-xs text-slate-400">Manual</div>
            <div className="text-xl font-bold text-blue-400">{statusCounts.manual}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
            <option value="manual">Manual</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>

          <button
            onClick={handleExportAsCSV}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Entries List */}
        <div className="w-1/3 border-r border-slate-700 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No entries found. Run APIs or add manual entries.
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {filteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`w-full text-left p-3 border-l-4 transition-colors ${
                    selectedEntry?.id === entry.id
                      ? 'bg-blue-900/30 border-blue-600'
                      : 'hover:bg-slate-800 border-slate-700'
                  } ${
                    entry.status === 'success'
                      ? 'border-l-green-600'
                      : entry.status === 'error'
                      ? 'border-l-red-600'
                      : entry.status === 'pending'
                      ? 'border-l-yellow-600'
                      : 'border-l-blue-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-sm">{entry.apiName}</div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        entry.status === 'success'
                          ? 'bg-green-900/50 text-green-300'
                          : entry.status === 'error'
                          ? 'bg-red-900/50 text-red-300'
                          : entry.status === 'pending'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {entry.timestamp.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {entry.category}
                    {entry.jobId && ` • Job: ${entry.jobId.slice(0, 8)}...`}
                  </div>
                  {entry.notes && (
                    <div className="text-xs text-slate-400 mt-2 truncate italic">
                      "{entry.notes}"
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entry Details */}
        <div className="w-2/3 overflow-y-auto p-4">
          {selectedEntry ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="pb-4 border-b border-slate-700">
                <h3 className="text-lg font-bold mb-2">{selectedEntry.apiName}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Category:</span>
                    <span className="ml-2 font-medium">{selectedEntry.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>
                    <span
                      className={`ml-2 font-medium ${
                        selectedEntry.status === 'success'
                          ? 'text-green-400'
                          : selectedEntry.status === 'error'
                          ? 'text-red-400'
                          : selectedEntry.status === 'pending'
                          ? 'text-yellow-400'
                          : 'text-blue-400'
                      }`}
                    >
                      {selectedEntry.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="ml-2 font-medium">
                      {selectedEntry.timestamp.toLocaleString()}
                    </span>
                  </div>
                  {selectedEntry.jobId && (
                    <div>
                      <span className="text-slate-400">Job ID:</span>
                      <span className="ml-2 font-mono text-xs">{selectedEntry.jobId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                {editingNotes[selectedEntry.id] !== undefined ? (
                  <div className="flex gap-2">
                    <textarea
                      value={editingNotes[selectedEntry.id]}
                      onChange={(e) =>
                        setEditingNotes(prev => ({
                          ...prev,
                          [selectedEntry.id]: e.target.value
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.shiftKey) {
                          e.preventDefault();
                          handleUpdateNotes(selectedEntry.id, editingNotes[selectedEntry.id]);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                      rows={3}
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          handleUpdateNotes(selectedEntry.id, editingNotes[selectedEntry.id])
                        }
                        className="p-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(prev => {
                            const newEditing = { ...prev };
                            delete newEditing[selectedEntry.id];
                            return newEditing;
                          });
                        }}
                        className="p-2 bg-slate-600 hover:bg-slate-700 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-3 bg-slate-800 rounded min-h-12 flex items-start justify-between group cursor-pointer hover:bg-slate-700/50 transition-colors"
                    onClick={() =>
                      setEditingNotes(prev => ({
                        ...prev,
                        [selectedEntry.id]: selectedEntry.notes
                      }))
                    }
                  >
                    <span className="text-sm text-slate-300 flex-1">
                      {selectedEntry.notes || 'Click to add notes...'}
                    </span>
                    <Edit2 className="w-4 h-4 text-slate-500 group-hover:text-slate-300 ml-2 flex-shrink-0" />
                  </div>
                )}
              </div>

              {/* Input Data */}
              <div>
                <label className="block text-sm font-medium mb-2">Input Parameters</label>
                <div className="p-3 bg-slate-800 rounded text-xs font-mono text-slate-300 max-h-40 overflow-y-auto">
                  {JSON.stringify(selectedEntry.inputData, null, 2)}
                </div>
              </div>

              {/* Result Data */}
              <div>
                <label className="block text-sm font-medium mb-2">API Response</label>
                <div className="p-3 bg-slate-800 rounded text-xs font-mono text-slate-300 max-h-64 overflow-y-auto">
                  {JSON.stringify(selectedEntry.result, null, 2)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    const json = JSON.stringify(selectedEntry, null, 2);
                    navigator.clipboard.writeText(json);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </button>
                <button
                  onClick={() => {
                    const json = JSON.stringify(selectedEntry, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedEntry.apiName}-${selectedEntry.timestamp.getTime()}.json`;
                    a.click();
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => handleDeleteEntry(selectedEntry.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm ml-auto transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Select an entry to view details
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Add Manual Entry</h3>
            <AddEntryForm
              onAdd={handleAddEntry}
              onCancel={() => setShowAddForm(false)}
              apis={apis}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface AddEntryFormProps {
  onAdd: (entry: Omit<APIWorksheetEntry, 'id'>) => void;
  onCancel: () => void;
  apis: any[];
}

function AddEntryForm({ onAdd, onCancel, apis }: AddEntryFormProps) {
  const [apiName, setApiName] = useState(apis[0]?.name || '');
  const [status, setStatus] = useState<'success' | 'error' | 'pending' | 'manual'>('manual');
  const [notes, setNotes] = useState('');
  const [inputData, setInputData] = useState('{}');
  const [resultData, setResultData] = useState('{}');

  const selectedAPI = apis.find(api => api.name === apiName);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">API</label>
        <select
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
        >
          {apis.map(api => (
            <option key={api.name} value={api.name}>{api.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="manual">Manual</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Input Data (JSON)</label>
        <textarea
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder='{"sequence": "...", "query": "..."}'
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-mono focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Result Data (JSON)</label>
        <textarea
          value={resultData}
          onChange={(e) => setResultData(e.target.value)}
          placeholder='{"hits": [...]}'
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-mono focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this API execution..."
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-slate-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            try {
              onAdd({
                timestamp: new Date(),
                apiName,
                category: selectedAPI?.category || 'other',
                status,
                inputData: JSON.parse(inputData || '{}'),
                result: JSON.parse(resultData || '{}'),
                notes
              });
            } catch (err) {
              alert('Invalid JSON in input or result data');
            }
          }}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
        >
          Add Entry
        </button>
      </div>
    </div>
  );
}
