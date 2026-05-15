import React from 'react'
import { AlignmentResult } from '../../types'

interface AlignmentResultsDisplayProps {
  result: AlignmentResult
  onGoToWorksheet: () => void;
  // ADDED: Optional prop to control the visibility of the "Go to Worksheet" button.
  // This is useful for when this component is displayed in a modal from the worksheet itself.
  showWorksheetButton?: boolean;
}

const MetricBox: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-gray-50 p-4 rounded-lg text-center">
    <div className="text-sm text-gray-600">{label}</div>
    <div className="text-2xl font-bold text-indigo-600">{value}</div>
  </div>
)

// Helper function to get legend title based on algorithm
const getLegendTitle = (algorithm?: string): string => {
  const algo = algorithm?.toLowerCase() || ''
  if (algo.includes('clustal')) return 'Clustal Omega Legend'
  if (algo.includes('mafft')) return 'MAFFT Legend'
  if (algo.includes('muscle')) return 'MUSCLE Legend'
  if (algo.includes('t-coffee') || algo.includes('tcoffee')) return 'T-Coffee Legend'
  return 'Alignment Legend'
}

// Helper function to get legend items based on algorithm
const getLegendItems = (algorithm?: string) => {
  const algo = algorithm?.toLowerCase() || ''
  
  // All EBI alignment tools use similar conservation symbols in their standard output
  // The symbols (* : .) represent the same meaning across different engines
  return [
    { symbol: '*', description: 'Identical residues' },
    { symbol: ':', description: 'Conserved substitutions (highly similar properties)' },
    { symbol: '.', description: 'Semi-conserved substitutions (less similar properties)' },
    { symbol: ' ', description: 'Non-similar residues' }
  ]
}

const AlignmentResultsDisplay: React.FC<AlignmentResultsDisplayProps> = ({
  result,
  onGoToWorksheet,
  showWorksheetButton = true, // Default to true for backward compatibility.
}) => {
  if (!result) return null

  /**
   * Handles downloading the alignment result as a text file.
   * This function is now more robust and handles cases where result properties might be missing.
   */
  const handleDownload = () => {
    const identityValue = typeof result.identity === 'number' ? `${result.identity.toFixed(2)}%` : 'N/A';
    const coverageValue = typeof result.coverage === 'number' ? `${result.coverage.toFixed(2)}%` : 'N/A';
    const scoreValue = typeof result.score === 'number' ? result.score.toFixed(2) : 'N/A';

    const alignmentName = result.name || result.queryName || result.subjectName || 'Untitled Alignment';
    const text = `
Alignment Result: ${alignmentName}
Algorithm: ${result.algorithm || 'N/A'}
Identity: ${identityValue}
Coverage: ${coverageValue}
Score: ${scoreValue}

${result.rawAlignment || `Query:   ${result.alignedQuery || ''}\nSubject: ${result.alignedSubject || ''}`}
    `
    const blob = new Blob([text.trim()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${alignmentName.replace(/\s+/g, '_')}_alignment.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Alignment Result: {result.name || result.queryName || result.subjectName || 'Untitled Alignment'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            // COMMENT: This button triggers the robust handleDownload function.
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Download
          </button>
          {/* ADDED: The "Go to Worksheet" button is now conditionally rendered. */}
          {showWorksheetButton && (
            <button
              onClick={onGoToWorksheet}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
            >
              Go to Worksheet
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* CHANGED: Metric boxes now handle potentially missing data gracefully, showing 'N/A'. */}
        <MetricBox label="Identity" value={typeof result.identity === 'number' ? `${result.identity.toFixed(2)}%` : 'N/A'} />
        <MetricBox label="Coverage" value={typeof result.coverage === 'number' ? `${result.coverage.toFixed(2)}%` : 'N/A'} />
        <MetricBox label="Score" value={typeof result.score === 'number' ? result.score.toFixed(2) : 'N/A'} />
        <MetricBox label="Algorithm" value={result.algorithm || 'N/A'} />
      </div>

      {/* REWRITTEN: This section now displays the raw alignment output for an authentic view. */}
      <div className="bg-gray-800 p-4 rounded-lg overflow-x-auto font-mono text-sm text-white">
        <pre>{result.rawAlignment || 'Raw alignment output not available.'}</pre>
      </div>

      {/* UPDATED: Legend now dynamically changes based on the algorithm/engine used */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs">
        <h4 className="font-bold text-gray-700 mb-2">{getLegendTitle(result.algorithm)}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          {getLegendItems(result.algorithm).map((item, idx) => (
            <div key={idx} className="flex items-center">
              <span className="font-mono font-bold mr-2 text-base w-4 text-center">{item.symbol}</span>
              {item.description}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default AlignmentResultsDisplay