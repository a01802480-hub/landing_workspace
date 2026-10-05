"use client";

/**
 * ToolTabs — the IDE's instant-tool-switch pill strip (Benchling-style).
 *
 * One pill per tool + Overview. Tabs are keep-alive (the host mounts each
 * page on first visit and never unmounts it), so switching is a pure CSS
 * visibility flip — no reload, no state loss. The split toggle renders
 * Sequence Map and Workflow Builder side-by-side in a resizable pane.
 */
import { Columns2, LayoutGrid, type LucideIcon } from "lucide-react";
import { useIde, type WorkspaceTabId } from "@/lib/ide";
import { WORKSPACE_TOOLS } from "@/lib/tools";

interface TabPill {
  id: WorkspaceTabId;
  label: string;
  icon: LucideIcon;
}

const PILLS: TabPill[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  ...WORKSPACE_TOOLS.map((t) => ({
    id: t.href.split("/").pop() as WorkspaceTabId,
    label: t.label,
    icon: t.icon,
  })),
];

export function ToolTabs() {
  const { activeTab, selectTab, splitView, setSplitView } = useIde();

  const pick = (id: WorkspaceTabId) => {
    setSplitView(false);
    selectTab(id);
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-ink-950/5 px-3 py-1.5" role="tablist" aria-label="Workspace tools">
      {PILLS.map((pill) => {
        const active = splitView
          ? pill.id === "dna" || pill.id === "flows"
          : pill.id === activeTab;
        const Icon = pill.icon;
        return (
          <button
            key={pill.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`tab-${pill.id}`}
            onClick={() => pick(pill.id)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-300 ease-out ${
              active
                ? "border-glow-violet/50 bg-glow-violet/15 font-medium text-frost"
                : "border-transparent text-mist hover:bg-ink-950/5 hover:text-frost"
            }`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {pill.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setSplitView((v) => !v)}
        aria-pressed={splitView}
        title={splitView ? "Exit split view" : "Split: Sequence Map + Workflow Builder"}
        className={`ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-300 ease-out ${
          splitView
            ? "border-glow-violet/50 bg-glow-violet/15 font-medium text-frost"
            : "border-ink-950/10 bg-white/70 text-mist hover:border-ink-950/30 hover:text-frost"
        }`}
      >
        <Columns2 aria-hidden className="h-3.5 w-3.5" />
        {splitView ? "Exit split" : "Split"}
      </button>
    </div>
  );
}
