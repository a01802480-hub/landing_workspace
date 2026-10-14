"use client";

/**
 * TopBar — the workspace's floating status bar: current tool title,
 * backend health chip, link back to the landing page.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OVERVIEW_META, WORKSPACE_TOOLS } from "@/lib/tools";
import { useDagRunsLive } from "@/lib/dagContext";
import { useIde, type WorkspaceTabId } from "@/lib/ide";
import { usePersistentState } from "@/lib/persistence";
import { HealthChip } from "./HealthChip";
import { StatusDot } from "./StatusDot";

/** Path → title/note lookup, derived from the single tool registry. */
const TITLES: Record<string, { title: string; note: string }> = Object.fromEntries([
  ["/workspace", OVERVIEW_META],
  ...WORKSPACE_TOOLS.map((t) => [t.href, { title: t.title, note: t.note }] as const),
]);

/** Tab id → title/note for the IDE route (the active tab owns the title). */
const TAB_TITLES: Record<WorkspaceTabId, { title: string; note: string }> = Object.fromEntries([
  ["overview", OVERVIEW_META],
  ...WORKSPACE_TOOLS.map((t) => [t.href.split("/").pop() as WorkspaceTabId, { title: t.title, note: t.note }] as const),
]) as Record<WorkspaceTabId, { title: string; note: string }>;

export function TopBar() {
  const pathname = usePathname();
  const { activeTab, splitView, selectTab } = useIde();
  const { runs } = useDagRunsLive();
  const [workspaceTitle, setWorkspaceTitle] = usePersistentState<string>(
    "workspace:title",
    "Genome Design Workspace",
    (v) => (typeof v === "string" ? v.slice(0, 80) : null),
  );
  const meta = pathname === "/workspace" ? TAB_TITLES[activeTab] : (TITLES[pathname] ?? TITLES["/workspace"]);
  const latest = runs[0];
  const running = latest && (latest.status === "queued" || latest.status === "running");
  return (
    <header className="flex shrink-0 items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <input
          value={workspaceTitle}
          onChange={(e) => setWorkspaceTitle(e.target.value)}
          className="w-full max-w-sm rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold tracking-tight text-frost transition-colors duration-300 ease-out outline-none hover:border-ink-950/10 focus:border-glow-violet/35"
          aria-label="Workspace title"
        />
        <p className="truncate text-[11px] text-mist/65">
          {splitView ? "Sequence Map + Workflow · linked editing context" : `${meta.title} · ${meta.note}`}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {running && (
          <Link
            href="/workspace#flows"
            scroll={false}
            onClick={() => selectTab("flows")}
            className="chip inline-flex items-center gap-1.5 border-glow-violet/40 transition-colors duration-300 ease-out hover:text-frost"
            title={latest!.name}
          >
            <StatusDot className="status-dot-pulse bg-glow-violet" />            workflow {latest!.status}
          </Link>
        )}
        <HealthChip />
        <Link
          href="/"
          className="chip inline-flex items-center gap-1.5 transition-colors duration-300 ease-out hover:border-ink-950/30 hover:text-frost"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Landing
        </Link>
      </div>
    </header>
  );
}
