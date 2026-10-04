/**
 * nextflow.ts — client hooks for the Nextflow pipeline monitor.
 *
 * Run status polls every 2 s while the run is active and stops once the run
 * reaches a terminal state (succeeded / failed / cancelled) — no background
 * polling left behind.
 */
import { useCallback, useEffect, useState } from "react";
import { apiValidated } from "./api";
import {
  PipelineLaunchSchema,
  PipelineStatusSchema,
  PipelinesSchema,
  RunsListSchema,
  type PipelineStatusSchema as PipelineStatusType,
} from "./validation";
import type { z } from "zod";

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export type PipelineRun = PipelineStatus["run"];
export type PipelineStep = NonNullable<PipelineStatus["steps"]>[number];

export interface PipelineTemplate {
  name: string;
  description: string;
  params: { key: string; label: string; type: string }[];
}

const POLL_INTERVAL_MS = 2_000;
const ACTIVE_STATUSES = new Set(["submitted", "running"]);

/** Load the pipeline template catalog once. */
export function usePipelines() {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiValidated("/nextflow/pipelines", PipelinesSchema)
      .then((r) => {
        if (!cancelled) setTemplates(r.pipelines);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Pipeline catalog unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, error };
}

/** Launch a run; returns the new run_id (null when the launch failed). */
export function useLaunchRun() {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(async (pipeline: string, params: Record<string, string>) => {
    setLaunching(true);
    setError(null);
    try {
      const started = await apiValidated("/nextflow/runs", PipelineLaunchSchema, {
        method: "POST",
        body: JSON.stringify({ pipeline, params }),
        timeoutMs: 30_000,
      });
      return started.run_id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The pipeline could not be launched.");
      return null;
    } finally {
      setLaunching(false);
    }
  }, []);

  return { launch, launching, error };
}

/** Poll one run's live status until it reaches a terminal state. */
export function usePipelineRun(runId: string | null) {
  const [payload, setPayload] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const status = await apiValidated(`/nextflow/runs/${encodeURIComponent(runId)}`, PipelineStatusSchema, {
          timeoutMs: 15_000,
        });
        if (cancelled) return;
        setPayload(status);
        if (ACTIVE_STATUSES.has(status.run.status)) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Run status unavailable.");
      }
    };

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  return { payload, error };
}

/** List recent runs, refreshed via `refreshKey`. */
export function useRuns(refreshKey: number) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiValidated("/nextflow/runs", RunsListSchema)
      .then((r) => {
        if (!cancelled) setRuns(r.runs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { runs };
}

// Re-export for consumers that prefer the schema type name.
export type { PipelineStatusType };
