/**
 * variants.ts — the all-substitutions scan client.
 *
 * Submit a window (≤500 positions) to POST /variants/scan, then poll with
 * PARTIAL results kept in state: rows render while the scan is still
 * running (per-position AlphaMissense degradation included).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiValidated } from "./api";
import {
  VariantScanStartResponseSchema,
  VariantScanStatusSchema,
  type VariantScanStatus,
} from "./validation";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 20_000;
/** ~10 minutes of polling for a full 500-position first scan. */
const MAX_POLLS = 200;

export interface VariantScanState {
  status: VariantScanStatus | null;
  /** Submit a scan; returns the job id (null when the submit failed). */
  submit: (uniprot: string, start?: number, end?: number) => Promise<string | null>;
  running: boolean;
  error: string | null;
}

export function useVariantScan(): VariantScanState {
  const [status, setStatus] = useState<VariantScanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobRef.current) return;
    const jobId = jobRef.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    const poll = async () => {
      polls += 1;
      try {
        const snapshot = await apiValidated(`/variants/scan/${encodeURIComponent(jobId)}`, VariantScanStatusSchema, {
          timeoutMs: POLL_TIMEOUT_MS,
        });
        if (cancelled) return;
        setStatus(snapshot);
        if (snapshot.status === "done" || snapshot.status === "error") {
          jobRef.current = null;
          if (snapshot.status === "error") setError(snapshot.detail ?? "The scan failed on the server.");
          return;
        }
        if (polls >= MAX_POLLS) {
          setError(`The scan did not finish within ${((MAX_POLLS * POLL_INTERVAL_MS) / 60_000).toFixed(0)} minutes.`);
          jobRef.current = null;
          return;
        }
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error && e.message ? e.message : "The scan service did not answer.");
        jobRef.current = null;
      }
    };

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status?.job_id]);

  const submit = useCallback(async (uniprot: string, start?: number, end?: number): Promise<string | null> => {
    setError(null);
    setStatus(null);
    try {
      const started = await apiValidated(
        "/variants/scan",
        VariantScanStartResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({ uniprot_id: uniprot.trim().toUpperCase(), ...(start ? { start } : {}), ...(end ? { end } : {}) }),
          timeoutMs: 30_000,
        },
      );
      jobRef.current = started.job_id;
      setStatus({ status: "queued", job_id: started.job_id, uniprot_id: uniprot.trim().toUpperCase(), progress: { scanned: 0, total: 0 }, vep_applied: false } as VariantScanStatus);
      return started.job_id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan could not be started.");
      return null;
    }
  }, []);

  return { status, submit, running: jobRef.current !== null || (status !== null && status.status === "running"), error };
}
