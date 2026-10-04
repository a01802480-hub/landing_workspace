"use client";

/**
 * GelSimulation — in silico agarose gel: band migration ∝ log(size),
 * normalized to a 1 kb+ ladder. Purely presentational (SVG) — the digest
 * math lives in lib/dna.ts and the fragment CSV exports from the panel.
 */
import { gelY } from "@/lib/dna";

const LADDER = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250];
const W = 340;
const WELL = 30;
const LANE_W = 90;
const LANE_H = 380;

export function GelSimulation({ fragments }: { fragments: number[] }) {
  const laneX = W / 2 - LANE_W - 15;
  const ladderX = W / 2 + 15;

  const Band = ({ x, size, highlight }: { x: number; size: number; highlight?: boolean }) => {
    const y = gelY(size, LANE_H, 24);
    return (
      <g>
        <rect
          x={x - LANE_W / 2 + LANE_W * 0.16}
          y={y - 2.5}
          width={LANE_W * 0.68}
          height={5}
          rx={2.5}
          fill={highlight ? "#6d5ae0" : "#202a44"}
        />
        <text x={x + LANE_W / 2 + 6} y={y + 3} fontSize={9} fill="#66718f" className="stat-num">
          {size.toLocaleString()}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${LANE_H + 46}`} className="w-full" role="img" aria-label="Simulated agarose gel">
      {/* Wells. */}
      {[laneX, ladderX].map((x) => (
        <rect key={x} x={x - LANE_W / 2 + 6} y={4} width={LANE_W - 12} height={10} rx={3} fill="rgba(101,89,163,0.25)" />
      ))}
      {/* Lanes. */}
      {[laneX, ladderX].map((x) => (
        <rect key={x} x={x - LANE_W / 2} y={WELL} width={LANE_W} height={LANE_H} rx={6} fill="rgba(101,89,163,0.06)" stroke="rgba(101,89,163,0.2)" />
      ))}
      {LADDER.map((s) => (
        <Band key={s} x={ladderX} size={s} />
      ))}
      {fragments.map((s, i) => (
        <Band key={`${s}:${i}`} x={laneX} size={s} highlight />
      ))}
      <text x={laneX} y={LANE_H + 34} textAnchor="middle" fontSize={10} fill="#202a44" fontWeight={600}>
        Sample
      </text>
      <text x={ladderX} y={LANE_H + 34} textAnchor="middle" fontSize={10} fill="#66718f">
        1 kb+ ladder
      </text>
      <text x={laneX} y={LANE_H + 16} textAnchor="middle" fontSize={8} fill="#898781">
        {fragments.length ? `${fragments.length} fragment${fragments.length === 1 ? "" : "s"} · ${fragments.reduce((a, b) => a + b, 0).toLocaleString()} bp` : "no cuts"}
      </text>
    </svg>
  );
}
