"use client";

/**
 * DoseResponsePanel — four-parameter logistic dose–response simulation on
 * a log dose axis. Sliders drive EC50, hill slope and the response
 * asymptotes; CSV export follows the lab panel contract.
 */
import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/export";
import { doseResponse } from "@/lib/dna";
import { fmt } from "@/lib/format";
import { LineChart, type LinePoint } from "@/components/workspace/charts/LineChart";

const LINE = "#0ea5c9";
const STEPS = 96;

function logLabel(v: number): string {
  if (v >= 1000 || v <= 0.001) return v.toExponential(0);
  if (v >= 1) return fmt(v, 0);
  return fmt(v, 2);
}

export function DoseResponsePanel() {
  const [bottom, setBottom] = useState(0);
  const [top, setTop] = useState(100);
  const [ec50, setEc50] = useState(1);
  const [hill, setHill] = useState(1);

  const points = useMemo(() => {
    const out: LinePoint[] = [];
    const logMin = Math.log10(ec50) - 3;
    const logMax = Math.log10(ec50) + 3;
    for (let i = 0; i <= STEPS; i++) {
      const dose = Math.pow(10, logMin + ((logMax - logMin) * i) / STEPS);
      out.push({ resi: dose, value: doseResponse(dose, bottom, top, ec50, hill) });
    }
    return out;
  }, [bottom, top, ec50, hill]);

  // Log-spaced x positions: the chart scales by index, so we map each point
  // onto a normalized position that is linear in log(dose).
  const xPos = (i: number): number => i / STEPS;

  const exportCsv = () => {
    const rows: (string | number)[][] = [["dose_uM", "response_pct"]];
    for (const p of points) rows.push([p.resi.toExponential(3), (p.value ?? 0).toFixed(2)]);
    downloadCsv(`dose-response-ec50${ec50}-hill${hill}.csv`, rows);
  };

  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    set: (v: number) => void,
    digits = 1,
  ) => (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0 text-mist/70">
        {label} {fmt(value, digits)}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="min-w-0 flex-1"
        aria-label={label}
      />
    </label>
  );

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex min-h-0 flex-1">
        <LineChart
          points={points}
          yMin={bottom - 5}
          yMax={top + 5}
          thresholds={[bottom, top]}
          lineColor={LINE}
          xPos={xPos}
          xTickLabel={(i) => logLabel(points[i]?.resi ?? 1)}
          ariaLabel={`Four-parameter logistic dose-response curve, EC50 ${ec50}`}
          tooltip={(p) => (
            <span className="chip !bg-white/90 backdrop-blur-md">
              <span className="stat-num">dose {p.resi.toExponential(1)} µM</span>
              <span className="text-mist/80">response {fmt(p.value ?? 0, 1)}%</span>
            </span>
          )}
        />
      </div>
      {slider("EC50 µM", ec50, 0.01, 100, 0.01, setEc50, 2)}
      {slider("Hill slope", hill, 0.5, 3, 0.1, setHill)}
      {slider("Bottom %", bottom, 0, 50, 1, setBottom, 0)}
      {slider("Top %", top, 50, 200, 1, setTop, 0)}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-mist/60">4-parameter logistic · log dose axis</p>
        <button type="button" onClick={exportCsv} className="btn-ghost !px-2.5 !py-1 text-[10px]">
          CSV
        </button>
      </div>
    </div>
  );
}
