"use client";

/**
 * Comparative — the on-demand sequence comparison workbench.
 *
 * The fixed ortholog dashboard is gone. Researchers bring sequences two
 * ways: a live search (gene symbol or UniProt accession → entry with its
 * sequence) or pasted FASTA. From the selected sequences they run, on
 * demand: a pairwise alignment of any two (local Needleman–Wunsch, instant)
 * or a Clustal Omega MSA of the whole set (submit/poll job).
 */
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { apiValidated } from "@/lib/api";
import { fmt } from "@/lib/format";
import { AlignmentResultSchema, type AlignmentResultValidated } from "@/lib/validation";
import { useMsaJob } from "@/lib/msa";
import { Panel } from "@/components/workspace/panels/Panel";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { AlignmentViewer } from "@/components/workspace/comparative/AlignmentViewer";
import { MsaResults, parseFasta } from "@/components/workspace/comparative/MsaPanel";

const SearchSchema = z.object({
  entries: z.array(
    z.object({
      accession: z.string(),
      gene: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      organism: z.string().nullable().optional(),
      length: z.number().nullable().optional(),
      sequence: z.string(),
      truncated: z.boolean().optional(),
    }),
  ),
});
type SearchEntry = z.infer<typeof SearchSchema>["entries"][number];

interface SelectedSequence {
  id: string;
  label: string;
  sequence: string;
}

const MAX_SELECTED = 8;
const FASTA_ID_RE = /^[A-Za-z0-9_.-]{1,40}$/;

export default function ComparativePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedSequence[]>([]);
  const [fasta, setFasta] = useState("");
  const [fastaError, setFastaError] = useState<string | null>(null);
  const [pairA, setPairA] = useState<string | null>(null);
  const [pairB, setPairB] = useState<string | null>(null);
  const [pairwise, setPairwise] = useState<AlignmentResultValidated | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const { job: msaJob, submit: submitMsa, busy: msaBusy } = useMsaJob();

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchError("Type a gene symbol (e.g. LIG1) or a UniProt accession (e.g. P18858).");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const res = await apiValidated(`/comparative/search?q=${encodeURIComponent(q)}`, SearchSchema, {
        timeoutMs: 60_000,
      });
      setResults(res.entries);
      if (res.entries.length === 0) setSearchError("No reviewed entry matched that query.");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addEntry = (entry: SearchEntry) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === entry.accession)) return prev;
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, { id: entry.accession, label: `${entry.gene ?? entry.accession} · ${entry.organism ?? ""}`, sequence: entry.sequence }];
    });
  };

  const addFasta = () => {
    const parsed = parseFasta(fasta);
    if ("error" in parsed) {
      setFastaError(parsed.error);
      return;
    }
    setFastaError(null);
    setSelected((prev) => {
      const next = [...prev];
      for (const rec of parsed.sequences) {
        if (next.some((s) => s.id === rec.id)) continue;
        if (next.length >= MAX_SELECTED) break;
        next.push({ id: rec.id, label: rec.id, sequence: rec.sequence });
      }
      return next;
    });
    setFasta("");
  };

  const runPairwise = useCallback(async () => {
    if (!pairA || !pairB) return;
    const a = selected.find((s) => s.id === pairA);
    const b = selected.find((s) => s.id === pairB);
    if (!a || !b) return;
    setPairLoading(true);
    setPairError(null);
    setPairwise(null);
    try {
      setPairwise(
        await apiValidated("/alignment/pairwise", AlignmentResultSchema, {
          method: "POST",
          body: JSON.stringify({ sequence_a: a.sequence, sequence_b: b.sequence }),
        }),
      );
    } catch (e) {
      setPairError(e instanceof Error ? e.message : "Pairwise alignment failed.");
    } finally {
      setPairLoading(false);
    }
  }, [pairA, pairB, selected]);

  const runMsa = () => {
    if (selected.length < 2) return;
    void submitMsa(
      selected.map((s) => {
        const clean = s.sequence.replace(/[^A-Z*\-_.]/gi, "").toUpperCase().slice(0, 2000);
        const id = FASTA_ID_RE.test(s.id) ? s.id : `seq${selected.indexOf(s) + 1}`;
        return { id, sequence: clean };
      }),
    );
  };

  const selectedById = useMemo(() => new Map(selected.map((s) => [s.id, s])), [selected]);

  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Comparative</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Bring your own sequences: search a protein by gene symbol or UniProt accession, or paste
          FASTA. Align any two on demand, or run a Clustal Omega multiple sequence alignment of the
          whole set — nothing runs until you ask for it.
        </p>
      </header>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* ── Search ─────────────────────────────────────────────────────── */}
        <Panel title="Search sequences" note="gene symbol or UniProt accession · live" bodyClassName="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="LIG1 or P18858"
              aria-label="Sequence search query"
              className="glass-panel min-w-0 flex-1 px-3 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
            />
            <button type="submit" disabled={searching} className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50">
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && (
            <p role="alert" className="mt-2 text-[11px] text-[#c13b3b]">
              {searchError}
            </p>
          )}
          {results.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {results.map((entry) => (
                <li key={entry.accession} className="flex items-center gap-2 rounded-lg border border-ink-950/10 bg-white/70 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-frost">
                      {entry.gene ?? entry.name ?? entry.accession}
                    </span>
                    <span className="stat-num block truncate text-[9px] text-mist/60">
                      {entry.accession} · {entry.length?.toLocaleString() ?? entry.sequence.length.toLocaleString()} aa
                      {entry.truncated ? " · sequence truncated at 2000" : ""} · {entry.organism ?? ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addEntry(entry)}
                    disabled={selected.some((s) => s.id === entry.accession) || selected.length >= MAX_SELECTED}
                    className="btn-ghost !px-2.5 !py-1 text-[10px] disabled:opacity-40"
                  >
                    {selected.some((s) => s.id === entry.accession) ? "added" : "+ add"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── FASTA paste ────────────────────────────────────────────────── */}
        <Panel title="Paste FASTA" note="strict parser · 2–50 records" bodyClassName="p-4">
          <textarea
            value={fasta}
            onChange={(e) => {
              setFasta(e.target.value);
              setFastaError(null);
            }}
            rows={4}
            spellCheck={false}
            aria-label="FASTA paste area"
            placeholder={">id\nSEQUENCE\n>id2\nSEQUENCE2"}
            className="glass-panel w-full resize-y px-3 py-2 font-mono text-[11px] leading-5 text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
          />
          {fastaError && (
            <p role="alert" className="mt-2 text-[11px] text-[#c13b3b]">
              {fastaError}
            </p>
          )}
          <button type="button" onClick={addFasta} disabled={!fasta.trim()} className="btn-ghost mt-2 !px-3 !py-1.5 text-xs disabled:opacity-40">
            Add to selection
          </button>
        </Panel>
      </div>

      {/* ── Selected sequences + alignments ─────────────────────────────── */}
      <Panel
        title="Selected sequences"
        note={selected.length > 0 ? `${selected.length} / ${MAX_SELECTED} — pick two for pairwise, or run the MSA` : "search or paste first"}
        bodyClassName="p-4"
        className="mb-6"
      >
        {selected.length === 0 ? (
          <p className="text-xs text-mist/70">Nothing selected yet — search a protein or paste FASTA above.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {selected.map((s) => (
                <li key={s.id} className="chip inline-flex items-center gap-1.5">
                  <span className="font-mono">{s.id}</span>
                  <span className="stat-num text-mist/60">{s.sequence.length.toLocaleString()} aa</span>
                  <button
                    type="button"
                    aria-label={`Remove ${s.id}`}
                    onClick={() => {
                      setSelected((prev) => prev.filter((x) => x.id !== s.id));
                      if (pairA === s.id) setPairA(null);
                      if (pairB === s.id) setPairB(null);
                    }}
                    className="text-mist/50 transition-colors duration-300 ease-out hover:text-[#c13b3b]"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-950/5 pt-3">
              <span className="text-[10px] tracking-wide text-mist/60 uppercase">Pairwise</span>
              <select value={pairA ?? ""} onChange={(e) => setPairA(e.target.value || null)} aria-label="First sequence" className="glass-panel px-2 py-1.5 text-xs text-frost focus:border-glow-violet/50 focus:outline-none">
                <option value="">— first —</option>
                {selected.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
              <span className="text-mist/50">vs</span>
              <select value={pairB ?? ""} onChange={(e) => setPairB(e.target.value || null)} aria-label="Second sequence" className="glass-panel px-2 py-1.5 text-xs text-frost focus:border-glow-violet/50 focus:outline-none">
                <option value="">— second —</option>
                {selected.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void runPairwise()}
                disabled={!pairA || !pairB || pairLoading}
                className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-40"
              >
                {pairLoading ? "Aligning…" : "Align pairwise"}
              </button>
              <button
                type="button"
                onClick={runMsa}
                disabled={selected.length < 2 || msaBusy}
                className="btn-ghost ml-auto !px-3 !py-1.5 text-xs disabled:opacity-40"
              >
                {msaBusy ? "Clustal running…" : "Run MSA (all)"}
              </button>
            </div>
          </>
        )}
      </Panel>

      {pairError && (
        <Panel title="Pairwise alignment" className="mb-6" bodyClassName="p-4">
          <p role="alert" className="text-xs text-[#c13b3b]">
            {pairError}
          </p>
        </Panel>
      )}
      {pairLoading && (
        <Panel title="Pairwise alignment" className="mb-6" bodyClassName="p-4">
          <div className="h-24">
            <PanelSkeleton variant="sequence" caption="Aligning…" />
          </div>
        </Panel>
      )}
      {pairwise && pairA && pairB && (
        <Panel
          title="Pairwise alignment"
          note={`${fmt(pairwise.identity_pct, 1)}% identity · ${pairwise.matches} matches · ${pairwise.mismatches} mismatches`}
          className="mb-6"
          bodyClassName="p-4"
        >
          <PanelBoundary title="Needleman–Wunsch alignment" className="h-full">
            <AlignmentViewer
              alignedA={pairwise.aligned_a}
              alignedB={pairwise.aligned_b}
              labelA={selectedById.get(pairA)?.label ?? pairA}
              labelB={selectedById.get(pairB)?.label ?? pairB}
            />
          </PanelBoundary>
        </Panel>
      )}

      {msaJob.kind === "running" && (
        <Panel title="Multiple sequence alignment" className="mb-6" bodyClassName="p-4">
          <div className="h-32">
            <PanelSkeleton variant="sequence" caption={`Aligning with Clustal Omega…${msaJob.jobId ? ` (job ${msaJob.jobId})` : ""}`} />
          </div>
        </Panel>
      )}
      {msaJob.kind === "error" && (
        <Panel title="Multiple sequence alignment" className="mb-6" bodyClassName="p-4">
          <p role="alert" className="text-xs text-[#c13b3b]">
            {msaJob.detail}
          </p>
        </Panel>
      )}
      {msaJob.kind === "done" && (
        <Panel title="Multiple sequence alignment" className="mb-6" bodyClassName="p-4">
          <PanelBoundary title="Multiple sequence alignment" className="h-full">
            <MsaResults result={msaJob.result} />
          </PanelBoundary>
        </Panel>
      )}
    </ToolScroll>
  );
}
