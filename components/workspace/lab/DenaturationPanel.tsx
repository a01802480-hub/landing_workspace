"use client";

/**
 * DenaturationPanel — solvent-driven protein denaturation kinetics.
 *
 * First-order unfolding: native(t) = exp(−k(EtOH)·t), with the unfolding
 * rate increasing exponentially with ethanol concentration
 * (k = k0·exp(c·[EtOH%]) — a widely used empirical solvent-denaturation
 * model). Turbidity (A600) tracks the unfolded fraction. The water control
 * (0%) is the dashed overlay; t½ is reported for the current solvent.
 */
import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/export";
import { fmt } from "@/lib/format";
import { LineChart, type LinePoint } from "@/components/workspace/charts/LineChart";

const LINE = "#d55181";
const CONTROL_LINE = "#898781";
const STEPS = 120;
const T_MAX = 60; // minutes
const K0 = 0.002; // 1/min at 0% ethanol
const C = 0.05; // rate sensitivity per % ethanol

function kAt(etohPct: number): number {
  return K0 * Math.exp(C * etohPct);
}

export function DenaturationPanel() {
  const [etoh, setEtOH] = useState(40);
  const [temperature, setTemperature] = useState(25);

  const { points, control, halfLife } = useMemo(() => {
    const k = kAt(etoh) * (1 + Math.max(0, temperature - 25) * 0.04); // mild thermal coupling
    const k0 = kAt(0);
    const primary: LinePoint[] = [];
    const ctrl: LinePoint[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * T_MAX;
      primary.push({ resi: t, value: 100 * (1 - Math.exp(-k * t)) });
      ctrl.push({ resi: t, value: 100 * (1 - Math.exp(-k0 * t)) });
    }
    return { points: primary, control: ctrl, halfLife: Math.LN2 / k };
  }, [etoh, temperature]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["time_min", `turbidity_pct_${etoh}pct_etoh`, "turbidity_pct_control"],
    ];
    points.forEach((p, i) => rows.push([p.resi.toFixed(1), (p.value ?? 0).toFixed(2), (control[i]?.value ?? 0).toFixed(2)]));
    downloadCsv(`denaturation-etoh${etoh}-t${temperature}c.csv`, rows);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex min-h-0 flex-1">
        <LineChart
          points={points}
          yMin={0}
          yMax={100}
          thresholds={[50]}
          lineColor={LINE}
          overlays={[{ points: control, color: CONTROL_LINE, label: "water control (0%)" }]}
          ariaLabel={`Protein denaturation at ${etoh} percent ethanol, turbidity over ${T_MAX} minutes`}
          xTickLabel={(i) => fmt(points[i]?.resi ?? 0, 0)}
          tooltip={(p, ov) => (
            <span className="chip !bg-white/90 backdrop-blur-md">
              <span className="stat-num">t {fmt(p.resi, 1)} min</span>
              <span className="text-mist/80">turbidity {fmt(p.value ?? 0, 1)}%</span>
              {ov.map((o) => (
                <span key={o.label} className="text-mist/80">
                  · ctrl {fmt(o.value ?? 0, 1)}%
                </span>
              ))}
            </span>
          )}
        />
      </div>
      <label className="flex items-center gap-3 text-xs">
        <span className="w-28 shrink-0 text-mist/70">Ethanol {etoh}%</span>
        <input
          type="range"
          min={0}
          max={80}
          step={5}
          value={etoh}
          onChange={(e) => setEtOH(Number(e.target.value))}
          className="min-w-0 flex-1"
          aria-label="Ethanol concentration"
        />
      </label>
      <label className="flex items-center gap-3 text-xs">
        <span className="w-28 shrink-0 text-mist/70">Temp {temperature}°C</span>
        <input
          type="range"
          min={4}
          max={90}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="min-w-0 flex-1"
          aria-label="Temperature"
        />
      </label>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-mist/60">
          First-order unfolding · t½ = {fmt(halfLife, 1)} min at {etoh}% EtOH · turbidity ≈ unfolded fraction
        </p>
        <button type="button" onClick={exportCsv} className="btn-ghost !px-2.5 !py-1 text-[10px]">
          CSV
        </button>
      </div>
    </div>
  );
}
