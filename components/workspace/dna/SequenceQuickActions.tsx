"use client";

import { useMemo, useState } from "react";
import { Check, CornerDownRight, Dna, ExternalLink, RotateCcw } from "lucide-react";
import { sliceRegion, translateDna, reverseComplement } from "@/lib/sequences";
import { useWorkspace } from "@/lib/workspaceStore";

export function SequenceQuickActions() {
  const { sequence, selection, editSequence, canUndo, canRedo, undo, redo } = useWorkspace();
  const [mutationBase, setMutationBase] = useState("");
  const [mutationAt, setMutationAt] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const selectedSeq = useMemo(() => {
    if (!sequence || !selection) return "";
    return sliceRegion(sequence.seq, selection);
  }, [sequence, selection]);

  const selectedProtein = useMemo(() => (selectedSeq ? translateDna(selectedSeq) : ""), [selectedSeq]);

  if (!sequence || !selection) return null;

  return (
    <section className="glass-card mx-4 mt-2 rounded-xl border border-ink-950/10 px-3 py-2" aria-label="Selection actions">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip text-[10px]">Selection {selection.start.toLocaleString()}–{selection.end.toLocaleString()}</span>
        <button
          type="button"
          onClick={async () => {
            if (!selectedProtein) return;
            await navigator.clipboard.writeText(selectedProtein);
            setNote(`Translated peptide copied (${selectedProtein.length} aa).`);
          }}
          className="btn-ghost inline-flex items-center gap-1.5 !px-2.5 !py-1 text-[10px]"
        >
          <Dna className="h-3.5 w-3.5" /> Translate
        </button>
        <button
          type="button"
          onClick={async () => {
            const rc = reverseComplement(selectedSeq);
            await navigator.clipboard.writeText(rc);
            setNote(`Reverse complement copied (${rc.length} bp).`);
          }}
          className="btn-ghost inline-flex items-center gap-1.5 !px-2.5 !py-1 text-[10px]"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reverse complement
        </button>
        <a
          href={`https://www.ncbi.nlm.nih.gov/nuccore/?term=${encodeURIComponent(selectedSeq.slice(0, 80))}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost inline-flex items-center gap-1.5 !px-2.5 !py-1 text-[10px]"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ortholog search
        </a>
        <a
          href={`https://search.foldseek.com/search?query=${encodeURIComponent(selectedProtein || selectedSeq)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost inline-flex items-center gap-1.5 !px-2.5 !py-1 text-[10px]"
        >
          <CornerDownRight className="h-3.5 w-3.5" /> Send to folding model
        </a>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-mist/70">Mutate base</span>
        <input
          value={mutationAt}
          onChange={(e) => setMutationAt(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="position"
          className="glass-panel w-24 px-2 py-1 text-xs"
        />
        <input
          value={mutationBase}
          onChange={(e) => setMutationBase(e.target.value.toUpperCase().replace(/[^ACGT]/g, "").slice(0, 1))}
          placeholder="A/C/G/T"
          className="glass-panel w-20 px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={async () => {
            const at = Number.parseInt(mutationAt, 10);
            if (!Number.isFinite(at) || at < 1 || at > sequence.seq.length || !mutationBase) {
              setNote("Mutation requires valid position and base.");
              return;
            }
            await editSequence({ kind: "replace", start: at, end: at, text: mutationBase }, `mutated base ${at} to ${mutationBase}`);
            setMutationAt("");
            setMutationBase("");
            setNote(`Mutation applied at ${at}.`);
          }}
          className="btn-primary inline-flex items-center gap-1 !px-2.5 !py-1 text-[10px]"
        >
          <Check className="h-3 w-3" /> Apply mutation
        </button>

        <button type="button" onClick={undo} disabled={!canUndo} className="btn-ghost !px-2.5 !py-1 text-[10px] disabled:opacity-40">
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} className="btn-ghost !px-2.5 !py-1 text-[10px] disabled:opacity-40">
          Redo
        </button>
      </div>
      {note && <p className="mt-1 text-[10px] text-mist/80">{note}</p>}
    </section>
  );
}
