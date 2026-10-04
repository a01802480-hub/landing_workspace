"use client";

/**
 * Flow builder — the ProtoFlow-style visual pipeline canvas.
 *
 * Layout: canvas fills the viewport (React Flow owns its own scroll),
 * right rail carries the draggable node palette and the inspector for the
 * selected node. Running a tool node navigates to its workspace with the
 * store's sequence/selection carried in the URL — the bridge defined in
 * objective 5 of the architecture brief.
 */
import { useCallback, useState } from "react";
import Link from "next/link";
import { Orbit, Play, Scissors, Workflow } from "lucide-react";
import { DROP_MIME, FlowCanvas } from "@/components/flows/FlowCanvas";
import { TOOL_NODE_CATALOG, type FlowToolId } from "@/lib/flows";
import { useWorkspace } from "@/lib/workspaceStore";

export default function FlowsPage() {
  const { sequence, selection } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const selectedTool = selectedId ? TOOL_NODE_CATALOG.find((t) => t.tool === selectedId.split("-")[0] as FlowToolId) : undefined;
  const draft = selectedId ? (drafts[selectedId] ?? {}) : {};

  const setDraft = (key: string, value: string) => {
    if (!selectedId) return;
    setDrafts((prev) => ({ ...prev, [selectedId]: { ...(prev[selectedId] ?? {}), [key]: value } }));
  };

  const runTarget = useCallback((): string | null => {
    if (!selectedId || !selectedTool) return null;
    const tool = selectedTool.tool;
    if (tool === "nextflow") {
      const pipeline = draft.pipeline || TOOL_NODE_CATALOG[3].defaults.pipeline;
      return `/workspace/pipelines?run=${encodeURIComponent(pipeline)}`;
    }
    const params = new URLSearchParams({ tool });
    if (selection) {
      params.set("start", String(selection.start));
      params.set("end", String(selection.end));
    }
    return `/workspace/crispr?${params.toString()}`;
  }, [selectedId, selectedTool, draft, selection]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Compact header ────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-frost">Flow builder</h1>
          <p className="text-[10px] text-mist/60">
            drag nodes from the palette · connect the sequence to the engines · select a node to configure & run
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {sequence ? (
            <span className="chip">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#0ca30c]" />
              {sequence.name} · {sequence.seq.length.toLocaleString()} bp
              {selection ? ` · ${selection.start}–${selection.end}` : ""}
            </span>
          ) : (
            <span className="chip">
              no sequence —{" "}
              <Link href="/workspace/dna" className="underline underline-offset-2 hover:text-frost">
                load one
              </Link>
            </span>
          )}
        </div>
      </div>

      {/* ── Canvas + right rail ───────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px] gap-3 px-4 pb-3">
        <section className="glass-card min-h-0 overflow-hidden" aria-label="Pipeline canvas">
          <FlowCanvas onSelectNode={setSelectedId} paramUpdates={drafts} />
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {/* Palette */}
          <div className="glass-card shrink-0 p-4">
            <h2 className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-mist/60 uppercase">Node palette</h2>
            <div className="flex flex-col gap-2">
              <PaletteItem label="Sequence Node" hint="the workspace sequence" icon={Orbit} kind="sequence" />
              {TOOL_NODE_CATALOG.map((t) => (
                <PaletteItem
                  key={t.tool}
                  label={t.label}
                  hint={t.tool === "nextflow" ? "launch a pipeline" : "design guides"}
                  icon={t.tool === "nextflow" ? Workflow : Scissors}
                  kind={t.tool}
                />
              ))}
            </div>
            <p className="mt-3 text-[9px] leading-relaxed text-mist/50">
              one Sequence Node per canvas — every tool node connected to it receives the
              current selection.
            </p>
          </div>

          {/* Inspector */}
          <div className="glass-card min-h-0 flex-1 p-4">
            <h2 className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-mist/60 uppercase">Inspector</h2>
            {!selectedId ? (
              <p className="text-xs leading-relaxed text-mist/70">
                Click a node to configure it. Tool nodes run against the sequence in the
                workspace store — the same one the DNA viewer shows.
              </p>
            ) : !selectedTool ? (
              <p className="text-xs leading-relaxed text-mist/70">
                Sequence Node — reads the workspace store. Select a region in the{" "}
                <Link href="/workspace/dna" className="text-glow-violet underline underline-offset-2 hover:text-frost">
                  DNA workspace
                </Link>{" "}
                to scope what the tools receive.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-frost">{selectedTool.label}</p>
                <p className="text-[10px] leading-relaxed text-mist/70">{selectedTool.hint}</p>
                {Object.keys(selectedTool.defaults).map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] tracking-wide text-mist/60 uppercase">{key}</span>
                    <input
                      value={draft[key] ?? ""}
                      onChange={(e) => setDraft(key, e.target.value)}
                      placeholder={selectedTool.defaults[key]}
                      className="glass-panel min-w-0 flex-1 px-2.5 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
                      aria-label={key}
                    />
                  </label>
                ))}
                <p className="stat-num text-[9px] text-mist/60">
                  receives: {sequence ? `${sequence.name}${selection ? ` · region ${selection.start}–${selection.end}` : " · whole sequence"}` : "no sequence loaded"}
                </p>
                <Link href={runTarget() ?? "#"} aria-disabled={!sequence} className="btn-primary inline-flex items-center justify-center gap-1.5 !px-3 !py-1.5 text-xs disabled:opacity-50">
                  <Play className="h-3.5 w-3.5" /> Run {selectedTool.label}
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PaletteItem({
  label,
  hint,
  icon: Icon,
  kind,
}: {
  label: string;
  hint: string;
  icon: typeof Orbit;
  kind: string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DROP_MIME, kind);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex cursor-grab items-center gap-2.5 rounded-lg border border-ink-950/10 bg-white/70 px-3 py-2 transition-colors duration-300 ease-out hover:border-glow-violet/40 hover:bg-glow-violet/5 active:cursor-grabbing"
      title={`Drag onto the canvas: ${hint}`}
    >
      <span aria-hidden className="text-glow-violet">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-frost">{label}</span>
        <span className="block truncate text-[9px] text-mist/60">{hint}</span>
      </span>
    </div>
  );
}
