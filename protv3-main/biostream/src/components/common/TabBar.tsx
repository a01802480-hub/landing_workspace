import React from 'react'

interface TabBarProps {
  activeTab: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet'
  onTabSwitch: (tab: 'sequence' | 'alignment' | 'worksheet' | 'detail' | 'alignment-view' | 'alignment-worksheet' | 'uniprot-services' | 'api-runner' | 'api-worksheet') => void
  hasActiveAlignment?: boolean
}

/**
 * TabBar component
 * Provides tab switching interface for workspace views
 * Displays tabs for Sequence Viewer, Alignment Engine, Worksheet, UniProt Services, and API Tools
 */
function TabBar({ activeTab, onTabSwitch, hasActiveAlignment }: TabBarProps) {
  const tabs = [
    { id: 'sequence' as const, label: 'Sequence Viewer' },
    { id: 'alignment' as const, label: 'Alignment Engine' },
    { id: 'detail' as const, label: 'Sequence Detail' },
    { id: 'worksheet' as const, label: 'Bio-Data Worksheet' },
    { id: 'uniprot-services' as const, label: 'UniProt Services' },
    { id: 'api-runner' as const, label: 'API Runner' },
    { id: 'api-worksheet' as const, label: 'API Worksheet' },
  ]

  return (
    <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabSwitch(tab.id)}
          className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default TabBar