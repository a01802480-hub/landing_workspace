import { useState } from 'react';
import { Play, Activity, Dna, Settings } from 'lucide-react';
import { simulateAlignment } from '../../utils/alignmentEngine';
import { AlignmentSettings, AlignmentResult, Workspace, BioFile } from '../../types';
import AlignmentResultsDisplay from './AlignmentResultsDisplay';

// Define available alignment engines
const ALIGNMENT_ENGINES: Array<{ value: AlignmentSettings['algorithm']; label: string; description: string }> = [
  { value: 'ClustalW', label: 'Clustal Omega', description: 'Fast multiple sequence alignment' },
  { value: 'TCoffee', label: 'T-Coffee', description: 'Accurate combined alignment' },
  { value: 'MAFFT', label: 'MAFFT', description: 'Very fast for large datasets' },
  { value: 'MUSCLE', label: 'MUSCLE', description: 'Balanced speed and accuracy' },
  { value: 'Jalview', label: 'Jalview', description: 'Visualize and edit alignments' },
];

interface AlignmentEngineTabProps {
  activeProject: Workspace;
  comparisonFiles: BioFile[] | null;
  onAlignmentComplete: (result: AlignmentResult | null) => void;
  onTabSwitch: (tab: 'sequence' | 'alignment' | 'worksheet' | 'alignment-worksheet' | 'api-explorer') => void;
}

interface SequenceInput {
  id: string;
  name: string;
  sequence: string;
}

/**
 * Alignment Engine Tab with Engine Selection
 * Allows users to select alignment engine, input sequences, configure parameters, and run analysis.
 */
function AlignmentEngineTab({ activeProject, comparisonFiles, onAlignmentComplete, onTabSwitch }: AlignmentEngineTabProps) {
  if (!activeProject) {
    return <div className="flex items-center justify-center h-full text-slate-400">Loading project...</div>
  }

  const projectFiles = activeProject.files ?? []
  const [alignmentMode, setAlignmentMode] = useState<'folder' | 'selected'>('folder');
  const [inputA, setInputA] = useState<SequenceInput>({ id: '', name: 'Sequence A', sequence: '' });
  const [inputB, setInputB] = useState<SequenceInput>({ id: '', name: 'Sequence B', sequence: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AlignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // State for settings with engine selection
  const [settings, setSettings] = useState<AlignmentSettings & { engine?: string }>({
    algorithm: 'ClustalW',
    engine: 'clustalo',  // Backend expects lowercase engine names
    gapOpenPenalty: 12,
    substitutionMatrix: 'BLOSUM62',
    runUniprot: false,
    runSift: false
  });

  const handleRunAnalysis = async () => {
    if (!inputA.sequence || !inputB.sequence) {
      setError("Please provide both sequences for comparison.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    console.log(`Starting alignment analysis with ${settings.algorithm}...`);

    try {
      // Call the alignment engine with the sequence content and options.
      const partialResult = await simulateAlignment(
        inputA.sequence, 
        inputB.sequence, 
        settings
      )
      
      if (partialResult) {
        const fullResult: AlignmentResult = {
          ...partialResult,
          id: `aln-${Date.now()}`,
          name: `alignment of sequences ${inputA.name} and ${inputB.name} (${settings.algorithm})`,
          queryName: inputA.name,
          subjectName: inputB.name,
          createdAt: new Date(),
          algorithm: settings.algorithm as any
        };
        console.log('Alignment completed:', fullResult);
        setResults(fullResult);
        console.log('Results displayed locally.');
      } else {
        setError("Alignment failed: The alignment service returned no data.");
        setResults(null);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Alignment failed:', errorMsg);
      setError(`Alignment failed: ${errorMsg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight">
            Comparative Analysis: {activeProject.name}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Engine: {settings.algorithm}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Matrix: {settings.substitutionMatrix}</span>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* ALIGNMENT ENGINE SELECTOR */}
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Select Alignment Engine</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {ALIGNMENT_ENGINES.map((engine) => (
              <button
                key={engine.value}
                onClick={() => {
                  // Map frontend algorithm names to backend engine names
                  const engineMap: Record<string, 'clustalo' | 'tcoffee' | 'mafft' | 'muscle' | 'jalview'> = {
                    'ClustalW': 'clustalo',
                    'TCoffee': 'tcoffee',
                    'MAFFT': 'mafft',
                    'MUSCLE': 'muscle',
                    'Jalview': 'jalview'
                  };
                  setSettings({ 
                    ...settings, 
                    algorithm: engine.value,
                    engine: engineMap[engine.value] || 'clustalo'
                  });
                }}
                className={`p-3 rounded-xl text-left transition-all border-2 ${
                  settings.algorithm === engine.value
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <div className={`font-bold text-xs ${settings.algorithm === engine.value ? 'text-white' : 'text-slate-700'}`}>
                  {engine.label}
                </div>
                <div className={`text-[9px] mt-1 line-clamp-2 ${
                  settings.algorithm === engine.value ? 'text-indigo-100' : 'text-slate-500'
                }`}>
                  {engine.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* INPUT MODE SELECTOR */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAlignmentMode('folder')
                setInputA({ id: '', name: 'Sequence A', sequence: '' });
                setInputB({ id: '', name: 'Sequence B', sequence: '' });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${alignmentMode === 'folder' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              1) Select from Folder
            </button>
            <button
              onClick={() => {
                setAlignmentMode('selected')
                setInputA({ id: '', name: 'Sequence A', sequence: '' });
                setInputB({ id: '', name: 'Sequence B', sequence: '' });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${alignmentMode === 'selected' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              2) Use Sidebar Selected Pair
            </button>
          </div>

          {alignmentMode === 'folder' ? (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">File A</p>
                <select
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  value={inputA.id}
                  onChange={(e) => {
                    const id = e.target.value
                    const file = projectFiles.find((f) => f.id === id)
                    if (file) {
                      console.log('File A selected:', file.name, 'Sequence length:', file.sequence.length)
                      setInputA({ id: file.id, name: file.name, sequence: file.sequence });
                    }
                  }}
                >
                  <option value="">Choose file...</option>
                  {projectFiles.map((file) => (
                    <option key={file.id} value={file.id}>{file.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">File B</p>
                <select
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  value={inputB.id}
                  onChange={(e) => {
                    const id = e.target.value
                    const file = projectFiles.find((f) => f.id === id)
                    if (file) {
                      console.log('File B selected:', file.name, 'Sequence length:', file.sequence.length)
                      setInputB({ id: file.id, name: file.name, sequence: file.sequence });
                    }
                  }}
                >
                  <option value="">Choose file...</option>
                  {projectFiles.map((file) => (
                    <option key={file.id} value={file.id}>{file.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              {comparisonFiles && comparisonFiles.length === 2 ? (
                <>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Selected from right sidebar</p>
                  <button
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs"
                    onClick={() => {
                      console.log('Using sidebar pair:', comparisonFiles[0].name, 'and', comparisonFiles[1].name)
                      setInputA({ id: comparisonFiles[0].id, name: comparisonFiles[0].name, sequence: comparisonFiles[0].sequence });
                      setInputB({ id: comparisonFiles[1].id, name: comparisonFiles[1].name, sequence: comparisonFiles[1].sequence });
                    }}
                  >
                    Use selected pair
                  </button>
                  <div className="text-[10px] mt-2 text-slate-500">
                    File A: {comparisonFiles[0].name} | File B: {comparisonFiles[1].name}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">No pair selected. Please select two files from right sidebar first.</p>
              )}
            </div>
          )}
        </div>

        {/* INPUT SECTION */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Dna size={12} /> Target Sequence (e.g., Human)
            </label>
            <textarea
              value={inputA.sequence}
              onChange={(e) => {
                const newName = inputA.id ? 'Custom Sequence A' : inputA.name;
                setInputA({ id: '', name: newName, sequence: e.target.value });
              }}
              placeholder="Paste FASTA or raw sequence string here..."
              className="w-full h-48 p-4 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Dna size={12} /> Subject Sequence (e.g., Whale)
            </label>
            <textarea
              value={inputB.sequence}
              onChange={(e) => {
                const newName = inputB.id ? 'Custom Sequence B' : inputB.name;
                setInputB({ id: '', name: newName, sequence: e.target.value });
              }}
              placeholder="Paste FASTA or raw sequence string here..."
              className="w-full h-48 p-4 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all resize-none"
            />
          </div>
        </div>

        {/* SETTINGS BAR & RUN BUTTON - Configure algorithm parameters and execute alignment */}
        <div className="flex items-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
           {/* SETTING: Gap Penalty configuration for alignment algorithm */}
           <div className="flex-1 grid grid-cols-1 gap-4">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-indigo-400 uppercase mb-1">Gap Penalty</span>
                {/* INPUT: Adjust gap penalty value - affects alignment scoring */}
                <input 
                  type="number" 
                  value={settings.gapOpenPenalty}
                  onChange={(e) => setSettings({...settings, gapOpenPenalty: parseInt(e.target.value)})}
                  className="bg-white border border-indigo-100 rounded-lg px-2 py-1 text-sm font-bold text-indigo-900"
                />
              </div>
           </div>
           
           {/* BUTTON: Run Alignment - executes the alignment with current sequences and settings */}
           <button 
             onClick={handleRunAnalysis}
             disabled={isAnalyzing}
             className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50 transition-all"
           >
             {/* ICON: Shows loading spinner during alignment, play icon when ready */}
             {isAnalyzing ? <Activity className="animate-spin" size={18} /> : <Play size={18} />}
             {isAnalyzing ? "Processing..." : `Run ${settings.algorithm}`}
           </button>
        </div>

        {/* RESULTS SECTION */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-lg text-red-600 font-bold">Error</span>
              <div>
                <div className="font-bold text-red-700 text-sm">Alignment Error</div>
                <div className="text-red-600 text-xs mt-1">{error}</div>
                <div className="text-[10px] text-red-500 mt-2">
                  <strong>Troubleshooting:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    <li>Make sure the backend is running: <code>python main.py</code></li>
                    <li>Check that sequences are valid (protein: ACDEFGHIKLMNPQRSTVWY-, DNA: ATGC-)</li>
                    <li>Ensure both sequences have at least 1 character</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {results ? (
          <div className="border-t border-slate-200 pt-6">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Alignment Results ({settings.algorithm})</h3>
              <p className="text-[10px] text-slate-500 mt-1">Your sequences have been successfully aligned</p>
            </div>
            <AlignmentResultsDisplay
              result={results}
              onGoToWorksheet={() => {
                if (results) {
                  console.log('Saving alignment result to state:', results.name);
                  onAlignmentComplete(results);
                  
                  if (onTabSwitch) {
                    console.log('Switching to worksheet tab...');
                    onTabSwitch('worksheet');
                  } else {
                    console.error('onTabSwitch is not defined!');
                  }
                }
              }} />
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 border-t border-slate-100 mt-6">
            <div className="text-4xl mb-2 text-slate-300 font-mono">DNA</div>
            <p className="text-sm font-medium">No alignment results yet</p>
            <p className="text-xs mt-1">Select an engine, choose sequences, then click "Run {settings.algorithm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AlignmentEngineTab;