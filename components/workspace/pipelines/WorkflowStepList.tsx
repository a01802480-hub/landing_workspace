"use client";

/**
 * WorkflowStepList — per-process progress for a pipeline run (Nextflow's
 * execution trace, Benchling-style status dots): pending (dim), running
 * (pulsing), cached/succeeded (good), failed (critical). Every status is
 * labeled — never a bare dot.
 */
import { Check, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import type { PipelineStep } from "@/lib/nextflow";

const STATUS_META: Record<PipelineStep["status"], { icon: typeof Check; className: string; label: string; dot: string }> = {
  pending: { icon: CircleDashed, className: "text-mist/40", label: "pending", dot: "#898781" },
  running: { icon: Loader2, className: "animate-spin text-glow-violet", label: "running", dot: "#6d5ae0" },
  cached: { icon: Check, className: "text-[#0ca30c]", label: "cached", dot: "#0ca30c" },
  succeeded: { icon: Check, className: "text-[#0ca30c]", label: "succeeded", dot: "#0ca30c" },
  failed: { icon: TriangleAlert, className: "text-[#c13b3b]", label: "failed", dot: "#c13b3b" },
};

export function WorkflowStepList({ steps }: { steps: PipelineStep[] }) {
  if (!steps.length) {
    return <p className="px-2 text-sm text-mist/60">No step trace yet.</p>;
  }
  return (
    <ol className="space-y-1">
      {steps.map((step) => {
        const meta = STATUS_META[step.status];
        const Icon = meta.icon;
        return (
          <li
            key={step.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors duration-300 ease-out hover:bg-ink-950/5"
          >
            <Icon aria-hidden className={`h-4 w-4 shrink-0 ${meta.className}`} />
            <span className="min-w-0 flex-1 truncate text-frost/90">{step.name}</span>
            <span className="chip shrink-0 !py-0.5 text-[9px]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
