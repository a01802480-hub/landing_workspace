"use client";

/**
 * PlddtChart — per-residue pLDDT confidence line chart.
 *
 * Thin wrapper over the shared LineChart engine, configured for the
 * AlphaFold confidence scale: 0–100 domain, canonical 50/70/90 threshold
 * hairlines with subtle tier washes, validated light-mode blue series
 * (#2a78d6). The tooltip carries the canonical band color chip + label
 * (domain convention, always labeled — never color-alone).
 */
import { fmt, plddtBand } from "@/lib/format";
import { LineChart, type LinePoint } from "./LineChart";

export interface PlddtPoint {
  resi: number;
  plddt: number | null;
}

const LINE = "#2a78d6";
const BANDS: { from: number; to: number; color: string }[] = [
  { from: 50, to: 70, color: "#ffdb13" },
  { from: 70, to: 90, color: "#65cbf3" },
  { from: 90, to: 100, color: "#0053d6" },
];

export function PlddtChart({
  series,
  highlight,
  onHover,
  onSelect,
}: {
  series: PlddtPoint[];
  highlight?: number | null;
  onHover?: (resi: number | null) => void;
  onSelect?: (resi: number) => void;
}) {
  const points: LinePoint[] = series.map((p) => ({ resi: p.resi, value: p.plddt }));
  return (
    <LineChart
      points={points}
      yMin={0}
      yMax={100}
      thresholds={[50, 70, 90]}
      washes={BANDS.map((b) => ({ from: b.from, to: b.to, color: b.color, opacity: 0.1 }))}
      lineColor={LINE}
      ariaLabel={`pLDDT confidence per residue, from residue ${series[0]?.resi ?? 0} to ${series[series.length - 1]?.resi ?? 0}`}
      highlight={highlight}
      onHover={onHover}
      onSelect={onSelect}
      tooltip={(p) =>
        p.value == null ? (
          <span className="chip !bg-white/90 backdrop-blur-md">R{p.resi} · no data</span>
        ) : (
          <span className="chip !bg-white/90 backdrop-blur-md">
            <span>R{p.resi} · {fmt(p.value, 1)} pLDDT</span>
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: plddtBand(p.value).color }} />
            <span className="text-mist/80">{plddtBand(p.value).label}</span>
          </span>
        )
      }
    />
  );
}
