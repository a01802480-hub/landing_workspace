"use client";

/**
 * SequenceEditor — the Benchling-style free letter editor.
 *
 * Layout: a left ruler column (50 bp lines, line numbers) next to a
 * per-base colored backdrop (BASE_COLORS, tick every 10th base), with a
 * textarea over the backdrop. The textarea holds the RAW draft while
 * focused (caret math is exact — the position readout is selectionStart);
 * on blur (or after Apply/Reset) the display re-chunks into 50 bp lines
 * so the ruler and ticks stay aligned. The backdrop re-renders only when
 * the draft is committed/unchunked — typing never remounts it.
 *
 * Apply diffs the draft against the applied sequence (common prefix/
 * suffix trim) into ONE replace op → store.editSequence → audit log.
 * Sequences above EDIT_CAP hide the editor and keep the selection-based
 * quick ops (delete selection / insert at position), which work at any
 * length.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw, Scissors } from "lucide-react";
import { BASE_COLORS } from "@/lib/dna";
import { fmt } from "@/lib/format";
import { gcPercent, meltingTemp, type SequenceSelection } from "@/lib/sequences";
import { EDIT_ALPHABET_RE } from "@/lib/audit";
import { useWorkspace } from "@/lib/workspaceStore";

const EDIT_CAP = 20_000;
const LINE_LEN = 50;

function chunk50(seq: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < seq.length; i += LINE_LEN) lines.push(seq.slice(i, i + LINE_LEN));
  return lines;
}

/** The single replace op between `before` and `after` (common trim). */
function diffAsReplace(before: string, after: string): { start: number; end: number; text: string } {
  let prefix = 0;
  const maxPrefix = Math.min(before.length, after.length);
  while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    start: prefix + 1,
    end: before.length - suffix,
    text: after.slice(prefix, after.length - suffix),
  };
}

function normalizeDraft(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase();
}

export function SequenceEditor() {
  const { sequence, selection, editSequence, annotateSelection, editing } = useWorkspace();
  const applied = sequence?.seq ?? "";
  const [draft, setDraft] = useState(applied);
  const [chunked, setChunked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [insertAt, setInsertAt] = useState<string>("");
  const [insertText, setInsertText] = useState<string>("");
  const [replaceText, setReplaceText] = useState<string>("");
  const [annoName, setAnnoName] = useState<string>("");
  const [annoType, setAnnoType] = useState<string>("feature");
  const [annoDirection, setAnnoDirection] = useState<1 | -1>(1);
  const [note, setNote] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const key = `${sequence?.name ?? ""}:${sequence?.revision ?? 0}`;

  // A new applied sequence (load or applied edit) resets the draft.
  useEffect(() => {
    setDraft(sequence?.seq ?? "");
    setChunked(true);
    setError(null);
    setNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const lines = useMemo(() => chunk50(chunked ? draft : normalizeDraft(draft)), [draft, chunked]);

  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft]);
  const draftValid = normalizedDraft === "" || EDIT_ALPHABET_RE.test(normalizedDraft);
  const dirty = normalizedDraft !== applied;

  const onInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    setDraft(e.currentTarget.value);
    setChunked(false);
    setCursor(e.currentTarget.selectionStart ?? 0);
    setError(null);
  }, []);

  const onFocus = useCallback(() => {
    // Switch to the raw draft so caret math is exact while typing.
    setDraft((d) => normalizeDraft(d));
    setChunked(false);
  }, []);

  const onBlur = useCallback(() => {
    setDraft((d) => normalizeDraft(d));
    setChunked(true);
  }, []);

  const apply = useCallback(async () => {
    if (!sequence) return;
    const clean = normalizeDraft(draft);
    if (clean === applied) {
      setNote("no changes to apply");
      return;
    }
    if (!EDIT_ALPHABET_RE.test(clean)) {
      setError("The draft contains characters outside the IUPAC DNA alphabet (ACGT + ambiguity codes).");
      return;
    }
    setError(null);
    const { start, end, text } = diffAsReplace(applied, clean);
    try {
      const op = end < start ? { kind: "insert" as const, at: start, text } : { kind: "replace" as const, start, end, text };
      const summary =
        end < start
          ? `inserted ${text.length} bp at position ${start.toLocaleString()}`
          : `edited positions ${start.toLocaleString()}–${end.toLocaleString()} (${end - start + 1} bp → ${text.length} bp)`;
      await editSequence(op, summary);
      setChunked(true);
      setNote(`applied — revision ${(sequence.revision ?? 0) + 1}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The edit could not be applied.");
    }
  }, [sequence, draft, applied, editSequence]);

  const deleteSelection = useCallback(async () => {
    if (!selection) return;
    try {
      await editSequence(
        { kind: "replace", start: selection.start, end: selection.end, text: "" },
        `deleted selection ${selection.start.toLocaleString()}–${selection.end.toLocaleString()}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The deletion could not be applied.");
    }
  }, [selection, editSequence]);

  const insertAtPosition = useCallback(async () => {
    const at = parseInt(insertAt, 10);
    const text = normalizeDraft(insertText);
    if (!Number.isFinite(at) || at < 1 || at > applied.length + 1) {
      setError("Insert position must be 1…" + (applied.length + 1).toLocaleString() + ".");
      return;
    }
    if (!text || !EDIT_ALPHABET_RE.test(text)) {
      setError("Insert text must be IUPAC DNA letters (ACGT + ambiguity codes).");
      return;
    }
    try {
      await editSequence({ kind: "insert", at, text }, `inserted ${text.length} bp at position ${at.toLocaleString()}`);
      setInsertText("");
      setNote("inserted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The insertion could not be applied.");
    }
  }, [insertAt, insertText, applied.length, editSequence]);

  const replaceSelection = useCallback(async () => {
    if (!selection) return;
    const text = normalizeDraft(replaceText);
    if (!text || !EDIT_ALPHABET_RE.test(text)) {
      setError("Replacement text must be IUPAC DNA letters (ACGT + ambiguity codes).");
      return;
    }
    try {
      await editSequence(
        { kind: "replace", start: selection.start, end: selection.end, text },
        `replaced selection ${selection.start.toLocaleString()}–${selection.end.toLocaleString()} with ${text.length} bp`,
      );
      setReplaceText("");
      setNote("replaced");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The replacement could not be applied.");
    }
  }, [selection, replaceText, editSequence]);

  const annotate = useCallback(() => {
    if (!selection) return;
    annotateSelection(annoName.trim() || "feature", annoType.trim() || "feature", annoDirection);
    setAnnoName("");
    setNote(`annotated ${selection.start.toLocaleString()}–${selection.end.toLocaleString()}`);
  }, [selection, annoName, annoType, annoDirection, annotateSelection]);

  const overCap = applied.length > EDIT_CAP;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-frost">Sequence editor</h3>
        <span className="stat-num text-[9px] text-mist/60">
          {applied.length.toLocaleString()} bp · revision {sequence?.revision ?? 0}
        </span>
      </div>

      {overCap ? (
        <p className="rounded-lg border border-ink-950/10 bg-ink-950/[0.03] p-2.5 text-[10px] leading-relaxed text-mist/70">
          This sequence ({applied.length.toLocaleString()} bp) is above the editor&apos;s {EDIT_CAP.toLocaleString()} bp
          cap — the free-text editor is hidden, but the selection-based operations below work at any length.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-ink-950/10 bg-white/70 px-2.5 py-1.5">
            <div
              aria-hidden
              className="shrink-0 overflow-hidden rounded border border-ink-950/10 bg-white font-mono text-[9px] leading-5 text-mist/70"
            >
              {lines.map((line, i) => (
                <div key={i} className="flex h-5 items-center justify-end px-1 tabular-nums">
                  {i * LINE_LEN + 1}
                </div>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <pre
                aria-hidden
                className="m-0 overflow-hidden font-mono text-[11px] leading-5 whitespace-pre"
              >
                {lines.map((line, li) => (
                  <span key={li} className="block">
                    {line.split("").map((base, bi) => {
                      const global = li * LINE_LEN + bi + 1;
                      return (
                        <span
                          key={bi}
                          style={{ color: BASE_COLORS[base] ?? "#898781" }}
                          className={global % 10 === 0 ? "border-r border-ink-950/20" : undefined}
                        >
                          {base}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </pre>
              <textarea
                ref={textareaRef}
                value={chunked ? chunk50(draft).join("\n") : draft}
                onInput={onInput}
                onFocus={onFocus}
                onBlur={onBlur}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Sequence letters"
                className="absolute inset-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-mono text-[11px] leading-5 text-transparent caret-frost whitespace-pre outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-mist/70">
            <span className="stat-num">
              cursor {cursor + 1 > 0 ? (cursor + 1).toLocaleString() : "—"}
            </span>
            <span className="stat-num">{normalizedDraft.length.toLocaleString()} bp draft</span>
            <span className="stat-num">GC {fmt(gcPercent(normalizedDraft), 1)}%</span>
            <span className="stat-num">Tm {fmt(meltingTemp(normalizedDraft), 1)} °C</span>
            {!draftValid && <span className="text-[#c13b3b]">invalid letters — IUPAC DNA only</span>}
            {dirty && draftValid && <span className="text-glow-violet">unsaved draft</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={editing || !dirty || !draftValid}
              className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px] disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> {editing ? "Applying…" : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(applied);
                setChunked(true);
                setError(null);
              }}
              disabled={editing || !dirty}
              className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px] disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-[10px] leading-relaxed text-[#c13b3b]">
          {error}
        </p>
      )}
      {note && <p className="text-[10px] text-[#0ca30c]">{note}</p>}

      {/* Selection-based quick ops — work at any length */}
      <div className="rounded-lg border border-ink-950/10 bg-white/60 p-2.5">
        <p className="mb-2 text-[9px] font-semibold tracking-[0.16em] text-mist/60 uppercase">Selection operations</p>
        <SelectionStatus selection={selection} />
        {selection && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="replacement letters"
                aria-label="Replacement text"
                className="glass-panel min-w-0 flex-1 px-2.5 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
              />
              <button type="button" onClick={() => void replaceSelection()} disabled={editing} className="btn-ghost !px-2.5 !py-1 text-[10px] disabled:opacity-40">
                Replace
              </button>
            </div>
            <button
              type="button"
              onClick={() => void deleteSelection()}
              disabled={editing}
              className="btn-ghost inline-flex items-center gap-1.5 self-start !px-2.5 !py-1 text-[10px] disabled:opacity-40"
            >
              <Scissors className="h-3 w-3" /> Delete selection
            </button>
          </div>
        )}
        <div className="mt-2 flex gap-2 border-t border-ink-950/5 pt-2">
          <span className="shrink-0 pt-1.5 text-[10px] text-mist/60 uppercase">Insert at</span>
          <input
            value={insertAt}
            onChange={(e) => setInsertAt(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={String(applied.length + 1)}
            aria-label="Insert position"
            className="glass-panel w-20 px-2.5 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
          />
          <input
            value={insertText}
            onChange={(e) => setInsertText(e.target.value)}
            placeholder="letters to insert"
            aria-label="Insert text"
            className="glass-panel min-w-0 flex-1 px-2.5 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
          />
          <button type="button" onClick={() => void insertAtPosition()} disabled={editing} className="btn-ghost !px-2.5 !py-1 text-[10px] disabled:opacity-40">
            Insert
          </button>
        </div>
      </div>

      {/* Annotate selection */}
      {selection && (
        <div className="rounded-lg border border-ink-950/10 bg-white/60 p-2.5">
          <p className="mb-2 text-[9px] font-semibold tracking-[0.16em] text-mist/60 uppercase">Annotate selection</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={annoName}
              onChange={(e) => setAnnoName(e.target.value)}
              placeholder="feature name"
              aria-label="Feature name"
              className="glass-panel min-w-0 flex-1 px-2.5 py-1.5 text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
            />
            <input
              value={annoType}
              onChange={(e) => setAnnoType(e.target.value)}
              placeholder="type (CDS, promoter…)"
              aria-label="Feature type"
              className="glass-panel w-40 px-2.5 py-1.5 text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
            />
            <select
              value={String(annoDirection)}
              onChange={(e) => setAnnoDirection(e.target.value === "-1" ? -1 : 1)}
              aria-label="Strand"
              className="glass-panel px-2 py-1.5 text-xs text-frost focus:border-glow-violet/50 focus:outline-none"
            >
              <option value="1">+ strand</option>
              <option value="-1">− strand</option>
            </select>
            <button type="button" onClick={annotate} className="btn-ghost !px-2.5 !py-1 text-[10px]">
              Add feature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionStatus({ selection }: { selection: SequenceSelection | null }) {
  if (selection) {
    return (
      <p className="stat-num text-[10px] text-frost/80">
        {selection.start.toLocaleString()}–{selection.end.toLocaleString()} ·{" "}
        {(selection.end - selection.start + 1).toLocaleString()} bp selected
      </p>
    );
  }
  return <p className="text-[10px] text-mist/60">click a feature or drag on the map to select a region</p>;
}
