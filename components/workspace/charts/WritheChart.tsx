"use client";

/**
 * WritheChart — per-residue local backbone writhe line chart (diverging
 * scale about zero). Shown when a structure has writhe data but no PAE
 * matrix (RCSB models, AlphaFold models without a PAE file), so the
 * dashboard always presents two graphs.
 *
 * Diverging rules: violet line (validated light categorical slot) over a
 * dashed zero hairline; the tooltip chip colors the sign with the same
 * validated violet/blue diverging pair used in the 3D viewer.
 */
import { fmt, writheColor } from "@/lib/format";
import { LineChart, type LinePoint } from "./LineChart";

const LINE = "#6d5ae0";

export function WritheChart({
  values,
  highlight,
  onHover,
  onSelect,
}: {
  /** Signed local writhe per residue, aligned with `resis`. */
  values: { resi: number; value: number }[];
  highlight?: number | null;
  onHover?: (resi: number | null) => void;
  onSelect?: (resi: number) => void;
}) {
  const extent = values.length
    ? Math.max(0.05, ...values.map((v) => Math.abs(v.value)))
    : 0.05;
  const points: LinePoint[] = values.map((v) => ({ resi: v.resi, value: v.value }));
  return (
    <LineChart
      points={points}
      yMin={-extent}
      yMax={extent}
      thresholds={[0]}
      lineColor={LINE}
      areaOpacity={0.05}
      ariaLabel={`Local backbone writhe per residue, from residue ${values[0]?.resi ?? 0} to ${values[values.length - 1]?.resi ?? 0}`}
      highlight={highlight}
      onHover={onHover}
      onSelect={onSelect}
      tooltip={(p) =>
        p.value == null ? (
          <span className="chip !bg-white/90 backdrop-blur-md">R{p.resi} · no data</span>
        ) : (
          <span className="chip !bg-white/90 backdrop-blur-md">
            <span>R{p.resi} · {fmt(p.value, 4)}</span>
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: writheColor(p.value, extent) }}
            />
            <span className="text-mist/80">{p.value >= 0 ? "positive twist" : "negative twist"}</span>
          </span>
        )
      }
    />
  );
}
