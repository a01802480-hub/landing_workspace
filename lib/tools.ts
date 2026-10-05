/**
 * tools.ts — the single registry of workspace tools.
 *
 * The hub cards (app/workspace/page.tsx), the TopBar titles (shell/TopBar)
 * and the SideRail navigation (shell/SideRail) all derive from this list —
 * one place to add a tool, three surfaces update.
 */
import {
  Dna,
  GitCompareArrows,
  Orbit,
  Pill,
  Scissors,
  Waypoints,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface WorkspaceTool {
  href: string;
  /** Short label for the side rail / tabs. */
  label: string;
  /** Page title (TopBar + hub card heading). */
  title: string;
  /** TopBar subtitle — one line on what the tool does. */
  note: string;
  /** Hub card description. */
  body: string;
  icon: LucideIcon;
}

export const OVERVIEW_META = {
  title: "Overview",
  note: "Workspace dashboard",
} as const;

export const WORKSPACE_TOOLS: WorkspaceTool[] = [
  {
    href: "/workspace/structure",
    label: "Structure",
    title: "Structure",
    note: "3D viewer · confidence · PAE",
    body: "3Dmol strict cartoon (α-helix ribbons, β-sheet arrows), full-residue sequence track, pLDDT chart and PAE heatmap — all synced.",
    icon: Dna,
  },
  {
    href: "/workspace/dna",
    label: "DNA",
    title: "DNA",
    note: "sequence & plasmid maps · restriction sites",
    body: "Benchling-style dual-stranded sequence viewer and interactive circular plasmid map (pBR322): restriction sites, ORFs, features — synchronized.",
    icon: Orbit,
  },
  {
    href: "/workspace/crispr",
    label: "CRISPR",
    title: "CRISPR design",
    note: "sgRNA · PAM tracks · off-targets · knockout plans",
    body: "CHOPCHOP, CRISPR-GATE and CRISPR-P 2.0 in one workflow: PAM-annotated sequence tracks, ranked guides, off-target tables, and a knockout plan you can push to Nextflow.",
    icon: Scissors,
  },
  {
    href: "/workspace/pipelines",
    label: "Pipelines",
    title: "Pipelines",
    note: "Nextflow runs · logs · workflow steps",
    body: "Trigger and monitor Nextflow computational pipelines: run status, per-step progress, live log tail — every run linked to the design that produced it.",
    icon: Workflow,
  },
  {
    href: "/workspace/flows",
    label: "Flow builder",
    title: "Flow builder",
    note: "node canvas · sequence → tools → pipelines",
    body: "A ProtoFlow-style visual pipeline canvas: connect the workspace sequence to CHOPCHOP, CRISPR-GATE, CRISPR-P 2.0 and Nextflow nodes, then run any node with the current selection.",
    icon: Waypoints,
  },
  {
    href: "/workspace/interactions",
    label: "Interactions",
    title: "Interactions",
    note: "docking · ΔG/Kd · solvent denaturation",
    body: "Empirical protein–drug docking (ΔG, Kd, contact points) and solvent-driven denaturation with a live 3D unfolding view.",
    icon: Pill,
  },
  {
    href: "/workspace/comparative",
    label: "Comparative",
    title: "Comparative",
    note: "Orthologs · domains · alignment",
    body: "LIG1 and PNKP: human vs. blue-whale orthologs, InterPro domain tracks, pairwise alignment, and Clustal Omega multi-sequence alignments.",
    icon: GitCompareArrows,
  },
  {
    href: "/workspace/variants",
    label: "Variants",
    title: "Variants",
    note: "pLDDT · AlphaMissense · SIFT",
    body: "Submit a substitution — get AlphaFold pLDDT, AlphaMissense pathogenicity and SIFT tolerance, each degrading gracefully on its own.",
    icon: Zap,
  },
  // The in-silico lab was retired (2026-10-04): its gel simulation now
  // lives in the DNA workspace's Digest panel, where it verifies the
  // edited construct. The /workspace/lab route stays dormant.
];
