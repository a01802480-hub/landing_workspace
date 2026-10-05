"use client";

/**
 * Workspace IDE — the unified, zero-reload tool host.
 *
 * Every tool is a keep-alive tab: its page component mounts on first
 * visit and stays mounted forever (inactive tabs are display:none, never
 * unmounted), so toggling Sequence Map ⇄ Workflow Builder is instant and
 * preserves selection, viewer mode and canvas state. Tool pages are
 * dynamic-imported (ssr:false — they render canvases/webgl and are
 * client-only by design) and each sits under its own Suspense boundary:
 * `crispr` and `pipelines` call useSearchParams(), which requires a
 * boundary under static export or `next build` fails.
 *
 * Split mode renders the dna and flows pages side-by-side in the shared
 * SplitPane (ratio persisted under "ide:split").
 */
import { Suspense, useEffect, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { useIde, type WorkspaceTabId } from "@/lib/ide";
import { OverviewTab } from "@/components/workspace/ide/OverviewTab";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { SplitPane } from "@/components/workspace/shell/SplitPane";
import { ToolTabs } from "@/components/workspace/shell/ToolTabs";

type ToolTabId = Exclude<WorkspaceTabId, "overview">;

const TOOL_VIEWS: Record<ToolTabId, ComponentType> = {
  structure: dynamic(() => import("./structure/page"), { ssr: false }),
  dna: dynamic(() => import("./dna/page"), { ssr: false }),
  crispr: dynamic(() => import("./crispr/page"), { ssr: false }),
  pipelines: dynamic(() => import("./pipelines/page"), { ssr: false }),
  flows: dynamic(() => import("./flows/page"), { ssr: false }),
  interactions: dynamic(() => import("./interactions/page"), { ssr: false }),
  comparative: dynamic(() => import("./comparative/page"), { ssr: false }),
  variants: dynamic(() => import("./variants/page"), { ssr: false }),
};

function TabPanel({ id, active }: { id: WorkspaceTabId; active: boolean }) {
  const View = id === "overview" ? OverviewTab : TOOL_VIEWS[id as ToolTabId];
  return (
    <div
      id={`tab-${id}`}
      role="tabpanel"
      aria-hidden={!active}
      className={active ? "h-full min-h-0" : "hidden"}
    >
      <Suspense fallback={<PanelSkeleton variant="viewer" caption="Mounting tool…" />}>
        <View />
      </Suspense>
    </div>
  );
}

export default function WorkspaceIde() {
  const { activeTab, splitView } = useIde();
  // Keep-alive set: a tab stays mounted forever once first visited.
  const [mounted, setMounted] = useState<WorkspaceTabId[]>(["overview"]);

  useEffect(() => {
    setMounted((prev) => (prev.includes(activeTab) ? prev : [...prev, activeTab]));
  }, [activeTab]);

  useEffect(() => {
    if (!splitView) return;
    setMounted((prev) => {
      if (prev.includes("dna") && prev.includes("flows")) return prev;
      return [...new Set<WorkspaceTabId>([...prev, "dna", "flows"])];
    });
  }, [splitView]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToolTabs />
      <div className="min-h-0 flex-1">
        {splitView ? (
          <SplitPane
            direction="row"
            storageKey="ide:split"
            initial={50}
            minFirst={30}
            minSecond={30}
            className="h-full"
            first={<TabPanel id="dna" active />}
            second={<TabPanel id="flows" active />}
          />
        ) : (
          mounted.map((id) => <TabPanel key={id} id={id} active={id === activeTab} />)
        )}
      </div>
    </div>
  );
}
