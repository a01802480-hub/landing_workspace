"use client";

/**
 * PlddtLegend — the canonical AlphaFold confidence band legend, shared by
 * every pLDDT surface: the per-residue strip, the line chart tooltips, the
 * 3D viewer overlay and the sequence track. One component, one palette.
 */
import { PLDDT_BANDS } from "@/lib/format";

export function PlddtLegend({
  className = "",
  solid = false,
}: {
  className?: string;
  /** Solid (non-blurred) chips for use inside panels rather than overlays. */
  solid?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="pLDDT confidence bands">
      {PLDDT_BANDS.map((band) => (
        <span key={band.label} className={`chip !py-0.5 text-[9px] ${solid ? "" : "!bg-white/80 backdrop-blur-md"}`}>
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: band.color }} />
          {band.label} · {band.range}
        </span>
      ))}
    </div>
  );
}
