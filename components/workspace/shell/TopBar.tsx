"use client";

/**
 * TopBar — the workspace's floating status bar: current tool title,
 * backend health chip, link back to the landing page.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HealthChip } from "@/components/workspace/HealthChip";

const TITLES: Record<string, { title: string; note: string }> = {
  "/workspace": { title: "Overview", note: "Workspace dashboard" },
  "/workspace/structure": { title: "Structure", note: "3D viewer · confidence · PAE" },
  "/workspace/dna": { title: "DNA", note: "sequence & plasmid maps · restriction sites" },
  "/workspace/comparative": { title: "Comparative", note: "Orthologs · domains · alignment" },
  "/workspace/variants": { title: "Variants", note: "pLDDT · AlphaMissense · SIFT" },
  "/workspace/lab": { title: "In silico lab", note: "digest & gel · kinetics · dose-response" },
  "/workspace/interactions": { title: "Interactions", note: "docking · ΔG/Kd · solvent denaturation" },
};

export function TopBar() {
  const pathname = usePathname();
  const meta = TITLES[pathname] ?? TITLES["/workspace"];
  return (
    <header className="flex shrink-0 items-center gap-3 px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight text-frost">{meta.title}</h1>
      <span aria-hidden className="hidden text-mist/30 sm:inline">·</span>
      <p className="hidden text-xs text-mist/60 sm:block">{meta.note}</p>
      <div className="ml-auto flex items-center gap-2">
        <HealthChip />
        <Link
          href="/"
          className="chip inline-flex items-center gap-1.5 transition-colors duration-300 ease-out hover:border-ink-950/30 hover:text-frost"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Landing
        </Link>
      </div>
    </header>
  );
}
