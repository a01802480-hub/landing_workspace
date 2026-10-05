/**
 * flows.ts — the flow builder's node/edge model, tool catalog and canvas
 * migration (v2).
 *
 * Three node kinds — unlimited instances of each:
 * - input: a data source. `sourceKind` selects sequence / fasta /
 *   dataframe; `resourceId` references the resource registry, and
 *   undefined resourceId + "sequence" means the live workspace sequence
 *   (the legacy one-sequence-node semantics, preserved by migration).
 * - tool: one external CRISPR engine (CHOPCHOP, CRISPR-GATE, CRISPR-P 2.0).
 * - compute: a Nextflow pipeline (catalog name + params).
 *
 * Statuses are runtime-only: the flows page folds live DAG run events into
 * `nodeStatus` and the canvas renders them; they are never persisted.
 */
import type { Edge, Node } from "@xyflow/react";

export type DagNodeStatus = "idle" | "queued" | "running" | "succeeded" | "failed" | "skipped";

export type FlowNodeType = "input" | "tool" | "compute";

export type InputSourceKind = "sequence" | "fasta" | "dataframe";

export type FlowToolId = "chopchop" | "crispr_gate" | "crispr_p";

export interface InputNodeData extends Record<string, unknown> {
  kind: "input";
  sourceKind: InputSourceKind;
  resourceId?: string;
  status?: DagNodeStatus;
}

export interface ToolNodeData extends Record<string, unknown> {
  kind: "tool";
  tool: FlowToolId;
  params: Record<string, string>;
  status?: DagNodeStatus;
}

export interface ComputeNodeData extends Record<string, unknown> {
  kind: "compute";
  pipeline: string;
  params: Record<string, string>;
  status?: DagNodeStatus;
}

export type FlowNodeData = InputNodeData | ToolNodeData | ComputeNodeData;
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowEdge = Edge;

/* ── Catalogs ─────────────────────────────────────────────────────────────── */

export interface ToolParamDef {
  key: string;
  label: string;
  placeholder?: string;
}

export const TOOL_NODE_CATALOG: {
  tool: FlowToolId;
  label: string;
  hint: string;
  params: ToolParamDef[];
}[] = [
  {
    tool: "chopchop",
    label: "Run CHOPCHOP",
    hint: "sgRNA design + upstream off-target prediction over the selected region.",
    params: [{ key: "gene", label: "Target gene", placeholder: "optional gene label" }],
  },
  {
    tool: "crispr_gate",
    label: "Run CRISPR-GATE",
    hint: "Knockout-first guide ranking and the knockout planning wizard.",
    params: [{ key: "gene", label: "Target gene", placeholder: "optional gene label" }],
  },
  {
    tool: "crispr_p",
    label: "Run CRISPR-P 2.0",
    hint: "Plant-optimized guide scoring (U3/U6 windows).",
    params: [{ key: "gene", label: "Target gene", placeholder: "optional gene label" }],
  },
];

export const DEFAULT_PIPELINE = "crispr-knockout";

export function toolCatalogEntry(tool: FlowToolId) {
  return TOOL_NODE_CATALOG.find((t) => t.tool === tool);
}

export function newFlowNodeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Default canvas ───────────────────────────────────────────────────────── */

/** Default canvas: one live-sequence input feeding every engine. */
export function defaultFlowNodes(): FlowNode[] {
  return [
    {
      id: "input-live",
      type: "input",
      position: { x: 60, y: 220 },
      data: { kind: "input", sourceKind: "sequence" },
    },
    {
      id: "tool-chopchop",
      type: "tool",
      position: { x: 420, y: 60 },
      data: { kind: "tool", tool: "chopchop", params: { gene: "" } },
    },
    {
      id: "tool-gate",
      type: "tool",
      position: { x: 420, y: 190 },
      data: { kind: "tool", tool: "crispr_gate", params: { gene: "" } },
    },
    {
      id: "tool-crisprp",
      type: "tool",
      position: { x: 420, y: 320 },
      data: { kind: "tool", tool: "crispr_p", params: { gene: "" } },
    },
    {
      id: "compute-1",
      type: "compute",
      position: { x: 420, y: 450 },
      data: { kind: "compute", pipeline: DEFAULT_PIPELINE, params: {} },
    },
  ];
}

export function defaultFlowEdges(): FlowEdge[] {
  return ["tool-chopchop", "tool-gate", "tool-crisprp", "compute-1"].map((target) => ({
    id: `input-live-${target}`,
    source: "input-live",
    target,
    animated: true,
  }));
}

/* ── Canvas persistence + migration ───────────────────────────────────────── */

export interface PersistedCanvas {
  version: 2;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface LegacyStoredCanvas {
  nodes?: unknown;
  edges?: unknown;
  version?: unknown;
}

/**
 * Restore + migrate a persisted canvas. Legacy (v1) canvases used
 * `sequence` (one per canvas, store-backed) and `tool` nodes (four fixed
 * engines incl. "nextflow"). Migration maps them onto the v2 model and is
 * deterministic: the persisted shape gains `version: 2`, so a canvas
 * migrates exactly once.
 */
export function migrateCanvas(stored: unknown): PersistedCanvas | null {
  if (typeof stored !== "object" || stored === null) return null;
  const s = stored as LegacyStoredCanvas;
  if (!Array.isArray(s.nodes) || !Array.isArray(s.edges)) return null;
  if (s.version === 2) {
    return { version: 2, nodes: s.nodes as FlowNode[], edges: s.edges as FlowEdge[] };
  }

  const nodes: FlowNode[] = [];
  for (const raw of s.nodes as { id?: unknown; type?: unknown; position?: unknown; data?: Record<string, unknown> }[]) {
    if (!raw || typeof raw.id !== "string" || typeof raw.type !== "string") continue;
    const position =
      raw.position && typeof raw.position === "object"
        ? (raw.position as { x: number; y: number })
        : { x: 60, y: 220 };
    const data = (raw.data ?? {}) as Record<string, unknown>;

    if (raw.type === "sequence" || (raw.type === "tool" && data.kind === "sequence")) {
      // v1 sequence node → live-sequence input (undefined resourceId).
      nodes.push({ id: raw.id, type: "input", position, data: { kind: "input", sourceKind: "sequence" } });
      continue;
    }
    if (raw.type === "tool" && data.kind === "tool" && typeof data.tool === "string") {
      if (data.tool === "nextflow") {
        const oldParams = (data.params ?? {}) as Record<string, string>;
        const { pipeline, ...rest } = oldParams;
        nodes.push({
          id: raw.id,
          type: "compute",
          position,
          data: { kind: "compute", pipeline: pipeline || DEFAULT_PIPELINE, params: rest },
        });
      } else if (data.tool === "chopchop" || data.tool === "crispr_gate" || data.tool === "crispr_p") {
        nodes.push({
          id: raw.id,
          type: "tool",
          position,
          data: { kind: "tool", tool: data.tool, params: (data.params ?? {}) as Record<string, string> },
        });
      }
    }
  }

  const edges: FlowEdge[] = (s.edges as { id?: unknown; source?: unknown; target?: unknown }[])
    .filter(
      (e): e is { id: string; source: string; target: string } =>
        !!e &&
        typeof e.id === "string" &&
        typeof e.source === "string" &&
        typeof e.target === "string",
    )
    .map((e) => ({ ...e, id: e.id, source: e.source, target: e.target, animated: true }));

  return { version: 2, nodes, edges };
}
