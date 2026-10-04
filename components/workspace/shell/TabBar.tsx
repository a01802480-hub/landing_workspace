"use client";

/**
 * TabBar — multi-tab file management (Benchling pattern). Each loaded
 * structure is a tab; switching tabs never unloads the other models
 * ("zero data loss" — the page keeps every model in its state map).
 * Tabs carry a status dot: pulsing while loading, red on error, dim
 * when ready. Close (×) removes a file; "+ New" opens the loader.
 */

import { X } from "lucide-react";

export interface FileTab {
  id: string;
  label: string;
  kind: "pdb" | "alphafold";
  status: "loading" | "ready" | "error";
}

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: FileTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1.5" role="tablist" aria-label="Open structures">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(tab.id);
              }
            }}
            className={`group flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-300 ease-out ${
              active
                ? "border-glow-violet/50 bg-glow-violet/15 font-medium text-frost"
                : "border-ink-950/15 bg-white/70 text-mist hover:border-ink-950/30 hover:text-frost"
            }`}
          >
            <span aria-hidden className="relative flex h-1.5 w-1.5">
              {tab.status === "loading" && <span className="status-dot status-dot-pulse" />}
              {tab.status === "ready" && <span className="status-dot bg-glow-cyan/70" />}
              {tab.status === "error" && <span className="status-dot bg-[#d03b3b]" />}
            </span>
            <span className="font-mono">{tab.label}</span>
            <span className="text-[9px] tracking-wider text-mist/50 uppercase">{tab.kind === "pdb" ? "PDB" : "AF"}</span>
            <button
              type="button"
              aria-label={`Close ${tab.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="-mr-1 rounded-full p-1 text-mist/50 transition-colors duration-300 ease-out hover:bg-ink-950/10 hover:text-frost"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onNew}
        className="btn-ghost shrink-0 !px-3 !py-1 text-xs"
        aria-label="Load a new structure"
      >
        + New
      </button>
    </div>
  );
}
