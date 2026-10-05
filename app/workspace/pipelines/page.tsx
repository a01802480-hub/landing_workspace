"use client";

/**
 * Pipelines workspace — trigger and monitor Nextflow runs.
 *
 * Top: template catalog (each card carries its parameter form). Bottom:
 * the run monitor — recent runs on the left, the active run's step trace
 * and live log tail on the right. Runs launched from the CRISPR knockout
 * wizard arrive with ?run=&guides=&target= prefilled.
 *
 * Honesty rule: payloads carry source "tower" (real compute) or "demo"
 * (in-process simulator) and the badge is always shown.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Square } from "lucide-react";
import { apiValidated } from "@/lib/api";
import { PipelineStatusSchema } from "@/lib/validation";
import { useLaunchRun, usePipelineRun, usePipelines, useRuns, type PipelineRun } from "@/lib/nextflow";
import { Panel } from "@/components/workspace/panels/Panel";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { PipelineCard } from "@/components/workspace/pipelines/PipelineCard";
import { WorkflowStepList } from "@/components/workspace/pipelines/WorkflowStepList";
import { PipelineLogViewer } from "@/components/workspace/pipelines/PipelineLogViewer";

interface Prefill {
  pipeline: string;
  params: Record<string, string>;
  key: number;
}

export default function PipelinesPage() {
  const { templates, error } = usePipelines();
  const { launch, launching } = useLaunchRun();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const { runs } = useRuns(refreshKey);
  const { payload, error: runError } = usePipelineRun(activeRunId);

  // Runs the monitor picked up — refresh the list whenever one launches.
  useEffect(() => {
    if (activeRunId) setRefreshKey((k) => k + 1);
  }, [activeRunId]);

  const onLaunch = useCallback(
    async (name: string, params: Record<string, string>) => {
      const runId = await launch(name, params);
      if (runId) setActiveRunId(runId);
    },
    [launch],
  );

  const cancel = useCallback(async () => {
    if (!activeRunId) return;
    try {
      await apiValidated(`/nextflow/runs/${encodeURIComponent(activeRunId)}/cancel`, PipelineStatusSchema, {
        method: "POST",
        timeoutMs: 15_000,
      });
      // Keep the run attached — the monitor shows its "cancelled" state.
      setRefreshKey((k) => k + 1);
    } catch {
      /* cancel failed — the run continues */
    }
  }, [activeRunId]);

  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Pipelines</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Trigger and monitor Nextflow computational pipelines: run status, per-process
          progress and a live log tail — every run linked to the design that produced it.
        </p>
      </header>

      {/* Query-param prefill from the CRISPR knockout wizard. */}
      <Suspense fallback={null}>
        <PrefillReader
          onPrefill={(p) => {
            setPrefill({ pipeline: p.pipeline, params: p.params, key: Date.now() });
            // Scroll the catalog into view — the prefill selects a card.
            document.getElementById("pipeline-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </Suspense>

      {/* ── Catalog ──────────────────────────────────────────────────── */}
      <section id="pipeline-catalog" className="mb-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-frost/90 uppercase">Run a pipeline</h2>
          {prefill && (
            <span className="chip">
              prefilled from the CRISPR knockout plan · {prefill.pipeline}
            </span>
          )}
        </div>
        {error ? (
          <div className="glass-panel p-4 text-sm text-[#c13b3b]">{error}</div>
        ) : templates.length === 0 ? (
          <div className="glass-panel h-24 p-1">
            <PanelSkeleton variant="stats" caption="Loading the pipeline catalog…" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <PipelineCard
                key={t.name}
                template={t}
                launching={launching}
                onLaunch={onLaunch}
                prefill={prefill?.pipeline === t.name ? prefill : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Monitor ──────────────────────────────────────────────────── */}
      <section className="mb-4">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">Run monitor</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Runs" note="recent launches" className="lg:col-span-1" bodyClassName="p-3">
            <PanelBoundary title="Run list" className="h-full">
              {runs.length === 0 ? (
                <p className="px-2 text-sm text-mist/60">No runs yet — launch a pipeline above.</p>
              ) : (
                <ul className="space-y-1">
                  {runs.map((run) => (
                    <RunRow key={run.run_id} run={run} active={run.run_id === activeRunId} onSelect={() => setActiveRunId(run.run_id)} />
                  ))}
                </ul>
              )}
            </PanelBoundary>
          </Panel>

          <Panel
            title={activeRunId ? `Run ${activeRunId.slice(0, 8)}…` : "Run detail"}
            note={payload ? payload.run.name : "select a run"}
            className="lg:col-span-2"
            bodyClassName="flex flex-col p-3"
            actions={
              payload && ["submitted", "running"].includes(payload.run.status) ? (
                <button type="button" onClick={cancel} className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1 text-xs">
                  <Square className="h-3 w-3" /> Cancel
                </button>
              ) : undefined
            }
          >
            <PanelBoundary title="Run detail" className="flex min-h-0 flex-1 flex-col">
              {runError ? (
                <p className="px-2 text-sm text-[#c13b3b]">{runError}</p>
              ) : !payload ? (
                <p className="px-2 text-sm text-mist/60">Launch a pipeline or pick a run to watch its trace.</p>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={payload.run.status} />
                    <SourceBadge source={payload.run.source} />
                    {payload.run.created_at && (
                      <span className="stat-num text-[10px] text-mist/60">started {payload.run.created_at.replace("T", " ")}</span>
                    )}
                  </div>
                  <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[10px] tracking-wide text-mist/60 uppercase">Processes</p>
                      <WorkflowStepList steps={payload.steps ?? []} />
                    </div>
                    <div className="flex min-h-0 flex-col">
                      <p className="mb-2 text-[10px] tracking-wide text-mist/60 uppercase">Log tail</p>
                      <div className="min-h-0 flex-1">
                        <PipelineLogViewer lines={payload.log_tail ?? []} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </PanelBoundary>
          </Panel>
        </div>
      </section>
    </ToolScroll>
  );
}

function RunRow({ run, active, onSelect }: { run: PipelineRun; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors duration-300 ease-out ${
          active ? "bg-glow-violet/15 font-medium text-frost" : "hover:bg-ink-950/5 hover:text-frost"
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            run.status === "succeeded"
              ? "bg-[#0ca30c]"
              : run.status === "failed"
                ? "bg-[#c13b3b]"
                : run.status === "cancelled"
                  ? "bg-mist/50"
                  : "status-dot status-dot-pulse"
          }`}
        />
        <span className="min-w-0 flex-1 truncate font-mono">{run.name}</span>
        <span className="stat-num text-[9px] text-mist/60">{run.status}</span>
      </button>
    </li>
  );
}

function StatusBadge({ status }: { status: PipelineRun["status"] }) {
  const color =
    status === "succeeded" ? "#0ca30c" : status === "failed" ? "#c13b3b" : status === "cancelled" ? "#898781" : "#6d5ae0";
  return (
    <span className="chip" style={{ borderColor: `${color}55`, color }}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

function SourceBadge({ source }: { source: PipelineRun["source"] }) {
  if (source === "tower") {
    return <span className="chip">Nextflow Tower</span>;
  }
  return (
    <span className="chip !border-[#c98500]/50 !text-[#9a6b00]" title="In-process simulator — not real compute">
      demo simulator
    </span>
  );
}

/** Reads ?run=&guides=&target= (from the CRISPR wizard) into the page —
 *  once per distinct parameter signature, so the keep-alive IDE tab
 *  re-fires when a new launch targets it. */
function PrefillReader({ onPrefill }: { onPrefill: (p: { pipeline: string; params: Record<string, string> }) => void }) {
  const search = useSearchParams();
  const last = useRef<string>("");

  useEffect(() => {
    const run = search.get("run");
    if (!run) return;
    const params: Record<string, string> = {};
    const guides = search.get("guides");
    const target = search.get("target");
    if (guides) params.guides = guides;
    if (target) params.target = target;
    const key = `${run}|${guides ?? ""}|${target ?? ""}`;
    if (last.current === key) return;
    last.current = key;
    onPrefill({ pipeline: run, params });
  }, [search, onPrefill]);

  return null;
}
