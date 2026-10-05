"use client";

/**
 * UnfoldingViewer — 3Dmol canvas that morphs a protein along the solvent
 * denaturation curve.
 *
 * Model: a deterministic "unfolded reference" — the primary chain's Cα
 * positions re-laid as a smoothed random coil (seeded PRNG, fixed step
 * length), side chains carried along with a partially collapsed offset.
 * At fraction f the displayed coordinates are lerp(native, unfolded, f),
 * so helices progressively unwind and sheets fray as the slider moves.
 *
 * Readouts computed from the same morph:
 * - RMSD(f) = f · RMSD(max) — the root-mean-square deviation of the
 *   displayed Cα trace from the native structure (linear in f by
 *   construction, reported live).
 * - Hydrophobic-core exposure: residues are colored by a clinical
 *   pink gradient scaled by f × hydrophobicity(resname) — the buried
 *   core visibly "stains" as solvent penetrates.
 *
 * Research preview: a geometric interpolation, not a molecular-dynamics
 * trajectory — labeled as such in the UI. Per-frame updates re-add the
 * model (a ~1k-atom PDB rebuild is cheap) throttled by rAF.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRaw } from "@/lib/api";
import { mulberry32 } from "@/lib/geometry";
import { fnv1a32 } from "@/lib/audit";
import { fmt } from "@/lib/format";

interface Atom {
  line: string;
  x: number;
  y: number;
  z: number;
  resi: number;
  chain: string;
  resn: string;
  element: string;
  isCA: boolean;
}

interface UnfoldingViewerProps {
  pdbId: string;
  source?: "pdb" | "alphafold";
  /** 0..1 unfolded fraction (drives the morph + colors + RMSD). */
  fraction: number;
  /** For the readout chip. */
  solventLabel: string;
  /** Per-solvent geometry parameters (backend SolventModel) — each
   *  one deterministically changes the morph/colors, so different
   *  solvents at the same fraction look different. */
  solventKey?: string;
  seed?: number;
  collapse?: number;
  coreAttack?: number;
  dielectric?: number | null;
  temperatureC?: number;
}

const COIL_STEP = 3.7; // Å per residue — Cα–Cα spacing in a random coil
const HYDROPHOBIC: Record<string, number> = {
  ALA: 1, VAL: 1, ILE: 1, LEU: 1, MET: 1, PHE: 1, TRP: 1,
  CYS: 0.4, TYR: 0.4, GLY: 0.2, PRO: 0.5,
};
const EXPOSED_COLOR = "#d55181"; // clinical pink — the "stained core"
const NATIVE_COLOR = "#7c87a6"; // cool slate for non-hydrophobic surface

type View3D = {
  removeAllModels: () => void;
  addModel: (data: string, format: string) => unknown;
  setStyle: (sel: object, style: object) => void;
  zoomTo: () => void;
  render: () => void;
  clear: () => void;
  resize: () => void;
};

function parsePdb(text: string): Atom[] {
  const atoms: Atom[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("ATOM") || line.length < 54) continue;
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    atoms.push({
      line,
      x,
      y,
      z,
      resi: Number(line.slice(22, 26)) || 0,
      chain: line.slice(21, 22).trim() || "A",
      resn: line.slice(17, 20).trim(),
      element: line.slice(76, 78).trim() || line.slice(12, 16).trim().slice(0, 1),
      isCA: line.slice(12, 16).trim() === "CA",
    });
  }
  return atoms;
}

function coordsToPdb(atoms: Atom[], resolve: (atom: Atom, index: number) => [number, number, number] | null): string {
  const out: string[] = ["TITLE     Protheon unfolding model"];
  for (const a of atoms) {
    const c = resolve(a, out.length);
    if (!c) continue;
    const prefix = a.line.slice(0, 30);
    const suffix = a.line.slice(54);
    out.push(
      `${prefix}${c[0].toFixed(3).padStart(8)}${c[1].toFixed(3).padStart(8)}${c[2].toFixed(3).padStart(8)}${suffix}`,
    );
  }
  out.push("END");
  return out.join("\n");
}

/** Mix two hex colors (0..1). */
function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return `#${pa
    .map((v, i) =>
      Math.round(v + (pb[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function UnfoldingViewer({
  pdbId,
  source = "pdb",
  fraction,
  solventLabel,
  solventKey,
  seed,
  collapse,
  coreAttack,
  dielectric,
  temperatureC,
}: UnfoldingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<View3D | null>(null);
  const atomsRef = useRef<Atom[]>([]);
  const caRef = useRef<Atom[]>([]);
  const unfoldedRef = useRef<Map<number, [number, number, number]>>(new Map());
  const rmsdMaxRef = useRef(0);
  const frameRef = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [rmsd, setRmsd] = useState(0);

  // ── Viewer lifecycle (created once per component lifetime) ──────────────
  useEffect(() => {
    let viewer: View3D | null = null;
    (async () => {
      try {
        const $3Dmol = (await import("3dmol")).default;
        const el = containerRef.current;
        if (!el) return;
        viewer = $3Dmol.createViewer(el, { backgroundColor: "white" }) as View3D;
        viewerRef.current = viewer;
        const ro = new ResizeObserver(() => viewer?.resize?.());
        ro.observe(el);
        window.addEventListener("resize", () => viewer?.resize?.());
        // eslint-disable-next-line react-hooks/exhaustive-deps
      } catch {
        setStatus("error");
        setError("3D viewer unavailable in this browser.");
      }
    })();
    return () => {
      viewerRef.current = null;
      // 3Dmol attaches no external handles; the container teardown releases it.
    };
  }, []);

  // ── Load the PDB + build the unfolded reference ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        const text = await apiRaw<string>(
      source === "alphafold" ? `/structure/alphafold/${pdbId}/file` : `/structure/pdb/${pdbId}/file`,
      { timeoutMs: 120_000 },
    );
        if (cancelled) return;
        const atoms = parsePdb(text);
        const primaryChain = [...new Set(atoms.map((a) => a.chain))].sort(
          (a, b) => atoms.filter((x) => x.chain === b).length - atoms.filter((x) => x.chain === a).length,
        )[0];
        const cas = atoms.filter((a) => a.isCA && a.chain === primaryChain).sort((a, b) => a.resi - b.resi);
        if (cas.length < 10) throw new Error("Structure has too few residues to unfold.");

        // Deterministic random coil: smoothed random walk, seeded by the
        // solvent + structure identity (per-solvent unfolded reference).
        const seedNum = parseInt(fnv1a32(`${pdbId}:${solventKey ?? "native"}:${seed ?? 7}`), 16) || 17;
        const rng = mulberry32(seedNum);
        const dir: [number, number, number] = [1, 0, 0];
        const path: [number, number, number][] = [[0, 0, 0]];
        for (let i = 1; i < cas.length; i++) {
          const nx = dir[0] + (rng() - 0.5) * 1.1;
          const ny = dir[1] + (rng() - 0.5) * 1.1;
          const nz = dir[2] + (rng() - 0.5) * 1.1;
          const len = Math.hypot(nx, ny, nz) || 1;
          dir[0] = nx / len;
          dir[1] = ny / len;
          dir[2] = nz / len;
          path.push([path[i - 1][0] + dir[0] * COIL_STEP, path[i - 1][1] + dir[1] * COIL_STEP, path[i - 1][2] + dir[2] * COIL_STEP]);
        }
        // 3-point smoothing for a coil that looks unfolded, not jagged.
        const smooth: [number, number, number][] = path.map((p, i) => {
          const a = path[Math.max(0, i - 1)];
          const b = path[Math.min(path.length - 1, i + 1)];
          return [(a[0] + p[0] + b[0]) / 3, (a[1] + p[1] + b[1]) / 3, (a[2] + p[2] + b[2]) / 3];
        });

        // Center the unfolded chain on the native Cα centroid so the morph
        // opens up in place instead of flying off.
        const cxo = cas.reduce((s, a) => s + a.x, 0) / cas.length;
        const cyo = cas.reduce((s, a) => s + a.y, 0) / cas.length;
        const czo = cas.reduce((s, a) => s + a.z, 0) / cas.length;
        const cxn = smooth.reduce((s, p) => s + p[0], 0) / smooth.length;
        const cyn = smooth.reduce((s, p) => s + p[1], 0) / smooth.length;
        const czn = smooth.reduce((s, p) => s + p[2], 0) / smooth.length;

        const unfolded = new Map<number, [number, number, number]>();
        let sumSq = 0;
        cas.forEach((ca, i) => {
          const target: [number, number, number] = [
            smooth[i][0] - cxn + cxo,
            smooth[i][1] - cyn + cyo,
            smooth[i][2] - czn + czo,
          ];
          unfolded.set(ca.resi, target);
          sumSq += (target[0] - ca.x) ** 2 + (target[1] - ca.y) ** 2 + (target[2] - ca.z) ** 2;
        });

        atomsRef.current = atoms;
        caRef.current = cas;
        unfoldedRef.current = unfolded;
        rmsdMaxRef.current = Math.sqrt(sumSq / cas.length);
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Failed to load the structure.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdbId, solventKey, seed]);

  // ── Morph application (rAF-throttled) ───────────────────────────────────
  const applyMorph = useMemo(
    () => (f: number) => {
      const viewer = viewerRef.current;
      const atoms = atomsRef.current;
      const cas = caRef.current;
      if (!viewer || atoms.length === 0 || cas.length === 0) return;

      const fClamped = Math.min(1, Math.max(0, f));
      // Display position of each primary-chain Cα: lerp(native, unfolded, f).
      const caTarget = new Map<number, [number, number, number]>();
      const caNative = new Map<number, [number, number, number]>();
      for (const ca of cas) {
        const u = unfoldedRef.current.get(ca.resi);
        if (!u) continue;
        caNative.set(ca.resi, [ca.x, ca.y, ca.z]);
        caTarget.set(ca.resi, [
          ca.x + (u[0] - ca.x) * fClamped,
          ca.y + (u[1] - ca.y) * fClamped,
          ca.z + (u[2] - ca.z) * fClamped,
        ]);
      }
      // Side chains follow their Cα; their native offset shrinks as the
      // chain unfolds (partially collapsed random-coil side chains).
      const sideScale = 1 - (collapse ?? 0.45) * fClamped;

      viewer.removeAllModels();
      viewer.addModel(
        coordsToPdb(atoms, (a) => {
          const c = caTarget.get(a.resi);
          if (!c) return null;
          if (a.isCA) return c;
          const n = caNative.get(a.resi);
          if (!n) return c;
          return [
            c[0] + (a.x - n[0]) * sideScale,
            c[1] + (a.y - n[1]) * sideScale,
            c[2] + (a.z - n[2]) * sideScale,
          ];
        }),
        "pdb",
      );
      viewer.setStyle({}, { cartoon: {} });

      // Hydrophobic-core exposure stain: pink scaled by f × hydrophobicity.
      const seen = new Set<number>();
      for (const ca of cas) {
        if (seen.has(ca.resi)) continue;
        seen.add(ca.resi);
        const hyd = HYDROPHOBIC[ca.resn] ?? 0;
        const t = Math.min(1, fClamped * hyd * (coreAttack ?? 1.6));
        const color = mix(NATIVE_COLOR, EXPOSED_COLOR, t);
        viewer.setStyle({ chain: ca.chain, resi: ca.resi }, { cartoon: { color } });
      }
      viewer.zoomTo();
      viewer.render();
      setRmsd(fClamped * rmsdMaxRef.current);
    },
    [],
  );

  useEffect(() => {
    if (status !== "ready") return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => applyMorph(fraction));
    return () => cancelAnimationFrame(frameRef.current);
  }, [fraction, status, applyMorph]);

  const unfoldedPct = Math.round(fraction * 100);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg border border-ink-950/5 bg-white" />
        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="chip !bg-white/90 backdrop-blur-md">Loading {pdbId}…</p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="chip !bg-white/90 backdrop-blur-md">{error}</p>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="chip stat-num !py-0.5 text-[10px]">
          RMSD {fmt(rmsd, 2)} Å
        </span>
        <span className="chip stat-num !py-0.5 text-[10px]">
          unfolded {unfoldedPct}% · {solventLabel}
        </span>
        {typeof dielectric === "number" && (
          <span className="chip stat-num !py-0.5 text-[10px]">ε {fmt(dielectric, 1)}</span>
        )}
        {typeof temperatureC === "number" && (
          <span className="chip stat-num !py-0.5 text-[10px]">{temperatureC}°C</span>
        )}
        <span className="chip !py-0.5 text-[10px]">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: NATIVE_COLOR }} />
          surface
          <span aria-hidden className="ml-1 h-2 w-2 rounded-full" style={{ background: EXPOSED_COLOR }} />
          exposed core
        </span>
      </div>
    </div>
  );
}
