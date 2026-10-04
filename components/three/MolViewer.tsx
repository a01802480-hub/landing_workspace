"use client";

/**
 * MolViewer — the structure workspace's cartoon renderer, powered by 3Dmol.js.
 *
 * Replaces the hand-rolled R3F backbone: 3Dmol derives a *real* cartoon from
 * the file's own HELIX/SHEET records — solid, continuous α-helix ribbons and
 * planar β-sheet arrows with directionality — so secondary structures are
 * never fragmented by a trace approximation.
 *
 * Architecture
 * - ONE viewer per component lifetime (`$3Dmol.createViewer` on mount); prop
 *   changes re-style the scene instead of unmounting/remounting it. A
 *   ResizeObserver keeps the canvas in sync with the split pane.
 * - The raw PDB text is fetched through the backend's file endpoints
 *   (`/structure/pdb/{id}/file`, `/structure/alphafold/{accession}/file`) via
 *   apiRaw(); 3Dmol parses it client-side. The Cα-trace payload still drives
 *   the charts/sequence panels (unchanged contract).
 * - Every 3Dmol call is wrapped in try/catch: a styling hiccup degrades the
 *   paint, never the panel. If WebGL is unavailable the component throws
 *   during render so the PanelBoundary shows its designed fallback.
 *
 * 3Dmol 2.5.5 API notes (verified against node_modules/3dmol):
 * - There is no `viewer.setColor(sel, hex)`; per-residue colors are applied
 *   with `setStyle(sel, style)` (same visual result, the supported path).
 * - `colorscheme.map` is a *discrete lookup object*, not a function — the
 *   supported hook for computed colors is `colorfunc`, used here for all
 *   three color modes.
 * - There is no `addResLabel`; `addLabel(text, options, sel)` positions the
 *   label at the selection, which is the same behaviour.
 * - `setHoverable` requires its unhover callback in this version (the mouseout
 *   dispatch calls it unconditionally), so both callbacks are always passed.
 *
 * Colors reuse the workspace's validated helpers: AlphaFold pLDDT bands from
 * lib/format.plddtBand and the diverging writhe ramp from writheColorRgb.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AtomSelectionSpec, AtomStyleSpec, GLViewer } from "3dmol";
import { apiRaw } from "@/lib/api";
import { plddtBand, writheColorRgb } from "@/lib/format";
import type { StructureModel } from "@/lib/types";

export type ColorMode = "chain" | "plddt" | "writhe";
export type RenderStyle = "spheres" | "tube";

/** Click-to-mutate annotation (structurally the page's Mutation type). */
export interface Mutation {
  resi: number;
  from: string;
  to: string;
}

export interface MolViewerProps {
  /** Null while a structure loads — the viewer shows an empty canvas. */
  model: StructureModel | null;
  colorMode: ColorMode;
  renderStyle: RenderStyle;
  showActiveSite: boolean;
  showMetals: boolean;
  mutations: Mutation[];
  /** Residue hovered elsewhere in the workspace (sequence/chart). */
  highlightResi: number | null;
  /** Residue selected by click (anywhere in the workspace). */
  selectedResi: number | null;
  onResidueHover: (resi: number | null) => void;
  onResidueSelect: (resi: number) => void;
}

/** Minimal atom view handed to 3Dmol callbacks (colorfunc, click, hover). */
interface ViewerAtom {
  resi?: number;
  chain?: string;
  resn?: string;
  elem?: string;
  b?: number;
}

type ThreeDmolModule = typeof import("3dmol");

/** Validated light-mode categorical slots (see lib/format.ts palette notes). */
const CHAIN_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#d55181", "#6d5ae0"];
const GRAY = "#9aa3b2";
const HOVER_COLOR = "#0ea5c9"; // hover / cross-panel highlight
const SELECT_COLOR = "#0ea5c9"; // click selection
const MUTATION_COLOR = "#c98500"; // amber — matches the MutateCard chip
const MUTATION_TEXT = "#7a5200";
const METAL_COLOR = "#199e70";
const METAL_TEXT = "#0f6b4c";
const COORD_COLOR = "#1baf7a";
const SELECT_TEXT = "#0e5f73";
const FILE_TIMEOUT_MS = 120_000;

/* ── Module loading (3Dmol is a CommonJS/UMD bundle) ─────────────────────── */

let modulePromise: Promise<ThreeDmolModule> | null = null;

/**
 * Dynamic import keeps the ~1 MB library out of the initial bundle and out of
 * any server evaluation (the UMD build touches `window` at load time). The
 * export shape can be either the namespace or a wrapped default — probe once
 * and remember the promise.
 */
function load3Dmol(): Promise<ThreeDmolModule> {
  if (!modulePromise) {
    modulePromise = import("3dmol").then((mod) => {
      const ns = mod as unknown as { createViewer?: unknown; default?: unknown };
      if (typeof ns.createViewer === "function") return mod;
      const fallback = ns.default as ThreeDmolModule | undefined;
      if (fallback && typeof fallback.createViewer === "function") return fallback;
      throw new Error("3Dmol did not expose createViewer.");
    });
    modulePromise.catch(() => {
      // Allow a later mount (e.g. after a transient chunk failure) to retry.
      modulePromise = null;
    });
  }
  return modulePromise;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

/* ── Color helpers ───────────────────────────────────────────────────────── */

function rgbToHex(rgb: number[]): string {
  return `#${rgb
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function plddtHex(b: number | undefined): string {
  if (typeof b !== "number" || !Number.isFinite(b) || b <= 0) return GRAY;
  return plddtBand(b).color;
}

/**
 * The per-atom color function for the current mode. 3Dmol calls it for every
 * atom of the model (backbone trace and side chains alike), so it must stay
 * pure and cheap: one Map lookup per call.
 */
function makeColorFunc(model: StructureModel, mode: ColorMode, mutations: Mutation[]) {
  const writheByResi = new Map<number, number>();
  const local = model.local_writhe ?? [];
  model.points.forEach((p, i) => {
    if (i < local.length) writheByResi.set(p.resi, local[i]);
  });
  const extent = Math.max(0.05, ...local.map((v) => Math.abs(v)));
  const mutated = new Set(mutations.map((m) => m.resi));
  const chainSlot = new Map(model.chains.map((c, i) => [c, i] as const));
  const primary = model.primary_chain;

  return (atom: ViewerAtom): string => {
    const chain = atom.chain ?? primary;
    if (typeof atom.resi === "number" && chain === primary && mutated.has(atom.resi)) {
      return MUTATION_COLOR;
    }
    if (mode === "plddt") return plddtHex(atom.b);
    if (mode === "writhe") {
      const w = typeof atom.resi === "number" ? (writheByResi.get(atom.resi) ?? 0) : 0;
      return rgbToHex(writheColorRgb(w, extent));
    }
    // Chain mode: the workspace's validated categorical palette, assigned by
    // the model's chain order (stable across renders) with a char-code
    // fallback for chains the payload did not list.
    const slot = chainSlot.get(chain);
    if (slot !== undefined) return CHAIN_PALETTE[slot % CHAIN_PALETTE.length];
    if (!chain) return GRAY;
    return CHAIN_PALETTE[chain.charCodeAt(0) % CHAIN_PALETTE.length];
  };
}

/** Residue-scoped selection spec — always chain-qualified when known. */
function residSpec(model: StructureModel | null, resi: number, chain?: string): AtomSelectionSpec {
  const c = chain ?? model?.points.find((p) => p.resi === resi)?.chain ?? model?.primary_chain;
  return c ? { chain: c, resi } : { resi };
}

/** Style object for one highlighted residue, matching the render style. */
function residueStyle(renderStyle: RenderStyle, color: string): AtomStyleSpec {
  return renderStyle === "tube"
    ? { cartoon: { color, arrows: true } }
    : { sphere: { color, scale: 0.9 } };
}

export default function MolViewer({
  model,
  colorMode,
  renderStyle,
  showActiveSite,
  showMetals,
  mutations,
  highlightResi,
  selectedResi,
  onResidueHover,
  onResidueSelect,
}: MolViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<GLViewer | null>(null);
  /** The model currently in the viewer (set after addModel, not on prop
   *  change) — painters key off this so a pending fetch never decorates the
   *  previous structure with the next one's coordinates. */
  const loadedRef = useRef<StructureModel | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Latest props, readable from the callbacks 3Dmol holds on to for the
  // viewer's lifetime (hover/click are registered once per model).
  const propsRef = useRef<MolViewerProps>({
    model,
    colorMode,
    renderStyle,
    showActiveSite,
    showMetals,
    mutations,
    highlightResi,
    selectedResi,
    onResidueHover,
    onResidueSelect,
  });
  useEffect(() => {
    propsRef.current = {
      model,
      colorMode,
      renderStyle,
      showActiveSite,
      showMetals,
      mutations,
      highlightResi,
      selectedResi,
      onResidueHover,
      onResidueSelect,
    };
  });

  /* ── Scene painters ─────────────────────────────────────────────────── */

  /** Marker shapes: metals, active-site residues, metal↔residue contacts. */
  const applyMarkers = useCallback(() => {
    const viewer = viewerRef.current;
    const m = loadedRef.current;
    const { showActiveSite: sites, showMetals: metals } = propsRef.current;
    if (!viewer || !m) return;
    try {
      viewer.removeAllShapes();
      if (metals) {
        for (const metal of m.metals ?? []) {
          viewer.addSphere({
            center: { x: metal.x, y: metal.y, z: metal.z },
            radius: 0.7,
            color: METAL_COLOR,
            alpha: 0.9,
          });
        }
        for (const coord of m.coordinations ?? []) {
          const metal = (m.metals ?? [])[coord.metal];
          if (!metal) continue;
          viewer.addCylinder({
            start: { x: metal.x, y: metal.y, z: metal.z },
            end: { x: coord.x, y: coord.y, z: coord.z },
            radius: 0.08,
            dashed: true,
            color: COORD_COLOR,
            opacity: 0.85,
          });
        }
      }
      if (sites) {
        const seen = new Set<string>();
        for (const site of m.active_sites ?? []) {
          for (const r of site.residues) {
            // SITE records repeat residues across sites — one sphere each.
            const key = `${r.chain}:${r.resi}`;
            if (r.x === null || r.x === undefined || r.y === null || r.y === undefined || r.z === null || r.z === undefined) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            viewer.addSphere({
              center: { x: r.x, y: r.y, z: r.z },
              radius: 0.8,
              color: MUTATION_COLOR,
              alpha: 0.9,
            });
          }
        }
      }
      viewer.render();
    } catch {
      /* markers are best-effort — the cartoon itself stays usable */
    }
  }, []);

  /** Labels: metals, active sites, mutation annotations, the selection. */
  const applyLabels = useCallback((viewer: GLViewer, m: StructureModel) => {
    const st = propsRef.current;
    try {
      // Simplest robust pass: clear and re-add all labels together, so the
      // hover-out repaint can never leave a stale or duplicated one.
      viewer.removeAllLabels();
      if (st.showMetals) {
        for (const metal of m.metals ?? []) {
          viewer.addLabel(`${metal.element}²⁺`, {
            position: { x: metal.x, y: metal.y + 1.1, z: metal.z },
            fontSize: 10,
            fontColor: METAL_TEXT,
            backgroundOpacity: 0.8,
            showBackground: true,
            inFront: true,
          });
        }
      }
      if (st.showActiveSite) {
        const seen = new Set<string>();
        for (const site of m.active_sites ?? []) {
          for (const r of site.residues) {
            const key = `${r.chain}:${r.resi}`;
            if (seen.has(key)) continue;
            seen.add(key);
            viewer.addLabel(`${r.resname}${r.resi}`, {
              fontSize: 10,
              fontColor: MUTATION_TEXT,
              backgroundOpacity: 0.8,
              showBackground: true,
              inFront: true,
            }, residSpec(m, r.resi, r.chain));
          }
        }
      }
      for (const mut of st.mutations) {
        viewer.addLabel(`Δ ${mut.from}${mut.resi}→${mut.to}`, {
          fontColor: MUTATION_TEXT,
          fontSize: 11,
          backgroundOpacity: 0.85,
          showBackground: true,
        }, residSpec(m, mut.resi));
      }
      if (st.selectedResi !== null) {
        const point = m.points.find((p) => p.resi === st.selectedResi);
        viewer.addLabel(`${point?.resn ?? "RES"} ${st.selectedResi}`, {
          fontColor: SELECT_TEXT,
          fontSize: 11,
          backgroundOpacity: 0.85,
          showBackground: true,
          inFront: true,
        }, residSpec(m, st.selectedResi));
      }
    } catch {
      /* labels are annotations — never fatal */
    }
  }, []);

  /** Full repaint: base carton/spheres + highlight overrides + labels. */
  const applyStyle = useCallback(() => {
    const viewer = viewerRef.current;
    const st = propsRef.current;
    const m = loadedRef.current;
    if (!viewer || !m) return;
    try {
      const colorfunc = makeColorFunc(m, st.colorMode, st.mutations);
      // "tube" is the strict PDB cartoon: helices as solid ribbons, sheets as
      // continuous directional arrows (arrows are opt-in in 3Dmol). "spheres"
      // keeps the AlphaFold-database confidence look.
      viewer.setStyle(
        {},
        st.renderStyle === "tube"
          ? { cartoon: { colorfunc, arrows: true } }
          : { sphere: { colorfunc, scale: 0.9 } },
      );
      if (st.selectedResi !== null) {
        viewer.setStyle(residSpec(m, st.selectedResi), residueStyle(st.renderStyle, SELECT_COLOR));
      }
      if (st.highlightResi !== null && st.highlightResi !== st.selectedResi) {
        viewer.setStyle(residSpec(m, st.highlightResi), residueStyle(st.renderStyle, HOVER_COLOR));
      }
      applyLabels(viewer, m);
      viewer.render();
    } catch {
      /* a styling pass must never take the panel down */
    }
  }, [applyLabels]);

  // Latest-closure ref so the once-registered hover/click callbacks always
  // repaint with the current props (see propsRef above).
  const applyStyleRef = useRef(applyStyle);
  useEffect(() => {
    applyStyleRef.current = applyStyle;
  });

  /* ── Viewer lifecycle: created once, never remounted on prop changes ─── */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!webglAvailable()) {
      setInitFailed(true);
      return;
    }

    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const onResize = () => {
      try {
        viewerRef.current?.resize();
      } catch {
        /* the container may already be gone */
      }
    };

    load3Dmol()
      .then(($3Dmol) => {
        if (cancelled || !containerRef.current) return;
        let viewer: GLViewer;
        try {
          viewer = $3Dmol.createViewer(container, { backgroundColor: "white" });
        } catch {
          setInitFailed(true);
          return;
        }
        viewerRef.current = viewer;
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(onResize);
          observer.observe(container);
        }
        window.addEventListener("resize", onResize);
        setViewerReady(true);
      })
      .catch(() => {
        if (!cancelled) setInitFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      viewerRef.current = null;
      loadedRef.current = null;
      try {
        while (container.firstChild) container.removeChild(container.firstChild);
      } catch {
        /* the DOM node may already be detached */
      }
    };
  }, []);

  /* ── Model loading: fetch raw PDB text, add to the viewer ────────────── */

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer) return;

    if (!model) {
      loadedRef.current = null;
      try {
        viewer.removeAllModels();
        viewer.removeAllShapes();
        viewer.removeAllLabels();
        viewer.render();
      } catch {
        /* clearing an empty scene is inherently safe */
      }
      setFileError(null);
      return;
    }

    const path =
      model.source === "rcsb" && model.pdb_id
        ? `/structure/pdb/${model.pdb_id}/file`
        : model.uniprot
          ? `/structure/alphafold/${model.uniprot}/file`
          : null;
    if (!path) {
      setFileError("No raw structure file is available for this model.");
      return;
    }

    let cancelled = false;
    setFileError(null);
    apiRaw(path, { timeoutMs: FILE_TIMEOUT_MS })
      .then((text) => {
        if (cancelled || !viewerRef.current) return;
        try {
          const v = viewerRef.current;
          v.removeAllModels();
          loadedRef.current = model;
          v.addModel(text, "pdb");
          registerInteractions(v);
          applyMarkers();
          applyStyleRef.current();
          v.zoomTo();
          v.render();
        } catch {
          setFileError("This structure file could not be rendered.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // ApiError carries the backend's fixed, user-safe message.
        setFileError(err instanceof Error && err.message ? err.message : "The structure file could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
    // registerInteractions is a stable module-local callback; applyMarkers /
    // applyStyle read the latest props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, viewerReady, applyMarkers]);

  /** Click → select; hover → cyan residue; unhover → full repaint. */
  function registerInteractions(viewer: GLViewer) {
    try {
      viewer.setClickable({}, true, (atom: ViewerAtom | null) => {
        if (atom && typeof atom.resi === "number") propsRef.current.onResidueSelect(atom.resi);
      });
      viewer.setHoverDuration(80);
      viewer.setHoverable(
        {},
        true,
        (atom: ViewerAtom | null) => {
          if (!atom || typeof atom.resi !== "number") return;
          const st = propsRef.current;
          try {
            viewer.setStyle(residSpec(loadedRef.current, atom.resi, atom.chain), residueStyle(st.renderStyle, HOVER_COLOR));
            viewer.render();
          } catch {
            /* hover styling is best-effort */
          }
          st.onResidueHover(atom.resi);
        },
        () => {
          // Mouse left the atom: repaint exactly what the props describe
          // (base colors + selection + labels), then report the exit.
          applyStyleRef.current();
          propsRef.current.onResidueHover(null);
        },
      );
    } catch {
      /* without interactions the structure still renders */
    }
  }

  /* ── Prop-driven repaints (no remount, no refetch) ───────────────────── */

  const mutationsKey = mutations.map((m) => `${m.resi}:${m.from}:${m.to}`).join(",");

  useEffect(() => {
    if (!viewerReady) return;
    applyMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerReady, model, showMetals, showActiveSite, applyMarkers]);

  useEffect(() => {
    if (!viewerReady) return;
    applyStyleRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerReady, model, colorMode, renderStyle, mutationsKey, highlightResi, selectedResi, showMetals, showActiveSite]);

  // React 19 requires a stable hook order — the throw has to come after every
  // hook call above, so the boundary sees a clean render-phase error.
  if (initFailed) {
    throw new Error("3Dmol could not initialize — WebGL is unavailable in this browser.");
  }

  return (
    <div className="relative h-full w-full">
      {/* The canvas root stays mounted for the panel's whole lifetime. */}
      <div ref={containerRef} className="absolute inset-0 overflow-hidden" data-testid="mol-viewer-root" />
      {fileError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="glass-card max-w-xs px-4 py-3 text-center">
            <p className="text-xs font-medium text-frost">Structure file unavailable</p>
            <p className="mt-1 text-[11px] leading-relaxed text-mist/80">{fileError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
