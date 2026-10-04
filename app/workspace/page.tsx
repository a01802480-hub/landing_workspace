"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Dna, FlaskConical, GitCompareArrows, Orbit, Pill, Zap, type LucideIcon } from "lucide-react";
import { apiValidated } from "@/lib/api";
import { CatalogSchema } from "@/lib/validation";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { IsometricTilt } from "@/components/antigravity/IsometricTilt";
import { HealthChip } from "@/components/workspace/HealthChip";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";

const TOOLS: { href: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    href: "/workspace/structure",
    icon: Dna,
    title: "Structure workspace",
    body: "3Dmol strict cartoon (α-helix ribbons, β-sheet arrows), full-residue sequence track, pLDDT chart and PAE heatmap — all synced.",
  },
  {
    href: "/workspace/dna",
    icon: Orbit,
    title: "DNA & plasmid maps",
    body: "Benchling-style dual-stranded sequence viewer and interactive circular plasmid map (pBR322): restriction sites, ORFs, features — synchronized.",
  },
  {
    href: "/workspace/interactions",
    icon: Pill,
    title: "Interactions",
    body: "Empirical protein–drug docking (ΔG, Kd, contact points) and solvent-driven denaturation with a live 3D unfolding view.",
  },
  {
    href: "/workspace/comparative",
    icon: GitCompareArrows,
    title: "Comparative genomics",
    body: "LIG1 and PNKP: human vs. blue-whale orthologs, InterPro domain tracks, pairwise alignment, and Clustal Omega multi-sequence alignments.",
  },
  {
    href: "/workspace/variants",
    icon: Zap,
    title: "Variant impact",
    body: "Submit a substitution — get AlphaFold pLDDT, AlphaMissense pathogenicity and SIFT tolerance, each degrading gracefully on its own.",
  },
  {
    href: "/workspace/lab",
    icon: FlaskConical,
    title: "In silico lab",
    body: "Restriction digests with agarose gel readouts, a live 2D Michaelis–Menten particle simulator, kinetics and dose–response — all CSV-exportable.",
  },
];

export default function WorkspaceHub() {
  const [structureCount, setStructureCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiValidated("/structure/catalog", CatalogSchema)
      .then((r) => {
        if (!cancelled) setStructureCount(r.entries.length);
      })
      .catch(() => {
        if (!cancelled) setStructureCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ToolScroll>
      <FloatIn className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-frost">Workspace</h1>
          <p className="mt-2 max-w-xl text-mist">
            Every tool is a floating panel over the same clinical void. Pick a lens, or start
            from the challenge structures below.
          </p>
        </div>
        <HealthChip />
      </FloatIn>

      {/* Watermelon-style KPI blocks — dashboard summary tiles. */}
      <FloatIn stagger={0.1} className="mb-8 grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <p className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">Challenge structures</p>
          <p className="stat-num mt-2 text-2xl font-semibold text-frost">{structureCount ?? "…"}</p>
          <p className="mt-1 text-xs text-mist/70">LIG1 · RuBisCO presets, one click away</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">Analysis channels</p>
          <p className="stat-num mt-2 text-2xl font-semibold text-frost">10</p>
          <p className="mt-1 text-xs text-mist/70">pLDDT · PAE · writhe · domains · alignment · pathogenicity · SIFT · restriction maps · kinetics</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">Upstream sources</p>
          <p className="stat-num mt-2 text-2xl font-semibold text-frost">7</p>
          <p className="mt-1 text-xs text-mist/70">AlphaFold DB · RCSB · UniProt · Ensembl · InterPro · NCBI Entrez · AlphaMissense/VEP</p>
        </GlassCard>
      </FloatIn>

      <FloatIn stagger={0.1} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((t) => (
          <IsometricTilt key={t.href} className="h-full">
            <Link href={t.href} className="block h-full">
              <GlassCard className="flex h-full flex-col p-7">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-950/10 bg-glow-violet/10 text-glow-violet" aria-hidden>
                  <t.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h2 className="text-lg font-semibold text-frost">{t.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist">{t.body}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-glow-violet/90">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </GlassCard>
            </Link>
          </IsometricTilt>
        ))}
      </FloatIn>
    </ToolScroll>
  );
}
