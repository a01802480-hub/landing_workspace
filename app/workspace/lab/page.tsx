"use client";

/**
 * In silico lab — simulated genetics assays:
 *
 * - Restriction digest → agarose gel simulation (band migration ∝ log size,
 *   1 kb+ ladder) with fragment CSV export.
 * - Michaelis–Menten kinetics with live sliders + CSV.
 * - Four-parameter logistic dose–response on a log dose axis + CSV.
 *
 * The digest reads the same strictly-parsed registry payload as the DNA
 * workspace (server-cached) — the simulation math lives in lib/dna.ts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiValidated } from "@/lib/api";
import { digestFragments, enzymeColor } from "@/lib/dna";
import { downloadCsv } from "@/lib/export";
import { DnaEnzymesSchema, DnaRegistrySchema, type DnaRegistry } from "@/lib/validation";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { Panel } from "@/components/workspace/panels/Panel";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { GelSimulation } from "@/components/workspace/lab/GelSimulation";
import { KineticsPanel } from "@/components/workspace/lab/KineticsPanel";
import { MmParticleSim } from "@/components/workspace/lab/MmParticleSim";
import { DenaturationPanel } from "@/components/workspace/lab/DenaturationPanel";
import { DoseResponsePanel } from "@/components/workspace/lab/DoseResponsePanel";

export default function LabPage() {
  const [registry, setRegistry] = useState<DnaRegistry | null>(null);
  const [enzymes, setEnzymes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(["EcoRI"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiValidated("/dna/registry/J01749", DnaRegistrySchema),
      apiValidated("/dna/enzymes", DnaEnzymesSchema),
    ])
      .then(([reg, cat]) => {
        if (cancelled) return;
        setRegistry(reg);
        setEnzymes(cat.enzymes.map((e) => e.name));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lab data unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fragments = useMemo(() => {
    if (!registry) return [];
    const cuts = registry.sites.filter((s) => selected.includes(s.enzyme)).map((s) => s.start);
    return digestFragments(registry.length, cuts, registry.topology);
  }, [registry, selected]);

  const toggleEnzyme = useCallback((name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]));
  }, []);

  const exportDigest = () => {
    downloadCsv("pBR322-digest.csv", [["fragment_bp"], ...fragments.map((f) => [f])]);
  };

  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">In silico lab</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Simulated genetics: restriction digests with agarose gel readouts, Michaelis–Menten
          kinetics and dose–response curves — every dataset exportable as CSV.
        </p>
      </header>

      <Panel
        title="Restriction digest → gel"
        note={registry ? `${registry.accession} · ${registry.topology} · ${registry.length} bp` : undefined}
        actions={
          <button type="button" onClick={exportDigest} className="btn-ghost !px-2.5 !py-1 text-[10px]">
            CSV
          </button>
        }
        className="mb-6"
        bodyClassName="p-4"
      >
        <PanelBoundary title="Digest & gel" className="h-full">
          {loading ? (
            <PanelSkeleton variant="heatmap" caption="Preparing the bench…" />
          ) : error ? (
            <p className="px-2 text-sm text-mist/70">{error}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {enzymes.map((name) => {
                const active = selected.includes(name);
                const inRegistry = registry?.sites.some((s) => s.enzyme === name);
                return (
                  <button
                    key={name}
                    type="button"
                    role="switch"
                    aria-checked={active}
                    disabled={!inRegistry}
                    onClick={() => toggleEnzyme(name)}
                    title={inRegistry ? undefined : "not present in this sequence"}
                    className={`chip transition-colors duration-300 ease-out ${
                      active ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : inRegistry ? "hover:text-frost" : "opacity-40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ background: enzymeColor(name) }}
                    />
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          {registry && !loading && (
            <div className="mt-4 max-w-xl">
              <GelSimulation fragments={fragments} />
            </div>
          )}
        </PanelBoundary>
      </Panel>

      <Panel
        title="2D particle kinetics"
        note="live particle simulation · random-walk substrate"
        className="mb-6"
      >
        <PanelBoundary title="2D particle kinetics" className="h-full">
          <MmParticleSim />
        </PanelBoundary>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Michaelis–Menten kinetics" note="enzyme steady-state · inhibitor model" className="h-[26rem]">
          <PanelBoundary title="Kinetics simulation" className="h-full">
            <KineticsPanel />
          </PanelBoundary>
        </Panel>
        <Panel title="Solvent denaturation" note="ethanol-driven unfolding · turbidity" className="h-[26rem]">
          <PanelBoundary title="Denaturation simulation" className="h-full">
            <DenaturationPanel />
          </PanelBoundary>
        </Panel>
        <Panel title="Dose–response" note="4-parameter logistic · log dose" className="h-96">
          <PanelBoundary title="Dose-response simulation" className="h-full">
            <DoseResponsePanel />
          </PanelBoundary>
        </Panel>
        <Panel title="Assembly wizard" note="Gibson & Golden Gate — next on the bench" className="h-96">
          <PanelBoundary title="Assembly wizard" className="h-full">
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-mist/60">
              Overhang validation and fragment-order planning for Gibson Assembly and Golden Gate
              cloning are on the roadmap — the digest engine behind them is already live.
            </p>
          </PanelBoundary>
        </Panel>
      </div>
    </ToolScroll>
  );
}
