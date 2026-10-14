"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Dna, Minus, Plus, Protein, Table2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspaceStore";
import { detectOrfs, reverseComplement } from "@/lib/sequences";
import { useFreeWorkspace, type BioBlockType } from "@/lib/freeWorkspaceStore";

const BLOCK_OPTIONS: { type: BioBlockType; label: string; icon: typeof Dna }[] = [
  { type: "notes", label: "Notes", icon: Plus },
  { type: "sequence", label: "Sequence viewer", icon: Dna },
  { type: "alignment", label: "Alignment table", icon: Table2 },
  { type: "protein", label: "3D protein", icon: Protein },
];

export function BioWorkspaceCanvas() {
  const { sequence, resources } = useWorkspace();
  const { blocks, addBlock, updateBlock, removeBlock, moveBlock } = useFreeWorkspace();
  const [slash, setSlash] = useState("");

  const slashOptions = useMemo(() => {
    const q = slash.trim().toLowerCase().replace(/^\//, "");
    if (!q) return BLOCK_OPTIONS;
    return BLOCK_OPTIONS.filter((option) => option.label.toLowerCase().includes(q) || option.type.includes(q));
  }, [slash]);

  const sequenceOrfs = useMemo(() => (sequence ? detectOrfs(sequence.seq, 20).slice(0, 5) : []), [sequence]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4">
      <div className="glass-card flex flex-wrap items-center gap-2 p-3">
        <input
          value={slash}
          onChange={(e) => setSlash(e.target.value)}
          placeholder="Type / to insert biological blocks"
          aria-label="Slash command"
          className="glass-panel min-w-[280px] flex-1 rounded-lg px-3 py-2 text-sm text-frost placeholder:text-mist/45 focus:border-glow-violet/45 focus:outline-none"
        />
        {BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="chip inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {slash.startsWith("/") && slashOptions.length > 0 && (
        <div className="glass-card flex flex-wrap gap-1.5 p-2">
          {slashOptions.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                addBlock(type);
                setSlash("");
              }}
              className="rounded-md border border-ink-950/10 bg-white/70 px-2.5 py-1 text-xs text-mist transition-colors duration-300 ease-out hover:border-glow-violet/35 hover:text-frost"
            >
              /{type} · {label}
            </button>
          ))}
        </div>
      )}

      {blocks.map((block) => (
        <article key={block.id} className="glass-card p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <input
              value={block.title}
              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-frost outline-none"
              aria-label="Block title"
            />
            <button type="button" onClick={() => moveBlock(block.id, -1)} className="chip !p-1" aria-label="Move block up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => moveBlock(block.id, 1)} className="chip !p-1" aria-label="Move block down">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => removeBlock(block.id)} className="chip !p-1" aria-label="Remove block">
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>

          {block.type === "notes" && (
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              placeholder="Write your hypothesis, experiment notes, and conclusions…"
              className="min-h-28 w-full resize-y rounded-lg border border-ink-950/10 bg-white/70 px-3 py-2 text-sm text-frost placeholder:text-mist/45 outline-none focus:border-glow-violet/45"
            />
          )}

          {block.type === "sequence" && (
            <div className="space-y-2 text-xs text-mist">
              {sequence ? (
                <>
                  <p>
                    <span className="font-semibold text-frost">{sequence.name}</span> · {sequence.seq.length.toLocaleString()} bp · {sequence.metadata?.topology ?? (sequence.circular ? "circular" : "linear")}
                  </p>
                  <p>
                    Annotation layers: {Array.from(new Set(sequence.features.map((f) => f.type))).slice(0, 6).join(", ") || "none"}
                  </p>
                  <p className="font-mono text-[11px] text-frost/80">Reverse complement preview: {reverseComplement(sequence.seq.slice(0, 36))}…</p>
                  <div>
                    <p className="mb-1 text-[10px] tracking-[0.16em] uppercase">Detected ORFs</p>
                    {sequenceOrfs.length ? (
                      <ul className="space-y-1">
                        {sequenceOrfs.map((orf) => (
                          <li key={`${orf.strand}:${orf.frame}:${orf.start}:${orf.end}`} className="rounded-md border border-ink-950/10 bg-white/60 px-2 py-1">
                            strand {orf.strand === 1 ? "+" : "-"} · frame {orf.frame} · {orf.start.toLocaleString()}–{orf.end.toLocaleString()} · {orf.aaLength} aa
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No ORFs above threshold.</p>
                    )}
                  </div>
                </>
              ) : (
                <p>Load or drop a sequence to populate this block.</p>
              )}
            </div>
          )}

          {block.type === "alignment" && (
            <div className="text-xs text-mist">
              <p className="mb-2">Alignment-ready sequence resources ({resources.filter((r) => r.payload).length})</p>
              <div className="grid gap-1">
                {resources.filter((r) => r.payload).slice(0, 6).map((r) => (
                  <div key={r.id} className="rounded-md border border-ink-950/10 bg-white/60 px-2 py-1">
                    {r.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.type === "protein" && (
            <div className="rounded-md border border-ink-950/10 bg-white/60 p-2 text-xs text-mist">
              <p>Send current selection or translated peptide to folding models (AlphaFold/ESMFold handoff).</p>
              <p className="mt-1 text-frost/80">Block-ready: plug into your structure tab or external model endpoint.</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
