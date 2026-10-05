"use client";

/**
 * MsaPanel — multiple sequence alignment (MSA) workbench for the comparative
 * dashboard (Clustal Omega job behind /comparative/msa).
 *
 * Pipeline: FASTA pasted into the textarea is parsed client-side under the
 * same strict id / residue patterns the API enforces (lib/validation.ts),
 * POSTed as a job, then polled every 3 s (max 40 polls) until the job reports
 * done or error. Every payload crosses a Zod schema before render — a
 * malformed job status becomes a designed fallback, never an undefined access
 * inside the alignment grid.
 *
 * Rendering rules (light clinical theme, text nodes only — React escapes
 * every sequence string, so no markup is ever built from data):
 * - conservation track: one thin cell per column on a sequential blue ramp
 *   (0 → #eef4fc, mid → #6da7ec, 1 → #0d366b), with a labeled legend;
 * - consensus row: monospace ink, gaps as dashes;
 * - aligned rows: ink = match to consensus, amber = mismatch, muted = gap;
 * - identity matrix: the same blue ramp keyed by % identity, every cell
 *   labeled with its numeric value (ink on light cells, near-white on the
 *   darkest cells where ink would be illegible).
 *
 * Motion: no animated polling indicators beyond the PanelSkeleton, one 0.5 s
 * opacity fade when results land (skipped under prefers-reduced-motion), and
 * no transition shorter than 0.3 s.
 */
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { fmt, hexToRgb } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/motion";
import { usePersistentState } from "@/lib/persistence";
import { useMsaJob } from "@/lib/msa";
import {
  MSA_ID_RE,
  MSA_SEQUENCE_RE,
  type MsaResult,
  type MsaSequence,
} from "@/lib/validation";
import { Panel } from "@/components/workspace/panels/Panel";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { ALIGNMENT_COLORS } from "./alignmentStyle";

// ── Constants ──────────────────────────────────────────────────────────────

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;
/** Spec'd cap: ~40 polls at 3 s each, then a designed timeout state. */
const MAX_POLLS = 40;
const FASTA_DRAFT_KEY = "comparative:msa-fasta";

/** Sequential blue ramp endpoints: conservation 0 → 0.5 → 1. */
const RAMP_LOW = "#eef4fc";
const RAMP_MID = "#6da7ec";
const RAMP_HIGH = "#0d366b";
/** Residue inks come from the shared alignment contract (alignmentStyle.tsx). */
const INK = ALIGNMENT_COLORS.match;
const AMBER = ALIGNMENT_COLORS.mismatchSoft;
const GAP = ALIGNMENT_COLORS.gap;
const COL_W = 10;

/**
 * Demo input — four synthetic, clearly related ~50-residue fragments (a seed,
 * an "ortholog" with substitutions + a 2-residue deletion, and two variants)
 * on the residue alphabet the API accepts. Invented for the demo button.
 */
const DEMO_FASTA = `>LIG1_HUMAN synthetic BER-motif fragment 1
MTQQLVTELLAQLQEQLLPSVKVLDTSGLLSLQQAEAALEQVRQELGSPDGK
>LIG1_WHALE synthetic BER-motif fragment 2
MTQQLVTVLLAQLKEQLLPSVKVLDTAGLLQQAEAAGEQVRQELTSPDGK
>LIG1_M1 synthetic BER-motif fragment 3 (L5E, K22F, E45P)
MTQQEVTELLAQLQEQLLPSVFVLDTSGLLSLQQAEAALEQVRQPLGSPDGK
>LIG1_M2 synthetic BER-motif fragment 4 (GGS insertion after S20, L30T, L47E)
MTQQLVTELLAQLQEQLLPSGGSVKVLDTSGLTSLQQAEAALEQVRQELESPDGK
`;

// ── Color helpers (sequential blue ramp, never color alone) ────────────────

const LOW_RGB = hexToRgb(RAMP_LOW);
const MID_RGB = hexToRgb(RAMP_MID);
const HIGH_RGB = hexToRgb(RAMP_HIGH);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** RGB for a 0..1 sequential value: 0 → LOW, 0.5 → MID, 1 → HIGH. */
function rampRgb(v: number): [number, number, number] {
  const t = clamp01(v);
  const [a, b, f] = t <= 0.5 ? [LOW_RGB, MID_RGB, t / 0.5] : [MID_RGB, HIGH_RGB, (t - 0.5) / 0.5];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

function rampColor(v: number): string {
  const [r, g, b] = rampRgb(v);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Ink that stays legible on the ramp: dark ink on light steps, near-white on
 *  the darkest steps (the matrix prints its value on every cell). */
function rampInk(v: number): string {
  const [r, g, b] = rampRgb(v);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? INK : "#f4f7fd";
}

// ── FASTA parsing (strict, mirrors the API's identifier/residue policy) ─────

/**
 * Parse a FASTA block into at most 50 records. Errors carry a line number and
 * never echo anything that has not already passed the identifier pattern.
 */
export function parseFasta(text: string): { sequences: MsaSequence[] } | { error: string } {
  const records: { id: string; chunks: string[] }[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    if (line.startsWith(">")) {
      // ">id description" — the id is the first whitespace-delimited token.
      const id = line.slice(1).trim().split(/\s+/)[0] ?? "";
      if (!MSA_ID_RE.test(id)) {
        return {
          error: `Line ${i + 1}: header ids must be 1–40 characters of letters, digits, "_", "." or "-".`,
        };
      }
      records.push({ id, chunks: [] });
      continue;
    }
    if (records.length === 0) {
      return { error: `Line ${i + 1}: sequence data before the first ">" header — every record starts with ">id".` };
    }
    records[records.length - 1].chunks.push(line.replace(/\s+/g, ""));
  }

  const sequences: MsaSequence[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    // `record.id` already matched MSA_ID_RE, so quoting it is inert text.
    if (seen.has(record.id)) {
      return { error: `Duplicate record id "${record.id}" — every sequence needs a unique id.` };
    }
    seen.add(record.id);
    const sequence = record.chunks.join("").toUpperCase();
    if (sequence.length === 0) return { error: `The record "${record.id}" has no residues.` };
    if (sequence.length > 2000) return { error: `The record "${record.id}" is longer than the 2000-residue limit.` };
    if (!MSA_SEQUENCE_RE.test(sequence)) {
      return {
        error: `The record "${record.id}" contains characters outside the residue alphabet (letters, "*", "-", "_" or ".").`,
      };
    }
    sequences.push({ id: record.id, sequence });
  }

  if (sequences.length < 2) {
    return { error: "An alignment needs at least 2 records — paste 2 to 50 FASTA records." };
  }
  if (sequences.length > 50) return { error: "An alignment job accepts at most 50 records." };
  return { sequences };
}

/** Column count of an alignment: the longest of consensus / conservation / rows. */
function columnCount(result: MsaResult): number {
  let columns = Math.max(result.consensus.length, result.conservation.length);
  for (const row of result.alignment) columns = Math.max(columns, row.sequence.length);
  return columns;
}

// ── Small presentational pieces ────────────────────────────────────────────

/** Sticky left gutter label so ids/track names survive horizontal scrolling. */
function RowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="sticky left-0 z-10 w-28 shrink-0 truncate bg-white/90 px-2 text-[10px] leading-5 text-mist/70 backdrop-blur-sm">
      {children}
    </div>
  );
}

/** Conservation track + consensus + aligned rows, one shared column grid. */
function AlignedBlock({ result }: { result: MsaResult }) {
  const { alignment, conservation, consensus } = result;
  const columns = columnCount(result);

  return (
    <div className="glass-panel p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[10px] text-mist/70">
          <span>conservation 0 → 1</span>
          <span
            aria-hidden
            className="h-2 w-20 rounded-full"
            style={{ background: `linear-gradient(90deg, ${RAMP_LOW}, ${RAMP_MID}, ${RAMP_HIGH})` }}
          />
        </span>
        <span className="flex items-center gap-2 text-[10px] text-mist/70">
          residues
          <span style={{ color: INK }}>match</span>
          <span style={{ color: AMBER }}>mismatch</span>
          <span style={{ color: GAP }}>gap</span>
        </span>
        <span className="stat-num text-[10px] text-mist/60">
          {alignment.length} records · {columns} columns
        </span>
      </div>

      <div
        role="region"
        aria-label="Multiple sequence alignment — scroll horizontally for long alignments"
        tabIndex={0}
        className="overflow-x-auto pb-1 outline-none focus-visible:ring-2 focus-visible:ring-glow-violet/40"
      >
        <div className="min-w-max">
          {/* Conservation track — one thin cell per alignment column. */}
          <div className="flex items-center gap-2">
            <RowLabel>conservation</RowLabel>
            <div
              className="flex"
              role="img"
              aria-label={`Per-column conservation across ${columns} alignment columns, 0 to 1`}
            >
              {Array.from({ length: columns }).map((_, c) => {
                const v = clamp01(conservation[c] ?? 0);
                return (
                  <span
                    key={c}
                    title={`column ${c + 1} · conservation ${Math.round(v * 100)}%`}
                    className="h-3.5 shrink-0 transition-colors duration-300 ease-out"
                    style={{ width: COL_W, background: rampColor(v) }}
                  />
                );
              })}
            </div>
          </div>

          {/* Consensus — monospace ink, gaps as dashes. */}
          <div className="mt-1 flex items-center gap-2">
            <RowLabel>consensus</RowLabel>
            <div className="font-mono text-[11px] leading-5">
              {Array.from({ length: columns }).map((_, c) => {
                const ch = consensus[c] ?? "-";
                return (
                  <span
                    key={c}
                    className="inline-block shrink-0 text-center"
                    style={{ width: COL_W, color: ch === "-" ? GAP : INK }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Aligned rows — residue color = match-to-consensus / mismatch / gap. */}
          <div className="mt-1 border-t border-ink-950/5 pt-1">
            {alignment.map((row, r) => (
              <div key={`${row.id}-${r}`} className="flex items-center gap-2">
                <RowLabel>{row.id}</RowLabel>
                <div className="font-mono text-[11px] leading-5">
                  {Array.from({ length: columns }).map((_, c) => {
                    const ch = row.sequence[c] ?? "-";
                    const gap = ch === "-" || ch === ".";
                    const color = gap ? GAP : ch === (consensus[c] ?? "-") ? INK : AMBER;
                    return (
                      <span
                        key={c}
                        className="inline-block shrink-0 text-center"
                        style={{ width: COL_W, color }}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** n×n pairing matrix — the same blue ramp keyed by % identity, value on cell. */
function IdentityMatrix({ ids, matrix }: { ids: string[]; matrix: number[][] }) {
  const n = ids.length;
  const rows = matrix.slice(0, n).map((row) => row.slice(0, n));
  let max = 0;
  for (const row of rows) {
    for (const v of row) if (Number.isFinite(v) && v > max) max = v;
  }
  // The API may express identity as a fraction (0..1) or a percentage
  // (0..100); normalize on the observed maximum, then always print %.
  const scale = max > 0 && max <= 1 ? 100 : 1;

  return (
    <div className="glass-panel p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[11px] font-semibold tracking-wide text-frost/80 uppercase">Identity matrix</h3>
        <p className="text-[10px] text-mist/70">
          Pairwise identity between aligned records — every cell prints its value; darker = more identical.
        </p>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-mist/70">
          <span>identity %</span>
          <span className="stat-num">0</span>
          <span
            aria-hidden
            className="h-2 w-20 rounded-full"
            style={{ background: `linear-gradient(90deg, ${RAMP_LOW}, ${RAMP_MID}, ${RAMP_HIGH})` }}
          />
          <span className="stat-num">100</span>
        </span>
      </div>

      <div className="max-h-80 overflow-auto">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-20 bg-[#f5f3fb] px-2 py-1 text-left text-[9px] font-medium text-mist/60"
              >
                id
              </th>
              {ids.map((id, c) => (
                <th
                  key={`${id}-${c}`}
                  scope="col"
                  title={id}
                  className="sticky top-0 z-10 bg-[#f5f3fb] px-1 py-1 text-center text-[9px] font-medium text-mist/70"
                >
                  <span className="block w-10 truncate">{id}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((rowId, r) => (
              <tr key={`${rowId}-${r}`}>
                <th
                  scope="row"
                  title={rowId}
                  className="sticky left-0 z-10 bg-[#f5f3fb] px-2 py-0 text-left text-[9px] font-medium text-mist/70"
                >
                  <span className="block w-24 truncate">{rowId}</span>
                </th>
                {ids.map((colId, c) => {
                  const raw = rows[r]?.[c];
                  const pct = typeof raw === "number" && Number.isFinite(raw) ? Math.min(100, Math.max(0, raw * scale)) : 0;
                  return (
                    <td key={`${colId}-${c}`} className="p-0">
                      <span
                        className="stat-num flex h-8 w-10 items-center justify-center font-mono text-[10px] transition-colors duration-300 ease-out"
                        style={{ background: rampColor(pct / 100), color: rampInk(pct / 100) }}
                        title={`${rowId} ↔ ${colId}: ${fmt(pct, 1)}% identity`}
                      >
                        {fmt(pct, 0)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Results fade in over 0.5 s — instantly under prefers-reduced-motion. */
function FadeIn({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={`transition-opacity duration-500 ease-out ${shown || reduced ? "opacity-100" : "opacity-0"}`}>
      {children}
    </div>
  );
}

export function MsaResults({ result }: { result: MsaResult }) {
  if (result.alignment.length === 0 || columnCount(result) === 0) {
    return (
      <p className="glass-panel p-4 text-xs text-mist/70">
        The alignment job finished but returned no aligned rows — check the input records and run it again.
      </p>
    );
  }
  return (
    <FadeIn>
      <div className="flex flex-col gap-3">
        <AlignedBlock result={result} />
        <IdentityMatrix ids={result.alignment.map((row) => row.id)} matrix={result.identity_matrix} />
      </div>
    </FadeIn>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────────────────────────────

export function MsaPanel() {
  const textareaId = useId();
  const [fasta, setFasta] = usePersistentState<string>(FASTA_DRAFT_KEY, "", (stored) =>
    typeof stored === "string" && stored.length <= 20_000 ? stored : null,
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const { job, submit, busy, retry } = useMsaJob();

  const runFromTextarea = useCallback(() => {
    const parsed = parseFasta(fasta);
    if ("error" in parsed) {
      setInputError(parsed.error);
      return;
    }
    void submit(parsed.sequences);
  }, [fasta, submit]);

  const loadDemo = useCallback(() => {
    setFasta(DEMO_FASTA);
    setInputError(null);
  }, [setFasta]);

  const retryOrRun = useCallback(() => {
    // The hook's retry re-submits the last submission; when there was none,
    // re-run whatever is in the textarea.
    if (job.kind === "error" && job.detail.includes("could not be started")) {
      runFromTextarea();
    } else {
      retry();
    }
  }, [retry, runFromTextarea, job]);

  const note =
    job.kind === "done"
      ? `${job.result.alignment.length} records · ${columnCount(job.result)} columns`
      : "Clustal Omega · conservation, consensus & identity";

  return (
    <Panel title="Multiple Sequence Alignment" note={note} bodyClassName="p-4">
      <PanelBoundary title="Multiple Sequence Alignment" className="h-full">
        <div className="flex flex-col gap-4">
          {/* Input */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={textareaId} className="text-xs font-medium text-frost/80">
                FASTA records — 2 to 50 sequences
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={loadDemo} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-xs">
                  Load demo
                </button>
                <button
                  type="button"
                  onClick={runFromTextarea}
                  disabled={busy}
                  className="btn-primary !px-3.5 !py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? "Aligning…" : "Run Clustal Omega"}
                </button>
              </div>
            </div>

            <textarea
              id={textareaId}
              value={fasta}
              onChange={(e) => {
                setFasta(e.target.value);
                setInputError(null);
              }}
              rows={6}
              spellCheck={false}
              disabled={busy}
              aria-invalid={inputError !== null}
              aria-describedby={inputError ? `${textareaId}-error` : undefined}
              placeholder={">id\nSEQUENCE\n>id2\nSEQUENCE2"}
              className="glass-panel mt-2 w-full resize-y px-3 py-2 font-mono text-[11px] leading-5 text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none disabled:opacity-60"
            />
            {inputError && (
              <p id={`${textareaId}-error`} role="alert" className="mt-2 text-xs text-[#c13b3b]">
                {inputError}
              </p>
            )}
            <p className="mt-1 text-[10px] text-mist/60">
              ids: 1–40 letters, digits, &quot;_&quot;, &quot;.&quot; or &quot;-&quot; · residues: letters, &quot;*&quot;,
              &quot;-&quot;, &quot;_&quot;, &quot;.&quot;
            </p>
          </div>

          {/* Output */}
          {job.kind === "running" ? (
            <div className="glass-panel h-56 p-1">
              <PanelSkeleton
                variant="sequence"
                caption={`Aligning with Clustal Omega…${job.jobId ? ` (job ${job.jobId})` : ""}`}
              />
            </div>
          ) : job.kind === "error" ? (
            <div className="glass-panel p-4" role="alert">
              <p className="text-sm font-medium text-frost">The alignment did not complete</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-mist/80">{job.detail}</p>
              <button type="button" onClick={retryOrRun} className="btn-ghost mt-3 !px-4 !py-1.5 text-xs">
                Retry
              </button>
            </div>
          ) : job.kind === "done" ? (
            <MsaResults result={job.result} />
          ) : (
            <p className="glass-panel p-4 text-xs leading-relaxed text-mist/70">
              Paste FASTA records or load the demo, then run Clustal Omega — the panel polls the alignment job every
              3 seconds, then renders the conservation track, consensus, aligned rows and the identity matrix.
            </p>
          )}
        </div>
      </PanelBoundary>
    </Panel>
  );
}
