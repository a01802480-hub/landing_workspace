"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiValidated } from "@/lib/api";
import { fmt } from "@/lib/format";
import { AlignmentResultSchema, GeneDashboardSchema, type GeneDashboardValidated, type AlignmentResultValidated } from "@/lib/validation";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { StatTile } from "@/components/workspace/panels/StatTile";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { AlignmentViewer } from "@/components/workspace/comparative/AlignmentViewer";
import { DomainTrack } from "@/components/workspace/comparative/DomainTrack";
import { OrthologCard } from "@/components/workspace/comparative/OrthologCard";
import { MsaPanel } from "@/components/workspace/comparative/MsaPanel";

const PRESETS = ["LIG1", "PNKP"];

export default function ComparativePage() {
  const [gene, setGene] = useState("LIG1");
  const [data, setData] = useState<GeneDashboardValidated | null>(null);
  const [alignment, setAlignment] = useState<AlignmentResultValidated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const load = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    setAlignment(null);
    try {
      const dash = await apiValidated(`/comparative/gene/${encodeURIComponent(symbol.trim())}`, GeneDashboardSchema, {
        // Ensembl's legacy hosts can take up to ~2 min; the client stops
        // waiting well before that and reports a designed error state.
        timeoutMs: 150_000,
      });
      setData(dash);
      if (dash.human.sequence && dash.ortholog.sequence) {
        setAlignment(
          await apiValidated("/alignment/pairwise", AlignmentResultSchema, {
            method: "POST",
            body: JSON.stringify({
              sequence_a: dash.human.sequence,
              sequence_b: dash.ortholog.sequence,
            }),
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparative dashboard failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    load("LIG1");
  }, [load]);

  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Comparative genomics</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Human BER-pathway proteins against their blue-whale orthologs — Ensembl homology,
          InterPro domain architecture, and a pairwise alignment in one dashboard.
        </p>
      </header>

      <GlassCard className="mb-8 p-5" hover={false}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(gene);
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <span className="text-xs tracking-wide text-mist/60 uppercase">Gene</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setGene(p);
                  load(p);
                }}
                className={`chip transition-colors duration-300 ease-out ${
                  data?.gene === p
                    ? "border-glow-cyan/50 bg-glow-cyan/10 text-frost"
                    : "hover:border-glow-cyan/40 hover:text-frost"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            value={gene}
            onChange={(e) => setGene(e.target.value)}
            placeholder="Custom gene symbol"
            aria-label="Gene symbol"
            className="glass-panel min-w-0 flex-1 px-3 py-2 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-cyan/50 focus:outline-none"
          />
          <button type="submit" disabled={loading} className="btn-primary !px-4 !py-2 text-sm">
            {loading ? "Aligning…" : "Compare"}
          </button>
        </form>
      </GlassCard>

      {error && (
        <GlassCard className="mb-8 !border-[#d03b3b]/40 p-5 text-sm text-[#c13b3b]" hover={false}>
          {error}
        </GlassCard>
      )}

      {loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {data && !loading && (
        <PanelBoundary title="Comparative dashboard">
          <FloatIn stagger={0.1} className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Human protein"
              value={data.human.name ?? data.gene}
              caption={`${data.human.accession} · ${fmt(data.human.length, 0)} aa`}
            />
            <StatTile
              label="Whale ortholog"
              value={data.ortholog.species_label ?? "Unavailable"}
              caption={
                data.ortholog.available
                  ? `${data.ortholog.percent_identity !== undefined ? fmt(data.ortholog.percent_identity, 1) : "—"}% identity · ${data.ortholog.sequence?.length ?? "—"} aa`
                  : "see detail below"
              }
            />
            <StatTile
              label="Pairwise identity"
              value={alignment ? `${fmt(alignment.identity_pct, 1)}%` : "—"}
              accent="#3987e5"
              caption={alignment ? `${alignment.matches} matches · ${alignment.mismatches} mismatches` : "no sequences"}
            />
            <StatTile
              label="InterPro entries"
              value={fmt(data.domains.length, 0)}
              accent="#6d5ae0"
              caption="annotated regions"
            />
          </FloatIn>

          <FloatIn stagger={0.1} className="mb-8 grid gap-6 lg:grid-cols-2">
            <GlassCard className="p-6" hover={false}>
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                Ortholog — {data.ortholog.species_label ?? "cetaceans"}
              </h2>
              <OrthologCard ortholog={data.ortholog} />
            </GlassCard>
            <GlassCard className="p-6" hover={false}>
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                Domain architecture — {data.human.accession}
              </h2>
              <DomainTrack domains={data.domains} length={data.human.length ?? 1} />
            </GlassCard>
          </FloatIn>

          <FloatIn className="mb-4">
            {alignment ? (
              <>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-frost/90 uppercase">
                  Needleman–Wunsch alignment
                </h2>
                <AlignmentViewer
                  alignedA={alignment.aligned_a}
                  alignedB={alignment.aligned_b}
                  labelA={`${data.gene} (human)`}
                  labelB={data.ortholog.species_label ?? "ortholog"}
                />
              </>
            ) : (
              <GlassCard className="p-6 text-sm text-mist/70" hover={false}>
                No pairwise alignment available — sequences missing on the human or ortholog side.
              </GlassCard>
            )}
          </FloatIn>
        </PanelBoundary>
      )}

      {/* Multi-sequence alignment — independent of the gene dashboard, so it
          stays available even when Ensembl/InterPro degrade. */}
      <PanelBoundary title="Multi-sequence alignment">
        <FloatIn className="mt-8">
          <MsaPanel />
        </FloatIn>
      </PanelBoundary>
    </ToolScroll>
  );
}
