"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiValidated } from "@/lib/api";
import { CatalogSchema } from "@/lib/validation";
import { WORKSPACE_TOOLS } from "@/lib/tools";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { IsometricTilt } from "@/components/antigravity/IsometricTilt";
import { HealthChip } from "@/components/workspace/shell/HealthChip";
import { StatTile } from "@/components/workspace/panels/StatTile";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";

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

      {/* KPI blocks — the shared StatTile, one block style for every dashboard. */}
      <FloatIn stagger={0.1} className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Challenge structures"
          value={structureCount ?? "…"}
          caption="LIG1 · RuBisCO presets, one click away"
        />
        <StatTile
          label="Analysis channels"
          value={WORKSPACE_TOOLS.length}
          caption="structure · DNA · CRISPR · pipelines · interactions · comparative · variants · lab"
        />
        <StatTile
          label="Upstream sources"
          value="7"
          caption="AlphaFold DB · RCSB · UniProt · Ensembl · InterPro · NCBI Entrez · AlphaMissense/VEP"
        />
      </FloatIn>

      <FloatIn stagger={0.1} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {WORKSPACE_TOOLS.map((t) => (
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
