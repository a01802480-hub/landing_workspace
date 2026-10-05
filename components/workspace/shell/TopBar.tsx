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
  const meta = pathname === "/workspace" ? TAB_TITLES[activeTab] : (TITLES[pathname] ?? TITLES["/workspace"]);
  const latest = runs[0];
  const running = latest && (latest.status === "queued" || latest.status === "running");
  return (
    <header className="flex shrink-0 items-center gap-3 px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight text-frost">
        {splitView ? "Sequence Map + Workflow" : meta.title}
      </h1>
      <span aria-hidden className="hidden text-mist/30 sm:inline">·</span>
      <p className="hidden text-xs text-mist/60 sm:block">
        {splitView ? "split view — selection and canvas state stay in sync" : meta.note}
      </p>
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
