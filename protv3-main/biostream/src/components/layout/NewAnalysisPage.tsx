import { useState } from 'react'
import { BioFile } from '../../types'
import { processFastaFile } from '../../utils/fastaParser'
import { ArrowLeft, Upload, FileText, X } from 'lucide-react'

interface NewAnalysisPageProps {
  onBack: () => void
  onSequencesReady: (sequences: BioFile[], workspaceId?: string) => void
}

export default function NewAnalysisPage({ onBack, onSequencesReady }: NewAnalysisPageProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste')
  const [fastaText, setFastaText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle pasted FASTA text
  const handlePasteSubmit = () => {
    if (!fastaText.trim()) {
      setError('Please paste your FASTA sequence(s)')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Process the pasted FASTA text
      const sequences = processFastaFile('pasted_sequences', fastaText, 'temp')
      
      if (sequences.length === 0) {
        setError('No valid sequences found. Please check your FASTA format.')
        setIsProcessing(false)
        return
      }

      console.log(`Parsed ${sequences.length} sequences from pasted text`)
      onSequencesReady(sequences)
    } catch (err) {
      setError('Error processing sequences: ' + (err as Error).message)
      setIsProcessing(false)
    }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setUploadedFiles(Array.from(files))
      setError(null)
    }
  }

  // Remove uploaded file
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Process uploaded files
  const handleUploadSubmit = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one file')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const allSequences: BioFile[] = []

      for (const file of uploadedFiles) {
        const content = await readFileAsText(file)
        const sequences = processFastaFile(file.name, content, 'temp')
        allSequences.push(...sequences)
      }

      if (allSequences.length === 0) {
        setError('No valid sequences found in uploaded files.')
        setIsProcessing(false)
        return
      }

      console.log(`Parsed ${allSequences.length} sequences from ${uploadedFiles.length} files`)
      onSequencesReady(allSequences)
    } catch (err) {
      setError('Error processing files: ' + (err as Error).message)
      setIsProcessing(false)
    }
  }

  // Helper to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result?.toString() || '')
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-4xl mx-auto flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Analysis</h1>
            <p className="text-sm text-gray-500">Import your sequences to begin</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Tab Selection */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all ${
              activeTab === 'paste'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <FileText className="w-6 h-6 mx-auto mb-2" />
            <div className="font-semibold">Paste FASTA</div>
            <div className="text-xs mt-1 opacity-70">Paste sequences directly</div>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all ${
              activeTab === 'upload'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Upload className="w-6 h-6 mx-auto mb-2" />
            <div className="font-semibold">Upload Files</div>
            <div className="text-xs mt-1 opacity-70">Upload .fasta, .txt, or other files</div>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Paste FASTA Tab */}
        {activeTab === 'paste' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Paste your FASTA sequence(s) below
            </label>
            <textarea
              value={fastaText}
              onChange={(e) => setFastaText(e.target.value)}
              placeholder={'>sequence1\nMKTIIALSYIFCLVFAD...\n\n>sequence2\nMKWVTFISLLFLFSSAYS...'}
              className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm resize-none"
              spellCheck={false}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handlePasteSubmit}
                disabled={isProcessing}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isProcessing ? 'Processing...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* Upload Files Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                multiple
                accept=".fasta,.fa,.txt,.seq,.fas"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-700 mb-2">
                  Click to upload or drag and drop
                </div>
                <div className="text-sm text-gray-500">
                  FASTA, TXT, SEQ, or any text-based sequence files
                </div>
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Uploaded Files ({uploadedFiles.length})
                </h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-400">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleUploadSubmit}
                disabled={isProcessing || uploadedFiles.length === 0}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isProcessing ? 'Processing...' : `Continue with ${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">FASTA Format Example:</h4>
          <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap">
{`>sequence_name_1
MKTIIALSYIFCLVFADYKDDDDK

>sequence_name_2
MKWVTFISLLFLFSSAYSRGVFRRDAHKSEVAHRFKDLGEENFKALVLIAFAQYLQQCPFEDHVKLVNEVTEFAKTCVADESAENCDKSLHTLFGDKLCTVATLRETYGEMADCCAKQEPERNECFLQHKDDNPNLPKYRGPVFECCKAADDKETCFAEEGKKLVAASQAALGL`}
          </pre>
        </div>
      </div>
    </div>
  )
}