"use client";

/**
 * SolventPanel — protein–solvent denaturation with a live 3D unfolding view.
 *
 * Tri-solvent selector (ethanol / urea / guanidinium): each solvent carries
 * its own linear-extrapolation thermodynamics (Cm, m-value, dielectric
 * mixing model) fetched from the Protheon biophysics service and drives
 * BOTH the 2D titration curve and the 3D unfolding morph.
 *
 * GET /biophysics/solvent/{solvent} → 40-point curve {concentration_molar,
 * dielectric_constant, fraction_unfolded}. The slider's nearest curve point
 * supplies the unfolded fraction for UnfoldingViewer — helices unwind and
 * sheets fray as the slider moves; RMSD drift and hydrophobic-core
 * exposure are reported live.
 *
 * Research preview: empirical parameterization + geometric interpolation,
 * not measured melts or molecular dynamics — labeled as such in the UI.
 */
import { useEffect, useMemo, useState } from "react";
import { Atom, Droplets, Waves } from "lucide-react";
import { z } from "zod";
import { apiValidated } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { fmt } from "@/lib/format";
import { usePersistentState } from "@/lib/persistence";
import { LineChart, type LinePoint } from "@/components/workspace/charts/LineChart";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { UnfoldingViewer } from "./UnfoldingViewer";

// ── Payload contract (local) ───────────────────────────────────────────────

const SolventCurvePointSchema = z.object({
  concentration_molar: z.number().finite(),
  dielectric_constant: z.number().finite(),
  fraction_unfolded: z.number().finite(),
});

const SolventResultSchema = z.object({
  solvent: z.string(),
  cm_molar: z.number().finite(),
  m_value_kcal_per_mol_per_molar: z.number().finite(),
  dielectric_curve: z.array(SolventCurvePointSchema),
  notes: z.string(),
});

type SolventResult = z.infer<typeof SolventResultSchema>;

const SOLVENTS = [
  { key: "ethanol", label: "Ethanol", icon: Droplets },
  { key: "urea", label: "Urea", icon: Waves },
  { key: "guanidinium", label: "Guanidinium", icon: Atom },
] as const;

type SolventKey = (typeof SOLVENTS)[number]["key"];

const LINE = "#d55181";
const PDB_ID = "1UBQ"; // ubiquitin — the classic small unfolding model

export function SolventPanel() {
  const [solvent, setSolvent] = useState<SolventKey>("ethanol");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<SolventResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-viewer convenience only: the last solvent strength the user parked
  // the slider on. Hydration never triggers a fetch.
  const [conc, setConc] = usePersistentState<number>("interactions:solvent-molarity", 4, (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 8 ? v : null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    apiValidated(`/biophysics/solvent/${solvent}`, SolventResultSchema, { timeoutMs: 90_000 })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Solvent data unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [solvent, reload]);

  const label = SOLVENTS.find((s) => s.key === solvent)?.label ?? solvent;

  const points: LinePoint[] = useMemo(
    () =>
      (data?.dielectric_curve ?? []).map((p) => ({
        resi: p.concentration_molar,
        value: p.fraction_unfolded,
      })),
    [data],
  );

  const epsByConc = useMemo(() => {
    const map = new Map<number, number>();
    data?.dielectric_curve.forEach((p) => map.set(p.concentration_molar, p.dielectric_constant));
    return map;
  }, [data]);

  /** Nearest curve sample to the slider position — drives the 3D morph. */
  const nearest = useMemo(() => {
    const curve = data?.dielectric_curve ?? [];
    if (curve.length === 0) return null;
    return curve.reduce((best, p) =>
      Math.abs(p.concentration_molar - conc) < Math.abs(best.concentration_molar - conc) ? p : best,
    );
  }, [data, conc]);

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [["concentration_molar", "dielectric_constant", "fraction_unfolded"]];
    data.dielectric_curve.forEach((p) =>
      rows.push([p.concentration_molar, p.dielectric_constant, p.fraction_unfolded]),
    );
    downloadCsv(`protheon-solvent-${data.solvent}.csv`, rows);
  };

  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-2">
      {/* ── Left: titration curve + controls ────────────────────────────── */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Denaturing solvent">
          <span className="text-[10px] tracking-wide text-mist/70 uppercase">Solvent</span>
          {SOLVENTS.map((s) => {
            const active = solvent === s.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSolvent(s.key)}
                className={`chip inline-flex items-center gap-1.5 transition-colors duration-300 ease-out ${
                  active ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                }`}
              >
                <Icon aria-hidden className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Stat label="Cm" value={data ? `${fmt(data.cm_molar, 2)} M` : "—"} />
          <Stat label="m-value" value={data ? `${fmt(data.m_value_kcal_per_mol_per_molar, 2)} kcal·mol⁻¹·M⁻¹` : "—"} />
          {nearest && (
            <Stat
              label="ε at marker"
              value={`${fmt(nearest.dielectric_constant, 1)}`}
              accent={nearest.dielectric_constant < 78.5 ? "#2a78d6" : "#9a6b00"}
            />
          )}
        </div>

        <div className="h-52 shrink-0">
          {loading ? (
            <PanelSkeleton variant="chart" caption="Titrating the solvent…" />
          ) : error ? (
            <div role="alert" className="rounded-xl border border-[#d03b3b]/30 bg-[#d03b3b]/5 p-4">
              <p className="text-sm font-medium text-frost">Solvent curve unavailable</p>
              <p className="mt-1 text-xs leading-relaxed text-mist/80">{error}</p>
              <button
                type="button"
                onClick={() => setReload((n) => n + 1)}
                className="btn-ghost mt-3 !px-4 !py-1.5 text-xs"
              >
                Retry
              </button>
            </div>
          ) : (
            <LineChart
              points={points}
              yMin={0}
              yMax={1}
              thresholds={[0.5]}
              lineColor={LINE}
              highlight={nearest?.concentration_molar ?? null}
              ariaLabel={`Fraction unfolded versus ${label} concentration, with the marker at ${fmt(
                nearest?.concentration_molar ?? 0,
                1,
              )} molar`}
              xTickLabel={(i) => `${fmt(points[i]?.resi ?? 0, 1)} M`}
              tooltip={(p) => (
                <span className="chip !bg-white/90 backdrop-blur-md">
                  <span className="stat-num">{fmt(p.resi, 1)} M</span>
                  <span className="text-mist/80">ε {fmt(epsByConc.get(p.resi), 0)}</span>
                  <span className="text-mist/80">unfolded {fmt((p.value ?? 0) * 100, 0)}%</span>
                </span>
              )}
            />
          )}
        </div>

        <label className="flex items-center gap-3 text-xs">
          <span className="w-44 shrink-0 text-mist/70">
            {label} {fmt(conc, 1)} M
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.1}
            value={conc}
            disabled={!data}
            onChange={(e) => setConc(Number(e.target.value))}
            className="min-w-0 flex-1"
            aria-label={`${label} concentration in molar`}
          />
        </label>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] leading-relaxed text-mist/60">
              Linear-extrapolation model: ΔG(c) = ΔG(H₂O) − m·c · Cm is the curve midpoint · ε from the
              solvent dielectric mixing model.
            </p>
            {data && <p className="mt-1 text-[10px] leading-relaxed text-mist/60">{data.notes}</p>}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="btn-ghost shrink-0 !px-2.5 !py-1 text-[10px]"
          >
            CSV
          </button>
        </div>
      </div>

      {/* ── Right: live 3D unfolding ────────────────────────────────────── */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] tracking-[0.16em] text-mist/70 uppercase">3D unfolding · {PDB_ID}</p>
          <p className="text-[10px] text-mist/60">
            structural morph + RMSD · {label} {fmt(conc, 1)} M
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <UnfoldingViewer
            pdbId={PDB_ID}
            fraction={nearest?.fraction_unfolded ?? 0}
            solventLabel={label}
          />
        </div>
        <p className="text-[9px] leading-relaxed text-mist/50">
          Geometric interpolation between the native structure and a deterministic random-coil reference —
          helices unwind and sheets fray as the unfolded fraction grows. Not a molecular-dynamics trajectory.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass-panel px-3 py-1.5 text-right">
      <p className="text-[9px] tracking-[0.16em] text-mist/60 uppercase">{label}</p>
      <p className="stat-num text-sm font-semibold" style={{ color: accent ?? undefined }}>
        {value}
      </p>
    </div>
  );
}
