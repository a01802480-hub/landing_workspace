/**
 * crispr.ts — client hooks for the CRISPR design workflow.
 *
 * The design job runs behind POST /crispr/design → GET /crispr/design/{id}
 * (same async shape as the MSA jobs). The local scoring core completes on
 * the first poll; upstream off-target enrichment (CHOPCHOP / CRISPR-P)
 * may keep the job queued longer.
 */
import { useCallback, useEffect, useState } from "react";
import { apiValidated } from "./api";
import {
  SgRnaJobStartSchema,
  SgRnaJobStatusSchema,
  type SgRna,
} from "./validation";

export type CrisprTool = "chopchop" | "crispr_gate" | "crispr_p";

export const CRISPR_TOOLS: {
  id: CrisprTool;
  label: string;
  blurb: string;
  pam: string;
}[] = [
  {
    id: "chopchop",
    label: "CHOPCHOP",
    blurb: "General sgRNA design with off-target prediction (upstream DB).",
    pam: "NGG",
  },
  {
    id: "crispr_gate",
    label: "CRISPR-GATE",
    blurb: "Knockout-first ranking — early-CDS placement for truncating alleles.",
    pam: "NGG",
  },
  {
    id: "crispr_p",
    label: "CRISPR-P 2.0",
    blurb: "Plant-optimized scoring — GC window tuned for U3/U6 expression.",
    pam: "NGG",
  },
];

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 20;

export type DesignState =
  | { kind: "idle" }
  | { kind: "running"; jobId: string | null }
  | { kind: "done"; tool: CrisprTool; results: SgRna[] }
  | { kind: "error"; detail: string };

/** Submit + poll a guide-design job. Mirrors the MSA panel's job pattern. */
export function useSgRnaDesign() {
  const [state, setState] = useState<DesignState>({ kind: "idle" });

  useEffect(() => {
    if (state.kind !== "running" || state.jobId === null) return;
    const jobId = state.jobId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    const poll = async () => {
      polls += 1;
      try {
        const status = await apiValidated(`/crispr/design/${encodeURIComponent(jobId)}`, SgRnaJobStatusSchema, {
          timeoutMs: 15_000,
        });
        if (cancelled) return;
        if (status.status === "done") {
          setState({ kind: "done", tool: status.tool as CrisprTool, results: status.results ?? [] });
          return;
        }
        if (status.status === "error") {
          setState({ kind: "error", detail: status.detail ?? "The design job failed on the server." });
          return;
        }
        if (polls >= MAX_POLLS) {
          setState({ kind: "error", detail: `The design job did not finish within ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s. Retry to start it again.` });
          return;
        }
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: "error",
          detail: e instanceof Error && e.message ? e.message : "The design service did not answer.",
        });
      }
    };

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state]);

  const submit = useCallback(
    async (sequence: string, tool: CrisprTool, geneLabel: string, organism: string) => {
      const clean = sequence.replace(/\s+/g, "").toUpperCase();
      if (!/^[ACGTN]{80,10000}$/.test(clean)) {
        setState({ kind: "error", detail: "Target sequence must be 80–10,000 nt of [ACGTN]." });
        return;
      }
      setState({ kind: "running", jobId: null });
      try {
        const started = await apiValidated("/crispr/design", SgRnaJobStartSchema, {
          method: "POST",
          body: JSON.stringify({ sequence: clean, tool, gene_label: geneLabel, organism }),
          timeoutMs: 30_000,
        });
        setState({ kind: "running", jobId: started.job_id });
      } catch (e) {
        setState({
          kind: "error",
          detail: e instanceof Error && e.message ? e.message : "The design job could not be started.",
        });
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ kind: "idle" }), []);

  return { state, submit, reset };
}

export type { SgRna };
