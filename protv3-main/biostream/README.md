# BioStream - React Bioinformatics Sequence Analysis Tool

**BioStream** is a professional-grade, React-based web application for biological sequence management and analysis. It mirrors high-end laboratory sequence analysis software with a dual-sidebar layout, tabbed workspace, and comprehensive bioinformatics tools.

## Features

- **Sequence Viewer Tab**: Visualize and explore DNA/Protein sequences with detailed metadata
- **Alignment Engine Tab**: Compare sequences using multiple algorithms (ClustalW, MUSCLE) with configurable parameters
- **Bio-Data Worksheet Tab**: Excel-style data grid for managing and analyzing sequence datasets with mock API integration
- **Project Browser**: Organize work across multiple projects and workspaces
- **Settings Sidebar**: Contextual tools and properties panel
- **Plus Menu**: Quick access to create new folders, upload sequences, and start analyses

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

```bash
# 1. Navigate to the project directory
cd c:\Users\Santiago Arizpe\protv3

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev

# 4. Open your browser
# Application will be available at http://localhost:3000
```

### Building for Production

```bash
# Build the optimized production bundle
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
biostream/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── LeftNavSidebar.tsx       # Main navigation sidebar
│   │   │   ├── LeftProjectBrowser.tsx   # Project/workspace browser
│   │   │   ├── RightSettingsSidebar.tsx # Settings and tools panel
│   │   │   └── MainWorkspace.tsx        # Central workspace container
│   │   ├── tabs/
│   │   │   ├── SequenceViewerTab.tsx    # Sequence visualization view
│   │   │   ├── AlignmentEngineTab.tsx   # Sequence alignment tools
│   │   │   └── WorksheetTab.tsx         # Data grid and analysis
│   │   └── common/
│   │       ├── TabBar.tsx               # Tab switching component
│   │       └── PlusMenu.tsx             # Dropdown menu component
│   ├── hooks/
│   │   └── useWorkspaceState.ts         # Custom hook for workspace state
│   ├── types/
│   │   └── index.ts                     # TypeScript type definitions
│   ├── utils/
│   │   ├── mockData.ts                  # Mock data generators
│   │   └── alignmentEngine.ts           # Alignment algorithm simulations
│   ├── App.tsx                          # Main App component
│   ├── main.tsx                         # React entry point
│   └── index.css                        # Global styles
├── index.html                           # HTML template
├── package.json                         # Dependencies and scripts
├── tailwind.config.js                   # Tailwind CSS configuration
├── tsconfig.json                        # TypeScript configuration
├── vite.config.ts                       # Vite configuration
└── README.md                            # Project documentation
```

## Usage Guide

### Navigating Workspaces

1. **Left Sidebar Navigation**
   - Click the Dashboard icon to view all workspaces
   - Click the Projects icon to filter by projects
   - Use the Search icon to find specific sequences
   - Click the Plus (+) button for quick actions

2. **Creating New Items**
   - Click the Plus (+) button in the left navigation
   - Choose from:
     - **New Folder**: Create a project folder
     - **Upload Sequence**: Import .faa or .gbk files
     - **New Analysis**: Start a new analysis project

3. **Project Browser**
   - View active workspaces in the left project panel
   - Available projects:
     - Whales and humans
     - Whale Genomic Data
     - Example Project
   - All projects owned by: Santiago Arizpe Dueñas

### Using the Sequence Viewer Tab

1. **Header Information**
   - Displays sequence accession number and organism info
   - Shows gene ID and associated metadata
   - Example: `NP_001275992.1 LIG1 [organism=Homo sapiens] [GeneID=3978]`

2. **Canvas Area**
   - Main visualization area for sequence data
   - Supports zooming and navigation (future enhancement)
   - Right-click for context menu options

3. **Metadata Footer**
   - Shows sequence length (e.g., "888 aa")
   - Displays full protein description
   - Provides quick reference information

### Using the Alignment Engine Tab

1. **Settings Pane (Left)**
   - **Algorithm**: Choose between ClustalW or MUSCLE
   - **Gap Open Penalty**: Adjust gap opening cost (numeric input)
   - **Substitution Matrix**: Select BLOSUM62 or PAM250

2. **Running Alignment**
   - Click "Run Alignment" to execute comparison
   - Compares sequences using selected algorithm
   - Displays mock alignment visualization
   - Results include identity percentage and coverage metrics

3. **Alignment Visualization**
   - Shows aligned sequences side-by-side
   - Highlights matches (identical residues)
   - Indicates gaps and mismatches
   - Provides alignment score and statistics

### Using the Worksheet Tab

1. **Data Grid**
   - Column headers: ID, Sequence Name, Species, Mutation Score, API Status
   - Sortable columns (click header to sort)
   - Supports pagination and filtering

2. **Fetching External Data**
   - Click "Fetch External Data" button
   - Simulates querying NCBI, UniProt, or similar services
   - Populates grid with mock sequence data
   - Updates API Status column with fetch results

3. **Data Management**
   - View and edit sequence metadata
   - Track mutation scores across experiments
   - Monitor external API connectivity status
   - Export data as CSV (future enhancement)

## Architecture & Technical Details

### State Management

The application uses React Hooks for state management:

```typescript
// Tab switching
const [activeTab, setActiveTab] = useState<'sequence' | 'alignment' | 'worksheet'>('sequence');

// Sidebar visibility
const [showSettings, setShowSettings] = useState(true);

// Dropdown menus
const [showPlusMenu, setShowPlusMenu] = useState(false);
```

### Component Hierarchy

```
App (main container)
├── LeftNavSidebar (navigation and menu)
│   └── PlusMenu (dropdown)
├── LeftProjectBrowser (workspace list)
├── MainWorkspace (central area with tabs)
│   ├── TabBar (tab selector)
│   ├── SequenceViewerTab (tab 1)
│   ├── AlignmentEngineTab (tab 2)
│   └── WorksheetTab (tab 3)
└── RightSettingsSidebar (tools panel, collapsible)
```

### Styling

- **Framework**: Tailwind CSS v3
- **Color Scheme**:
  - Dark Purple Gradient: `#1a0f2e` (navigation)
  - Indigo Accent: `#6366f1` (actions)
  - Light Grey: `#f3f4f6` (settings panel)
  - White: `#ffffff` (primary background)

### Mock Data & APIs

All external API calls are simulated:

```typescript
// Mock NCBI sequence fetch
mockFetchNCBISequence(accession: string): Sequence { ... }

// Mock UniProt data
mockFetchUniProtData(): UniProtEntry[] { ... }

// Mock alignment result
mockRunAlignment(seq1: string, seq2: string): AlignmentResult { ... }
```

## Component Documentation

### LeftNavSidebar
Slim, dark-themed navigation sidebar with:
- Top-aligned icons (Dashboard, Projects, Search)
- Plus button with dropdown menu
- Bottom user profile avatar
- Supports theme customization

### LeftProjectBrowser
Secondary panel displaying:
- Active workspaces/projects
- Project ownership information
- Expandable project trees
- Click to select active project

### RightSettingsSidebar
Contextual tools panel with:
- Blue icon toolbar (Selection, Line, Path, Brush, Text)
- Retractable functionality to maximize workspace
- Properties display for selected items
- Quick action buttons

### MainWorkspace
Central container featuring:
- Tab system for switching views
- Responsive layout that adapts to sidebar visibility
- Maintains tab state during navigation
- Supports full-screen mode

### SequenceViewerTab
Sequence visualization with:
- Breadcrumb header with metadata
- Large canvas area for sequence display
- Zoom and navigation controls (future)
- Footer with length and description

### AlignmentEngineTab
Alignment comparison tool with:
- Settings sidebar (algorithm, penalties, matrix)
- Run button to execute alignment
- Visual alignment display
- Score and identity metrics

### WorksheetTab
Data management grid with:
- TanStack Table integration
- Sortable columns
- Pagination support
- External data fetching button
- Mock API simulation

## Development

### Code Style

- **TypeScript**: Full type safety enabled
- **Comments**: JSDoc-style comments on all functions
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: 2-space indentation

### Example Function Comment

```typescript
/**
 * Simulates running a sequence alignment algorithm on two sequences
 * @param seq1 - First sequence string to align
 * @param seq2 - Second sequence string to align
 * @param algorithm - Alignment algorithm (ClustalW or MUSCLE)
 * @returns Mock alignment result with identity score and alignment string
 */
function mockRunAlignment(seq1: string, seq2: string, algorithm: string): AlignmentResult {
  // Implementation...
}
```

### Adding New Features

1. Create component in appropriate `src/components/` subdirectory
2. Add TypeScript interfaces to `src/types/index.ts`
3. Add unit tests in `__tests__` folder
4. Update README.md with usage documentation
5. Ensure JSDoc comments on all exported functions

## Testing

Currently supports manual testing. To add automated tests:

```bash
# (Future) Run tests
npm run test

# (Future) Run tests with coverage
npm run test:coverage
```

## Performance Considerations

- Uses React 18 with automatic batching
- Tailwind CSS for optimized styling
- TanStack Table for efficient grid rendering
- Virtual scrolling for large datasets (future enhancement)
- Code splitting via Vite

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires ES2020 support

## Known Limitations

- Sequence visualization is a canvas placeholder (future: integrate DNA viewer library)
- Alignment visualization is a mock output (future: integrate alignment viewer)
- Data grid uses mock data (future: connect to real APIs)
- No persistence layer (future: add Firebase/Supabase backend)

## Future Enhancements

- Real NCBI/UniProt API integration
- FASTA file parsing and validation
- Multi-sequence alignment visualization
- 3D protein structure viewer
- User authentication and project sharing
- Sequence search with similarity metrics
- Custom algorithm parameters
- Export alignments as PDF/PNG
- Dark mode toggle
- Keyboard shortcuts

## Troubleshooting

### Application won't start
```bash
# Clear node_modules and reinstall
rm -r node_modules
npm install
npm run dev
```

### Styles not loading
```bash
# Rebuild Tailwind CSS
npm run build

# If issue persists, check tailwind.config.js content paths
```

### Components not rendering
- Check TypeScript errors: `npm run type-check`
- Verify React and React-DOM versions match
- Check console for import errors

## Contributing

1. Create a feature branch
2. Follow existing code style and JSDoc patterns
3. Test changes manually in browser
4. Update README if adding new features
5. Submit pull request with clear description

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions, please refer to the GitHub issues page.

## Credits

Developed by Santiago Arizpe Dueñas
Built with React, TypeScript, and Tailwind CSS
Icons provided by Lucide React
Data grid powered by TanStack Table
