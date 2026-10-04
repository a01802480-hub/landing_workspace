"use client";

/**
 * PaeHeatmap — 2D heatmap of the AlphaFold PAE (predicted aligned error)
 * matrix, canvas-rendered.
 *
 * Color rules:
 * - The AlphaFold domain convention for PAE plots: low PAE (confident) =
 *   deep teal-green, high PAE = pale — dark→light sequential ramp on the
 *   white clinical surface. A labeled legend bar accompanies it (domain
 *   convention, never color-alone), matching how PAE appears on the
 *   AlphaFold DB itself.
 * - The full matrix is drawn once into an offscreen canvas at native
 *   resolution (≤ display size²), then blitted with smoothing — hover
 *   redraws only the crosshair layer, no per-frame work.
 * - Hover layer: crosshair + residue-pair tooltip; click selects the row
 *   residue (syncs to the viewer + sequence); arrow keys scrub for
 *   keyboard users; role="img" + aria-label.
 * - "Export CSV" is the table view (accessibility rule for large matrices)
 *   and the zero-data-loss export of the displayed matrix.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfidenceData } from "@/lib/validation";
import { hexToRgb } from "@/lib/format";

/** AlphaFold-style PAE ramp: deep teal (confident) → pale (uncertain). */
const RAMP = ["#0b5c43", "#0e7a58", "#1f9e72", "#5cc39a", "#a8e0c8", "#e8f7f0"];
const MUTED = "rgba(102, 113, 143, 0.85)";

function rampColor(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  const pos = clamped * (RAMP.length - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = hexToRgb(RAMP[i]);
  const b = hexToRgb(RAMP[Math.min(i + 1, RAMP.length - 1)]);
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

export function PaeHeatmap({
  data,
  highlight,
  onHover,
  onSelect,
}: {
  data: ConfidenceData;
  highlight?: number | null;
  onHover?: (resi: number | null) => void;
  onSelect?: (resi: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const [cursor, setCursor] = useState<{ i: number; j: number } | null>(null);

  const n = data.pae.length;
  const matrix = data.pae;

  // Build the native-resolution matrix once per dataset.
  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = n;
    off.height = n;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(n, n);
    for (let j = 0; j < n; j++) {
      const row = matrix[j];
      const rowLen = row?.length ?? 0;
      for (let i = 0; i < n; i++) {
        const v = i < rowLen ? (row[i] ?? 0) : 0;
        const t = data.max_pae > 0 ? v / data.max_pae : 0;
        const c = rampColor(t); // low PAE → deep teal (AlphaFold convention)
        const p = (j * n + i) * 4;
        img.data[p] = c[0];
        img.data[p + 1] = c[1];
        img.data[p + 2] = c[2];
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    offRef.current = off;
  }, [n, matrix, data.max_pae]);

  const indexOfResi = useCallback(
    (resi: number): number => {
      // residue_index is ascending; binary search for the nearest cell.
      const idx = data.residue_index;
      let lo = 0;
      let hi = idx.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (idx[mid] < resi) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && resi - idx[lo - 1] < idx[lo] - resi) return lo - 1;
      return lo;
    },
    [data.residue_index],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const off = offRef.current;
    if (!canvas || !wrap || !off) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = wrap.getBoundingClientRect();
    const size = Math.max(4, Math.min(rect.width, rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (sizeRef.current.w !== size || sizeRef.current.h !== size || sizeRef.current.dpr !== dpr) {
      sizeRef.current = { w: size, h: size, dpr };
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, n, n, 0, 0, size, size);

    // Axis residue ticks (every ~eighth cell).
    ctx.fillStyle = MUTED;
    ctx.font = "8px system-ui, sans-serif";
    ctx.textBaseline = "top";
    const tickEvery = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += tickEvery) {
      const px = ((i + 0.5) / n) * size;
      ctx.fillText(String(data.residue_index[i]), px + 3, size + 2);
    }
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "right";
    for (let j = 0; j < n; j += tickEvery) {
      const py = ((j + 0.5) / n) * size;
      ctx.fillText(String(data.residue_index[j]), 0, py + 8);
    }
    ctx.textAlign = "start";

    // Crosshair: highlight (from sequence/3D) or keyboard/hover cursor.
    const focus = cursor ?? (highlight != null ? { i: indexOfResi(highlight), j: indexOfResi(highlight) } : null);
    if (focus && focus.i >= 0 && focus.i < n && focus.j >= 0 && focus.j < n) {
      const cx = ((focus.i + 0.5) / n) * size;
      const cy = ((focus.j + 0.5) / n) * size;
      ctx.strokeStyle = "rgba(32, 42, 68, 0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(size, cy);
      ctx.stroke();
    }
  }, [n, data.residue_index, cursor, highlight, indexOfResi]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const cellFromEvent = (e: React.PointerEvent | React.MouseEvent): { i: number; j: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    const j = Math.floor(((e.clientY - rect.top) / rect.height) * n);
    if (i < 0 || i >= n || j < 0 || j >= n) return null;
    return { i, j };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = cellFromEvent(e);
    setCursor(cell);
    onHover?.(cell ? data.residue_index[cell.i] : null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape"].includes(e.key)) return;
    e.preventDefault();
    const cur = cursor ?? { i: Math.floor(n / 2), j: Math.floor(n / 2) };
    let { i, j } = cur;
    if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    if (e.key === "ArrowUp") j = Math.max(0, j - 1);
    if (e.key === "ArrowDown") j = Math.min(n - 1, j + 1);
    if (e.key === "Escape") {
      setCursor(null);
      onHover?.(null);
      return;
    }
    setCursor({ i, j });
    onHover?.(data.residue_index[i]);
  };

  const exportCsv = () => {
    const header = ["resi\\resi", ...data.residue_index].join(",");
    const lines = data.residue_index.map((r, j) => [r, ...(matrix[j] ?? [])].join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.uniprot}-pae-${n}x${n}.csv`;
    // Append + remove inside try/catch — a detached-anchor click works in
    // every browser and never touches React-managed DOM.
    document.body.appendChild(a);
    a.click();
    try {
      document.body.removeChild(a);
    } catch {
      /* already removed — ignore */
    }
    URL.revokeObjectURL(url);
  };

  const cellValue = cursor ? matrix[cursor.j]?.[cursor.i] : null;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div
        ref={wrapRef}
        className="relative flex min-h-0 flex-1 items-center justify-center outline-none"
        tabIndex={0}
        role="img"
        aria-label={`PAE matrix for ${data.uniprot}: ${n} by ${n} residues, max ${data.max_pae} ångströms`}
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair rounded-md"
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            setCursor(null);
            onHover?.(null);
          }}
          onClick={() => {
            if (cursor) onSelect?.(data.residue_index[cursor.i]);
          }}
        />
        {cursor && cellValue != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2"
            style={{ left: `${((cursor.i + 0.5) / n) * 100}%` }}
          >
            <div className="chip !bg-white/90 backdrop-blur-md">
              <span className="stat-num">
                {data.residue_index[cursor.i]} ↔ {data.residue_index[cursor.j]}
              </span>
              <span className="text-mist/80">PAE {cellValue.toFixed(1)} Å</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend + export. */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[9px] text-mist/60">low</span>
        <div
          aria-hidden
          className="h-2 flex-1 rounded-full"
          style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }}
        />
        <span className="text-[9px] text-mist/60">high</span>
        <span className="stat-num text-[9px] text-mist/60">max {data.max_pae.toFixed(1)} Å</span>
        <button type="button" onClick={exportCsv} className="btn-ghost !px-2.5 !py-1 text-[10px]">
          CSV
        </button>
      </div>
      <p className="px-1 text-[9px] text-mist/50">
        {data.stride > 1 ? `mean-pooled ×${data.stride} · ${n}×${n} displayed` : `${n}×${n} residues`} · row/column = residue number
      </p>
    </div>
  );
}
