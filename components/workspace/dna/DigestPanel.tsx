"use client";

/**
 * DigestPanel — virtual restriction digest + gel against the EDITED
 * workspace sequence (the lab's gel simulation relocated here, where it
 * verifies the actual construct). Fragment math is client-side: enzyme
 * motifs + cut offsets from the backend catalog, cuts from lib/enzymes,
 * fragment sizes from lib/dna.digestFragments. "Record digest
 * verification" writes a no-op entry into the provenance audit log —
 * the researcher's record that the construct was checked.
 */
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { digestFragments } from "@/lib/dna";
import { loadEnzymeCatalog, cutsForEnzymes, type EnzymeDef } from "@/lib/enzymes";
import { useWorkspace } from "@/lib/workspaceStore";
import { GelSimulation } from "@/components/workspace/dna/GelSimulation";

export function DigestPanel() {
  const { sequence, recordAuditNote, editing } = useWorkspace();
  const [catalog, setCatalog] = useState<EnzymeDef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(["EcoRI"]));
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    loadEnzymeCatalog().then(setCatalog).catch(() => {});
  }, []);

  const cuts = useMemo(() => {
    if (!sequence) return [];
    return cutsForEnzymes(sequence.seq, sequence.circular, catalog, [...selected]);
  }, [sequence, catalog, selected]);

  const fragments = useMemo(() => {
    if (!sequence || cuts.length === 0) return [];
    return digestFragments(sequence.seq.length, cuts, sequence.circular ? "circular" : "linear");
  }, [sequence, cuts]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const record = async () => {
    if (!sequence) return;
    const enzymeList = [...selected].sort().join(" + ");
    const summary =
      fragments.length > 0
        ? `digest verified: ${enzymeList} → ${fragments.length} fragment${fragments.length === 1 ? "" : "s"} (${fragments
            .map((f) => f.toLocaleString())
            .join(" / ")} bp)`
        : `digest verified: ${enzymeList} → no cuts in ${sequence.name}`;
    await recordAuditNote("digest", summary);
    setNote(summary);
  };

  if (!sequence) {
    return <p className="p-3 text-xs leading-relaxed text-mist/70">Load a sequence to digest it.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-frost">Digest &amp; gel</h3>
        <span className="stat-num text-[9px] text-mist/60">
          {cuts.length} cut{cuts.length === 1 ? "" : "s"} · {fragments.length} fragment{fragments.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {catalog.map((enzyme) => (
          <button
            key={enzyme.name}
            type="button"
            onClick={() => toggle(enzyme.name)}
            aria-pressed={selected.has(enzyme.name)}
            className={`chip !py-0.5 text-[9px] transition-colors duration-300 ease-out ${
              selected.has(enzyme.name) ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
            }`}
            title={`${enzyme.motif} · cuts at ${enzyme.cut}`}
          >
            {enzyme.name}
          </button>
        ))}
      </div>

      {fragments.length > 0 ? (
        <>
          <div className="min-h-40 overflow-hidden rounded-lg border border-ink-950/10 bg-white/70">
            <GelSimulation fragments={fragments} />
          </div>
          <ul className="flex flex-col gap-1">
            {fragments.map((size, i) => (
              <li key={i} className="stat-num flex items-center justify-between rounded px-2 py-1 text-[10px] text-mist/80 odd:bg-ink-950/[0.03]">
                <span>band {i + 1}</span>
                <span className="font-mono">{size.toLocaleString()} bp</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-lg border border-ink-950/10 bg-white/60 p-2.5 text-[10px] leading-relaxed text-mist/70">
          {cuts.length === 0
            ? "None of the selected enzymes cut this sequence."
            : "A single cut in a circular sequence produces one fragment the length of the whole plasmid."}
        </p>
      )}

      <button
        type="button"
        onClick={() => void record()}
        disabled={editing}
        className="btn-primary inline-flex items-center justify-center gap-1.5 !px-3 !py-1.5 text-[11px] disabled:opacity-40"
      >
        <Check className="h-3.5 w-3.5" /> Record digest verification
      </button>
      {note && <p className="text-[9px] leading-relaxed text-[#0ca30c]">{note} — added to the history</p>}
    </div>
  );
}
