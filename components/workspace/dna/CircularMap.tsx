"use client";

/**
 * CircularMap — interactive circular plasmid viewer (SVG), synchronized
 * with the linear sequence map.
 *
 * Rings (outside → in): restriction cut-site ticks with enzyme labels,
 * feature arcs with direction arrows (ampR/bla, tet, rop, ori, bom…),
 * and a base-pair ruler with 1 kb labels. Wheel zoom + drag pan; hovering
 * or clicking reports the base position back to the linear map, and a
 * selection from the linear map draws as a radial highlight here.
 */
import { memo, useMemo, useRef, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { DnaRegistry } from "@/lib/validation";
import { enzymeColor, featureColor } from "@/lib/dna";
import type { DnaSelection } from "./LinearMap";

const SIZE = 420;
const C = SIZE / 2;
const R_FEATURES = 128;
const R_RULER = 112;
const R_SITES = 150;

function polar(r: number, angle: number): [number, number] {
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
}

/** bp (1-based) → SVG angle in radians (0 at 12 o'clock, clockwise). */
function bpAngle(bp: number, length: number): number {
  return ((bp - 1) / length) * Math.PI * 2 - Math.PI / 2;
}

function arcPath(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export const CircularMap = memo(function CircularMap({
  registry,
  selection,
  hoverBp,
  focusBp,
  onSelect,
  onHover,
}: {
  registry: DnaRegistry;
  selection: DnaSelection | null;
  hoverBp: number | null;
  focusBp: number | null;
  onSelect: (sel: DnaSelection) => void;
  onHover: (bp: number | null) => void;
}) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const bpFromPoint = (x: number, y: number): number | null => {
    // Inverse of the view transform, then cartesian → angle → bp.
    const vx = (x - C - view.x) / view.scale;
    const vy = (y - C - view.y) / view.scale;
    const angle = Math.atan2(vy, vx) + Math.PI / 2; // back to 0-at-top clockwise
    const frac = (angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2);
    return Math.floor(frac * registry.length) + 1;
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setView((v) => ({ ...v, scale: Math.min(4, Math.max(0.5, v.scale * (e.deltaY < 0 ? 1.12 : 0.9))) }));
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      if (dragRef.current.moved) {
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        dragRef.current = { x: e.clientX, y: e.clientY, moved: true };
      }
    }
    const bp = bpFromPoint(x, y);
    if (bp) onHover(bp);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current && !dragRef.current.moved) {
      const rect = e.currentTarget.getBoundingClientRect();
      const bp = bpFromPoint(e.clientX - rect.left, e.clientY - rect.top);
      if (bp) onSelect({ start: bp, end: bp });
    }
    dragRef.current = null;
  };

  const rulerTicks = useMemo(() => {
    const ticks: { bp: number; label: boolean }[] = [];
    for (let bp = 1; bp <= registry.length; bp += 500) ticks.push({ bp, label: bp % 1000 === 1 });
    return ticks;
  }, [registry.length]);

  const focus = hoverBp ?? (selection ? Math.round((selection.start + selection.end) / 2) : focusBp);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={`Circular map of ${registry.accession}, ${registry.length} base pairs, ${registry.topology}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => onHover(null)}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {/* Feature arcs — unique-keyed by index (type+start is not unique
              upstream: pBR322 carries two `source` records at position 1). */}
          {registry.features
            .filter((f) => !["source", "old_sequence"].includes(f.type))
            .slice(0, 24)
            .map((f, i) => {
            const a0 = bpAngle(f.start, registry.length);
            const a1 = bpAngle(f.end, registry.length);
            const color = featureColor(i);
            return (
              <g key={`${f.type}:${f.start}:${i}`} className="cursor-pointer">
                <path d={arcPath(R_FEATURES, a0, a1)} fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" opacity={0.9} />
                <path
                  d={arcPath(R_FEATURES, a0, a1)}
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                {/* Direction arrow at the arc end. */}
                <g transform={`translate(${polar(R_FEATURES, f.strand === 1 ? a1 : a0).join(" ")}) rotate(${((f.strand === 1 ? a1 : a0) * 180) / Math.PI + 90})`}>
                  <path d="M -5 -4 L 5 0 L -5 4 Z" fill={color} />
                </g>
                <text
                  x={polar(R_FEATURES, (a0 + a1) / 2)[0]}
                  y={polar(R_FEATURES, (a0 + a1) / 2)[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5}
                  fontWeight={600}
                  fill="#ffffff"
                  style={{ pointerEvents: "none" }}
                >
                  {f.label}
                </text>
              </g>
            );
          })}

          {/* Ruler ring. */}
          {rulerTicks.map((t) => {
            const a = bpAngle(t.bp, registry.length);
            const [x0, y0] = polar(R_RULER + 8, a);
            const [x1, y1] = polar(R_RULER, a);
            return (
              <g key={t.bp}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#66718f" strokeWidth={t.label ? 1.6 : 0.8} />
                {t.label && (
                  <text
                    x={polar(R_RULER - 8, a)[0]}
                    y={polar(R_RULER - 8, a)[1]}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={7.5}
                    fill="#66718f"
                    transform={`rotate(${(a * 180) / Math.PI + 90} ${polar(R_RULER - 8, a).join(" ")})`}
                    className="stat-num"
                  >
                    {t.bp}
                  </text>
                )}
              </g>
            );
          })}

          {/* Restriction site ticks + labels. */}
          {registry.sites.map((s) => {
            const a = bpAngle(s.cut + 1, registry.length);
            const color = enzymeColor(s.enzyme);
            const [x0, y0] = polar(R_SITES, a);
            const [x1, y1] = polar(R_SITES + 10, a);
            const [lx, ly] = polar(R_SITES + 16, a);
            return (
              <g key={`${s.enzyme}:${s.start}`} className="cursor-pointer" onClick={() => onSelect({ start: s.start + 1, end: s.start + s.motif.length })}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7.5}
                  fontWeight={600}
                  fill={color}
                  transform={`rotate(${(a * 180) / Math.PI + 90} ${lx} ${ly})`}
                >
                  {s.enzyme} {s.start + 1}
                </text>
              </g>
            );
          })}

          {/* Focus radial (hover/selection from the linear map). */}
          {focus != null && (
            <g>
              <line
                x1={C}
                y1={C}
                x2={polar(R_SITES + 24, bpAngle(focus, registry.length))[0]}
                y2={polar(R_SITES + 24, bpAngle(focus, registry.length))[1]}
                stroke="#6d5ae0"
                strokeWidth={1.4}
                strokeDasharray="5 4"
              />
              <circle cx={C} cy={C} r={R_SITES + 24} fill="none" stroke="#6d5ae0" strokeWidth={1} opacity={0.3} />
            </g>
          )}

          {/* Selection arc. */}
          {selection && (
            <path
              d={arcPath(R_SITES + 5, bpAngle(selection.start, registry.length), bpAngle(selection.end, registry.length))}
              fill="none"
              stroke="#6d5ae0"
              strokeWidth={4}
              opacity={0.55}
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>

      {/* Center label + controls. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="max-w-[180px] text-xs font-semibold text-frost">{registry.name || registry.accession}</p>
        <p className="stat-num mt-0.5 text-[10px] text-mist/70">
          {registry.accession} · {registry.length} bp · {registry.topology}
        </p>
      </div>
      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        {[
          { label: "Zoom in", icon: ZoomIn, fn: () => setView((v) => ({ ...v, scale: Math.min(4, v.scale * 1.25) })) },
          { label: "Zoom out", icon: ZoomOut, fn: () => setView((v) => ({ ...v, scale: Math.max(0.5, v.scale / 1.25) })) },
          { label: "Reset view", icon: RotateCcw, fn: () => setView({ scale: 1, x: 0, y: 0 }) },
        ].map((b) => (
          <button key={b.label} type="button" onClick={b.fn} aria-label={b.label} className="btn-ghost !p-1.5">
            <b.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
});
