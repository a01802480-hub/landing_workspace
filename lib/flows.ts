/**
 * flows.ts — the flow builder's node/edge model and tool catalog.
 *
 * The canvas has two node kinds:
 * - sequence: the workspace sequence (one per canvas — it reads the shared
 *   store, so every tool node attached to it receives the current selection).
 * - tool: one per external engine (CHOPCHOP, CRISPR-GATE, CRISPR-P 2.0,
 *   Nextflow). Running a tool node navigates to its workspace with the
 *   node's params + the store's sequence/selection carried along.
 */
import type { Edge, Node } from "@xyflow/react";

export type FlowToolId = "chopchop" | "crispr_gate" | "crispr_p" | "nextflow";

export interface SequenceNodeData extends Record<string, unknown> {
  kind: "sequence";
}

export interface ToolNodeData extends Record<string, unknown> {
  kind: "tool";
  tool: FlowToolId;
  /** Params edited in the node inspector (e.g. nextflow pipeline name). */
  params: Record<string, string>;
}

export type FlowNodeData = SequenceNodeData | ToolNodeData;
export type FlowNode = Node<FlowNodeData, "sequence" | "tool">;
export type FlowEdge = Edge;

export const TOOL_NODE_CATALOG: {
  tool: FlowToolId;
  label: string;
  hint: string;
  defaults: Record<string, string>;
}[] = [
  {
    tool: "chopchop",
    label: "Run CHOPCHOP",
    hint: "sgRNA design + upstream off-target prediction over the selected region.",
    defaults: { gene: "" },
  },
  {
    tool: "crispr_gate",
    label: "Run CRISPR-GATE",
    hint: "Knockout-first guide ranking and the knockout planning wizard.",
    defaults: { gene: "" },
  },
  {
    tool: "crispr_p",
    label: "Run CRISPR-P 2.0",
    hint: "Plant-optimized guide scoring (U3/U6 windows).",
    defaults: { gene: "" },
  },
  {
    tool: "nextflow",
    label: "Nextflow Pipeline",
    hint: "Launch a pipeline with the selection as a parameter.",
    defaults: { pipeline: "crispr-knockout" },
  },
];

/** Default canvas: one sequence node feeding every engine. */
export function defaultFlowNodes(): FlowNode[] {
  return [
    {
      id: "sequence",
      type: "sequence",
      position: { x: 60, y: 220 },
      data: { kind: "sequence" },
    },
    {
      id: "chopchop",
      type: "tool",
      position: { x: 420, y: 60 },
      data: { kind: "tool", tool: "chopchop", params: { ...TOOL_NODE_CATALOG[0].defaults } },
    },
    {
      id: "crispr_gate",
      type: "tool",
      position: { x: 420, y: 190 },
      data: { kind: "tool", tool: "crispr_gate", params: { ...TOOL_NODE_CATALOG[1].defaults } },
    },
    {
      id: "crispr_p",
      type: "tool",
      position: { x: 420, y: 320 },
      data: { kind: "tool", tool: "crispr_p", params: { ...TOOL_NODE_CATALOG[2].defaults } },
    },
    {
      id: "nextflow",
      type: "tool",
      position: { x: 420, y: 450 },
      data: { kind: "tool", tool: "nextflow", params: { ...TOOL_NODE_CATALOG[3].defaults } },
    },
  ];
}

export function defaultFlowEdges(): FlowEdge[] {
  return ["chopchop", "crispr_gate", "crispr_p", "nextflow"].map((target) => ({
    id: `sequence-${target}`,
    source: "sequence",
    target,
    animated: true,
  }));
}
