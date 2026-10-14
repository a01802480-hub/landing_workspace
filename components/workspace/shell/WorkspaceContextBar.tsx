"use client";

import { useMemo, useState } from "react";
import { Bot, Search, Sparkles, Waypoints } from "lucide-react";
import { useIde, type WorkspaceTabId } from "@/lib/ide";
import { WORKSPACE_TOOLS } from "@/lib/tools";
import { useWorkspace } from "@/lib/workspaceStore";

type CommandItem =
  | { id: string; label: string; kind: "tool"; tab: WorkspaceTabId }
  | { id: string; label: string; kind: "resource"; tab: WorkspaceTabId; resourceId: string };

const TOOL_ITEMS: CommandItem[] = [
  { id: "tool-overview", label: "Overview", kind: "tool", tab: "overview" },
  ...WORKSPACE_TOOLS.map((tool) => ({
    id: `tool-${tool.href}`,
    label: tool.title,
    kind: "tool" as const,
    tab: tool.href.split("/").pop() as WorkspaceTabId,
  })),
];

export function WorkspaceContextBar() {
  const { activeTab, selectTab } = useIde();
  const { sequence, selection, resources, setSequence } = useWorkspace();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const commandItems = useMemo<CommandItem[]>(() => {
    const resourceItems: CommandItem[] = resources.slice(0, 8).map((r) => ({
      id: `resource-${r.id}`,
      label: r.name,
      kind: "resource",
      tab: "dna",
      resourceId: r.id,
    }));
    const all = [...TOOL_ITEMS, ...resourceItems];
    return q.length === 0 ? all.slice(0, 7) : all.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 7);
  }, [q, resources]);

  return (
    <section className="shrink-0 px-4 pb-2">
      <div className="glass-card flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink-950/10 bg-white/70 px-3 py-1.5">
          <Search aria-hidden className="h-3.5 w-3.5 text-mist/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to tools or resources"
            aria-label="Workspace command search"
            className="min-w-0 flex-1 border-0 bg-transparent text-xs text-frost outline-none placeholder:text-mist/55"
          />
        </div>

        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-glow-violet" />
          {sequence ? `${sequence.name} · ${sequence.seq.length.toLocaleString()} bp` : "No active sequence"}
        </span>
        <span className="chip">
          <Waypoints className="h-3.5 w-3.5 text-glow-violet" />
          {selection ? `${selection.start.toLocaleString()}–${selection.end.toLocaleString()}` : "No selection"}
        </span>
        <span className="chip">
          <Bot className="h-3.5 w-3.5 text-glow-violet" />
          {resources.length.toLocaleString()} resources
        </span>
      </div>

      {commandItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {commandItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.kind === "resource") {
                  const picked = resources.find((r) => r.id === item.resourceId);
                  if (picked?.payload) setSequence(picked.payload);
                }
                selectTab(item.tab);
                setQuery("");
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-300 ease-out ${
                item.kind === "tool" && activeTab === item.tab
                  ? "border-glow-violet/50 bg-glow-violet/15 text-frost"
                  : "border-ink-950/10 bg-white/65 text-mist hover:border-glow-violet/35 hover:text-frost"
              }`}
            >
              {item.kind === "resource" ? `Resource · ${item.label}` : item.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
