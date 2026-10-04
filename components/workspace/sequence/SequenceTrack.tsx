"use client";

/**
 * SequenceTrack — the workspace's sequence editor panel. One button per
 * residue (monospace chip colored by the canonical AlphaFold pLDDT bands,
 * always paired with the band legend), wrapped in rows of 60. Hovering or
 * selecting a residue syncs across the workspace: the 3D viewer drops a
 * focus marker, the pLDDT chart moves its crosshair, the PAE heatmap
 * draws its cursor line.
 *
 * XSS note: every label is a React text node or an aria-label — residue
 * content can never render as markup.
 */
import { memo, useEffect, useRef } from "react";
import { plddtBand } from "@/lib/format";

export interface TrackResidue {
  resi: number;
  resn: string;
  plddt: number | null;
}

const ROW_LEN = 60;
const TICKS = [0, 10, 20, 30, 40, 50];

export const SequenceTrack = memo(function SequenceTrack({
  residues,
  highlight,
  selected,
  onHover,
  onSelect,
}: {
  residues: TrackResidue[];
  highlight?: number | null;
  selected?: number | null;
  onHover?: (resi: number | null) => void;
  onSelect?: (resi: number) => void;
}) {
  const refs = useRef(new Map<number, HTMLButtonElement>());

  // Keep the focused residue in view when the highlight moves in from
  // another panel (3D hover → scroll the strip).
  useEffect(() => {
    if (highlight == null) return;
    const el = refs.current.get(highlight);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [highlight]);

  if (!residues.length) {
    return <p className="flex h-full items-center justify-center px-6 text-sm text-mist/60">No sequence data.</p>;
  }

  const rows: TrackResidue[][] = [];
  for (let i = 0; i < residues.length; i += ROW_LEN) rows.push(residues.slice(i, i + ROW_LEN));

  return (
    <div
      className="h-full overflow-y-auto px-4 pt-6 pb-3"
      onPointerLeave={() => onHover?.(null)}
      role="list"
      aria-label="Protein sequence"
    >
      {rows.map((row, rowIndex) => {
        const start = row[0].resi;
        return (
          <div
            key={rowIndex}
            className="sequence-row relative mb-2.5"
            role="listitem"
          >
            {/* Ruler: every 10th residue number, aligned to the row grid. */}
            {TICKS.map((off) => (
              <span
                key={off}
                aria-hidden
                className="stat-num absolute -top-3.5 text-[8px] leading-3 text-mist/45"
                style={{ left: `${off * (100 / ROW_LEN)}%` }}
              >
                {start + off}
              </span>
            ))}
            <div className="flex gap-[3px]">
              {row.map((r) => {
                const band = r.plddt === null ? null : plddtBand(r.plddt);
                const isSelected = selected === r.resi;
                const isHighlighted = highlight === r.resi;
                return (
                  <button
                    key={r.resi}
                    ref={(el) => {
                      if (el) refs.current.set(r.resi, el);
                      else refs.current.delete(r.resi);
                    }}
                    type="button"
                    onPointerEnter={() => onHover?.(r.resi)}
                    onFocus={() => onHover?.(r.resi)}
                    onClick={() => onSelect?.(r.resi)}
                    title={band ? `${r.resn}${r.resi} · pLDDT ${r.plddt?.toFixed(1)} (${band.label})` : `${r.resn}${r.resi}`}
                    aria-label={band ? `${r.resn}${r.resi}, pLDDT ${r.plddt?.toFixed(1)}, ${band.label}` : `${r.resn}${r.resi}`}
                    aria-pressed={isSelected}
                    className={`sequence-residue flex-1 ${band ? "" : "sequence-residue-na"} ${
                      isHighlighted || isSelected ? "sequence-residue-focus" : ""
                    }`}
                    style={band ? { background: band.color } : undefined}
                  >
                    {r.resn}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
