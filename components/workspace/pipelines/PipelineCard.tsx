"use client";

/**
 * PipelineCard — one Nextflow template with its parameter form and launch
 * button (Benchling's "run workflow" tile). Params are typed text inputs;
 * launching hands the run id up so the monitor can attach immediately.
 */
import { useState } from "react";
import { Play } from "lucide-react";
import type { PipelineTemplate } from "@/lib/nextflow";

export function PipelineCard({
  template,
  launching,
  onLaunch,
  prefill,
}: {
  template: PipelineTemplate;
  launching: boolean;
  onLaunch: (name: string, params: Record<string, string>) => void;
  /** Prefill from the CRISPR knockout wizard — highlights the card. */
  prefill?: { pipeline: string; params: Record<string, string>; key: number };
}) {
  const [params, setParams] = useState<Record<string, string>>(prefill?.params ?? {});
  const highlighted = prefill !== undefined;

  return (
    <div
      className={`glass-card flex flex-col p-6 transition-shadow duration-300 ease-out ${
        highlighted ? "ring-2 ring-glow-violet/40" : ""
      }`}
    >
      <h2 className="text-base font-semibold text-frost">{template.name}</h2>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-mist/80">{template.description}</p>

      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onLaunch(template.name, params);
        }}
      >
        {template.params.map((p) => (
          <label key={p.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[10px] tracking-wide text-mist/60 uppercase">{p.label}</span>
            <input
              value={params[p.key] ?? ""}
              onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
              className="glass-panel min-w-0 flex-1 px-3 py-1.5 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
              aria-label={p.label}
            />
          </label>
        ))}
        <button type="submit" disabled={launching} className="btn-primary mt-2 inline-flex w-fit items-center gap-1.5 !px-4 !py-1.5 text-xs disabled:opacity-50">
          <Play className="h-3.5 w-3.5" /> {launching ? "Launching…" : highlighted ? "Launch prefilled run" : "Launch"}
        </button>
      </form>
    </div>
  );
}
