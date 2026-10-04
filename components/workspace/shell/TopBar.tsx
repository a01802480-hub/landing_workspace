"use client";

/**
 * TopBar — the workspace's floating status bar: current tool title,
 * backend health chip, link back to the landing page.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OVERVIEW_META, WORKSPACE_TOOLS } from "@/lib/tools";
import { HealthChip } from "./HealthChip";

/** Path → title/note lookup, derived from the single tool registry. */
const TITLES: Record<string, { title: string; note: string }> = Object.fromEntries([
  ["/workspace", OVERVIEW_META],
  ...WORKSPACE_TOOLS.map((t) => [t.href, { title: t.title, note: t.note }] as const),
]);

export function TopBar() {
  const pathname = usePathname();
  const meta = TITLES[pathname] ?? TITLES["/workspace"];
  return (
    <header className="flex shrink-0 items-center gap-3 px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight text-frost">{meta.title}</h1>
      <span aria-hidden className="hidden text-mist/30 sm:inline">·</span>
      <p className="hidden text-xs text-mist/60 sm:block">{meta.note}</p>
      <div className="ml-auto flex items-center gap-2">
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
