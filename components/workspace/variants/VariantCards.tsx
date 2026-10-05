"use client";

/**
 * VariantCards — the three per-variant score cards (shared by the
 * single-substitution form and the all-substitutions scan detail).
 *
 * `VariantDetail` synthesizes a VariantImpact-shaped object from a scan
 * position row so the scan's row click renders exactly the same screen
 * as the single-substitution flow — per-source degradation included.
 */
import { fmt, plddtBand } from "@/lib/format";
import type { VariantImpactValidated, VariantScanPosition } from "@/lib/validation";
import { ConsensusMeter } from "@/components/workspace/variants/ConsensusMeter";
import { ScoreCard, ScoreRow, type ScoreTone } from "@/components/workspace/panels/ScoreCard";

export function PlddtCard({ impact }: { impact: VariantImpactValidated }) {
  const p = impact.plddt;
  if (p.status !== "ok" || typeof p.plddt !== "number") {
    return (
      <ScoreCard source="AlphaFold" title="Structural confidence" tone="neutral" toneLabel="unavailable">
        <ScoreRow k="Detail" v={p.detail ?? "No pLDDT at this position."} />
      </ScoreCard>
    );
  }
  const band = plddtBand(p.plddt);
  const tone: ScoreTone = p.plddt >= 70 ? "good" : p.plddt >= 50 ? "warning" : "critical";
  return (
    <ScoreCard
      source="AlphaFold"
      title="Structural confidence"
      tone={tone}
      toneLabel={`pLDDT ${fmt(p.plddt, 1)}`}
      footnote="pLDDT is the per-residue model confidence from the AlphaFold DB model file (B-factor column)."
    >
      <ScoreRow k="pLDDT at position" v={<span style={{ color: band.color }}>{fmt(p.plddt, 1)}</span>} />
      <ScoreRow k="Band" v={band.label} />
      <ScoreRow k="Mean model pLDDT" v={p.mean_model_plddt !== undefined ? fmt(p.mean_model_plddt, 1) : "—"} />
    </ScoreCard>
  );
}

export function AlphaMissenseCard({ impact }: { impact: VariantImpactValidated }) {
  const a = impact.alphamissense;
  if (a.status !== "ok" || !a.class) {
    return (
      <ScoreCard source="AlphaMissense" title="Pathogenicity" tone="neutral" toneLabel="unavailable">
        <ScoreRow k="Detail" v={a.detail ?? "No AlphaMissense row for this position."} />
      </ScoreCard>
    );
  }
  const tone: ScoreTone =
    a.class === "pathogenic" ? "critical" : a.class === "ambiguous" ? "warning" : a.class === "benign" ? "good" : "neutral";
  return (
    <ScoreCard
      source="AlphaMissense"
      title="Pathogenicity"
      tone={tone}
      toneLabel={a.class.replace(/_/g, " ")}
      footnote="AlphaMissense class for the substitution at this position (hegelab hotspot API)."
    >
      <ScoreRow k="Class" v={a.class} />
      <ScoreRow k="Mean pathogenicity" v={a.mean_pathogenicity !== undefined ? fmt(a.mean_pathogenicity, 4) : "—"} mono />
    </ScoreCard>
  );
}

export function SiftCard({ impact }: { impact: VariantImpactValidated }) {
  const s = impact.sift;
  if (s.status !== "ok" || !s.sift) {
    return (
      <ScoreCard source="SIFT / VEP" title="Tolerance" tone="neutral" toneLabel="unavailable">
        <ScoreRow k="Detail" v={s.detail ?? "No SIFT consequence for this substitution."} />
      </ScoreCard>
    );
  }
  const pred = s.sift.prediction ?? "";
  const tone: ScoreTone = pred.includes("deleterious") ? "critical" : pred === "tolerated" ? "good" : "warning";
  return (
    <ScoreCard
      source="SIFT / VEP"
      title="Tolerance"
      tone={tone}
      toneLabel={pred.replace(/_/g, " ")}
      footnote="SIFT + PolyPhen computed by Ensembl VEP on the canonical transcript."
    >
      <ScoreRow k="SIFT score" v={s.sift.score !== undefined ? fmt(s.sift.score, 3) : "—"} mono />
      <ScoreRow k="Prediction" v={pred} />
      {s.polyphen && (
        <ScoreRow
          k="PolyPhen"
          v={`${s.polyphen.prediction ?? ""} ${s.polyphen.score !== undefined ? fmt(s.polyphen.score, 3) : ""}`}
        />
      )}
    </ScoreCard>
  );
}

/** One scan position row + one alt → the four-card detail (the same
 *  screen as the single-substitution flow). */
export function VariantDetail({
  uniprot,
  position,
  alt,
}: {
  uniprot: string;
  position: VariantScanPosition;
  alt: string;
}) {
  const am = position.alphamissense ?? { status: "unavailable" as const };
  const sub = am.status === "ok" ? (am.substitutions ?? []).find((s) => s.alt === alt) : undefined;
  const impact = {
    uniprot_id: uniprot,
    variant: `p.${position.ref ?? "?"}${position.position}${alt}`,
    plddt: position.plddt ?? { status: "unavailable" as const },
    alphamissense: {
      status: am.status,
      class: sub?.class,
      mean_pathogenicity: am.status === "ok" ? am.mean : undefined,
      detail: am.detail,
    },
    sift: position.sift ?? { status: "unavailable" as const },
  } as VariantImpactValidated;
  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-4">
      <PlddtCard impact={impact} />
      <AlphaMissenseCard impact={impact} />
      <SiftCard impact={impact} />
      <ConsensusMeter impact={impact} />
    </div>
  );
}
