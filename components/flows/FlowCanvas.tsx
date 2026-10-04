"use client";

/**
 * FlowCanvas — the ProtoFlow-style visual pipeline builder (@xyflow/react).
 *
 * One "Sequence Node" feeds tool nodes (Run CHOPCHOP / CRISPR-GATE /
 * CRISPR-P 2.0 / Nextflow Pipeline) through edges. The sequence node reads
 * the shared workspace store — so the canvas always operates on the same
 * sequence + selection as the DNA viewer. Dragging from the palette drops
 * new nodes at the pointer; the canvas persists to localStorage
 * (best-effort, shape-guarded).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Orbit, Scissors, Workflow } from "lucide-react";
import { TOOL_NODE_CATALOG, defaultFlowEdges, defaultFlowNodes, type FlowEdge, type FlowNode, type FlowToolId } from "@/lib/flows";
import { storageRead, storageWrite } from "@/lib/persistence";
import { useWorkspace } from "@/lib/workspaceStore";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";

export const DROP_MIME = "application/protheon-flow";

/* ── Custom nodes ─────────────────────────────────────────────────────────── */

function SequenceNodeView({ data }: NodeProps<FlowNode>) {
  const { sequence, selection } = useWorkspace();
  return (
    <div className="w-56 rounded-xl border border-glow-violet/40 bg-white/90 shadow-lg backdrop-blur-md">
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-glow-violet" />
      <div className="flex items-center gap-2 border-b border-ink-950/5 px-3 py-2">
        <span aria-hidden className="text-glow-violet">
          <Orbit className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-frost">Sequence Node</span>
      </div>
      <div className="px-3 py-2">
        {sequence ? (
          <>
            <p className="truncate text-xs text-frost/90" title={sequence.name}>
              {sequence.name}
            </p>
            <p className="stat-num mt-0.5 text-[10px] text-mist/70">
              {sequence.seq.length.toLocaleString()} bp · {sequence.circular ? "circular" : "linear"}
            </p>
            {selection ? (
              <p className="chip mt-1.5 !py-0.5 text-[9px]">
                selection {selection.start.toLocaleString()}–{selection.end.toLocaleString()}
              </p>
            ) : (
              <p className="mt-1 text-[9px] text-mist/60">no selection — tools run on the whole sequence</p>
            )}
          </>
        ) : (
          <p className="text-xs leading-relaxed text-mist/70">
            No sequence loaded — open the{" "}
            <Link href="/workspace/dna" className="text-glow-violet underline-offset-2 hover:underline">
              DNA workspace
            </Link>{" "}
            and import one.
          </p>
        )}
      </div>
    </div>
  );
}

const TOOL_ICONS: Record<FlowToolId, typeof Scissors> = {
  chopchop: Scissors,
  crispr_gate: Scissors,
  crispr_p: Scissors,
  nextflow: Workflow,
};

function ToolNodeView({ data }: NodeProps<FlowNode>) {
  const d = data as { tool: FlowToolId; params: Record<string, string> };
  const meta = TOOL_NODE_CATALOG.find((t) => t.tool === d.tool);
  const Icon = TOOL_ICONS[d.tool];
  const paramSummary = Object.values(d.params).filter(Boolean).join(" · ");
  return (
    <div className="w-56 rounded-xl border border-ink-950/15 bg-white/90 shadow-lg backdrop-blur-md">
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-mist" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-mist" />
      <div className="flex items-center gap-2 border-b border-ink-950/5 px-3 py-2">
        <span aria-hidden className="text-glow-violet">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-frost">{meta?.label ?? d.tool}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-[10px] leading-relaxed text-mist/70">{meta?.hint}</p>
        {paramSummary && (
          <p className="mt-1 truncate text-[9px] text-mist/60" title={paramSummary}>
            {paramSummary}
          </p>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  sequence: SequenceNodeView,
  tool: ToolNodeView,
} as unknown as NodeTypes;

/* ── Canvas ───────────────────────────────────────────────────────────────── */

const STORE_KEY = "flows:canvas";

function restoreCanvas(): { nodes: FlowNode[]; edges: FlowEdge[] } | null {
  try {
    const stored = storageRead<{ nodes: FlowNode[]; edges: FlowEdge[] }>(STORE_KEY);
    if (!stored || !Array.isArray(stored.nodes) || !Array.isArray(stored.edges)) return null;
    // Position/types re-checked — stored canvas data is untrusted input.
    if (!stored.nodes.every((n) => typeof n.id === "string" && (n.type === "sequence" || n.type === "tool"))) return null;
    return stored;
  } catch {
    return null;
  }
}

function CanvasBody({
  onSelectNode,
  paramUpdates,
}: {
  onSelectNode: (id: string | null) => void;
  /** Inspector edits keyed by node id — applied to tool nodes in place. */
  paramUpdates?: Record<string, Record<string, string>>;
}) {
  const restored = useMemo(restoreCanvas, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(restored?.nodes ?? defaultFlowNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(restored?.edges ?? defaultFlowEdges());
  const { screenToFlowPosition } = useReactFlow();
  const saved = useRef(false);

  useEffect(() => {
    // Persist after the first change pass (skip the initial mount write).
    if (!saved.current) {
      saved.current = true;
      return;
    }
    storageWrite(STORE_KEY, { nodes, edges });
  }, [nodes, edges]);

  // Inspector edits → node params, in place (never remounts the node).
  useEffect(() => {
    if (!paramUpdates || Object.keys(paramUpdates).length === 0) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.type === "tool" && paramUpdates[n.id] ? { ...n, data: { ...n.data, params: paramUpdates[n.id] } } : n,
      ),
    );
  }, [paramUpdates, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DROP_MIME) as "" | "sequence" | FlowToolId;
      if (!kind) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (kind === "sequence") {
        if (nodes.some((n) => n.type === "sequence")) return; // one sequence node per canvas
        setNodes((nds) => [...nds, { id: "sequence", type: "sequence", position, data: { kind: "sequence" } }]);
        return;
      }
      const meta = TOOL_NODE_CATALOG.find((t) => t.tool === kind);
      if (!meta) return;
      setNodes((nds) => [
        ...nds,
        {
          id: `${kind}-${Date.now()}`,
          type: "tool",
          position,
          data: { kind: "tool", tool: kind, params: { ...meta.defaults } },
        },
      ]);
    },
    [screenToFlowPosition, nodes, setNodes],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => onSelectNode(node.id),
    [onSelectNode],
  );

  return (
    <PanelBoundary title="Flow canvas" className="h-full">
      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => onSelectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.4}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="rgba(139,124,240,0.25)" />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            className="!bg-white/80 !backdrop-blur-md"
            maskColor="rgba(247,246,253,0.7)"
          />
        </ReactFlow>
      </div>
    </PanelBoundary>
  );
}

/** The exported canvas — the provider wraps the body so useReactFlow
 *  (screenToFlowPosition for palette drops) resolves inside it. */
export function FlowCanvas({
  onSelectNode,
  paramUpdates,
}: {
  onSelectNode: (id: string | null) => void;
  paramUpdates?: Record<string, Record<string, string>>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasBody onSelectNode={onSelectNode} paramUpdates={paramUpdates} />
    </ReactFlowProvider>
  );
}
