"use client";

/**
 * PlasmidBuilder — the Benchling-style assembly surface.
 *
 * Pick a blueprint (a part list), change ANY part (locked parts are
 * real published sequences but can still be unlocked/edited — the
 * blueprint is a starting point, not a cage), then either insert the
 * assembly into the workspace sequence at a position or replace it.
 * Assembly goes through store.editSequence, so the audit log replays it
 * like any other edit, and the result registers as a resource (a flow
 * builder input). A pending guide from the CRISPR workspace (spacer +
 * PAM + strand) prefills the spacer part.
 */
import { useEffect, useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { assembleBlueprint, blueprintParts, takePendingGuide, type PlasmidBlueprint, type PlasmidPart } from "@/lib/plasmid";
import { makeResource } from "@/lib/resources";
import { useWorkspace } from "@/lib/workspaceStore";

type Mode = "insert" | "replace" | "new";

export function PlasmidBuilder() {
  const { sequence, editSequence, setSequence, addResource, editing } = useWorkspace();
  const [blueprintId, setBlueprintId] = useState("grna-u6");
  const [parts, setParts] = useState<PlasmidPart[]>([]);
  const [mode, setMode] = useState<Mode>("new");
  const [insertAt, setInsertAt] = useState<string>("");
  const [name, setName] = useState<string>("designed plasmid");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const blueprints = useMemo(blueprintParts, []);

  // Parts for a blueprint, with the backbone prefilled from the workspace
  // sequence when it is circular.
  const partsForBlueprint = (bp: PlasmidBlueprint, current: typeof sequence): PlasmidPart[] =>
    bp.parts.map((p) =>
      p.id === "backbone"
        ? {
            ...p,
            seq: current?.circular ? current.seq : "",
            note: current?.circular
              ? `current workspace sequence (${current.name}, ${current.seq.length.toLocaleString()} bp)`
              : "no circular workspace sequence — paste your vector backbone",
          }
        : { ...p, seq: p.seq, note: p.note },
    );

  // Adopt a pending CRISPR guide → gRNA blueprint + spacer filled.
  // (Runs when the builder mounts — visit the Plasmid tab after
  // "Design plasmid with this guide".)
  useEffect(() => {
    const pending = takePendingGuide();
    if (!pending) return;
    setBlueprintId("grna-u6");
    const bp = blueprints.find((b) => b.id === "grna-u6");
    if (!bp) return;
    setParts((prev) => {
      const base = prev.length > 0 ? prev : partsForBlueprint(bp, sequence);
      return base.map((p) =>
        p.id === "spacer"
          ? {
              ...p,
              seq: pending.spacer,
              note: `PAM ${pending.pam} · ${pending.strand} strand · from guide ${pending.spacerStart.toLocaleString()}–${pending.spacerEnd.toLocaleString()}${pending.gene ? ` (${pending.gene})` : ""}`,
            }
          : p,
      );
    });
    setNote(`guide ${pending.spacer} loaded from CRISPR — edit anything, then assemble`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selecting a blueprint replaces the part list.
  const selectBlueprint = (bp: PlasmidBlueprint) => {
    setBlueprintId(bp.id);
    setParts(partsForBlueprint(bp, sequence));
    setError(null);
  };

  const setPartSeq = (id: string, seq: string) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, seq: seq.replace(/\s+/g, "").toUpperCase() } : p)));
  };

  const toggleLock = (id: string) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p)));
  };

  const addCustomPart = () => {
    setParts((prev) => [...prev, { id: `part-${Date.now()}`, name: `part ${prev.length + 1}`, role: "custom", seq: "" }]);
  };

  const removePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
  };

  const assembled = useMemo(() => {
    const bp = blueprints.find((b) => b.id === blueprintId);
    if (!bp) return null;
    return assembleBlueprint(name.trim() || "designed plasmid", bp.circular, parts);
  }, [blueprints, blueprintId, parts, name]);

  const totalBp = assembled?.seq.length ?? 0;
  const hasNs = /N/.test(assembled?.seq ?? "");

  const build = async () => {
    if (!assembled) return;
    if (assembled.seq.length === 0) {
      setError("The assembly is empty — add at least one part with sequence.");
      return;
    }
    if (hasNs) {
      setError("The spacer still contains N placeholders — paste the real 20-nt guide spacer.");
      return;
    }
    const summary = `assembled "${name.trim()}" (${parts.filter((p) => p.seq).map((p) => p.name).join(" + ")})`;
    setError(null);
    try {
      if (mode === "new" || !sequence) {
        const circular = blueprints.find((b) => b.id === blueprintId)?.circular ?? true;
        setSequence({
          name: name.trim() || "designed plasmid",
          seq: assembled.seq,
          circular,
          annotations: assembled.annotations,
          features: assembled.features,
          enzymes: [],
          source: "file",
          description: summary,
          revision: 0,
        });
        addResource(
          makeResource("sequence", name.trim() || "designed plasmid", {
            payload: {
              name: name.trim() || "designed plasmid",
              seq: assembled.seq,
              circular,
              annotations: assembled.annotations,
              features: assembled.features,
              enzymes: [],
              source: "file",
              description: summary,
              revision: 0,
            },
          }),
        );
        setNote(`assembled ${totalBp.toLocaleString()} bp — now the workspace sequence (revision 0)`);
        return;
      }
      if (mode === "replace") {
        await editSequence({ kind: "replace", start: 1, end: sequence.seq.length, text: assembled.seq }, summary);
      } else {
        const at = parseInt(insertAt, 10);
        if (!Number.isFinite(at) || at < 1 || at > sequence.seq.length + 1) {
          setError("Insert position must be 1…" + (sequence.seq.length + 1).toLocaleString() + ".");
          return;
        }
        await editSequence({ kind: "insert", at, text: assembled.seq }, summary);
      }
      setNote(`assembled ${totalBp.toLocaleString()} bp into the workspace sequence`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assembly could not be applied.");
    }
  };

  const bp = blueprints.find((b) => b.id === blueprintId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-frost">Plasmid builder</h3>
        <span className="stat-num text-[9px] text-mist/60">{totalBp.toLocaleString()} bp</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {blueprints.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => selectBlueprint(b)}
            className={`rounded-lg border px-2.5 py-1.5 text-left text-[10px] transition-colors duration-300 ease-out ${
              blueprintId === b.id
                ? "border-glow-violet/50 bg-glow-violet/15 text-frost"
                : "border-ink-950/10 bg-white/70 text-mist hover:border-glow-violet/40 hover:text-frost"
            }`}
          >
            <span className="block font-medium">{b.name}</span>
            <span className="block text-[9px] text-mist/60">{b.description}</span>
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Plasmid name"
        placeholder="plasmid name"
        className="glass-panel px-2.5 py-1.5 text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
      />

      <div className="flex flex-col gap-2">
        {parts.map((part) => (
          <div key={part.id} className="rounded-lg border border-ink-950/10 bg-white/60 p-2">
            <div className="flex items-center gap-2">
              <span className="chip !py-0.5 text-[9px]">{part.role}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-frost">{part.name}</span>
              <button
                type="button"
                onClick={() => toggleLock(part.id)}
                title={part.locked ? "unlock to edit" : "lock"}
                className={`rounded p-0.5 text-mist/50 transition-colors duration-300 ease-out hover:text-frost ${part.locked ? "text-glow-violet" : ""}`}
              >
                <Wrench className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => removePart(part.id)}
                aria-label={`Remove ${part.name}`}
                className="rounded p-0.5 text-mist/50 transition-colors duration-300 ease-out hover:text-[#c13b3b]"
              >
                ×
              </button>
            </div>
            {part.note && <p className="mt-1 text-[9px] leading-relaxed text-mist/60">{part.note}</p>}
            {part.locked ? (
              <p className="mt-1 truncate font-mono text-[9px] text-mist/60" title={part.seq}>
                {part.seq} <span className="text-mist/40">({part.seq.length} bp · locked)</span>
              </p>
            ) : (
              <textarea
                value={part.seq}
                onChange={(e) => setPartSeq(part.id, e.target.value)}
                rows={2}
                aria-label={`Part sequence: ${part.name}`}
                className="glass-panel mt-1 w-full resize-y px-2 py-1 font-mono text-[10px] leading-relaxed text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
                placeholder="paste the part sequence"
              />
            )}
          </div>
        ))}
        <button type="button" onClick={addCustomPart} className="btn-ghost self-start !px-2.5 !py-1 text-[10px]">
          + add part
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-950/10 bg-white/60 p-2">
        <span className="text-[9px] tracking-wide text-mist/60 uppercase">Land as</span>
        {(
          [
            { id: "new", label: "New sequence" },
            { id: "insert", label: "Insert into workspace" },
            { id: "replace", label: "Replace workspace" },
          ] as { id: Mode; label: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`chip !py-0.5 text-[9px] transition-colors duration-300 ease-out ${
              mode === m.id ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
            }`}
          >
            {m.label}
          </button>
        ))}
        {mode === "insert" && (
          <input
            value={insertAt}
            onChange={(e) => setInsertAt(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={sequence ? String(sequence.seq.length + 1) : "1"}
            aria-label="Assembly insert position"
            className="glass-panel w-20 px-2 py-1 font-mono text-[10px] text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => void build()}
        disabled={editing}
        className="btn-primary !px-3 !py-1.5 text-[11px] disabled:opacity-40"
      >
        {editing ? "Assembling…" : `Assemble (${totalBp.toLocaleString()} bp)`}
      </button>

      {error && (
        <p role="alert" className="text-[10px] leading-relaxed text-[#c13b3b]">
          {error}
        </p>
      )}
      {note && <p className="text-[10px] leading-relaxed text-[#0ca30c]">{note}</p>}
      {bp && assembled && assembled.annotations.length > 0 && (
        <p className="text-[9px] leading-relaxed text-mist/60">
          annotations: {assembled.annotations.map((a) => `${a.name} (${a.start.toLocaleString()}–${a.end.toLocaleString()})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
