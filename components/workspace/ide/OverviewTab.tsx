"use client";

import { Dna, Layers, NotebookPen } from "lucide-react";
import { BioWorkspaceCanvas } from "@/components/workspace/free/BioWorkspaceCanvas";

export function OverviewTab() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <section className="mx-auto flex w-full max-w-5xl flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-frost">Free Workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-mist">
            Start from a blank analysis page, insert biological blocks in-place, and keep sequence work directly in context.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="chip inline-flex items-center gap-1.5"><NotebookPen className="h-3.5 w-3.5" /> Document-first</span>
          <span className="chip inline-flex items-center gap-1.5"><Dna className="h-3.5 w-3.5" /> Biological blocks</span>
          <span className="chip inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Layered annotations</span>
        </div>
      </section>
      <BioWorkspaceCanvas />
    </div>
  );
}
