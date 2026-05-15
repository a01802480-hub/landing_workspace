/**
 * Mock data generators for BioStream application
 * Provides sample data for development and demonstration
 */

import { Workspace, Sequence, WorksheetRow } from '../types'

/**
 * Generates mock workspace data for the project browser
 * @returns Array of workspace objects with sample projects
 */
export const getMockWorkspaces = (): Workspace[] => [
  {
    id: '1',
    name: 'Whales and humans',
    owner: 'Santiago Arizpe Dueñas',
    description: 'Comparative genomic analysis',
    sequenceCount: 124,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Whale Genomic Data',
    owner: 'Santiago Arizpe Dueñas',
    description: 'High-depth whale genome sequences',
    sequenceCount: 456,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    name: 'Example Project',
    owner: 'Santiago Arizpe Dueñas',
    description: 'Sample bioinformatics workflow',
    sequenceCount: 89,
    createdAt: new Date('2024-03-10'),
  },
]

/**
 * Generates a mock protein sequence with metadata
 * @returns Sample sequence object for the viewer
 */
export const getMockSequence = (): Sequence => ({
  accession: 'NP_001275992.1',
  name: 'LIG1',
  organism: 'Homo sapiens',
  length: 888,
  description: 'DNA ligase 1 [Homo sapiens]',
  geneId: '3978',
  sequence:
    'MTVAVGVEGPVVVGVQVVVDQDFDVGPWQEEELQVVVWQRTLGLVGEGEQTVGETYGSLRVEEEGGAAYDVLSRGSKTGDGVDTYYTDL' +
    'DGTTVFWVAQYGAGVMAASAASWQVLLTDGHGETQRLTAAVVWQVAGGATANQMVAHPAAEQSGVSVGWYHYQITDGAVYMDRGRVT' +
    'GVQVVITGATAGSVMAVVAQYLPQAHQSQGGAQTQVTAAAQMQAIPVLISWVARGVLVVMQHHTGVQAVVHGNVGAAVQMIRQALAA',
})

/**
 * Generates mock worksheet rows for the data grid
 * @returns Array of worksheet row objects with sample data
 */
export const getMockWorksheetRows = (): WorksheetRow[] => [
  {
    id: '1',
    sequenceName: 'LIG1_Human',
    species: 'Homo sapiens',
    mutationScore: 0.87,
    apiStatus: 'success' as const,
  },
  {
    id: '2',
    sequenceName: 'LIG1_Whale',
    species: 'Balaenoptera musculus',
    mutationScore: 0.92,
    apiStatus: 'success' as const,
  },
  {
    id: '3',
    sequenceName: 'LIG1_Mouse',
    species: 'Mus musculus',
    mutationScore: 0.78,
    apiStatus: 'success' as const,
  },
  {
    id: '4',
    sequenceName: 'DNA_Unknown',
    species: 'Unknown',
    mutationScore: 0.45,
    apiStatus: 'pending' as const,
  },
  {
    id: '5',
    sequenceName: 'REPAIR_Gene',
    species: 'Gallus gallus',
    mutationScore: 0.91,
    apiStatus: 'error' as const,
  },
]
