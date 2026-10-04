"use client";

/**
 * LinearMap — dual-stranded nucleotide sequence viewer (Benchling-style).
 *
 * - Top strand with coordinate ruler (every 10th labeled) and canonical
 *   base colors; reverse-complement bottom strand; optional 3-frame ORF
 *   translation rows (standard genetic code, stop codons marked).
 * - Restriction cut sites: recognition bases tinted with the enzyme's
 *   categorical color + a labeled cut tick between the strands.
 * - Feature overview strip (ampR/bla, tet, rop, ori, bom…) with direction
 *   arrows — click a feature to select its range.
 * - Drag to select a range; hover syncs with the circular map. Rows are
 *   `content-visibility`-isolated so a 4.4 kb map paints only what is
 *   visible. Every base is a React text node (XSS-inert by construction).
 */
import { memo, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DnaRegistry } from "@/lib/validation";
import { BASE_COLORS, enzymeColor, featureColor, gcPercent } from "@/lib/dna";
import { reverseComplement, translate } from "@/lib/codon";
import { regionSlice } from "@/components/workspace/tracks/FeatureTrack";

const ROW_FONT = 10;

function baseStyle(b: string): React.CSSProperties {
  return { color: BASE_COLORS[b] ?? BASE_COLORS.N };
}

export interface DnaSelection {
  start: number; // 1-based
  end: number; // 1-based inclusive
}

export const LinearMap = memo(function LinearMap({
  registry,
  zoom,
  showComplement,
  showOrfs,
  selection,
  hoverBp,
  focusBp,
  onSelect,
  onHover,
}: {
  registry: DnaRegistry;
  zoom: number;
  showComplement: boolean;
  showOrfs: boolean;
  selection: DnaSelection | null;
  hoverBp: number | null;
  focusBp: number | null;
  onSelect: (sel: DnaSelection) => void;
  onHover: (bp: number | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);

  const seq = registry.sequence;
  const comp = showComplement ? reverseComplement(seq) : null;
  const rows: number[] = [];
  for (let start = 0; start < seq.length; start += zoom) rows.push(start);

  // Feature overview strip — one bar per feature spanning the full width.
  // Real records (e.g. pBR322's 46-feature annotation) contain duplicated
  // `source` entries and dense qualifier features — the strip shows the
  // annotation-bearing types, unique-keyed by index (type+start is NOT
  // unique upstream).
  const features = registry.features
    .filter((f) => !["source", "old_sequence"].includes(f.type))
    .slice(0, 24);
  const sitesByPos = new Map<number, (typeof registry.sites)[number][]>();
  for (const s of registry.sites) {
    const list = sitesByPos.get(s.start) ?? [];
    list.push(s);
    sitesByPos.set(s.start, list);
  }

  // Scroll to the focused base (circular-map click, search jump).
  useEffect(() => {
    if (focusBp == null) return;
    const rowStart = Math.floor((focusBp - 1) / zoom) * zoom;
    const el = rowRefs.current.get(rowStart);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusBp, zoom]);

  const bpFromEvent = (e: React.PointerEvent<HTMLDivElement>, rowStart: number): number => {
    const rowEl = rowRefs.current.get(rowStart);
    if (!rowEl) return rowStart + 1;
    const rect = rowEl.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.min(seq.length, rowStart + Math.floor(frac * zoom) + 1);
  };

  const onPointerDown = (rowStart: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const bp = bpFromEvent(e, rowStart);
    setDrag({ anchor: bp, current: bp });
    onSelect({ start: bp, end: bp });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMoveRow = (rowStart: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const bp = bpFromEvent(e, rowStart);
    if (drag) {
      setDrag({ anchor: drag.anchor, current: bp });
      onSelect({ start: Math.min(drag.anchor, bp), end: Math.max(drag.anchor, bp) });
    }
    onHover(bp);
  };
  const onPointerUpRow = () => {
    setDrag(null);
  };
  const onPointerLeaveAll = () => {
    if (!drag) onHover(null);
  };

  const inSelection = (bp: number): boolean =>
    selection !== null && bp >= selection.start && bp <= selection.end;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Feature overview strip ─────────────────────────────────────── */}
      <div className="shrink-0 border-b border-ink-950/5 px-3 py-2">
        <div className="relative h-8 w-full">
          {features.map((f, i) => {
            const { left, width } = regionSlice(f.start, f.end, seq.length, 0.5);
            return (
              <button
                key={`${f.type}:${f.start}:${i}`}
                type="button"
                title={`${f.label}${f.product ? ` — ${f.product}` : ""} · ${f.start}–${f.end}`}
                onClick={() => onSelect({ start: f.start, end: f.end })}
                className="absolute top-0 flex h-6 items-center gap-1 overflow-hidden rounded-full px-2 text-[9px] whitespace-nowrap text-white transition-transform duration-300 ease-out hover:-translate-y-0.5"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: featureColor(i),
                  boxShadow: `0 2px 6px ${featureColor(i)}44`,
                }}
              >
                <span aria-hidden className="text-white">
                  {f.strand === -1 ? <ArrowLeft className="h-2.5 w-2.5" /> : <ArrowRight className="h-2.5 w-2.5" />}
                </span>
                <span className="truncate">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sequence rows ──────────────────────────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2" onPointerLeave={onPointerLeaveAll}>
        {rows.map((rowStart) => {
          const rowEnd = Math.min(seq.length, rowStart + zoom);
          const row = seq.slice(rowStart, rowEnd);
          const compRow = comp?.slice(rowStart, rowEnd);
          const selected = drag
            ? { start: Math.min(drag.anchor, drag.current), end: Math.max(drag.anchor, drag.current) }
            : selection;
          return (
            <div key={rowStart} ref={(el) => {
              if (el) rowRefs.current.set(rowStart, el);
              else rowRefs.current.delete(rowStart);
            }}>
              {/* Ruler: every 10th base labeled. */}
              <div className="relative h-4" aria-hidden>
                {Array.from({ length: row.length }, (_, i) => {
                  const bp = rowStart + i + 1;
                  if (bp % 10 !== 0) return null;
                  return (
                    <span
                      key={bp}
                      className="stat-num absolute top-0 text-[8px] text-mist/60"
                      style={{ left: `${((i + 0.5) / zoom) * 100}%` }}
                    >
                      {bp}
                    </span>
                  );
                })}
              </div>

              {/* Top strand. */}
              <div
                className="sequence-row relative flex h-5 cursor-crosshair gap-px"
                style={{ fontFamily: "monospace", fontSize: ROW_FONT, lineHeight: "1.25rem" }}
                onPointerDown={onPointerDown(rowStart)}
                onPointerMove={onPointerMoveRow(rowStart)}
                onPointerUp={onPointerUpRow}
                data-row={rowStart}
              >
                {row.split("").map((b, i) => {
                  const bp = rowStart + i + 1;
                  const site = sitesByPos.get(rowStart + i);
                  const tint = site ? enzymeColor(site[0].enzyme) : null;
                  return (
                    <span
                      key={bp}
                      className={`flex-1 text-center transition-colors duration-150 ${
                        inSelection(bp) ? "bg-glow-violet/30" : bp === hoverBp ? "bg-glow-violet/15" : ""
                      }`}
                      style={{
                        ...baseStyle(b),
                        ...(tint ? { background: `${tint}33`, borderRadius: 2 } : {}),
                      }}
                    >
                      {b}
                    </span>
                  );
                })}
              </div>

              {/* Cut-site ticks between the strands. */}
              <div className="relative h-3" aria-hidden>
                {[...sitesByPos.keys()]
                  .filter((p) => p >= rowStart && p < rowEnd)
                  .map((p) => (
                    <span
                      key={p}
                      className="absolute top-0.5 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${(((p - rowStart) + 0.5) / zoom) * 100}%` }}
                    >
                      <span className="h-2 w-0.5" style={{ background: enzymeColor(sitesByPos.get(p)![0].enzyme) }} />
                    </span>
                  ))}
              </div>

              {/* Bottom strand. */}
              {compRow && (
                <div className="relative flex h-5 gap-px opacity-75" style={{ fontFamily: "monospace", fontSize: ROW_FONT, lineHeight: "1.25rem" }}>
                  {compRow.split("").map((b, i) => (
                    <span key={i} className="flex-1 text-center" style={baseStyle(b)}>
                      {b}
                    </span>
                  ))}
                </div>
              )}

              {/* ORF translations. */}
              {showOrfs && (
                <div className="mb-2 mt-1 space-y-0.5">
                  {[0, 1, 2].map((frame) => (
                    <div key={frame} className="relative flex" style={{ fontFamily: "monospace", fontSize: 9, lineHeight: "0.9rem" }}>
                      <span className="sticky left-0 w-8 shrink-0 text-[8px] text-mist/60">+{frame + 1}</span>
                      <span className="flex flex-1">
                        {translate(seq, rowStart + frame).slice(0, Math.floor(row.length / 3) + 1).split("").map((aa, i) => (
                          <span
                            key={i}
                            className="flex-1 text-center"
                            style={{ color: aa === "*" ? "#c13b3b" : aa === "M" ? "#0ca30c" : "#5a6584" }}
                          >
                            {aa}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend strip ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-ink-950/5 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(BASE_COLORS)
            .filter(([b]) => b !== "N")
            .map(([b, c]) => (
              <span key={b} className="chip !py-0.5 text-[9px]">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c }} />
                {b}
              </span>
            ))}
          {registry.sites.slice(0, 8).map((s, i) => (
            <span key={`${s.enzyme}:${s.start}`} className="chip !py-0.5 text-[9px]">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: enzymeColor(s.enzyme) }} />
              {s.enzyme} {s.start + 1}
            </span>
          ))}
          <span className="ml-auto text-[9px] text-mist/60">
            GC {gcPercent(seq).toFixed(1)}% · {seq.length} bp
          </span>
        </div>
      </div>
    </div>
  );
});
