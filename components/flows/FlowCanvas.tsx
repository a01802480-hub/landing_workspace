"use client";

/**
 * FlowCanvas — the ProtoFlow-style visual pipeline builder (@xyflow/react).
 *
 * Unlimited nodes of three kinds: input (sequence / FASTA / dataframe —
 * the sequence variant without a resourceId reads the live workspace
 * store), tool (CHOPCHOP / CRISPR-GATE / CRISPR-P 2.0) and compute
 * (Nextflow pipeline). Nodes arrive from three sources: the palette
 * (DROP_MIME), the resource sidebar (RESOURCE_DROP_MIME — a resource id
 * becomes an input node), and OS file drops (parsed into resources).
 *
 * The canvas is controlled: the flows page owns nodes/edges (so it can
 * serialize them into the DAG payload) and passes `nodeStatus` — live
 * run statuses folded from SSE events — which is rendered as a badge on
 * every node but never persisted.
 */
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  type Connection,
  type NodeProps,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FileText, Orbit, Scissors, Table2, Workflow } from "lucide-react";
import {
  TOOL_NODE_CATALOG,
  toolCatalogEntry,
  newFlowNodeId,
  DEFAULT_PIPELINE,
  type DagNodeStatus,
  type FlowEdge,
  type FlowNode,
  type FlowToolId,
  type InputSourceKind,
} from "@/lib/flows";
import { RESOURCE_DROP_MIME, parseFileToResources, type Resource } from "@/lib/resources";
import { useWorkspace } from "@/lib/workspaceStore";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { StatusDot } from "@/components/workspace/shell/StatusDot";

/** Palette drags: "input:sequence" | "input:fasta" | "input:dataframe" |
 *  "tool:<id>" | "compute". */
export const DROP_MIME = "application/protheon-flow";

const STATUS_META: Record<DagNodeStatus, { label: string; dot: string }> = {
  idle: { label: "", dot: "" },
  queued: { label: "queued", dot: "bg-mist" },
  running: { label: "running", dot: "bg-glow-violet status-dot-pulse" },
  succeeded: { label: "done", dot: "bg-[#0ca30c]" },
  failed: { label: "failed", dot: "bg-[#c13b3b]" },
  skipped: { label: "skipped", dot: "bg-mist/50" },
};

function StatusBadge({ status }: { status: DagNodeStatus }) {
  const meta = STATUS_META[status];
  if (!meta.label) return null;
  return (
    <span className="chip ml-auto !py-0.5 text-[9px]">
      <StatusDot className={meta.dot} />
      {meta.label}
    </span>
  );
}

/* ── Custom nodes ─────────────────────────────────────────────────────────── */

const INPUT_ICONS: Record<InputSourceKind, typeof Orbit> = {
  sequence: Orbit,
  fasta: FileText,
  dataframe: Table2,
};

const INPUT_LABELS: Record<InputSourceKind, string> = {
  sequence: "Sequence",
  fasta: "FASTA file",
  dataframe: "Dataframe",
};

function InputNodeView({ data }: NodeProps<FlowNode>) {
  const { sequence, resources } = useWorkspace();
  const d = data as { sourceKind: InputSourceKind; resourceId?: string; status?: DagNodeStatus };
  const Icon = INPUT_ICONS[d.sourceKind];
  const resource: Resource | undefined = d.resourceId
    ? resources.find((r) => r.id === d.resourceId)
    : undefined;
  const meta = resource
    ? resource.kind === "dataframe"
      ? `${resource.dataframe ? resource.dataframe.rows.length.toLocaleString() : "?"} rows`
      : `${resource.payload ? `${resource.payload.seq.length.toLocaleString()} bp` : "session-only"}`
    : d.sourceKind === "sequence"
      ? sequence
        ? `${sequence.seq.length.toLocaleString()} bp${sequence.circular ? " · circular" : ""}`
        : "no sequence loaded"
      : "unset";
  const name =
    resource?.name ?? (d.sourceKind === "sequence" ? (sequence ? sequence.name : "Workspace sequence") : "Pick a resource");

  return (
    <div className="w-56 rounded-xl border border-glow-violet/40 bg-white/90 shadow-lg backdrop-blur-md">
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-glow-violet" />
      <div className="flex items-center gap-2 border-b border-ink-950/5 px-3 py-2">
        <span aria-hidden className="text-glow-violet">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-frost">{INPUT_LABELS[d.sourceKind]} Input</span>
        <StatusBadge status={d.status ?? "idle"} />
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-xs text-frost/90" title={name}>
          {name}
        </p>
        <p className="stat-num mt-0.5 text-[10px] text-mist/70">{meta}</p>
        {d.sourceKind === "sequence" && !resource && sequence && (
          <p className="mt-1 text-[9px] text-mist/60">live workspace sequence — tools receive the current selection</p>
        )}
      </div>
    </div>
  );
}

const TOOL_ICONS: Record<FlowToolId, typeof Scissors> = {
  chopchop: Scissors,
  crispr_gate: Scissors,
  crispr_p: Scissors,
};

function ToolNodeView({ data }: NodeProps<FlowNode>) {
  const d = data as { tool: FlowToolId; params: Record<string, string>; status?: DagNodeStatus };
  const meta = toolCatalogEntry(d.tool);
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
        <StatusBadge status={d.status ?? "idle"} />
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

function ComputeNodeView({ data }: NodeProps<FlowNode>) {
  const d = data as { pipeline: string; params: Record<string, string>; status?: DagNodeStatus };
  const paramSummary = Object.values(d.params).filter(Boolean).join(" · ");
  return (
    <div className="w-56 rounded-xl border border-ink-950/15 bg-white/90 shadow-lg backdrop-blur-md">
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-mist" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-mist" />
      <div className="flex items-center gap-2 border-b border-ink-950/5 px-3 py-2">
        <span aria-hidden className="text-glow-violet">
          <Workflow className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-frost">Nextflow Pipeline</span>
        <StatusBadge status={d.status ?? "idle"} />
      </div>
      <div className="px-3 py-2">
        <p className="truncate font-mono text-xs text-frost/90" title={d.pipeline}>
          {d.pipeline}
        </p>
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
  input: InputNodeView,
  tool: ToolNodeView,
  compute: ComputeNodeView,
} as unknown as NodeTypes;

/* ── Canvas ───────────────────────────────────────────────────────────────── */

function CanvasBody({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectNode,
  nodeStatus,
  setNodes,
  onCanvasError,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: (connection: Connection) => void;
  onSelectNode: (id: string | null) => void;
  nodeStatus?: Record<string, DagNodeStatus>;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  onCanvasError: (message: string) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const { resources, addResource } = useWorkspace();

  // Live statuses overlay the persisted node data — never written back.
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: nodeStatus?.[n.id] ?? (n.data.status ?? "idle") },
      })),
    [nodes, nodeStatus],
  );

  const addInputNode = useCallback(
    (position: { x: number; y: number }, sourceKind: InputSourceKind, resourceId?: string) => {
      setNodes((prev) => [
        ...prev,
        { id: newFlowNodeId(), type: "input", position, data: { kind: "input", sourceKind, resourceId } },
      ]);
    },
    [setNodes],
  );

  const addToolNode = useCallback(
    (position: { x: number; y: number }, tool: FlowToolId) => {
      const meta = TOOL_NODE_CATALOG.find((t) => t.tool === tool);
      if (!meta) return;
      setNodes((prev) => [
        ...prev,
        {
          id: newFlowNodeId(),
          type: "tool",
          position,
          data: {
            kind: "tool",
            tool,
            params: Object.fromEntries(meta.params.map((p) => [p.key, ""])),
          },
        },
      ]);
    },
    [setNodes],
  );

  const addComputeNode = useCallback(
    (position: { x: number; y: number }) => {
      setNodes((prev) => [
        ...prev,
        {
          id: newFlowNodeId(),
          type: "compute",
          position,
          data: { kind: "compute", pipeline: DEFAULT_PIPELINE, params: {} },
        },
      ]);
    },
    [setNodes],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // OS file drop → parse into resources → input nodes.
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) {
        for (const file of files) {
          try {
            const { resources: added, sequence } = await parseFileToResources(file);
            for (const r of added) addResource(r);
            const first = added[0];
            if (first && first.kind === "dataframe") {
              addInputNode(position, "dataframe", first.id);
            } else if (first) {
              // A dropped sequence file becomes an input node on the canvas.
              addInputNode(position, sequence ? "sequence" : "fasta", first.id);
            }
          } catch (err) {
            onCanvasError(err instanceof Error ? err.message : `${file.name} could not be imported.`);
          }
        }
        return;
      }

      // Resource sidebar drag → input node referencing that resource.
      const resourceId = e.dataTransfer.getData(RESOURCE_DROP_MIME);
      if (resourceId) {
        const resource = resources.find((r) => r.id === resourceId);
        if (resource) addInputNode(position, resource.kind, resource.id);
        return;
      }

      // Palette drag: "input:<kind>" | "tool:<id>" | "compute".
      const kind = e.dataTransfer.getData(DROP_MIME);
      if (!kind) return;
      if (kind.startsWith("input:")) {
        addInputNode(position, kind.slice("input:".length) as InputSourceKind);
        return;
      }
      if (kind === "compute") {
        addComputeNode(position);
        return;
      }
      if (kind.startsWith("tool:")) {
        addToolNode(position, kind.slice("tool:".length) as FlowToolId);
      }
    },
    [screenToFlowPosition, resources, addResource, addInputNode, addToolNode, addComputeNode, onCanvasError],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => onSelectNode(node.id),
    [onSelectNode],
  );

  return (
    <PanelBoundary title="Flow canvas" className="h-full">
      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={displayNodes}
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
 *  (screenToFlowPosition for drops) resolves inside it. */
export function FlowCanvas(props: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: (connection: Connection) => void;
  onSelectNode: (id: string | null) => void;
  nodeStatus?: Record<string, DagNodeStatus>;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  onCanvasError: (message: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasBody {...props} />
    </ReactFlowProvider>
  );
}
