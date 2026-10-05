"use client";

/**
 * ide.tsx — the unified IDE's tab state (hash-routed, keep-alive safe).
 *
 * The workspace hub (/workspace) hosts every tool as a lazily-mounted,
 * never-unmounted tab, so toggling Sequence Map ⇄ Workflow Builder is
 * instant and loses no state. The active tab lives in the URL hash
 * (/workspace#dna): browser back/forward, deep links and refreshes all
 * work with zero Next-router involvement (static-export safe — no
 * useSearchParams, no route-level Suspense requirements).
 *
 * The hash is adopted only after hydration (the initial render always
 * shows "overview"), which avoids prerender/hydration divergence under
 * `output: "export"`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { WORKSPACE_TOOLS } from "@/lib/tools";

export type WorkspaceTabId =
  | "overview"
  | "structure"
  | "dna"
  | "crispr"
  | "pipelines"
  | "flows"
  | "interactions"
  | "comparative"
  | "variants";

/** The tab ids derive from the tool registry — one place to add a tool. */
const TAB_IDS: WorkspaceTabId[] = [
  "overview",
  ...WORKSPACE_TOOLS.map((t) => t.href.split("/").pop() as WorkspaceTabId),
];

interface IdeState {
  activeTab: WorkspaceTabId;
  selectTab: (id: WorkspaceTabId) => void;
  /** DNA + Flow builder rendered side-by-side in a resizable split pane. */
  splitView: boolean;
  setSplitView: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const IdeContext = createContext<IdeState | null>(null);

/** Read + validate the hash — invalid/absent hashes fall back to overview. */
function readHash(): WorkspaceTabId {
  if (typeof window === "undefined") return "overview";
  const raw = window.location.hash.replace(/^#/, "");
  return (TAB_IDS as string[]).includes(raw) ? (raw as WorkspaceTabId) : "overview";
}

export function IdeProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("overview");
  const [splitView, setSplitView] = useState(false);

  useEffect(() => {
    // Adopt the hash after hydration, then track every way it can change:
    // - `hashchange` fires for location.hash assignment + history traversal
    // - `popstate` fires for back/forward through pushState entries
    //   (Next's <Link> hash navigation uses pushState, which fires NOTHING —
    //   those call sites invoke selectTab directly instead)
    const sync = () => setActiveTab(readHash());
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const selectTab = useCallback((id: WorkspaceTabId) => {
    setActiveTab(id);
    if (typeof window !== "undefined" && window.location.hash !== `#${id}`) {
      window.location.hash = id; // back/forward works; hashchange re-confirms
    }
  }, []);

  // Hidden tabs keep seqviz / React Flow canvases at display:none; a
  // synthetic resize wakes them when their tab becomes visible again.
  useEffect(() => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("resize"));
  }, [activeTab]);

  const value = useMemo(
    () => ({ activeTab, selectTab, splitView, setSplitView }),
    [activeTab, selectTab, splitView],
  );

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>;
}

export function useIde(): IdeState {
  const ctx = useContext(IdeContext);
  if (!ctx) throw new Error("useIde must be used inside IdeProvider.");
  return ctx;
}
