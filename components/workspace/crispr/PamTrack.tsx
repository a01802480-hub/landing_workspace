"use client";

/**
 * PamTrack — SnapGene-style guide overview over the target sequence.
 *
 * A horizontal track: coordinate ruler on top, the plus strand's guides
 * as ticks above the axis, minus-strand guides below. Tick color encodes
 * the on-target score (sequential violet ramp, always paired with the
 * rank label next to the tick), the selected guide gets an amber marker.
 * Clicking a tick selects the guide; the table and track stay synced.
 */
import { memo, useMemo } from "react";
import { regionLeft } from "@/components/workspace/tracks/FeatureTrack";
import type { SgRna } from "@/lib/validation";

const W = 900;
const H = 92;
const AXIS = 48;
const TICK_PLUS = 30;
const TICK_MINUS = 66;

function scoreColor(score: number): string {
  // 0 → pale violet, 100 → deep violet (sequential, never color-alone).
  const t = Math.min(1, Math.max(0, score / 100));
  return `rgb(${Math.round(238 - t * 129)}, ${Math.round(240 - t * 149)}, ${Math.round(252 - t * 28)})`;
}

export const PamTrack = memo(function PamTrack({
  sequence,
  guides,
  selectedId,
  onSelect,
  hoverId,
  onHover,
}: {
  sequence: string;
  guides: SgRna[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hoverId?: string | null;
  onHover?: (id: string | null) => void;
}) {
  const ticks = useMemo(() => {
    // Ruler: every 100 nt labeled.
    const ruler: { x: number; label: string }[] = [];
    for (let bp = 1; bp <= sequence.length; bp += 100) ruler.push({ x: regionLeft(bp, sequence.length), label: String(bp) });
    return ruler;
  }, [sequence.length]);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[600px]"
        role="img"
        aria-label={`Guide overview across ${sequence.length} nt — ${guides.length} guides`}
      >
        {/* Axis + ruler. */}
        <line x1={0} x2={W} y1={AXIS} y2={AXIS} stroke="rgba(102,113,143,0.4)" strokeWidth={1} />
        {ticks.map((t) => (
          <g key={t.label}>
            <line x1={`${t.x}%`} x2={`${t.x}%`} y1={AXIS - 3} y2={AXIS + 3} stroke="rgba(102,113,143,0.6)" strokeWidth={1} />
            <text x={`${t.x}%`} y={AXIS + 14} textAnchor="middle" fontSize={8} fill="#66718f" className="stat-num">
              {t.label}
            </text>
          </g>
        ))}

        {/* Guide ticks — plus strand above, minus below. */}
        {guides.map((g, i) => {
          const x = regionLeft(g.start, sequence.length);
          const y = g.strand === "+" ? TICK_PLUS : TICK_MINUS;
          const selected = g.id === selectedId;
          const hovered = g.id === hoverId;
          const color = selected ? "#c98500" : scoreColor(g.on_target_score);
          return (
            <g
              key={g.id}
              className="cursor-pointer"
              onClick={() => onSelect(g.id)}
              onPointerEnter={() => onHover?.(g.id)}
              onPointerLeave={() => onHover?.(null)}
            >
              <line
                x1={`${x}%`}
                x2={`${x}%`}
                y1={g.strand === "+" ? TICK_PLUS : AXIS + 2}
                y2={g.strand === "+" ? AXIS - 2 : TICK_MINUS}
                stroke={color}
                strokeWidth={selected || hovered ? 3 : 2}
                strokeLinecap="round"
              />
              <text
                x={`${x}%`}
                y={g.strand === "+" ? TICK_PLUS - 5 : TICK_MINUS + 10}
                textAnchor="middle"
                fontSize={8}
                fontWeight={selected ? 700 : 400}
                fill={selected ? "#7a5200" : "#5a6584"}
                className="stat-num"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-mist/60">
        rank 1 = highest {">"} on-target score · + strand above the axis, − strand below · amber = selected
      </p>
    </div>
  );
});
