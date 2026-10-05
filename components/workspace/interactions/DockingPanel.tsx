"use client";

/**
 * DockingPanel — empirical protein–drug docking against the Protheon
 * biophysics service.
 *
 * POST /biophysics/dock scores a parameterized ligand against a PDB entry
 * with a Vina-like empirical function and the panel lays out the whole
 * decomposition: predicted binding free energy (ΔG), the derived
 * dissociation constant (Kd), the pocket centroid and every active-site
 * contact (van der Waals, hydrogen bond, steric clash).
 *
 * Research preview: ΔG is an empirical estimate, not a measured affinity.
 * The zod schema is local to this file by design — another agent owns
 * lib/validation.ts this run.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleDot, Link2, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { apiValidated } from "@/lib/api";
import { fmt } from "@/lib/format";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";

// ── Payload contract (local) ───────────────────────────────────────────────

const DockContactSchema = z.object({
  ligand_atom: z.string(),
  ligand_element: z.string(),
  /** Residue label as returned by the scorer, e.g. "SER195". */
  residue: z.string(),
  atom: z.string(),
  type: z.enum(["vdw", "hbond", "clash"]),
  distance_angstrom: z.number().finite(),
});

const DockResultSchema = z.object({
  pdb_id: z.string(),
  ligand: z.string(),
  delta_g_kcal_per_mol: z.number().finite(),
  kd_molar: z.number().finite(),
  kd_label: z.string(),
  pocket: z.object({ resi: z.number().int(), resname: z.string() }),
  contacts: z.array(DockContactSchema),
});

type DockResult = z.infer<typeof DockResultSchema>;
type DockContact = z.infer<typeof DockContactSchema>;

const LIGANDS = [
  { key: "aspirin", label: "Aspirin" },
  { key: "ibuprofen", label: "Ibuprofen" },
  { key: "caffeine", label: "Caffeine" },
  { key: "warfarin", label: "Warfarin" },
] as const;

/** Contact-type icons — the non-color encoding; color alone never carries meaning. */
const TYPE_ICON: Record<DockContact["type"], typeof Link2> = {
  hbond: Link2,
  vdw: CircleDot,
  clash: TriangleAlert,
};

const TYPE_LABEL: Record<DockContact["type"], string> = {
  hbond: "hydrogen bond",
  vdw: "van der Waals contact",
  clash: "steric clash",
};

/** Fixed status-critical color — used only for clashes, always with the icon + label. */
const CRITICAL = "#d03b3b";

function dgTone(dg: number): { color: string; label: string } {
  if (dg <= -7) return { color: "#0ca30c", label: "strong binder" };
  if (dg <= -5) return { color: "#9a6b00", label: "moderate" };
  return { color: "#66718f", label: "weak" };
}

export function DockingPanel({
  pdbId,
  onPdbIdChange,
}: {
  /** The page-level protein picker state (docking uses PDB ids). */
  pdbId: string;
  onPdbIdChange: (id: string) => void;
}) {
  const [ligand, setLigand] = useState<string>("aspirin");
  const [center, setCenter] = useState("");
  const [result, setResult] = useState<DockResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const dock = useCallback(async (id: string, lig: string, centerRaw: string) => {
    const pdb = id.trim().toUpperCase();
    const centerText = centerRaw.trim();
    // Client-side shape checks first: the backend enforces the same strict
    // patterns, but a designed local message beats a round-trip 422.
    if (!/^[A-Za-z0-9]{4}$/.test(pdb)) {
      setResult(null);
      setLoading(false);
      setError("PDB ID must be exactly four letters or digits (e.g. 1X9N).");
      return;
    }
    if (centerText !== "" && !/^[1-9][0-9]*$/.test(centerText)) {
      setResult(null);
      setLoading(false);
      setError("Center residue must be a positive integer, or left empty for automatic pocket detection.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiValidated("/biophysics/dock", DockResultSchema, {
        method: "POST",
        body: JSON.stringify({
          pdb_id: pdb,
          ligand: lig,
          ...(centerText ? { center_resi: Number(centerText) } : {}),
        }),
        timeoutMs: 90_000,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Docking failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Boot with the demo pose (aspirin against the picked structure) so the
  // panel arrives populated, exactly like the variants workspace does.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void dock(pdbId, "aspirin", "");
  }, [dock, pdbId]);

  const tone = result ? dgTone(result.delta_g_kcal_per_mol) : null;
  const kdText =
    result && !/^kd\b/i.test(result.kd_label.trim()) ? `Kd ${result.kd_label}` : result?.kd_label ?? "";

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void dock(pdbId, ligand, center);
        }}
      >
        <Field label="PDB ID">
          <input
            value={pdbId}
            onChange={(e) => onPdbIdChange(e.target.value)}
            maxLength={4}
            spellCheck={false}
            autoComplete="off"
            aria-label="PDB ID"
            className="glass-panel w-28 px-3 py-2 font-mono text-sm text-frost transition-colors duration-300 ease-out focus:border-glow-violet/50 focus:outline-none"
          />
        </Field>
        <Field label="Ligand">
          <select
            value={ligand}
            onChange={(e) => setLigand(e.target.value)}
            aria-label="Ligand"
            className="glass-panel w-36 px-3 py-2 text-sm text-frost transition-colors duration-300 ease-out focus:border-glow-violet/50 focus:outline-none"
          >
            {LIGANDS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Center residue (optional)">
          <input
            value={center}
            onChange={(e) => setCenter(e.target.value)}
            inputMode="numeric"
            placeholder="auto"
            spellCheck={false}
            autoComplete="off"
            aria-label="Center residue (optional)"
            className="glass-panel w-28 px-3 py-2 font-mono text-sm text-frost transition-colors duration-300 ease-out focus:border-glow-violet/50 focus:outline-none"
          />
        </Field>
        <button type="submit" disabled={loading} className="btn-primary !px-5 !py-2 text-sm">
          {loading ? "Docking…" : "Dock"}
        </button>
      </form>

      <div className="min-h-0 flex-1">
        {loading ? (
          <PanelSkeleton variant="stats" caption="Scoring the pose…" />
        ) : error ? (
          <div role="alert" className="rounded-xl border border-[#d03b3b]/30 bg-[#d03b3b]/5 p-4">
            <p className="text-sm font-medium text-frost">Docking unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-mist/80">{error}</p>
            <button
              type="button"
              onClick={() => void dock(pdbId, ligand, center)}
              className="btn-ghost mt-3 !px-4 !py-1.5 text-xs"
            >
              Retry dock
            </button>
          </div>
        ) : result && tone ? (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">
              {result.pdb_id.toUpperCase()} · {result.ligand}
            </p>

            {/* ΔG hero + Kd + pocket — the headline numbers. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">ΔG binding</p>
                <p className="stat-num mt-1 text-3xl font-semibold" style={{ color: tone.color }}>
                  {fmt(result.delta_g_kcal_per_mol, 2)}
                  <span className="ml-1.5 text-sm font-normal text-mist/70">kcal/mol</span>
                </p>
              </div>
              <span
                className="chip"
                style={{ color: tone.color, borderColor: `${tone.color}59`, background: `${tone.color}14` }}
              >
                {tone.label}
              </span>
              <span className="chip" title={`Kd = ${result.kd_molar.toExponential(2)} M`}>
                <span className="stat-num">{kdText}</span>
              </span>
              <span className="chip">
                pocket ≈ {result.pocket.resname}
                <span className="stat-num">{result.pocket.resi}</span>
              </span>
            </div>

            {/* Active-site contacts — rendered in the scorer's order. */}
            <div>
              <p className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">
                Active-site contacts ({result.contacts.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="list">
                {result.contacts.length === 0 ? (
                  <p className="text-xs text-mist/70">No contacts within the pocket cutoff.</p>
                ) : (
                  result.contacts.map((c, i) => (
                    <span
                      key={`${c.ligand_atom}-${c.residue}-${c.atom}-${i}`}
                      role="listitem"
                      className="chip"
                      style={
                        c.type === "clash"
                          ? { borderColor: "rgba(208,59,59,0.45)", background: "rgba(208,59,59,0.08)", color: CRITICAL }
                          : undefined
                      }
                      aria-label={`${TYPE_LABEL[c.type]}: ligand atom ${c.ligand_atom} (${c.ligand_element}) to ${c.residue} ${c.atom} at ${fmt(c.distance_angstrom, 2)} angstrom`}
                    >
                      {(() => {
                        const Icon = TYPE_ICON[c.type];
                        return <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: c.type === "clash" ? CRITICAL : undefined }} />;
                      })()}
                      <span className="stat-num">{c.ligand_atom}</span>
                      <span className="text-mist/70">
                        {c.residue}:{c.atom}
                      </span>
                      <span className="stat-num text-mist/70">{fmt(c.distance_angstrom, 2)} Å</span>
                    </span>
                  ))
                )}
              </div>
              <p className="mt-2 text-[10px] text-mist/60">
                <Link2 className="h-3 w-3" aria-hidden /> hydrogen bond · <CircleDot className="h-3 w-3" aria-hidden /> van der Waals · <TriangleAlert className="h-3 w-3 text-[#d03b3b]" aria-hidden /> steric clash
              </p>
            </div>

            <p className="text-[10px] leading-relaxed text-mist/60">
              Empirical Vina-like scoring · parameterized ligands — not a substitute for AutoDock
              Vina.
            </p>
          </div>
        ) : (
          <p className="text-sm text-mist/60">
            Enter a PDB entry and a ligand, then dock to see ΔG, Kd and the active-site contacts.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-mist/60 uppercase">{label}</span>
      {children}
    </label>
  );
}
