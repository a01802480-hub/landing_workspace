import React from 'react';
import { BioFile, AlignmentResult } from '../../types';
import { FileText, GitCompare } from 'lucide-react';
import { Workspace } from '../../types';

interface WorksheetTabProps {
  project: Workspace;
  alignmentResult: AlignmentResult | null;
  onAlignmentItemClick: (alignment: AlignmentResult) => void;
  onFileClick?: (file: BioFile) => void;
}

type WorksheetItem = BioFile | AlignmentResult;

/**
 * Renders a single row in the worksheet table, dispatching to different
 * views based on whether the item is a BioFile or an AlignmentResult.
 */
const renderItem = (item: WorksheetItem, onAlignmentItemClick: (alignment: AlignmentResult) => void, onFileClick?: (file: BioFile) => void) => {
  // Check if it's a BioFile (has type property)
  if ('type' in item && ('dna' === item.type || 'protein' === item.type)) {
    const file = item as BioFile;
    return (
      <>
        <td className="px-6 py-3 text-sm text-gray-900 flex items-center gap-2">
          <FileText size={16} className="text-blue-500" />
          {file.name}
        </td>
        <td className="px-6 py-3 text-sm text-gray-600 capitalize">{file.type}</td>
        <td className="px-6 py-3 text-sm text-gray-600">Uploaded file</td>
        <td className="px-6 py-3 text-sm text-gray-600">{file.sequence.length} chars</td>
        <td className="px-6 py-3 text-sm text-gray-600">
          {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : 'N/A'}
        </td>
      </>
    );
  }

  // Check if it's an alignment (has identity property)
  if ('identity' in item) {
    const aln = item as AlignmentResult;
    return (
      <>
        <td className="px-6 py-3 text-sm text-gray-900 flex items-center gap-2">
          <GitCompare size={16} className="text-green-500" />
          {aln.name || aln.queryName || aln.subjectName || 'Untitled Alignment'}
        </td>
        <td className="px-6 py-3 text-sm text-gray-600">Alignment</td>
        <td className="px-6 py-3 text-sm text-gray-600">
          {aln.queryName} vs {aln.subjectName}
        </td>
        <td className="px-6 py-3 text-sm text-gray-600">
          {aln.identity ? `${aln.identity.toFixed(1)}% identity` : 'N/A'}
        </td>
        <td className="px-6 py-3 text-sm text-gray-600">
          {aln.createdAt ? new Date(aln.createdAt).toLocaleDateString() : 'N/A'}
        </td>
      </>
    );
  }

  return null;
};

/**
 * WorksheetTab component. Displays a log of all sequences and analyses.
 * This version is compatible with the App.tsx state management, receiving
 * the project prop and displaying all files and alignment results.
 */
const WorksheetTab: React.FC<WorksheetTabProps> = ({ project, alignmentResult, onAlignmentItemClick, onFileClick }) => {
  // Build items list from workspace files and alignment results
  const items: WorksheetItem[] = [
    ...(project.files || []),
    ...(alignmentResult ? [alignmentResult] : []),
  ];

  console.log('📊 WorksheetTab rendering:', {
    projectFilesCount: project.files?.length || 0,
    hasAlignmentResult: !!alignmentResult,
    alignmentResultName: alignmentResult?.name || 'N/A',
    alignmentQueryName: alignmentResult?.queryName || 'N/A',
    alignmentSubjectName: alignmentResult?.subjectName || 'N/A',
    totalItems: items.length,
    itemsBreakdown: {
      files: project.files?.length || 0,
      alignments: alignmentResult ? 1 : 0,
    }
  });

  if (alignmentResult) {
    console.log('✅ ALIGNMENT RESULT DETAILS:', {
      id: alignmentResult.id,
      name: alignmentResult.name,
      queryName: alignmentResult.queryName,
      subjectName: alignmentResult.subjectName,
      identity: alignmentResult.identity,
      hasAlignedQuery: !!alignmentResult.alignedQuery,
      hasAlignedSubject: !!alignmentResult.alignedSubject,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <h2 className="text-lg font-semibold">Bio-Data Worksheet</h2>
        <p className="text-sm text-gray-600">A central log of all your sequences and analyses. Click an item to view details.</p>
      </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Details</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Metrics</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created At</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => {
                  const isAlignment = 'identity' in item;
                  return (
                    <tr
                      key={'id' in item ? item.id : idx}
                      className={`border-b border-gray-200 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
                      onClick={() => {
                        if (isAlignment) {
                          onAlignmentItemClick(item as AlignmentResult);
                        } else if (onFileClick) {
                          onFileClick(item as BioFile);
                        }
                      }}
                    >
                      {renderItem(item, onAlignmentItemClick, onFileClick)}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    No items in the worksheet yet. Run an alignment or upload a sequence.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
};

export default WorksheetTab;