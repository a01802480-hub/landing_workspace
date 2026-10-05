/**
 * dag.ts — the flow-builder → backend executor bridge.
 *
 * `buildDagPayload` resolves the canvas (resource references, live
 * sequence + selection) into the POST /dag/runs payload and surfaces
 * client-side validation errors per node. `useDagRun` subscribes to the
 * run's SSE stream: per-event `seq` dedupe (the server replays its full
 * event log on every reconnect, so duplicates are guaranteed), and a
 * polling fallback when the stream dies three times in a row (proxies /
 * endpoint security software sometimes kill EventSource).
 *
 * StrictMode-safe by construction: the effect's cleanup closes the
 * EventSource and clears the fallback interval, so the dev double-mount
 * is create → close → create with no leak.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiValidated } from "./api";
import type { FlowEdge, FlowNode, DagNodeStatus } from "./flows";
import type { Resource } from "./resources";
import type { SequenceSelection, WorkspaceSequence } from "./sequences";
import {
  DagEventSchema,
  DagRunsListSchema,
  DagRunStartResponseSchema,
  DagRunStatusSchema,
  type DagEvent,
  type DagRunStart,
  type DagRunStatus,
  type DagRunSummary,
} from "./validation";

/* ── Payload building + client-side validation ────────────────────────────── */

export interface DagBuildError {
  nodeId: string | null;
  message: string;
}

const MIN_SEQ_NT = 80;
const MAX_SEQ_NT = 10_000;

function hasCycle(ids: string[], edges: { source: string; target: string }[]): boolean {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of ids) indeg.set(id, 0);
  for (const e of edges) {
    if (!indeg.has(e.source) || !indeg.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const queue = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  let seen = 0;
  while (queue.length) {
    const id = queue.shift() as string;
    seen++;
    for (const t of adj.get(id) ?? []) {
      const d = (indeg.get(t) ?? 1) - 1;
      indeg.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  return seen !== ids.length;
}

/**
 * Resolve the canvas into the backend payload. Errors are per-node and
 * rendered on the canvas — the run button never fires a doomed payload.
 */
export function buildDagPayload(
  nodes: FlowNode[],
  edges: FlowEdge[],
  resources: Resource[],
  sequence: WorkspaceSequence | null,
  selection: SequenceSelection | null,
): { payload: DagRunStart | null; errors: DagBuildError[] } {
  const errors: DagBuildError[] = [];
  const ids = nodes.map((n) => n.id);

  if (hasCycle(ids, edges)) {
    return { payload: null, errors: [{ nodeId: null, message: "The graph contains a cycle — a workflow must be a DAG." }] };
  }

  const upstreamOf = (id: string) => edges.filter((e) => e.target === id).map((e) => e.source);

  const payloadNodes: DagRunStart["nodes"] = [];

  for (const node of nodes) {
    const data = node.data;

    if (data.kind === "input") {
      if (data.sourceKind === "dataframe") {
        const res = data.resourceId ? resources.find((r) => r.id === data.resourceId) : undefined;
        if (!res || !res.dataframe) {
          errors.push({ nodeId: node.id, message: "Pick a dataframe resource (drop a .csv/.tsv into the resource sidebar)." });
          continue;
        }
        payloadNodes.push({
          kind: "input",
          id: node.id,
          source_kind: "dataframe",
          name: res.name,
          dataframe: res.dataframe,
        });
        continue;
      }

      // sequence / fasta
      let name: string;
      let seq: string;
      if (data.resourceId) {
        const res = resources.find((r) => r.id === data.resourceId);
        if (!res) {
          errors.push({ nodeId: node.id, message: "The referenced resource was removed — pick another." });
          continue;
        }
        if (!res.payload) {
          errors.push({ nodeId: node.id, message: `${res.name} was too large to persist — re-import it.` });
          continue;
        }
        name = res.name;
        seq = res.payload.seq;
      } else {
        if (!sequence) {
          errors.push({ nodeId: node.id, message: "No sequence loaded — import one in the DNA workspace." });
          continue;
        }
        const scoped = selection
          ? sequence.seq.slice(Math.max(0, selection.start - 1), selection.end)
          : sequence.seq;
        name = selection
          ? `${sequence.name} [${selection.start.toLocaleString()}–${selection.end.toLocaleString()}]`
          : sequence.name;
        seq = scoped;
      }
      if (seq.length < MIN_SEQ_NT || seq.length > MAX_SEQ_NT) {
        errors.push({
          nodeId: node.id,
          message: `The sequence is ${seq.length.toLocaleString()} nt — tools need ${MIN_SEQ_NT}–${MAX_SEQ_NT.toLocaleString()} nt.`,
        });
        continue;
      }
      payloadNodes.push({
        kind: "input",
        id: node.id,
        source_kind: data.sourceKind,
        name,
        sequence: seq,
      });
      continue;
    }

    if (data.kind === "tool") {
      const ups = upstreamOf(node.id);
      if (ups.length === 0) {
        errors.push({ nodeId: node.id, message: "Connect a sequence input to this tool first." });
        continue;
      }
      const upstreamNodes = nodes.filter((n) => ups.includes(n.id));
      if (upstreamNodes.every((n) => n.data.kind === "input" && n.data.sourceKind === "dataframe")) {
        errors.push({ nodeId: node.id, message: "This tool needs a sequence input — dataframes feed pipelines, not guide design." });
        continue;
      }
      payloadNodes.push({
        kind: "tool",
        id: node.id,
        tool: data.tool,
        gene_label: (data.params.gene ?? "").slice(0, 80),
        organism: (data.params.organism ?? "").slice(0, 80),
      });
      continue;
    }

    // compute
    if (upstreamOf(node.id).length === 0) {
      errors.push({ nodeId: node.id, message: "Connect an input (or a tool) to this pipeline." });
      continue;
    }
    payloadNodes.push({
      kind: "compute",
      id: node.id,
      pipeline: data.pipeline,
      params: Object.fromEntries(
        Object.entries(data.params).map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 500)]),
      ),
    });
  }

  if (payloadNodes.length === 0) {
    return { payload: null, errors: [...errors, { nodeId: null, message: "The canvas has no runnable nodes." }] };
  }

  const payload: DagRunStart = {
    nodes: payloadNodes,
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  return { payload, errors };
}

/* ── Submission ───────────────────────────────────────────────────────────── */

export function submitDagRun(payload: DagRunStart): Promise<string | null> {
  return apiValidated("/dag/runs", DagRunStartResponseSchema, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 30_000,
  })
    .then((r) => r.run_id)
    .catch(() => null);
}

/* ── Live run subscription (SSE + polling fallback) ───────────────────────── */

const TERMINAL_EVENTS = new Set(["run_succeeded", "run_failed", "run_cancelled"]);
const FALLBACK_AFTER_ERRORS = 3;
const FALLBACK_INTERVAL_MS = 3_000;
const MAX_EVENTS = 500;

export type DagRunStatusValue = DagRunStatus["run"]["status"];

export interface DagRunState {
  events: DagEvent[];
  nodeStatus: Record<string, DagNodeStatus>;
  runStatus: DagRunStatusValue | null;
  /** SSE stream alive (false while on the polling fallback). */
  connected: boolean;
  error: string | null;
  cancel: () => void;
}

export function useDagRun(runId: string | null, nodeIds: string[]): DagRunState {
  const [events, setEvents] = useState<DagEvent[]>([]);
  const [nodeStatus, setNodeStatus] = useState<Record<string, DagNodeStatus>>({});
  const [runStatus, setRunStatus] = useState<DagRunStatusValue | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxSeq = useRef(0);
  const nodeIdsRef = useRef(nodeIds);
  nodeIdsRef.current = nodeIds;

  const foldEvent = useCallback((evt: DagEvent) => {
    setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), evt]);
    if (evt.type === "run_started") {
      setRunStatus("running");
      setNodeStatus(Object.fromEntries(nodeIdsRef.current.map((id) => [id, "queued" as DagNodeStatus])));
      return;
    }
    if (evt.node_id) {
      const status: DagNodeStatus | undefined =
        evt.type === "node_started"
          ? "running"
          : evt.type === "node_succeeded"
            ? "succeeded"
            : evt.type === "node_failed"
              ? "failed"
              : evt.type === "node_skipped"
                ? "skipped"
                : undefined;
      if (status) setNodeStatus((prev) => ({ ...prev, [evt.node_id as string]: status }));
    }
    if (evt.type === "run_succeeded") setRunStatus("succeeded");
    else if (evt.type === "run_failed") setRunStatus("failed");
    else if (evt.type === "run_cancelled") setRunStatus("cancelled");
  }, []);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let consecutiveErrors = 0;

    setEvents([]);
    setNodeStatus({});
    setRunStatus(null);
    setError(null);
    maxSeq.current = 0;

    const startPolling = () => {
      if (cancelled || timer) return;
      setConnected(false);
      timer = setInterval(async () => {
        try {
          const status = await apiValidated(`/dag/runs/${encodeURIComponent(runId)}`, DagRunStatusSchema, {
            timeoutMs: 15_000,
          });
          if (cancelled) return;
          if (status.nodes) {
            setNodeStatus((prev) => {
              const next = { ...prev };
              for (const n of status.nodes ?? []) next[n.id] = n.status;
              return next;
            });
          }
          setRunStatus(status.run.status);
          if (["succeeded", "failed", "cancelled"].includes(status.run.status) && timer) {
            clearInterval(timer);
            timer = undefined;
          }
        } catch (e) {
          if (cancelled) return;
          setError(e instanceof Error && e.message ? `Run lost (${e.message.toLowerCase()})` : "Run lost — the backend may have restarted.");
          if (timer) {
            clearInterval(timer);
            timer = undefined;
          }
        }
      }, FALLBACK_INTERVAL_MS);
    };

    es = new EventSource(`${API_BASE}/api/dag/runs/${encodeURIComponent(runId)}/stream`);
    es.onopen = () => {
      consecutiveErrors = 0;
      if (!cancelled) setConnected(true);
    };
    es.onmessage = (msg) => {
      consecutiveErrors = 0;
      try {
        const parsed = DagEventSchema.safeParse(JSON.parse(msg.data));
        if (!parsed.success) return; // unknown event shapes are dropped
        const evt = parsed.data;
        if (evt.seq <= maxSeq.current) return; // replay dedupe
        maxSeq.current = evt.seq;
        if (!cancelled) foldEvent(evt);
        if (TERMINAL_EVENTS.has(evt.type)) es?.close();
      } catch {
        /* malformed frame — ignore */
      }
    };
    es.onerror = () => {
      consecutiveErrors += 1;
      if (consecutiveErrors >= FALLBACK_AFTER_ERRORS) {
        es?.close();
        es = null;
        if (!cancelled) startPolling();
      }
    };

    return () => {
      cancelled = true;
      es?.close();
      if (timer) clearInterval(timer);
    };
  }, [runId, foldEvent]);

  const cancel = useCallback(() => {
    if (!runId) return;
    apiValidated(`/dag/runs/${encodeURIComponent(runId)}/cancel`, DagRunStatusSchema, {
      method: "POST",
      timeoutMs: 15_000,
    }).catch(() => {});
  }, [runId]);

  return { events, nodeStatus, runStatus, connected, error, cancel };
}

/* ── Run listing ──────────────────────────────────────────────────────────── */

export type { DagRunSummary } from "./validation";

export function useDagRuns(refreshKey: number): { runs: DagRunSummary[]; error: string | null } {
  const [runs, setRuns] = useState<DagRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiValidated("/dag/runs", DagRunsListSchema)
      .then((r) => {
        if (!cancelled) setRuns(r.runs);
      })
      .catch(() => {
        if (!cancelled) setError("DAG runs unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { runs, error };
}

export type { DagRunStatus };
