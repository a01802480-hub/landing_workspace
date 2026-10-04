"use client";

/**
 * Panel — the workspace's floating glass module: header row (title, note,
 * actions) + bounded body. Every panel body is wrapped in a PanelBoundary
 * by the caller; this component supplies the consistent chrome.
 */
import type { ReactNode } from "react";

export function Panel({
  title,
  note,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`glass-card flex min-h-0 flex-col overflow-hidden ${className}`} aria-label={title}>
      <header className="flex items-baseline gap-3 border-b border-ink-950/5 px-4 py-2.5">
        <h2 className="shrink-0 text-[11px] font-semibold tracking-[0.14em] text-frost/80 uppercase">{title}</h2>
        {note && <p className="min-w-0 truncate text-[11px] text-mist/60">{note}</p>}
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
