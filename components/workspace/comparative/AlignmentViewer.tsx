"use client";

import { memo } from "react";
import { chunkString } from "@/lib/format";
import { ALIGNMENT_COLORS, AlignmentLegend } from "./alignmentStyle";

interface AlignmentViewerProps {
  alignedA: string;
  alignedB: string;
  labelA: string;
  labelB: string;
}

const CHUNK = 60;

/**
 * Pairwise alignment viewer. Rendered as per-character <span>s — React's
 * escaping means sequence text can never become markup (XSS-safe by
 * construction; no dangerouslySetInnerHTML anywhere).
 *
 * Colors come from the shared alignment contract (alignmentStyle.tsx):
 * matches stay in primary ink, mismatches use the validated amber slot,
 * gaps recede to muted ink. Positions are shown numerically so the
 * alignment is never color-alone.
 */
export const AlignmentViewer = memo(function AlignmentViewer({
  alignedA,
  alignedB,
  labelA,
  labelB,
}: AlignmentViewerProps) {
  const chunksA = chunkString(alignedA, CHUNK);
  const chunksB = chunkString(alignedB, CHUNK);

  return (
    <div className="glass-panel overflow-x-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-mist/80">
          <span className="text-sm font-medium text-frost">{labelA}</span> vs
          <span className="text-sm font-medium text-frost">{labelB}</span>
        </span>
        <AlignmentLegend />
      </div>
      <table className="border-separate border-spacing-y-1 font-mono text-[11px] leading-5">
        <tbody>
          {chunksA.map((_, ci) => {
            const startA = chunksA.slice(0, ci).reduce((n, c) => n + c.replace(/-/g, "").length, 0) + 1;
            const startB = chunksB.slice(0, ci).reduce((n, c) => n + c.replace(/-/g, "").length, 0) + 1;
            return (
              <RowBlock
                key={ci}
                rowA={chunksA[ci]}
                rowB={chunksB[ci]}
                startA={startA}
                startB={startB}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

function RowBlock({ rowA, rowB, startA, startB }: { rowA: string; rowB: string; startA: number; startB: number }) {
  return (
    <>
      <tr>
        <td className="stat-num pr-2 text-right align-baseline text-[10px] text-mist/50">{startA}</td>
        <td className="align-baseline">
          {rowA.split("").map((c, i) => (
            <Char key={i} c={c} other={rowB[i]} />
          ))}
        </td>
      </tr>
      <tr>
        <td className="stat-num pr-2 text-right align-baseline text-[10px] text-mist/50">{startB}</td>
        <td className="align-baseline">
          {rowB.split("").map((c, i) => (
            <Char key={i} c={c} other={rowA[i]} />
          ))}
        </td>
      </tr>
    </>
  );
}

function Char({ c, other }: { c: string; other: string | undefined }) {
  if (c === "-" || other === "-") {
    return <span style={{ color: ALIGNMENT_COLORS.gap }}>{c}</span>;
  }
  if (c === other) {
    return <span style={{ color: ALIGNMENT_COLORS.match }}>{c}</span>;
  }
  return <span style={{ color: ALIGNMENT_COLORS.mismatch }}>{c}</span>;
}
