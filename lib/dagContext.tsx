"use client";

/**
 * dagContext.tsx — shared polled listing of DAG runs.
 *
 * The TopBar status chip and the ResourceSidebar's runs section both
 * render the latest workflow runs; one provider polls (4 s while a run
 * is active, 15 s otherwise) so the endpoint is hit once per interval.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiValidated } from "./api";
import { DagRunsListSchema, type DagRunSummary } from "./validation";

interface DagRunsState {
  runs: DagRunSummary[];
  refresh: () => void;
}

const DagRunsContext = createContext<DagRunsState | null>(null);

export function DagRunsProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<DagRunSummary[]>([]);

  const refresh = useCallback(() => {
    apiValidated("/dag/runs", DagRunsListSchema)
      .then((r) => setRuns(r.runs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Dense polling while a run is active, sparse otherwise.
  const active = runs.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    const timer = setInterval(refresh, active ? 4_000 : 15_000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const value = useMemo(() => ({ runs, refresh }), [runs, refresh]);
  return <DagRunsContext.Provider value={value}>{children}</DagRunsContext.Provider>;
}

export function useDagRunsLive(): DagRunsState {
  const ctx = useContext(DagRunsContext);
  if (!ctx) throw new Error("useDagRunsLive must be used inside DagRunsProvider.");
  return ctx;
}
