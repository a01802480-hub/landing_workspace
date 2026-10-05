"use client";

/**
 * Flow builder — the ProtoFlow-style visual pipeline canvas.
 *
 * Layout: canvas fills the viewport (React Flow owns its own scroll); the
 * right rail carries the draggable node library (unlimited inputs, tools,
 * compute), the inspector for the selected node and — while a run is
 * active — the live RunMonitor (SSE-fed). "Run workflow" serializes the
 * whole DAG (nodes + edges, resource references resolved to inline
 * payloads) to POST /dag/runs; the backend executes it topologically and
 * streams progress back, which the canvas renders as per-node badges.
 *
 * The canvas persists to localStorage (shape-guarded, versioned); live
 * statuses never do.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addEdge, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { FileText, Orbit, Play, Scissors, Table2, Trash2, Workflow, X, type LucideIcon } from "lucide-react";
import { DROP_MIME, FlowCanvas } from "@/components/flows/FlowCanvas";
import { RunMonitor } from "@/components/flows/RunMonitor";
import { buildDagPayload, submitDagRun, useDagRun, type DagBuildError } from "@/lib/dag";
import {
  DEFAULT_PIPELINE,
  TOOL_NODE_CATALOG,
  defaultFlowEdges,
  defaultFlowNodes,
  migrateCanvas,
  toolCatalogEntry,
  type FlowEdge,
  type FlowNode,
} from "@/lib/flows";
import { usePipelines } from "@/lib/nextflow";
import { storageRead, storageWrite } from "@/lib/persistence";
import { useIde } from "@/lib/ide";
import { useWorkspace } from "@/lib/workspaceStore";

const STORE_KEY = "flows:canvas";

function restoreCanvas(): { nodes: FlowNode[]; edges: FlowEdge[]; restored: boolean } {
  const restored = migrateCanvas(storageRead<unknown>(STORE_KEY));
  if (restored && restored.nodes.length > 0) {
    return { nodes: restored.nodes, edges: restored.edges, restored: true };
  }
  return { nodes: defaultFlowNodes(), edges: defaultFlowEdges(), restored: false };
}

export default function FlowsPage() {
  const { sequence, selection, resources } = useWorkspace();
  const { selectTab } = useIde();
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(defaultFlowNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(defaultFlowEdges());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [buildErrors, setBuildErrors] = useState<DagBuildError[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const { templates } = usePipelines();

  // Adopt the persisted canvas AFTER hydration — the legacy /workspace/flows
  // route is prerendered, and reading storage during the first render would
  // diverge the client tree from the server HTML.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const restored = restoreCanvas();
    if (restored.restored) {
      setNodes(restored.nodes);
      setEdges(restored.edges);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!restoredRef.current) return; // never write defaults over a stored canvas
    storageWrite(STORE_KEY, { version: 2, nodes, edges });
  }, [nodes, edges]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, labelForNode(n)])),
    [nodes],
  );

  const runState = useDagRun(activeRunId, nodes.map((n) => n.id));

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  );

  const setParam = (nodeId: string, key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId && (n.data.kind === "tool" || n.data.kind === "compute")
          ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
          : n,
      ),
    );
  };

  const setPipeline = (nodeId: string, pipeline: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId && n.data.kind === "compute" ? { ...n, data: { ...n.data, pipeline } } : n,
      ),
    );
  };

  const setResourceRef = (nodeId: string, resourceId: string | undefined) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId && n.data.kind === "input" ? { ...n, data: { ...n.data, resourceId } } : n,
      ),
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedId === nodeId) setSelectedId(null);
  };

  const runWorkflow = useCallback(async () => {
    setBuildErrors([]);
    setCanvasError(null);
    const { payload, errors } = buildDagPayload(nodes, edges, resources, sequence, selection);
    if (!payload || errors.length > 0) {
      setBuildErrors(errors);
      return;
    }
    const runId = await submitDagRun(payload);
    if (runId) {
      setActiveRunId(runId);
    } else {
      setBuildErrors([{ nodeId: null, message: "The workflow could not be submitted — is the backend running?" }]);
    }
  }, [nodes, edges, resources, sequence, selection]);

  /** Legacy single-node bridge: open the tool workspace with the node's
   *  params + the store's selection carried along (still handy for manual
   *  per-tool runs; the full DAG runs via "Run workflow"). */
  const openTarget = useCallback(() => {
    if (!selectedNode) return;
    if (selectedNode.data.kind === "compute") {
      void router.push(`/workspace?run=${encodeURIComponent(selectedNode.data.pipeline)}#pipelines`);
      selectTab("pipelines"); // router.push uses pushState — no hashchange event
      return;
    }
    if (selectedNode.data.kind === "tool") {
      const params = new URLSearchParams({ tool: selectedNode.data.tool });
      if (selection) {
        params.set("start", String(selection.start));
        params.set("end", String(selection.end));
      }
      void router.push(`/workspace?${params.toString()}#crispr`);
      selectTab("crispr");
    }
  }, [selectedNode, selection, router, selectTab]);

  const running = activeRunId !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Compact header ────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-frost">Flow builder</h1>
          <p className="text-[10px] text-mist/60">
            drag nodes from the library · connect inputs → tools → pipelines · run the whole DAG
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {sequence ? (
            <span className="chip">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#0ca30c]" />
              {sequence.name} · {sequence.seq.length.toLocaleString()} bp
              {selection ? ` · ${selection.start}–${selection.end}` : ""}
            </span>
          ) : (
            <span className="chip">no sequence — import one in the DNA workspace</span>
          )}
          {running && (
            <button type="button" onClick={() => setActiveRunId(null)} className="btn-ghost inline-flex items-center gap-1 !px-2.5 !py-1 text-[10px]">
              <X className="h-3 w-3" /> Clear status
            </button>
          )}
          <button
            type="button"
            onClick={() => void runWorkflow()}
            disabled={running && (runState.runStatus === "running" || runState.runStatus === "queued")}
            className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Run workflow
          </button>
        </div>
      </div>

      {/* ── Validation errors strip ───────────────────────────────────── */}
      {(buildErrors.length > 0 || canvasError) && (
        <div className="shrink-0 px-4 pb-1.5">
          <div role="alert" className="rounded-lg border border-[#c13b3b]/30 bg-[#c13b3b]/5 px-3 py-2">
            {canvasError && <p className="text-[11px] text-[#c13b3b]">{canvasError}</p>}
            {buildErrors.map((err, i) => (
              <p key={i} className="text-[11px] text-[#c13b3b]">
                {err.nodeId ? `${labelForId(err.nodeId)}: ` : ""}
                {err.message}
              </p>
            ))}
            <button
              type="button"
              onClick={() => {
                setBuildErrors([]);
                setCanvasError(null);
              }}
              className="mt-1 text-[10px] text-mist/70 underline underline-offset-2 hover:text-frost"
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Canvas + right rail ───────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px] gap-3 px-4 pb-3">
        <section className="glass-card min-h-0 overflow-hidden" aria-label="Pipeline canvas">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectNode={setSelectedId}
            setNodes={setNodes}
            nodeStatus={runState.nodeStatus}
            onCanvasError={setCanvasError}
          />
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {/* Node library */}
          <div className="glass-card shrink-0 p-4">
            <h2 className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-mist/60 uppercase">Node library</h2>
            <div className="flex flex-col gap-2">
              <p className="text-[9px] tracking-wide text-mist/50 uppercase">Input nodes</p>
              <PaletteItem label="Workspace sequence" hint="the live sequence + selection" icon={Orbit} kind="input:sequence" />
              <PaletteItem label="FASTA file" hint="a raw FASTA record" icon={FileText} kind="input:fasta" />
              <PaletteItem label="Dataframe" hint="CSV/TSV tabular data" icon={Table2} kind="input:dataframe" />
              <p className="pt-1 text-[9px] tracking-wide text-mist/50 uppercase">Tool nodes</p>
              {TOOL_NODE_CATALOG.map((t) => (
                <PaletteItem key={t.tool} label={t.label} hint="design guides" icon={Scissors} kind={`tool:${t.tool}`} />
              ))}
              <p className="pt-1 text-[9px] tracking-wide text-mist/50 uppercase">Compute nodes</p>
              <PaletteItem label="Nextflow Pipeline" hint="custom compute pipeline" icon={Workflow} kind="compute" />
            </div>
            <p className="mt-3 text-[9px] leading-relaxed text-mist/50">
              unlimited nodes — drag resources from the sidebar or drop .gb/.dna/.fa/.csv files straight onto the canvas.
            </p>
          </div>

          {/* Inspector */}
          <div className="glass-card shrink-0 p-4">
            <h2 className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-mist/60 uppercase">Inspector</h2>
            {!selectedNode ? (
              <p className="text-xs leading-relaxed text-mist/70">
                Click a node to configure it. The whole canvas runs as one DAG — inputs feed
                tools, tools feed pipelines.
              </p>
            ) : (
              <Inspector
                node={selectedNode}
                templates={templates}
                resources={resources}
                sequence={sequence}
                onParam={setParam}
                onPipeline={setPipeline}
                onResourceRef={setResourceRef}
                onDelete={deleteNode}
                onOpenTarget={openTarget}
              />
            )}
          </div>

          {/* Run monitor */}
          {running && (
            <div className="glass-card min-h-48 shrink-0 p-4">
              <RunMonitor runId={activeRunId} state={runState} nodeLabels={nodeLabels} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function labelForNode(n: FlowNode): string {
  if (n.data.kind === "input") return `${n.data.sourceKind} · ${n.id.slice(0, 6)}`;
  if (n.data.kind === "tool") return toolCatalogEntry(n.data.tool)?.label ?? n.data.tool;
  return n.data.pipeline;
}

function labelForId(id: string): string {
  if (id.startsWith("tool-")) return `Tool node ${id}`;
  if (id.startsWith("compute-")) return `Pipeline node ${id}`;
  return `Input node ${id.slice(0, 8)}`;
}

/* ── Inspector ────────────────────────────────────────────────────────────── */

function Inspector({
  node,
  templates,
  resources,
  sequence,
  onParam,
  onPipeline,
  onResourceRef,
  onDelete,
  onOpenTarget,
}: {
  node: FlowNode;
  templates: { name: string; description: string; params: { key: string; label: string; type: string }[] }[];
  resources: ReturnType<typeof useWorkspace>["resources"];
  sequence: ReturnType<typeof useWorkspace>["sequence"];
  onParam: (nodeId: string, key: string, value: string) => void;
  onPipeline: (nodeId: string, pipeline: string) => void;
  onResourceRef: (nodeId: string, resourceId: string | undefined) => void;
  onDelete: (nodeId: string) => void;
  onOpenTarget: () => void;
}) {
  const data = node.data;

  return (
    <div className="flex flex-col gap-3">
      {data.kind === "input" && (
        <>
          <p className="text-xs font-medium text-frost">
            {data.sourceKind === "sequence" ? "Sequence input" : data.sourceKind === "fasta" ? "FASTA input" : "Dataframe input"}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-wide text-mist/60 uppercase">Resource</span>
            <select
              value={data.resourceId ?? ""}
              onChange={(e) => onResourceRef(node.id, e.target.value || undefined)}
              className="glass-panel px-2.5 py-1.5 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none"
              aria-label="Resource"
            >
              {data.sourceKind === "sequence" && (
                <option value="">Live workspace sequence{sequence ? ` (${sequence.name})` : ""}</option>
              )}
              <option value="" disabled={data.sourceKind !== "sequence"}>
                {data.sourceKind === "fasta" ? "— pick a FASTA resource —" : "— pick a dataframe resource —"}
              </option>
              {resources
                .filter((r) => (data.sourceKind === "sequence" ? r.kind === "sequence" : r.kind === data.sourceKind))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-[10px] leading-relaxed text-mist/70">
            {data.sourceKind === "sequence"
              ? "The live sequence feeds tools with the current selection; a resource feeds the whole file."
              : "This input feeds whatever tool or pipeline it connects to."}
          </p>
        </>
      )}

      {data.kind === "tool" && (
        <>
          <p className="text-xs font-medium text-frost">{toolCatalogEntry(data.tool)?.label ?? data.tool}</p>
          <p className="text-[10px] leading-relaxed text-mist/70">{toolCatalogEntry(data.tool)?.hint}</p>
          {toolCatalogEntry(data.tool)?.params.map((p) => (
            <label key={p.key} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] tracking-wide text-mist/60 uppercase">{p.label}</span>
              <input
                value={data.params[p.key] ?? ""}
                onChange={(e) => onParam(node.id, p.key, e.target.value)}
                placeholder={p.placeholder ?? ""}
                className="glass-panel min-w-0 flex-1 px-2.5 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
                aria-label={p.label}
              />
            </label>
          ))}
          <button type="button" onClick={onOpenTarget} className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px]">
            Open {toolCatalogEntry(data.tool)?.label} workspace
          </button>
        </>
      )}

      {data.kind === "compute" && (
        <>
          <p className="text-xs font-medium text-frost">Nextflow pipeline</p>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-wide text-mist/60 uppercase">Pipeline</span>
            <select
              value={data.pipeline}
              onChange={(e) => onPipeline(node.id, e.target.value)}
              className="glass-panel px-2.5 py-1.5 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none"
              aria-label="Pipeline"
            >
              {templates.length === 0 && <option value={data.pipeline}>{data.pipeline}</option>}
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
              {!templates.some((t) => t.name === data.pipeline) && <option value={data.pipeline}>{data.pipeline} (custom)</option>}
            </select>
          </label>
          {(() => {
            const template = templates.find((t) => t.name === data.pipeline);
            if (!template) return <p className="text-[10px] leading-relaxed text-mist/70">Pipeline catalog unavailable — the backend will reject unknown pipeline names.</p>;
            return (
              <>
                <p className="text-[10px] leading-relaxed text-mist/70">{template.description}</p>
                {template.params.map((p) => (
                  <label key={p.key} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] tracking-wide text-mist/60 uppercase">{p.label}</span>
                    <input
                      value={data.params[p.key] ?? ""}
                      onChange={(e) => onParam(node.id, p.key, e.target.value)}
                      placeholder={p.key}
                      className="glass-panel min-w-0 flex-1 px-2.5 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
                      aria-label={p.label}
                    />
                  </label>
                ))}
              </>
            );
          })()}
        </>
      )}

      <button
        type="button"
        onClick={() => onDelete(node.id)}
        className="mt-1 inline-flex items-center gap-1.5 self-start text-[10px] text-mist/60 transition-colors duration-300 ease-out hover:text-[#c13b3b]"
      >
        <Trash2 className="h-3 w-3" /> Delete node
      </button>
    </div>
  );
}

/* ── Palette ──────────────────────────────────────────────────────────────── */

function PaletteItem({
  label,
  hint,
  icon: Icon,
  kind,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  kind: string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DROP_MIME, kind);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex cursor-grab items-center gap-2.5 rounded-lg border border-ink-950/10 bg-white/70 px-3 py-2 transition-colors duration-300 ease-out hover:border-glow-violet/40 hover:bg-glow-violet/5 active:cursor-grabbing"
      title={`Drag onto the canvas: ${hint}`}
    >
      <span aria-hidden className="text-glow-violet">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-frost">{label}</span>
        <span className="block truncate text-[9px] text-mist/60">{hint}</span>
      </span>
    </div>
  );
}
