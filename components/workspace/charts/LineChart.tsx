"use client";

/**
 * LineChart — the shared interactive SVG line-chart engine behind the
 * pLDDT and local-writhe panels.
 *
 * Dataviz rules applied (see lib/format.ts for the palette contract):
 * - One series → no legend box; the panel title names it. The line uses a
 *   validated categorical slot; a soft gradient area under the curve
 *   carries magnitude.
 * - Threshold hairlines (pLDDT 50/70/90, writhe 0) are labeled, muted,
 *   never color-alone.
 * - Hover layer: crosshair + tooltip by default; keyboard scrubbing with
 *   the arrow keys; role="img" + aria-label.
 * - Null values break the path into segments (gaps in the model).
 */
import { useMemo, useRef, useState, type ReactNode } from "react";

const VB_W = 800;
const VB_H = 240;
const M = { l: 40, r: 30, t: 14, b: 28 };
const PLOT_W = VB_W - M.l - M.r;
const PLOT_H = VB_H - M.t - M.b;
const HAIR = "rgba(32, 42, 68, 0.09)";
const MUTED = "#898781";

export interface LinePoint {
  resi: number;
  value: number | null;
}

export interface BandWash {
  from: number;
  to: number;
  color: string;
  opacity: number;
}

export interface OverlaySeries {
  points: LinePoint[];
  color: string;
  label: string;
}

function x(i: number, n: number): number {
  return M.l + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_W);
}

function yOf(v: number, yMin: number, yMax: number): number {
  const span = yMax - yMin || 1;
  const t = (v - yMin) / span;
  return M.t + (1 - Math.min(1, Math.max(0, t))) * PLOT_H;
}

export function LineChart({
  points,
  yMin,
  yMax,
  thresholds = [],
  washes = [],
  lineColor,
  areaOpacity = 0.08,
  tooltip,
  highlight,
  onHover,
  onSelect,
  ariaLabel,
  xPos,
  xTickLabel,
  overlays = [],
}: {
  points: LinePoint[];
  yMin: number;
  yMax: number;
  thresholds?: number[];
  washes?: BandWash[];
  lineColor: string;
  areaOpacity?: number;
  tooltip: (p: LinePoint, overlayValues: { label: string; value: number | null }[]) => ReactNode;
  highlight?: number | null;
  onHover?: (resi: number | null) => void;
  onSelect?: (resi: number) => void;
  ariaLabel: string;
  /** Optional normalized (0..1) x position per index — e.g. log dose scales. */
  xPos?: (i: number) => number;
  /** Optional x-tick label formatter (defaults to the point's resi). */
  xTickLabel?: (i: number) => string;
  /** Optional overlay series (legend always shown when present). */
  overlays?: OverlaySeries[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);

  const n = points.length;
  const posOf = useMemo(
    () =>
      xPos
        ? xPos
        : (i: number) => (n <= 1 ? 0 : i / (n - 1)),
    [xPos, n],
  );
  const px = (i: number): number => M.l + posOf(i) * PLOT_W;

  const { path, areaPath, indexOfResi, firstResi, lastResi } = useMemo(() => {
    let d = "";
    let area = "";
    let pen = false;
    let lastX = M.l;
    const map = new Map<number, number>();
    points.forEach((p, i) => {
      map.set(p.resi, i);
      if (p.value == null) {
        pen = false;
        return;
      }
      const cx = px(i).toFixed(2);
      const py = yOf(p.value, yMin, yMax).toFixed(2);
      d += `${pen ? " L" : " M"}${cx},${py}`;
      area += `${pen ? " L" : ` M${cx},${M.t + PLOT_H} L`}${cx},${py}`;
      lastX = px(i);
      pen = true;
    });
    if (pen) area += ` L${lastX.toFixed(2)},${M.t + PLOT_H} Z`;
    return {
      path: d,
      areaPath: area,
      indexOfResi: map,
      firstResi: points[0]?.resi ?? 0,
      lastResi: points[points.length - 1]?.resi ?? 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, yMin, yMax, xPos]);

  const activeIdx = highlight != null ? indexOfResi.get(highlight) ?? null : scrub;
  const active = activeIdx != null ? points[activeIdx] : null;

  // Overlay paths (same x scale — overlays share the primary's index grid).
  const overlayPaths = useMemo(() => {
    return overlays.map((o) => {
      let d = "";
      let pen = false;
      o.points.forEach((p, i) => {
        if (i >= points.length) return;
        if (p.value == null) {
          pen = false;
          return;
        }
        d += `${pen ? " L" : " M"}${px(i).toFixed(2)},${yOf(p.value, yMin, yMax).toFixed(2)}`;
        pen = true;
      });
      return { ...o, path: d };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays, points.length, yMin, yMax, xPos]);

  const moveTo = (idx: number | null) => {
    setScrub(idx);
    if (idx == null) onHover?.(null);
    else {
      const p = points[idx];
      if (p) onHover?.(p.resi);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n < 2) return;
    const frac = (e.clientX - rect.left) / rect.width;
    let idx: number;
    if (xPos) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(posOf(i) - frac);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      idx = best;
    } else {
      idx = Math.round(frac * (n - 1));
    }
    moveTo(Math.max(0, Math.min(n - 1, idx)));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const cur = activeIdx ?? 0;
      const next = e.key === "ArrowLeft" ? Math.max(0, cur - 1) : Math.min(n - 1, cur + 1);
      moveTo(next);
    } else if (e.key === "Escape") {
      moveTo(null);
    }
  };

  if (n === 0 || path === "") {
    return <p className="flex h-full items-center justify-center px-6 text-sm text-mist/60">No data for this chart.</p>;
  }

  const xTicks = 6;
  const tickIdx = (k: number): number => {
    if (!xPos) return Math.min(n - 1, k * Math.max(1, Math.ceil((n - 1) / (xTicks - 1))));
    const target = k / (xTicks - 1);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(posOf(i) - target);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  const yTicks = 5;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full cursor-crosshair outline-none"
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={onPointerMove}
      onPointerLeave={() => moveTo(null)}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (active) onSelect?.(active.resi);
      }}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {/* Band washes (e.g. pLDDT confidence tiers). */}
        {washes.map((w) => (
          <rect
            key={`${w.from}-${w.to}`}
            x={M.l}
            y={yOf(Math.min(w.to, yMax), yMin, yMax)}
            width={PLOT_W}
            height={Math.max(0, yOf(Math.max(w.from, yMin), yMin, yMax) - yOf(Math.min(w.to, yMax), yMin, yMax))}
            fill={w.color}
            opacity={w.opacity}
          />
        ))}

        {/* Grid + y labels. */}
        {Array.from({ length: yTicks }, (_, k) => {
          const v = yMin + ((yMax - yMin) * k) / (yTicks - 1);
          return (
            <g key={k}>
              <line x1={M.l} x2={M.l + PLOT_W} y1={yOf(v, yMin, yMax)} y2={yOf(v, yMin, yMax)} stroke={HAIR} strokeWidth={1} />
              <text x={M.l - 6} y={yOf(v, yMin, yMax) + 3} textAnchor="end" fontSize={9} fill={MUTED} className="stat-num">
                {Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(1))}
              </text>
            </g>
          );
        })}

        {/* X ticks. */}
        {Array.from({ length: xTicks }, (_, k) => {
          const idx = tickIdx(k);
          const p = points[idx];
          return (
            <text key={k} x={px(idx)} y={VB_H - 8} textAnchor="middle" fontSize={9} fill={MUTED} className="stat-num">
              {p ? (xTickLabel ? xTickLabel(idx) : p.resi) : ""}
            </text>
          );
        })}

        {/* Threshold hairlines with labels. */}
        {thresholds.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={M.l + PLOT_W} y1={yOf(t, yMin, yMax)} y2={yOf(t, yMin, yMax)} stroke={HAIR} strokeWidth={1} strokeDasharray="4 4" />
            <text x={M.l + PLOT_W + 4} y={yOf(t, yMin, yMax) + 3} fontSize={8} fill={MUTED} className="stat-num">
              {t}
            </text>
          </g>
        ))}

        {/* Area + line. */}
        <path d={areaPath} fill={lineColor} opacity={areaOpacity} />
        <path d={path} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Overlay series. */}
        {overlayPaths.map((o) => (
          <g key={o.label}>
            <path d={o.path} fill="none" stroke={o.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 4" />
          </g>
        ))}

        {/* Crosshair. */}
        {activeIdx != null && (
          <g>
            <line x1={px(activeIdx)} x2={px(activeIdx)} y1={M.t} y2={M.t + PLOT_H} stroke={lineColor} strokeWidth={1} opacity={0.5} />
            {active?.value != null && (
              <circle cx={px(activeIdx)} cy={yOf(active.value, yMin, yMax)} r={4} fill={lineColor} stroke="#ffffff" strokeWidth={2} />
            )}
          </g>
        )}
      </svg>

      {/* Overlay legend (always present when overlays exist). */}
      {overlayPaths.length > 0 && (
        <div className="pointer-events-none absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
          {overlayPaths.map((o) => (
            <span key={o.label} className="chip !bg-white/90 !py-0.5 text-[9px] backdrop-blur-md">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: o.color }} />
              {o.label}
            </span>
          ))}
        </div>
      )}

      {/* Tooltip (HTML — text nodes only). */}
      {active && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2"
          style={{ left: `${(px(activeIdx ?? 0) / VB_W) * 100}%` }}
        >
          {tooltip(
            active,
            activeIdx != null
              ? overlayPaths.map((o) => ({ label: o.label, value: o.points[activeIdx]?.value ?? null }))
              : [],
          )}
        </div>
      )}
    </div>
  );
}
