"use client";

/**
 * RunMonitor — live DAG execution panel for the flow builder's right rail.
 *
 * Shows the run status + cancel, per-node status chips (folded from SSE
 * events), compute-node step progress (accumulated step_update events),
 * and a scrolling monospace event log (auto-scrolls unless the user has
 * scrolled up).
 */
import { useEffect, useMemo, useRef } from "react";
import { Ban, Radio } from "lucide-react";
import type { DagRunState } from "@/lib/dag";
import type { DagNodeStatus } from "@/lib/flows";
import { StatusDot } from "@/components/workspace/shell/StatusDot";

const STATUS_TONE: Record<string, string> = {
  queued: "text-mist",
  running: "text-glow-violet",
  succeeded: "text-[#0ca30c]",
  failed: "text-[#c13b3b]",
  cancelled: "text-mist",
};

const NODE_DOT: Record<DagNodeStatus, string> = {
  idle: "bg-mist/40",
  queued: "bg-mist",
  running: "bg-glow-violet status-dot-pulse",
  succeeded: "bg-[#0ca30c]",
  failed: "bg-[#c13b3b]",
  skipped: "bg-mist/50",
};

interface StepState {
  name: string;
  status: string;
}

export function RunMonitor({
  runId,
  state,
  nodeLabels,
}: {
  runId: string;
  state: DagRunState;
  nodeLabels: Record<string, string>;
}) {
  const { events, nodeStatus, runStatus, connected, error, cancel } = state;
  const logRef = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);

  const steps = useMemo(() => {
    const map = new Map<string, StepState>();
    for (const evt of events) {
      if (evt.type !== "step_update" || !evt.data) continue;
      const id = String(evt.data.step_id ?? "");
      if (!id) continue;
      map.set(id, {
        name: String(evt.data.step_name ?? id),
        status: String(evt.data.step_status ?? "pending"),
      });
    }
    return [...map.values()];
  }, [events]);

  useEffect(() => {
    const el = logRef.current;
    if (el && !userScrolled.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-frost">Run monitor</h3>
        <span className="stat-num ml-auto font-mono text-[9px] text-mist/60" title={runId}>
          {runId.slice(0, 10)}…
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${STATUS_TONE[runStatus ?? ""] ?? ""}`}>
          <StatusDot
            className={
              runStatus === "running"
                ? "bg-glow-violet status-dot-pulse"
                : runStatus === "succeeded"
                  ? "bg-[#0ca30c]"
                  : runStatus === "failed"
                    ? "bg-[#c13b3b]"
                    : "bg-mist"
            }
          />
          {runStatus ?? "starting…"}
        </span>
        <span className="chip text-[9px] text-mist/70">
          {connected ? (
            <>
              <Radio aria-hidden className="h-3 w-3 text-glow-violet" /> live stream
            </>
          ) : (
            "polling fallback"
          )}
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={runStatus !== "running" && runStatus !== "queued"}
          className="btn-ghost ml-auto inline-flex items-center gap-1 !px-2.5 !py-1 text-[10px] disabled:opacity-40"
        >
          <Ban className="h-3 w-3" /> Cancel
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[10px] leading-relaxed text-[#c13b3b]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(nodeStatus).map(([id, status]) => (
          <span key={id} className="chip inline-flex items-center gap-1.5 !py-0.5 text-[9px]" title={id}>
            <StatusDot className={NODE_DOT[status]} />
            {nodeLabels[id] ?? id}
          </span>
        ))}
      </div>

      {steps.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[9px] tracking-[0.16em] text-mist/60 uppercase">Pipeline steps</p>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <StatusDot
                className={
                  s.status === "succeeded"
                    ? "bg-[#0ca30c]"
                    : s.status === "failed"
                      ? "bg-[#c13b3b]"
                      : s.status === "running"
                        ? "bg-glow-violet status-dot-pulse"
                        : "bg-mist/40"
                }
              />
              <span className="min-w-0 flex-1 truncate text-[10px] text-frost/80">{s.name}</span>
              <span className="stat-num text-[9px] text-mist/60">{s.status}</span>
            </div>
          ))}
        </div>
      )}

      <div
        ref={logRef}
        onScroll={() => {
          const el = logRef.current;
          if (el) userScrolled.current = el.scrollTop + el.clientHeight < el.scrollHeight - 24;
        }}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-ink-950/5 bg-ink-950/[0.03] p-2 font-mono text-[9px] leading-relaxed text-mist/80"
        aria-label="Run event log"
      >
        {events.length === 0 && <p className="text-mist/50">events will appear here…</p>}
        {events.map((evt, i) => (
          <p key={i} className={evt.type.includes("failed") ? "text-[#c13b3b]" : ""}>
            <span className="text-mist/40">{evt.ts.slice(11, 19)}</span> {evt.type}
            {evt.node_id ? ` · ${evt.node_id.slice(0, 12)}` : ""} — {evt.message}
          </p>
        ))}
      </div>
    </div>
  );
}
