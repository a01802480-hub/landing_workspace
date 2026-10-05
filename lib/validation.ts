/**
 * validation.ts — Zod schemas for every API payload the workspace consumes.
 *
 * "Every payload crosses a Zod schema before render": a malformed response
 * becomes a designed fallback, never an undefined access inside a panel.
 * Unknown keys are stripped (zod default) — known keys are enforced.
 */
import { z } from "zod";

/* ── Health / catalog ─────────────────────────────────────────────────────── */

export const HealthSchema = z.object({
  status: z.string(),
  services: z.record(z.string(), z.boolean()),
});
export type HealthValidated = z.infer<typeof HealthSchema>;

export const CatalogEntrySchema = z.object({
  id: z.string(),
  pdb: z.string(),
  title: z.string(),
  note: z.string(),
});

export const CatalogSchema = z.object({
  entries: z.array(CatalogEntrySchema),
});
export type CatalogValidated = z.infer<typeof CatalogSchema>;

/* ── Structure ────────────────────────────────────────────────────────────── */

const StructurePointSchema = z.object({
  chain: z.string(),
  resi: z.number(),
  resn: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  plddt: z.number().nullable(),
});

export const StructureModelSchema = z.object({
  source: z.enum(["alphafold", "rcsb"]),
  pdb_id: z.string().nullable().optional(),
  uniprot: z.string().nullable().optional(),
  points: z.array(StructurePointSchema),
  residues_full: z
    .array(z.object({ resi: z.number(), resn: z.string(), plddt: z.number().nullable() }))
    .optional(),
  secondary: z
    .array(z.object({ start: z.number(), end: z.number(), kind: z.enum(["helix", "sheet", "loop"]) }))
    .optional(),
  chains: z.array(z.string()).optional(),
  primary_chain: z.string().nullable().optional(),
  mean_plddt: z.number().optional(),
  writhe: z.number().nullable().optional(),
  local_writhe: z.array(z.number()).nullable().optional(),
  residue_count: z.number(),
  full_residue_count: z.number().optional(),
  pae_available: z.boolean().optional(),
  active_sites: z
    .array(
      z.object({
        site_id: z.string(),
        residues: z.array(
          z.object({
            resi: z.number(),
            resname: z.string(),
            chain: z.string().optional(),
            x: z.number().nullable().optional(),
            y: z.number().nullable().optional(),
            z: z.number().nullable().optional(),
          }),
        ),
      }),
    )
    .optional(),
  metals: z
    .array(
      z.object({
        element: z.string(),
        resi: z.number().optional(),
        chain: z.string().optional(),
        x: z.number(),
        y: z.number(),
        z: z.number(),
        coordinations: z.array(z.object({ resi: z.number(), resname: z.string(), dist: z.number() })).optional(),
      }),
    )
    .optional(),
  coordinations: z
    .array(
      z.object({
        metal: z.number(),
        resi: z.number(),
        resname: z.string().optional(),
        dist: z.number(),
        x: z.number(),
        y: z.number(),
        z: z.number(),
      }),
    )
    .optional(),
  model_metadata: z
    .object({
      entry_id: z.string().optional(),
      latest_version: z.number().optional(),
      model_created_date: z.string().optional(),
    })
    .optional(),
});
export type StructureModelValidated = z.infer<typeof StructureModelSchema>;

export const ConfidenceDataSchema = z.object({
  uniprot: z.string(),
  pae: z.array(z.array(z.number())),
  max_pae: z.number(),
  residue_index: z.array(z.number()),
  plddt: z.array(z.number().nullable()).optional(),
  stride: z.number().int().optional(),
  mean_pae: z.number(),
});
export type ConfidenceData = z.infer<typeof ConfidenceDataSchema>;

/* ── DNA ──────────────────────────────────────────────────────────────────── */

const DnaFeatureSchema = z.object({
  type: z.string(),
  label: z.string().optional(),
  product: z.string().optional(),
  start: z.number(),
  end: z.number(),
  strand: z.number(),
});

const DnaSiteSchema = z.object({
  enzyme: z.string(),
  start: z.number(),
  cut: z.number(),
  motif: z.string(),
});

export const DnaRegistrySchema = z.object({
  accession: z.string(),
  name: z.string(),
  length: z.number(),
  topology: z.string(),
  sequence: z.string(),
  features: z.array(DnaFeatureSchema),
  sites: z.array(DnaSiteSchema),
});
export type DnaRegistry = z.infer<typeof DnaRegistrySchema>;

export const DnaEnzymesSchema = z.object({
  enzymes: z.array(z.object({ name: z.string(), motif: z.string(), cut: z.number() })),
});
export type DnaEnzymesValidated = z.infer<typeof DnaEnzymesSchema>;

/* ── Alignment / comparative ──────────────────────────────────────────────── */

export const AlignmentResultSchema = z.object({
  identity_pct: z.number(),
  matches: z.number(),
  mismatches: z.number(),
  aligned_a: z.string(),
  aligned_b: z.string(),
});
export type AlignmentResultValidated = z.infer<typeof AlignmentResultSchema>;

export const InterProDomainSchema = z.object({
  accession: z.string(),
  name: z.string(),
  type: z.string(),
  start: z.number(),
  end: z.number(),
});

const OrthologInfoSchema = z.object({
  available: z.boolean(),
  detail: z.string().optional(),
  species_label: z.string().optional(),
  orthology_type: z.string().optional(),
  protein_id: z.string().optional(),
  percent_identity: z.number().optional(),
  sequence: z.string().optional(),
});

export const GeneDashboardSchema = z.object({
  gene: z.string(),
  human: z.object({
    name: z.string().optional(),
    accession: z.string(),
    length: z.number(),
    sequence: z.string().optional(),
  }),
  ortholog: OrthologInfoSchema,
  domains: z.array(InterProDomainSchema),
});
export type GeneDashboardValidated = z.infer<typeof GeneDashboardSchema>;

/* ── Variants ─────────────────────────────────────────────────────────────── */

export const VariantImpactSchema = z.object({
  uniprot_id: z.string(),
  variant: z.string(),
  plddt: z.object({
    status: z.string(),
    plddt: z.number().optional(),
    mean_model_plddt: z.number().optional(),
    detail: z.string().optional(),
  }),
  alphamissense: z.object({
    status: z.string(),
    class: z.string().optional(),
    mean_pathogenicity: z.number().optional(),
    detail: z.string().optional(),
  }),
  sift: z.object({
    status: z.string(),
    sift: z.object({ score: z.number().optional(), prediction: z.string().optional() }).optional(),
    polyphen: z.object({ score: z.number().optional(), prediction: z.string().optional() }).optional(),
    detail: z.string().optional(),
  }),
});
export type VariantImpactValidated = z.infer<typeof VariantImpactSchema>;

/* ── MSA jobs (Clustal Omega) ─────────────────────────────────────────────── */

/** Mirrors the backend's identifier policy — 1–40 chars of the safe set. */
export const MSA_ID_RE = /^[A-Za-z0-9_.-]{1,40}$/;
/** Residue alphabet accepted by the API: letters, "*", "-", "_", ".". */
export const MSA_SEQUENCE_RE = /^[A-Z*\-_.]+$/;

export const MsaSequenceSchema = z.object({
  id: z.string().regex(MSA_ID_RE),
  sequence: z.string().min(1).max(2000).regex(MSA_SEQUENCE_RE),
});
export type MsaSequence = z.infer<typeof MsaSequenceSchema>;

export const MsaSequencesSchema = z.array(MsaSequenceSchema).min(2).max(50);

export const MsaResultSchema = z.object({
  consensus: z.string(),
  conservation: z.array(z.number()),
  alignment: z.array(MsaSequenceSchema),
  identity_matrix: z.array(z.array(z.number())),
});
export type MsaResult = z.infer<typeof MsaResultSchema>;

export const MsaJobStartSchema = z.object({
  job_id: z.string(),
});

export const MsaJobStatusSchema = z.object({
  status: z.enum(["running", "done", "error"]),
  result: MsaResultSchema.optional(),
  detail: z.string().optional(),
});

/* ── CRISPR design jobs ───────────────────────────────────────────────────── */

export const PamMotifSchema = z.object({
  motif: z.string(),
  enzyme: z.string(),
});

export const SgRnaSchema = z.object({
  id: z.string(),
  sequence: z.string(),
  pam: z.string(),
  /** 1-based coordinate of the guide (spacer) start on the plus strand. */
  start: z.number(),
  end: z.number(),
  strand: z.enum(["+", "-"]),
  gc: z.number(),
  /** Tool-specific on-target score, 0–100 (CHOPCHOP rank, CRISPR-P score…). */
  on_target_score: z.number(),
  /** Number of reported off-targets at the tolerance used by the tool. */
  off_target_count: z.number(),
  /** Top off-targets with mismatches + position, already capped by the API. */
  off_targets: z.array(
    z.object({
      locus: z.string(),
      mismatches: z.number(),
      sequence: z.string().optional(),
    }),
  ),
  /** Self-complementarity / hairpin flags where the tool reports them. */
  self_comp: z.number().optional(),
  efficiency_note: z.string().optional(),
});

export type SgRna = z.infer<typeof SgRnaSchema>;

export const SgRnaJobStartSchema = z.object({
  job_id: z.string(),
});
export const SgRnaJobStatusSchema = z.object({
  status: z.enum(["queued", "running", "done", "error"]),
  job_id: z.string(),
  tool: z.string(),
  // The backend emits null for both fields while a job is queued —
  // plain .optional() rejects null.
  results: z.array(SgRnaSchema).nullable().optional(),
  detail: z.string().nullable().optional(),
});

/* ── Nextflow pipelines ───────────────────────────────────────────────────── */

export const PipelineRunSchema = z.object({
  run_id: z.string(),
  name: z.string(),
  status: z.enum(["submitted", "running", "succeeded", "failed", "cancelled"]),
  /** "tower" (real compute) or "demo" (in-process simulator) — always badged. */
  source: z.enum(["tower", "demo"]).optional(),
  workdir: z.string().optional(),
  created_at: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const RunsListSchema = z.object({
  runs: z.array(PipelineRunSchema),
});

export const PipelinesSchema = z.object({
  pipelines: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      params: z.array(z.object({ key: z.string(), label: z.string(), type: z.string() })),
    }),
  ),
});

export const PipelineLaunchSchema = z.object({
  run_id: z.string(),
  status: z.string(),
});

export const PipelineStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "running", "cached", "succeeded", "failed"]),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const PipelineStatusSchema = z.object({
  run: PipelineRunSchema,
  steps: z.array(PipelineStepSchema).optional(),
  log_tail: z.array(z.string()).optional(),
});

/* ── DAG runs (flow builder → backend executor) ───────────────────────────── */

const DagIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/);

export const DagInputNodeSchema = z.object({
  kind: z.literal("input"),
  id: DagIdSchema,
  source_kind: z.enum(["sequence", "fasta", "dataframe"]),
  name: z.string().max(120),
  sequence: z.string().max(10000).nullable().optional(),
  dataframe: z
    .object({ columns: z.array(z.string().max(200)).max(50), rows: z.array(z.array(z.string().max(200))).max(2000) })
    .optional(),
});

export const DagToolNodeSchema = z.object({
  kind: z.literal("tool"),
  id: DagIdSchema,
  tool: z.enum(["chopchop", "crispr_gate", "crispr_p"]),
  gene_label: z.string().max(80).default(""),
  organism: z.string().max(80).default(""),
});

export const DagComputeNodeSchema = z.object({
  kind: z.literal("compute"),
  id: DagIdSchema,
  pipeline: z.string().regex(/^[a-z0-9-]{1,60}$/),
  params: z.record(z.string(), z.string()),
});

export const DagNodeSchema = z.discriminatedUnion("kind", [DagInputNodeSchema, DagToolNodeSchema, DagComputeNodeSchema]);

export const DagEdgeSchema = z.object({
  id: DagIdSchema,
  source: DagIdSchema,
  target: DagIdSchema,
});

/** The payload the flow canvas sends to POST /dag/runs. */
export const DagRunStartSchema = z.object({
  nodes: z.array(DagNodeSchema).min(1).max(50),
  edges: z.array(DagEdgeSchema).max(200),
});
export type DagRunStart = z.infer<typeof DagRunStartSchema>;

export const DagRunStartResponseSchema = z.object({
  run_id: z.string(),
  status: z.string(),
});

export const DagNodeStatusSchema = z.object({
  id: DagIdSchema,
  kind: z.enum(["input", "tool", "compute"]),
  label: z.string(),
  status: z.enum(["idle", "queued", "running", "succeeded", "failed", "skipped"]),
  note: z.string().optional(),
  results_count: z.number().optional(),
});

export const DagRunStatusSchema = z.object({
  run: z.object({
    run_id: z.string(),
    status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
    created_at: z.string(),
  }),
  nodes: z.array(DagNodeStatusSchema).optional(),
});
export type DagRunStatus = z.infer<typeof DagRunStatusSchema>;

export const DagRunSummarySchema = z.object({
  run_id: z.string(),
  name: z.string(),
  status: z.string(),
  source: z.string(),
  created_at: z.string(),
});
export type DagRunSummary = z.infer<typeof DagRunSummarySchema>;

export const DagRunsListSchema = z.object({
  runs: z.array(DagRunSummarySchema),
});

/** One SSE event from /dag/runs/{id}/stream — strict envelope, permissive
 *  `data` (unknown event types are dropped by the client). */
export const DagEventSchema = z.object({
  seq: z.number(),
  ts: z.string(),
  type: z.enum([
    "run_started",
    "node_started",
    "node_progress",
    "node_succeeded",
    "node_failed",
    "node_skipped",
    "step_update",
    "log",
    "run_succeeded",
    "run_failed",
    "run_cancelled",
  ]),
  node_id: z.string().nullable().optional(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type DagEvent = z.infer<typeof DagEventSchema>;

/* ── Variant bulk scan ────────────────────────────────────────────────────── */

const VariantScanSourceSchema = z.object({
  status: z.enum(["ok", "unavailable", "timeout"]),
  detail: z.string().optional(),
});

export const VariantScanStartSchema = z.object({
  uniprot_id: z.string(),
  start: z.number().int().positive().optional(),
  end: z.number().int().positive().optional(),
});
export type VariantScanStart = z.infer<typeof VariantScanStartSchema>;

export const VariantScanPositionSchema = z.object({
  position: z.number().int().positive(),
  ref: z.string().nullable().optional(),
  plddt: VariantScanSourceSchema.extend({ plddt: z.number().optional(), mean_model_plddt: z.number().optional() }).nullable().optional(),
  alphamissense: VariantScanSourceSchema.extend({
    mean: z.number().optional(),
    substitutions: z.array(z.object({ alt: z.string(), class: z.string() })).optional(),
  }).nullable().optional(),
  sift: VariantScanSourceSchema.extend({
    sift: z.object({ score: z.number().optional(), prediction: z.string().nullable().optional() }).nullable().optional(),
    polyphen: z.object({ score: z.number().optional(), prediction: z.string().nullable().optional() }).nullable().optional(),
  }).nullable().optional(),
});
export type VariantScanPosition = z.infer<typeof VariantScanPositionSchema>;

export const VariantScanStatusSchema = z.object({
  status: z.enum(["queued", "running", "done", "error"]),
  job_id: z.string(),
  uniprot_id: z.string(),
  progress: z.object({ scanned: z.number(), total: z.number() }),
  vep_applied: z.boolean(),
  positions: z.array(VariantScanPositionSchema).optional(),
  detail: z.string().nullable().optional(),
});
export type VariantScanStatus = z.infer<typeof VariantScanStatusSchema>;

export const VariantScanStartResponseSchema = z.object({
  job_id: z.string(),
  status: z.string(),
});
