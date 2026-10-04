import Link from "next/link";
import { ArrowRight, Dna, GitCompareArrows, Zap, type LucideIcon } from "lucide-react";
import { FloatIn } from "@/components/antigravity/FloatIn";
import { GlassCard } from "@/components/antigravity/GlassCard";
import { IsometricTilt } from "@/components/antigravity/IsometricTilt";

const TOOLS: { href: string; icon: LucideIcon; title: string; body: string; tags: string[] }[] = [
  {
    href: "/workspace/structure",
    icon: Dna,
    title: "3D Structure Workspace",
    body: "Interactive backbone rendering with writhe mapping (LIG1) and catalytic-site geometry (RuBisCO Mg²⁺ site), powered by 3Dmol.js.",
    tags: ["RCSB", "AlphaFold", "Writhe", "pLDDT"],
  },
  {
    href: "/workspace/comparative",
    icon: GitCompareArrows,
    title: "Comparative Genomics",
    body: "Human vs. blue-whale orthologs for BER pathway proteins — Ensembl homology, InterPro domain tracks, pairwise and multi-sequence alignment.",
    tags: ["LIG1", "PNKP", "Ensembl", "Clustal"],
  },
  {
    href: "/workspace/variants",
    icon: Zap,
    title: "Variant Impact",
    body: "One substitution, three verdicts: AlphaFold structural confidence, AlphaMissense pathogenicity and SIFT tolerance — with graceful degradation.",
    tags: ["AlphaMissense", "SIFT", "pLDDT"],
  },
];

/**
 * Tool selection grid: cards float into view staggered by 0.1s, then snap into
 * an isometric perspective on hover (IsometricTilt, transform-only).
 */
export function ToolGrid() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <FloatIn className="mb-14 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-frost">Choose your lens</h2>
        <p className="mt-3 text-mist">Three pipelines, rendered in the same weightless workspace.</p>
      </FloatIn>
      <FloatIn stagger={0.1} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <IsometricTilt key={tool.href} className="h-full">
            <Link href={tool.href} className="block h-full">
              <GlassCard className="flex h-full flex-col p-7">
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-950/10 bg-glow-violet/10 text-glow-violet"
                    aria-hidden
                  >
                    <tool.icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <ArrowRight aria-hidden className="h-4 w-4 text-mist/60" />
                </div>
                <h3 className="text-lg font-semibold text-frost">{tool.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist">{tool.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {tool.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </Link>
          </IsometricTilt>
        ))}
      </FloatIn>
    </section>
  );
}
