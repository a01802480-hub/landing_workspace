/**
 * types.ts — shared domain types (what the API returns, what panels consume).
 * Zod-validated runtime shapes live in lib/validation.ts; these interfaces
 * describe the validated payloads at the type level.
 */

/* ── Structure ────────────────────────────────────────────────────────────── */

export interface StructurePoint {
  chain: string;
  resi: number;
  resn: string;
  x: number;
  y: number;
  z: number;
  plddt: number | null;
}

export interface SecondarySpan {
  start: number;
  end: number;
  kind: "helix" | "sheet" | "loop";
}

export interface ActiveSite {
  site_id: string;
  residues: {
    resi: number;
    resname: string;
    chain?: string;
    x?: number | null;
    y?: number | null;
    z?: number | null;
  }[];
}

export interface MetalIon {
  element: string;
  resi?: number;
  chain?: string;
  x: number;
  y: number;
  z: number;
  coordinations?: { resi: number; resname: string; dist: number }[];
}

export interface Coordination {
  /** Index into the model's metals array. */
  metal: number;
  resi: number;
  resname?: string;
  dist: number;
  x: number;
  y: number;
  z: number;
}

export interface StructureModel {
  source: "alphafold" | "rcsb";
  pdb_id?: string | null;
  uniprot?: string | null;
  /** Cα trace (viewer + hover/select sync). */
  points: StructurePoint[];
  /** Full-chain residues when available (sequence track, AlphaFold models). */
  residues_full?: { resi: number; resn: string; plddt: number | null }[];
  secondary?: SecondarySpan[];
  /** Chain ids in payload order (stable color slots). */
  chains?: string[];
  /** The dominant chain id (atom coloring falls back to it). */
  primary_chain?: string | null;
  mean_plddt?: number;
  writhe?: number | null;
  local_writhe?: number[] | null;
  residue_count: number;
  full_residue_count?: number;
  pae_available?: boolean;
  active_sites?: ActiveSite[];
  metals?: MetalIon[];
  coordinations?: Coordination[];
  model_metadata?: {
    entry_id?: string;
    latest_version?: number;
    model_created_date?: string;
  };
}

export interface CatalogEntry {
  id: string;
  pdb: string;
  title: string;
  note: string;
}

/* ── Variants ─────────────────────────────────────────────────────────────── */

export interface VariantSource<T> {
  status: "ok" | "unavailable" | "timeout";
  detail?: string;
  data?: T;
}

export interface VariantImpact {
  uniprot_id: string;
  variant: string;
  plddt: {
    status: string;
    plddt?: number;
    mean_model_plddt?: number;
    detail?: string;
  };
  alphamissense: {
    status: string;
    class?: string;
    mean_pathogenicity?: number;
    detail?: string;
  };
  sift: {
    status: string;
    sift?: { score?: number; prediction?: string };
    polyphen?: { score?: number; prediction?: string };
    detail?: string;
  };
}

/* ── Comparative ──────────────────────────────────────────────────────────── */

export interface InterProDomain {
  accession: string;
  name: string;
  type: string;
  start: number;
  end: number;
}

export interface OrthologInfo {
  available: boolean;
  detail?: string;
  species_label?: string;
  orthology_type?: string;
  protein_id?: string;
  percent_identity?: number;
  sequence?: string;
}
