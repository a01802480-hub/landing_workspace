"use client";

/**
 * CrisprGateWizard — the CRISPR-GATE knockout planning flow (Benchling's
 * "Design knockout" wizard): choose a guide, review the plan (guide, PAM,
 * placement, predicted truncation), then export the plan as JSON or push
 * it to the Nextflow pipelines workspace.
 */
import { useState } from "react";
import Link from "next/link";
import { Check, Download, Workflow } from "lucide-react";
import { downloadText } from "@/lib/export";
import { useIde } from "@/lib/ide";
import type { SgRna } from "@/lib/validation";

export interface KnockoutPlan {
  tool: string;
  gene_label: string;
  organism: string;
  guide_id: string;
  spacer: string;
  pam: string;
  start: number;
  end: number;
  strand: string;
  on_target_score: number;
  predicted_effect: string;
}

export function CrisprGateWizard({
  guides,
  selectedId,
  onSelect,
  geneLabel,
  organism,
  sequenceLength,
  disabled = false,
}: {
  guides: SgRna[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  geneLabel: string;
  organism: string;
  sequenceLength: number;
  disabled?: boolean;
}) {
  const [plan, setPlan] = useState<KnockoutPlan | null>(null);
  const { selectTab } = useIde();
  const selected = guides.find((g) => g.id === selectedId) ?? null;

  const buildPlan = () => {
    if (!selected) return;
    const relPos = Math.round(((selected.start + selected.end) / 2 / Math.max(1, sequenceLength)) * 100);
    setPlan({
      tool: "crispr_gate",
      gene_label: geneLabel,
      organism,
      guide_id: selected.id,
      spacer: selected.sequence,
      pam: selected.pam,
      start: selected.start,
      end: selected.end,
      strand: selected.strand,
      on_target_score: selected.on_target_score,
      predicted_effect: `truncating allele — guide placed at ${relPos}% of the target sequence${
        relPos <= 25 ? " (early-CDS knockout placement preferred)" : ""
      }`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-mist/80">
        CRISPR-GATE ranks guides for knockout: early coding-sequence placement truncates the
        protein. Pick a guide, confirm the plan, then push it to Nextflow for validation
        (on-target PCR + indel calling).
      </p>

      {/* Guide picker — compact radio list (top 8 by score). */}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Knockout guide">
        {guides.slice(0, 8).map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={g.id === selectedId}
            disabled={disabled}
            onClick={() => onSelect(g.id)}
            className={`chip font-mono text-[11px] transition-colors duration-300 ease-out disabled:opacity-50 ${
              g.id === selectedId
                ? "border-[#c98500]/60 bg-[#c98500]/10 text-[#7a5200]"
                : "hover:border-glow-violet/40 hover:text-frost"
            }`}
            title={`${g.sequence}${g.pam} · score ${g.on_target_score.toFixed(0)}`}
          >
            #{g.id.split("-").pop()} {g.strand}
            {g.start}–{g.end}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={buildPlan} disabled={!selected || disabled} className="btn-primary !px-3.5 !py-1.5 text-xs disabled:opacity-50">
          <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm knockout plan
        </button>
        {plan && (
          <>
            <button
              type="button"
              onClick={() => downloadText(`${geneLabel || "target"}-knockout-plan.json`, JSON.stringify(plan, null, 2))}
              className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" /> JSON
            </button>
            <Link
              href={{
                pathname: "/workspace",
                query: {
                  run: "crispr-knockout",
                  guides: plan.guide_id,
                  target: geneLabel || "target",
                },
                hash: "#pipelines",
              }}
              scroll={false}
              onClick={() => selectTab("pipelines")}
              className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
            >
              <Workflow className="h-3.5 w-3.5" /> Run in Nextflow
            </Link>
          </>
        )}
      </div>

      {plan && (
        <dl className="mt-1 grid gap-2 rounded-lg border border-ink-950/5 bg-ink-950/[0.03] p-4 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-mist/70">Guide</dt>
            <dd className="stat-num font-mono text-frost/90">{plan.spacer}{plan.pam}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-mist/70">Placement</dt>
            <dd className="stat-num text-frost/90">{plan.start}–{plan.end} ({plan.strand})</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-mist/70">On-target score</dt>
            <dd className="stat-num text-frost/90">{plan.on_target_score.toFixed(0)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <dt className="shrink-0 text-mist/70">Predicted effect</dt>
            <dd className="text-right text-frost/90">{plan.predicted_effect}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
