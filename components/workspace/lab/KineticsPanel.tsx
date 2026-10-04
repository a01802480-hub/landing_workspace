"use client";

/**
 * KineticsPanel — Michaelis–Menten kinetics with an inhibitor model.
 *
 * Competitive:   v = Vmax·[S] / (Km·(1+[I]/Ki) + [S])
 * Non-competitive: v = (Vmax/(1+[I]/Ki))·[S] / (Km + [S])
 *
 * The uninhibited curve is the primary series; the inhibited curve is a
 * dashed overlay (legend always shown). CSV exports both columns.
 */
import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/export";
import { mmRate } from "@/lib/dna";
import { fmt } from "@/lib/format";
import { LineChart, type LinePoint } from "@/components/workspace/charts/LineChart";

const LINE = "#6d5ae0";
const INHIBITOR_LINE = "#eb6834";
const STEPS = 120;

export function KineticsPanel() {
  const [vmax, setVmax] = useState(100);
  const [km, setKm] = useState(5);
  const [mode, setMode] = useState<"competitive" | "non-competitive">("competitive");
  const [inhibitor, setInhibitor] = useState(20); // [I] µM
  const [ki, setKi] = useState(5); // Ki µM

  const { points, inhibited, xMax } = useMemo(() => {
    const range = km * 5;
    const primary: LinePoint[] = [];
    const inh: LinePoint[] = [];
    const alpha = inhibitor / ki; // [I]/Ki — the inhibition factor
    for (let i = 0; i <= STEPS; i++) {
      const s = (i / STEPS) * range;
      primary.push({ resi: s, value: mmRate(s, vmax, km) });
      const v =
        mode === "competitive"
          ? (vmax * s) / (km * (1 + alpha) + s)
          : (vmax / (1 + alpha) * s) / (km + s);
      inh.push({ resi: s, value: v });
    }
    return { points: primary, inhibited: inh, xMax: range };
  }, [vmax, km, mode, inhibitor, ki]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["substrate_uM", "uninhibited_rate_uM_s", `${mode}_inhibited_rate_uM_s`],
    ];
    points.forEach((p, i) => rows.push([p.resi.toFixed(3), (p.value ?? 0).toFixed(3), (inhibited[i]?.value ?? 0).toFixed(3)]));
    downloadCsv(`mm-${mode}-inhibition-i${inhibitor}-ki${ki}.csv`, rows);
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
          yMin={0}
          yMax={vmax * 1.05}
          thresholds={[]}
          lineColor={LINE}
          overlays={[{ points: inhibited, color: INHIBITOR_LINE, label: `${mode} inhibited` }]}
          ariaLabel={`Michaelis-Menten curve with ${mode} inhibitor, Vmax ${vmax}, Km ${km}`}
          xTickLabel={(i) => fmt(points[i]?.resi ?? 0, 0)}
          tooltip={(p, ov) => (
            <span className="chip !bg-white/90 backdrop-blur-md">
              <span className="stat-num">[S] {fmt(p.resi, 1)} µM</span>
              <span className="text-mist/80">v {fmt(p.value ?? 0, 1)}</span>
              {ov.map((o) => (
                <span key={o.label} className="text-mist/80">
                  · inh {fmt(o.value ?? 0, 1)}
                </span>
              ))}
            </span>
          )}
        />
      </div>
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Inhibition mode">
        {(
          [
            { id: "competitive", label: "Competitive (Km↑)" },
            { id: "non-competitive", label: "Non-competitive (Vmax↓)" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`chip transition-colors duration-300 ease-out ${
              mode === m.id ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {slider("Vmax", vmax, 10, 200, 1, setVmax, 0)}
      {slider("Km µM", km, 0.1, 50, 0.1, setKm)}
      {slider("Inhibitor [I] µM", inhibitor, 0, 100, 1, setInhibitor, 0)}
      {slider("Ki µM", ki, 0.5, 50, 0.5, setKi)}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-mist/60">Michaelis–Menten model · [I]/Ki = {fmt(inhibitor / ki, 2)} inhibition factor</p>
        <button type="button" onClick={exportCsv} className="btn-ghost !px-2.5 !py-1 text-[10px]">
          CSV
        </button>
      </div>
    </div>
  );
}
