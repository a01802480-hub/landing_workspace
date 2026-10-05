"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiValidated } from "@/lib/api";
import { fmt } from "@/lib/format";
import { StructureModelSchema, VariantImpactSchema, type StructureModelValidated, type VariantImpactValidated, type VariantScanPosition } from "@/lib/validation";
import { classifySequence } from "@/lib/sequences";
import { useVariantScan } from "@/lib/variants";
import { useWorkspace } from "@/lib/workspaceStore";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { PlddtStrip } from "@/components/workspace/sequence/PlddtStrip";
import { PlddtCard, AlphaMissenseCard, SiftCard, VariantDetail } from "@/components/workspace/variants/VariantCards";
import { ConsensusMeter } from "@/components/workspace/variants/ConsensusMeter";
import { Panel } from "@/components/workspace/panels/Panel";

const UNIPROT_RE = /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/;

interface FormState {
  uniprot: string;
  position: string;
  ref: string;
  alt: string;
}

const INITIAL: FormState = { uniprot: "P18858", position: "641", ref: "R", alt: "L" };

const AM_TONE: Record<string, string> = {
  pathogenic: "text-[#c13b3b]",
  ambiguous: "text-[#9a6b00]",
  benign: "text-[#0ca30c]",
};

export default function VariantsPage() {
  const { sequence } = useWorkspace();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<VariantImpactValidated | null>(null);
  const [strip, setStrip] = useState<StructureModelValidated | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  // ── Bulk scan state ────────────────────────────────────────────────────
  const [scanUniprot, setScanUniprot] = useState("P18858");
  const [scanStart, setScanStart] = useState("");
  const [scanEnd, setScanEnd] = useState("");
  const [workspaceNote, setWorkspaceNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pathogenic" | "ambiguous" | "benign">("all");
  const [detail, setDetail] = useState<{ position: VariantScanPosition; alt: string } | null>(null);
  const scan = useVariantScan();

  const submit = useCallback(async (f: FormState) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setStrip(null);
    try {
      const pos = parseInt(f.position, 10);
      if (!Number.isInteger(pos) || pos < 1) throw new Error("Position must be a positive integer.");
      const impact = await apiValidated("/variants/impact", VariantImpactSchema, {
        method: "POST",
        body: JSON.stringify({
          uniprot_id: f.uniprot.trim().toUpperCase(),
          position: pos,
          ref: f.ref.trim().toUpperCase(),
          alt: f.alt.trim().toUpperCase(),
        }),
        timeoutMs: 100_000,
      });
      setResult(impact);
      apiValidated(`/structure/alphafold/${impact.uniprot_id}?full=true`, StructureModelSchema)
        .then(setStrip)
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variant prediction failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    submit(INITIAL);
  }, [submit]);

  // ── Bulk scan helpers ──────────────────────────────────────────────────

  /** "Use workspace protein": alphabet detection + accession grammar. */
  const useWorkspaceProtein = () => {
    if (!sequence) {
      setWorkspaceNote("No workspace sequence loaded — import a protein first.");
      return;
    }
    const kind = classifySequence(sequence.seq);
    if (kind !== "protein") {
      setWorkspaceNote("The workspace sequence is not protein-like (alphabet check). Variant scanning works on proteins.");
      return;
    }
    if (sequence.accession && UNIPROT_RE.test(sequence.accession.toUpperCase())) {
      setScanUniprot(sequence.accession.toUpperCase());
      setWorkspaceNote(`Using the workspace protein ${sequence.name} (${sequence.accession}).`);
    } else {
      setWorkspaceNote(
        `The workspace sequence (${sequence.name}) looks like a protein but has no UniProt accession — AlphaMissense/VEP are keyed by accession. Enter the accession for this protein to scan it.`,
      );
    }
  };

  const startScan = () => {
    setDetail(null);
    setWorkspaceNote(null);
    const start = scanStart ? parseInt(scanStart, 10) : undefined;
    const end = scanEnd ? parseInt(scanEnd, 10) : undefined;
    if (!UNIPROT_RE.test(scanUniprot.trim().toUpperCase())) {
      setWorkspaceNote("Enter a valid UniProt accession (e.g. P18858).");
      return;
    }
    void scan.submit(scanUniprot, start, end);
  };

  // ── Scan table rows ────────────────────────────────────────────────────

  const rows = useMemo(() => {
    const positions = scan.status?.positions ?? [];
    const out: { position: VariantScanPosition; alt: string; cls: string; amMean?: number; plddt?: number; sift?: string }[] = [];
    for (const pos of positions) {
      const am = pos.alphamissense;
      const plddtOk = pos.plddt?.status === "ok" && typeof pos.plddt.plddt === "number";
      if (am?.status === "ok" && am.substitutions) {
        for (const sub of am.substitutions) {
          if (filter !== "all" && sub.class !== filter) continue;
          const siftPred = pos.sift?.status === "ok" ? (pos.sift.sift?.prediction ?? undefined) : undefined;
          out.push({
            position: pos,
            alt: sub.alt,
            cls: sub.class,
            amMean: am.mean,
            plddt: plddtOk ? pos.plddt?.plddt : undefined,
            sift: siftPred,
          });
        }
      } else if (filter === "all") {
        out.push({ position: pos, alt: "—", cls: "no data" });
      }
    }
    return out;
  }, [scan.status, filter]);

  const summary = useMemo(() => {
    const positions = scan.status?.positions ?? [];
    let pathogenic = 0;
    let ambiguous = 0;
    let amCovered = 0;
    for (const pos of positions) {
      if (pos.alphamissense?.status === "ok") {
        amCovered++;
        for (const sub of pos.alphamissense.substitutions ?? []) {
          if (sub.class === "pathogenic") pathogenic++;
          if (sub.class === "ambiguous") ambiguous++;
        }
      }
    }
    return { positions: positions.length, pathogenic, ambiguous, amCovered };
  }, [scan.status]);

  const scanBusy = scan.status !== null && (scan.status.status === "queued" || scan.status.status === "running");
  const scanned = scan.status?.progress?.scanned ?? 0;
  const total = scan.status?.progress?.total ?? 0;

  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Variant impact</h1>
        <p className="mt-2 max-w-2xl text-mist">
          One substitution, three independent verdicts — or scan every substitution of a protein
          window at once. AlphaFold structural confidence, AlphaMissense pathogenicity, SIFT
          tolerance; each source degrades on its own.
        </p>
      </header>

      {/* ── Single substitution (kept) ─────────────────────────────────── */}
      <GlassCard className="mb-8 p-5" hover={false}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(form);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="UniProt accession">
            <input
              value={form.uniprot}
              onChange={(e) => setForm({ ...form, uniprot: e.target.value })}
              className="glass-panel w-36 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="UniProt accession"
            />
          </Field>
          <Field label="Position">
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="glass-panel w-24 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="Residue position"
            />
          </Field>
          <Field label="Ref">
            <input
              value={form.ref}
              onChange={(e) => setForm({ ...form, ref: e.target.value })}
              maxLength={3}
              className="glass-panel w-16 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="Reference amino acid"
            />
          </Field>
          <Field label="Alt">
            <input
              value={form.alt}
              onChange={(e) => setForm({ ...form, alt: e.target.value })}
              maxLength={3}
              className="glass-panel w-16 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
              aria-label="Alternate amino acid"
            />
          </Field>
          <button type="submit" disabled={loading} className="btn-primary !px-5 !py-2 text-sm">
            {loading ? "Predicting…" : "Predict"}
          </button>
        </form>
        <p className="mt-3 text-xs text-mist/60">
          Demo substitution: P18858 (LIG1) p.Arg641Leu — pathogenic in AlphaMissense (0.976).
        </p>
      </GlassCard>

      {error && (
        <GlassCard className="mb-8 !border-[#d03b3b]/40 p-5 text-sm text-[#c13b3b]" hover={false}>
          {error}
        </GlassCard>
      )}

      {loading && (
        <div className="grid gap-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      )}

      {result && !loading && (
        <PanelBoundary title="Variant score cards">
          <FloatIn stagger={0.1} className="grid items-stretch gap-6 lg:grid-cols-4">
            <PlddtCard impact={result} />
            <AlphaMissenseCard impact={result} />
            <SiftCard impact={result} />
            <ConsensusMeter impact={result} />
          </FloatIn>
        </PanelBoundary>
      )}

      {result && strip && (
        <PanelBoundary title="Per-residue confidence strip">
          <FloatIn className="mt-8">
            <GlassCard className="p-6" hover={false}>
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                Per-residue confidence — AlphaFold {result.uniprot_id}
              </h2>
              <PlddtStrip model={strip} position={parseInt(result.variant.match(/\d+/)?.[0] ?? "", 10)} />
            </GlassCard>
          </FloatIn>
        </PanelBoundary>
      )}

      {/* ── All-substitutions scan ─────────────────────────────────────── */}
      <Panel
        title="Scan all substitutions"
        note={
          scanBusy
            ? `scanning ${scanned.toLocaleString()} / ${total.toLocaleString()} positions`
            : scan.status?.status === "done"
              ? `${summary.amCovered} positions · ${summary.pathogenic} pathogenic · ${summary.ambiguous} ambiguous`
              : "AlphaMissense per position + pLDDT + SIFT for flagged variants"
        }
        className="mb-8"
        bodyClassName="p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="UniProt accession">
            <input
              value={scanUniprot}
              onChange={(e) => setScanUniprot(e.target.value)}
              aria-label="Scan accession"
              className="glass-panel w-36 px-3 py-2 font-mono text-sm text-frost focus:border-glow-cyan/50 focus:outline-none"
            />
          </Field>
          <Field label="From (optional)">
            <input
              value={scanStart}
              onChange={(e) => setScanStart(e.target.value.replace(/[^0-9]/g, ""))}
              aria-label="Scan start position"
              placeholder="1"
              className="glass-panel w-20 px-3 py-2 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-cyan/50 focus:outline-none"
            />
          </Field>
          <Field label="To (optional)">
            <input
              value={scanEnd}
              onChange={(e) => setScanEnd(e.target.value.replace(/[^0-9]/g, ""))}
              aria-label="Scan end position"
              placeholder="500"
              className="glass-panel w-20 px-3 py-2 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-cyan/50 focus:outline-none"
            />
          </Field>
          <button type="button" onClick={startScan} disabled={scanBusy} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-50">
            {scanBusy ? `Scanning ${total > 0 ? `${Math.round((scanned / Math.max(1, total)) * 100)}%` : "…"}` : "Scan all substitutions"}
          </button>
          <button type="button" onClick={useWorkspaceProtein} className="btn-ghost !px-4 !py-2 text-sm">
            Use workspace protein
          </button>
        </div>
        {workspaceNote && <p className="mt-2 text-xs leading-relaxed text-mist/70">{workspaceNote}</p>}
        {scan.error && (
          <p role="alert" className="mt-2 text-xs text-[#c13b3b]">
            {scan.error}
          </p>
        )}

        {rows.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Substitution filter">
              {(["all", "pathogenic", "ambiguous", "benign"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filter === f}
                  onClick={() => setFilter(f)}
                  className={`chip !py-0.5 text-[10px] transition-colors duration-300 ease-out ${
                    filter === f ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                  }`}
                >
                  {f}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-mist/60">click a row for the full verdict cards</span>
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border border-ink-950/5">
              <table className="w-full border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#f5f3fb] text-[9px] tracking-wide text-mist/70 uppercase">
                    <th scope="col" className="px-3 py-2 font-medium">Position</th>
                    <th scope="col" className="px-2 py-2 font-medium">Ref</th>
                    <th scope="col" className="px-2 py-2 font-medium">Alt</th>
                    <th scope="col" className="px-2 py-2 font-medium">AlphaMissense</th>
                    <th scope="col" className="px-2 py-2 font-medium">Mean</th>
                    <th scope="col" className="px-2 py-2 font-medium">pLDDT</th>
                    <th scope="col" className="px-2 py-2 font-medium">SIFT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={`${row.position.position}-${row.alt}-${i}`}
                      onClick={() => row.cls !== "no data" && setDetail({ position: row.position, alt: row.alt })}
                      className={`border-t border-ink-950/5 transition-colors duration-300 ease-out ${
                        row.cls === "no data" ? "" : "cursor-pointer hover:bg-ink-950/5"
                      }`}
                    >
                      <td className="stat-num px-3 py-1.5">{row.position.position}</td>
                      <td className="stat-num px-2 py-1.5 text-mist/80">{row.position.ref ?? "—"}</td>
                      <td className="stat-num px-2 py-1.5 font-mono">{row.alt}</td>
                      <td className={`px-2 py-1.5 font-medium ${AM_TONE[row.cls] ?? "text-mist/60"}`}>{row.cls}</td>
                      <td className="stat-num px-2 py-1.5 text-mist/80">{row.amMean !== undefined ? fmt(row.amMean, 3) : "—"}</td>
                      <td className="stat-num px-2 py-1.5 text-mist/80">{row.plddt !== undefined ? fmt(row.plddt, 1) : "—"}</td>
                      <td className="px-2 py-1.5 text-mist/80">{row.sift ?? (scan.status?.vep_applied ? "—" : "flagged only")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detail && (
          <div className="mt-4 border-t border-ink-950/5 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-frost">
                p.{detail.position.ref ?? "?"}
                {detail.position.position}
                {detail.alt}
              </span>
              <button type="button" onClick={() => setDetail(null)} className="btn-ghost !px-2.5 !py-1 text-[10px]">
                close
              </button>
            </div>
            <VariantDetail uniprot={scanUniprot.trim().toUpperCase()} position={detail.position} alt={detail.alt} />
          </div>
        )}
      </Panel>
    </ToolScroll>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-mist/60 uppercase">{label}</span>
      {children}
    </label>
  );
}
