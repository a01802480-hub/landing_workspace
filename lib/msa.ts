/**
 * msa.ts — the Clustal Omega MSA job state machine (submit → poll → done),
 * shared by the MSA panel and the redesigned comparative page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiValidated } from "./api";
import {
  MsaJobStartSchema,
  MsaJobStatusSchema,
  MsaSequencesSchema,
  type MsaResult,
  type MsaSequence,
} from "./validation";

export type MsaJobState =
  | { kind: "idle" }
  | { kind: "running"; jobId: string | null }
  | { kind: "done"; result: MsaResult }
  | { kind: "error"; detail: string };

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;
/** Spec'd cap: ~40 polls at 3 s each, then a designed timeout state. */
const MAX_POLLS = 40;
/** Job ids travel into a URL, so they must be strict identifiers. */
const MSA_JOB_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function useMsaJob() {
  const [job, setJob] = useState<MsaJobState>({ kind: "idle" });
  /** Exactly what the last job was started with — retry re-submits it. */
  const submittedRef = useRef<MsaSequence[] | null>(null);

  const busy = job.kind === "running";

  useEffect(() => {
    if (job.kind !== "running" || job.jobId === null) return;
    const jobId = job.jobId;
    if (!MSA_JOB_ID_RE.test(jobId)) {
      setJob({ kind: "error", detail: "The alignment service returned an unexpected job identifier." });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    const poll = async () => {
      polls += 1;
      try {
        const status = await apiValidated(`/comparative/msa/${encodeURIComponent(jobId)}`, MsaJobStatusSchema, {
          timeoutMs: POLL_TIMEOUT_MS,
        });
        if (cancelled) return;
        if (status.status === "done") {
          if (!status.result) {
            setJob({ kind: "error", detail: "The alignment job finished without results — retry it." });
            return;
          }
          setJob({ kind: "done", result: status.result });
          return;
        }
        if (status.status === "error") {
          setJob({ kind: "error", detail: status.detail ?? "The alignment job failed on the server." });
          return;
        }
        if (polls >= MAX_POLLS) {
          setJob({
            kind: "error",
            detail: `The alignment job did not finish within 2 minutes (${MAX_POLLS} polls). Retry to start it again.`,
          });
          return;
        }
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        setJob({
          kind: "error",
          detail: e instanceof Error && e.message ? e.message : "The alignment service did not answer.",
        });
      }
    };

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [job]);

  const submit = useCallback(async (sequences: MsaSequence[]) => {
    const gate = MsaSequencesSchema.safeParse(sequences);
    if (!gate.success) {
      setJob({ kind: "error", detail: "These sequences did not pass the client-side checks: 2–50 records, strict ids, residue alphabet." });
      return;
    }
    submittedRef.current = gate.data;
    setJob({ kind: "running", jobId: null });
    try {
      const started = await apiValidated("/comparative/msa", MsaJobStartSchema, {
        method: "POST",
        body: JSON.stringify({ sequences: gate.data }),
        timeoutMs: SUBMIT_TIMEOUT_MS,
      });
      setJob({ kind: "running", jobId: started.job_id });
    } catch (e) {
      setJob({
        kind: "error",
        detail: e instanceof Error && e.message ? e.message : "The alignment job could not be started.",
      });
    }
  }, []);

  const retry = useCallback(() => {
    if (submittedRef.current) void submit(submittedRef.current);
  }, [submit]);

  return { job, submit, busy, retry };
}
