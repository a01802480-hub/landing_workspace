"use client";

/**
 * ResourceSidebar — the IDE's global resource panel (left of the viewport).
 *
 * Lists every imported resource grouped by kind (sequences, raw FASTA
 * records, dataframes), accepts file drops (same parsing pipeline as the
 * DNA FileDropzone), activates a sequence on click, and every row is
 * draggable onto the flow canvas (RESOURCE_DROP_MIME) to spawn an input
 * node. Collapsible, state persisted like the SideRail.
 */
import { useCallback, useState } from "react";
import { ChevronRight, FileText, Orbit, Table2, Trash2, type LucideIcon } from "lucide-react";
import { RESOURCE_DROP_MIME, parseFileToResources, type Resource, type ResourceKind } from "@/lib/resources";
import { usePersistentState } from "@/lib/persistence";
import { useDagRunsLive } from "@/lib/dagContext";
import { useIde } from "@/lib/ide";
import { useWorkspace } from "@/lib/workspaceStore";
import { StatusDot } from "@/components/workspace/shell/StatusDot";

const KIND_META: Record<ResourceKind, { label: string; icon: LucideIcon }> = {
  sequence: { label: "Sequences", icon: Orbit },
  fasta: { label: "FASTA", icon: FileText },
  dataframe: { label: "Dataframes", icon: Table2 },
};

const ORDER: ResourceKind[] = ["sequence", "fasta", "dataframe"];

function metaOf(r: Resource): string {
  if (r.kind === "dataframe" && r.dataframe) {
    return `${r.dataframe.rows.length.toLocaleString()} × ${r.dataframe.columns.length}`;
  }
  if (r.payload) return `${r.payload.seq.length.toLocaleString()} bp`;
  return "session-only";
}

export function ResourceSidebar() {
  const { resources, addResource, removeResource, sequence, setSequence } = useWorkspace();
  const { runs } = useDagRunsLive();
  const { selectTab } = useIde();
  const [expanded, setExpanded] = usePersistentState<boolean>("resources:expanded", true, (v) =>
    typeof v === "boolean" ? v : null,
  );
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      for (const file of Array.from(files)) {
        try {
          const { resources: added, sequence: active } = await parseFileToResources(file);
          for (const r of added) addResource(r);
          if (active) setSequence(active);
        } catch (e) {
          setError(e instanceof Error ? e.message : `${file.name} could not be imported.`);
        }
      }
    },
    [addResource, setSequence],
  );

  return (
    <aside
      className={`glass-card z-20 m-3 mx-0 flex shrink-0 flex-col overflow-hidden rounded-2xl transition-[width] duration-300 ease-out ${
        expanded ? "w-56" : "w-14"
      }`}
      aria-label="Resources"
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropActive(false);
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-2.5 border-b border-ink-950/5 px-3.5 py-4">
        {expanded ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-frost">Resources</span>
            <span className="block text-[9px] tracking-[0.22em] text-mist/60 uppercase">
              {resources.length} imported
            </span>
          </span>
        ) : (
          <span aria-hidden className="mx-auto text-glow-violet" title="Resources">
            <Orbit className="h-5 w-5" strokeWidth={2} />
          </span>
        )}
      </div>

      {expanded && (
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3 transition-colors duration-300 ease-out ${
            dropActive ? "bg-glow-violet/10" : ""
          }`}
        >
          {resources.length === 0 ? (
            <p className="px-2 text-xs leading-relaxed text-mist/60">
              Drop .gb / .dna / .fa / .csv files here — they become sequence, FASTA and
              dataframe resources you can drag onto the flow canvas.
            </p>
          ) : (
            ORDER.map((kind) => {
              const items = resources.filter((r) => r.kind === kind);
              if (items.length === 0) return null;
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              return (
                <div key={kind} className="mb-3">
                  <p className="px-2 pb-1 text-[9px] font-semibold tracking-[0.18em] text-mist/50 uppercase">
                    {meta.label}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((r) => {
                      const isActive = sequence !== null && r.payload !== undefined && r.payload.name === sequence.name && r.payload.seq === sequence.seq;
                      return (
                        <li
                          key={r.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(RESOURCE_DROP_MIME, r.id);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => {
                            if (r.payload) setSequence(r.payload);
                          }}
                          className={`group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-300 ease-out active:cursor-grabbing ${
                            isActive
                              ? "bg-glow-violet/15 font-medium text-frost"
                              : "text-mist hover:bg-ink-950/5 hover:text-frost"
                          }`}
                          title={`${r.name} — drag onto the flow canvas to add an input node`}
                        >
                          <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-glow-violet" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{r.name}</span>
                            <span className="block truncate text-[9px] text-mist/60">{metaOf(r)}</span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${r.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeResource(r.id);
                            }}
                            className="rounded p-0.5 text-mist/40 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 hover:text-[#c13b3b]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
          {error && (
            <p role="alert" className="px-2 text-[10px] leading-relaxed text-[#c13b3b]">
              {error}
            </p>
          )}

          {runs.length > 0 && (
            <div className="mt-2 border-t border-ink-950/5 pt-3">
              <p className="px-2 pb-1 text-[9px] font-semibold tracking-[0.18em] text-mist/50 uppercase">DAG runs</p>
              <ul className="space-y-0.5">
                {runs.slice(0, 5).map((run) => (
                  <li key={run.run_id}>
                    <button
                      type="button"
                      onClick={() => selectTab("flows")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-mist transition-colors duration-300 ease-out hover:bg-ink-950/5 hover:text-frost"
                      title={`${run.name} — ${run.status}`}
                    >
                      <StatusDot
                        className={
                          run.status === "succeeded"
                            ? "bg-[#0ca30c]"
                            : run.status === "failed"
                              ? "bg-[#c13b3b]"
                              : run.status === "running"
                                ? "bg-glow-violet status-dot-pulse"
                                : run.status === "cancelled"
                                  ? "bg-mist/50"
                                  : "bg-mist"
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{run.name}</span>
                      <span className="stat-num shrink-0 text-[9px] text-mist/60">{run.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse resources" : "Expand resources"}
        aria-expanded={expanded}
        className="flex items-center gap-2.5 border-t border-ink-950/5 px-3.5 py-3 text-xs text-mist transition-colors duration-300 ease-out hover:bg-ink-950/5 hover:text-frost"
      >
        <ChevronRight
          aria-hidden
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${expanded ? "rotate-90" : ""}`}
        />
        {expanded && <span>Collapse</span>}
      </button>
    </aside>
  );
}
