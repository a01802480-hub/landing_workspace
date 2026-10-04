"use client";

/**
 * Structure workspace — the Benchling-style flagship.
 *
 * Layout: command bar + multi-tab file list on top; below, a resizable
 * split between the 3D viewer (left) and a stack of synced panels
 * (right): stats, sequence track, pLDDT chart, PAE heatmap.
 *
 * Stability contract ("zero unhandled errors"):
 * - Every panel body sits inside a PanelBoundary; a crash degrades that
 *   panel only. API payloads pass Zod before rendering. Loading states
 *   are PanelSkeletons.
 * - Zero data loss: every loaded model stays in a state map keyed by tab;
 *   switching/closing tabs never discards another tab's model. The tab
 *   list, view prefs and split ratio persist to localStorage (validated
 *   on hydration — stored data is treated as untrusted input).
 *
 * Sync contract: hover/select in any panel (sequence ↔ 3D ↔ chart ↔
 * heatmap) flows through two workspace-level values, hoverResi and
 * selectedResi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PanelRight, TriangleAlert, X } from "lucide-react";
import { z } from "zod";
import { apiValidated } from "@/lib/api";
import { usePersistentState } from "@/lib/persistence";
import { fmt, plddtBand, writheColor, MARKER } from "@/lib/format";
import type { CatalogEntry, StructureModel } from "@/lib/types";
import {
  CatalogSchema,
  ConfidenceDataSchema,
  StructureModelSchema,
  type ConfidenceData,
} from "@/lib/validation";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";
import { Panel } from "@/components/workspace/panels/Panel";
import { SplitPane } from "@/components/workspace/shell/SplitPane";
import { TabBar, type FileTab } from "@/components/workspace/shell/TabBar";
import { SequenceTrack, type TrackResidue } from "@/components/workspace/sequence/SequenceTrack";
import { PlddtChart, type PlddtPoint } from "@/components/workspace/charts/PlddtChart";
import { WritheChart } from "@/components/workspace/charts/WritheChart";
import { PaeHeatmap } from "@/components/workspace/charts/PaeHeatmap";
import { PlddtLegend } from "@/components/workspace/sequence/PlddtLegend";
import { StatTile } from "@/components/workspace/panels/StatTile";
import type { ColorMode, Mutation, RenderStyle } from "@/components/three/ProteinViewer";

// 3Dmol.js cartoon renderer, loaded client-side only (the library is a
// browser-only bundle and the largest single dependency of this route). It
// renders from the raw PDB file fetched via the /structure/*/file endpoints.
const MolViewer = dynamic(() => import("@/components/three/MolViewer"), {
  ssr: false,
  loading: () => <PanelSkeleton variant="viewer" />,
});

type LoadKind = "pdb" | "alphafold";

const IDENT_RE: Record<LoadKind, RegExp> = {
  pdb: /^[0-9A-Za-z]{4}$/,
  // UniProtKB accession grammar (6-char TrEMBL + 10-char forms) — mirrors the
  // backend path validator so a PDB ID typed into the UniProt field never
  // reaches a URL.
  alphafold: /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/,
};

/** Persisted tab shape — validated on hydration (localStorage is untrusted).
 *  Identifiers are re-checked against the current grammars, so a tab saved
 *  by an older build (e.g. a PDB code inside a UniProt tab) is dropped on
 *  restore instead of reproducing an upstream 422 on boot. */
const PersistedTabSchema = z
  .object({
    id: z.string().max(80),
    kind: z.enum(["pdb", "alphafold"]),
    ident: z.string().max(20),
  })
  .refine((t) => IDENT_RE[t.kind].test(t.ident), { message: "identifier no longer valid" });
const PersistedTabsSchema = z.array(PersistedTabSchema).max(20);

const ALPHAFOLD_PRESETS = [
  { acc: "P18858", label: "P18858 · LIG1" },
  { acc: "P00875", label: "P00875 · RuBisCO rbcL" },
];

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "chain", label: "Chain" },
  { id: "plddt", label: "pLDDT / B-factor" },
  { id: "writhe", label: "Backbone writhe" },
];

export default function StructurePage() {
  const [tabs, setTabs] = usePersistentState<z.infer<typeof PersistedTabSchema>[]>(
    "structure:tabs",
    [],
    (v) => (PersistedTabsSchema.safeParse(v).success ? (v as z.infer<typeof PersistedTabSchema>[]) : null),
  );
  const [activeId, setActiveId] = usePersistentState<string | null>("structure:active", null, (v) =>
    typeof v === "string" && v.length <= 80 ? v : null,
  );
  const [colorMode, setColorMode] = usePersistentState<ColorMode>("structure:color", "plddt", (v) =>
    v === "chain" || v === "plddt" || v === "writhe" ? v : null,
  );
  const [renderStyle, setRenderStyle] = usePersistentState<RenderStyle>("structure:style", "spheres", (v) =>
    v === "spheres" || v === "tube" ? v : null,
  );
  const [showActiveSite, setShowActiveSite] = usePersistentState<boolean>("structure:markers:site", true, (v) =>
    typeof v === "boolean" ? v : null,
  );
  const [showMetals, setShowMetals] = usePersistentState<boolean>("structure:markers:metal", true, (v) =>
    typeof v === "boolean" ? v : null,
  );
  const [showPanels, setShowPanels] = usePersistentState<boolean>("structure:panels", true, (v) =>
    typeof v === "boolean" ? v : null,
  );

  const [models, setModels] = useState<Record<string, StructureModel>>({});
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, ConfidenceData | "loading" | "error">>({});
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [hoverResi, setHoverResi] = useState<number | null>(null);
  const [selectedResi, setSelectedResi] = useState<number | null>(null);
  /** Click-to-mutate annotations, keyed by tab id (zero data loss per tab). */
  const [mutations, setMutations] = useState<Record<string, Mutation[]>>({});

  const [kind, setKind] = useState<LoadKind>("alphafold");
  const [ident, setIdent] = useState("P18858");
  const [formError, setFormError] = useState<string | null>(null);
  const identRef = useRef<HTMLInputElement>(null);
  const booted = useRef(false);

  const activeModel = activeId ? models[activeId] : undefined;
  const activeTab = tabs.find((t) => t.id === activeId);
  const activeStatus: FileTab["status"] = activeId
    ? loadingIds.has(activeId)
      ? "loading"
      : activeId in errors
        ? "error"
        : activeModel
          ? "ready"
          : "loading"
    : "loading";

  const setLoading = useCallback((id: string, on: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const loadConfidence = useCallback(
    async (id: string, uniprot: string) => {
      setConfidence((prev) => ({ ...prev, [id]: "loading" }));
      try {
        const data = await apiValidated(`/structure/alphafold/${uniprot}/confidence`, ConfidenceDataSchema);
        setConfidence((prev) => ({ ...prev, [id]: data }));
      } catch {
        setConfidence((prev) => ({ ...prev, [id]: "error" }));
      }
    },
    [],
  );

  const load = useCallback(
    async (loadKind: LoadKind, loadIdent: string) => {
      const clean = loadIdent.trim().toUpperCase();
      // Client-side identifier gate mirrors the backend's path patterns —
      // anything else never reaches a URL, and the user gets an actionable
      // hint (a 4-char code is almost always a PDB ID).
      if (!IDENT_RE[loadKind].test(clean)) {
        const looksLikePdb = /^[0-9A-Za-z]{4}$/.test(clean);
        setFormError(
          loadKind === "alphafold" && looksLikePdb
            ? `“${clean}” is a PDB-style identifier — switch the loader to PDB ID mode to open it.`
            : loadKind === "pdb"
              ? `“${clean}” is not a valid PDB ID (4 characters, e.g. 1X9N).`
              : `“${clean}” is not a UniProt accession (e.g. P18858).`,
        );
        return;
      }
      setFormError(null);
      const id = `${loadKind}:${clean}`;
      setTabs((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { id, kind: loadKind, ident: clean }]));
      setActiveId(id);
      setSelectedResi(null);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setLoading(id, true);
      try {
        const model = await apiValidated<StructureModel>(
          loadKind === "pdb" ? `/structure/rcsb/${clean}` : `/structure/alphafold/${clean}`,
          StructureModelSchema,
        );
        setModels((prev) => ({ ...prev, [id]: model }));
        if (model.source === "alphafold" && model.pae_available && model.uniprot) {
          void loadConfidence(id, model.uniprot);
        }
        // Each database opens in its native look: AlphaFold → pLDDT spheres
        // (the AF DB confidence view); RCSB PDB → chain-colored cartoon
        // (the Mol* view).
        if (loadKind === "alphafold") {
          setColorMode("plddt");
          setRenderStyle("spheres");
        } else {
          setColorMode("chain");
          setRenderStyle("tube");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load structure.";
        setErrors((prev) => ({ ...prev, [id]: msg }));
      } finally {
        setLoading(id, false);
      }
    },
    [loadConfidence, setActiveId, setColorMode, setLoading, setRenderStyle, setTabs],
  );

  // Boot: restore persisted tabs (models reload lazily), else float the
  // AlphaFold LIG1 model in — the confidence view with both graphs.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (tabs.length > 0) {
      const target = tabs.find((t) => t.id === activeId) ?? tabs[0];
      setActiveId(target.id);
      void load(target.kind, target.ident);
    } else {
      void load("alphafold", "P18858");
    }
    apiValidated("/structure/catalog", CatalogSchema)
      .then((r) => setCatalog(r.entries))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTab = useCallback(
    (id: string) => {
      setActiveId(id);
      setSelectedResi(null);
      setHoverResi(null);
      // Lazy restore: a persisted tab without a loaded model reloads on demand.
      const tab = tabs.find((t) => t.id === id);
      if (tab && !models[id] && !loadingIds.has(id) && !(id in errors)) {
        void load(tab.kind, tab.ident);
      }
    },
    [errors, load, loadingIds, models, setActiveId, tabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeId) setActiveId(next.length > 0 ? next[next.length - 1].id : null);
        return next;
      });
      setModels((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setConfidence((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [activeId, setActiveId, setTabs],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void load(kind, ident);
  };

  const fileTabs: FileTab[] = tabs.map((t) => ({
    id: t.id,
    label: t.ident,
    kind: t.kind,
    status: t.id === activeId
      ? activeStatus
      : loadingIds.has(t.id)
        ? "loading"
        : t.id in errors
          ? "error"
          : models[t.id]
            ? "ready"
            : "loading",
  }));

  // ── Panel data ───────────────────────────────────────────────────────────
  const trackResidues: TrackResidue[] = useMemo(() => {
    if (!activeModel) return [];
    const src = activeModel.residues_full?.length ? activeModel.residues_full : activeModel.points;
    return src.map((p) => ({ resi: p.resi, resn: p.resn, plddt: p.plddt ?? null }));
  }, [activeModel]);

  const plddtSeries: PlddtPoint[] = useMemo(() => {
    if (!activeModel || !activeId) return [];
    const conf = confidence[activeId];
    if (conf && conf !== "loading" && conf !== "error" && conf.plddt) {
      return conf.residue_index.map((resi, i) => ({ resi, plddt: conf.plddt?.[i] ?? null }));
    }
    return activeModel.points.map((p) => ({ resi: p.resi, plddt: p.plddt ?? null }));
  }, [activeModel, activeId, confidence]);

  const confState = activeId ? confidence[activeId] : undefined;
  const confData: ConfidenceData | null = confState && confState !== "loading" && confState !== "error" ? confState : null;
  const plddtNote = confData ? "full model" : "Cα trace";

  const focus = hoverResi ?? selectedResi;
  const activeMutations = activeId ? (mutations[activeId] ?? []) : [];

  const applyMutation = (resi: number, to: string) => {
    if (!activeId || !activeModel) return;
    const from = activeModel.points.find((p) => p.resi === resi)?.resn ?? "X";
    setMutations((prev) => {
      const list = (prev[activeId] ?? []).filter((m) => m.resi !== resi);
      return { ...prev, [activeId]: [...list, { resi, from, to }] };
    });
  };

  const clearMutation = (resi: number) => {
    if (!activeId) return;
    setMutations((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] ?? []).filter((m) => m.resi !== resi),
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Command bar + tabs ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-3">
        <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5" role="toolbar" aria-label="Structure controls">
          <form onSubmit={submit} className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex shrink-0 rounded-full border border-ink-950/10 bg-ink-950/5 p-0.5" role="radiogroup" aria-label="Identifier type">
                {(["pdb", "alphafold"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => {
                      setKind(k);
                      setFormError(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] transition-colors duration-300 ease-out ${
                      kind === k ? "bg-white/90 font-medium text-frost shadow-sm" : "text-mist hover:text-frost"
                    }`}
                  >
                    {k === "pdb" ? "PDB ID" : "UniProt"}
                  </button>
                ))}
              </div>
              <input
                ref={identRef}
                value={ident}
                onChange={(e) => {
                  setIdent(e.target.value);
                  setFormError(null);
                }}
                placeholder={kind === "pdb" ? "e.g. 1X9N" : "e.g. P18858"}
                aria-label="Structure identifier"
                aria-invalid={formError !== null}
                className="glass-panel min-w-0 flex-1 px-3 py-1.5 font-mono text-sm text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
              />
              <button type="submit" disabled={loadingIds.has(`${kind}:${ident.trim().toUpperCase()}`)} className="btn-primary !px-4 !py-1.5 text-xs">
                Load
              </button>
            </div>
            {formError && (
              <p role="alert" className="px-3 text-[11px] text-[#c13b3b]">
                {formError}
              </p>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-1.5 border-l border-ink-950/10 pl-4">
            <span className="text-[10px] tracking-wide text-mist/70 uppercase">Presets</span>
            {(kind === "pdb" ? catalog : ALPHAFOLD_PRESETS.map((p) => ({ id: p.acc.toLowerCase(), pdb: p.acc, title: p.label, note: "" }))).map(
              (c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setKind(kind);
                    setIdent(c.pdb);
                    void load(kind, c.pdb);
                  }}
                  className="chip transition-colors duration-300 ease-out hover:border-glow-violet/40 hover:text-frost"
                  title={c.note || c.title}
                >
                  {kind === "pdb" ? `${c.pdb} · ${c.id.toUpperCase()}` : c.title}
                </button>
              ),
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-l border-ink-950/10 pl-4" role="radiogroup" aria-label="Backbone color mode">
            <span className="text-[10px] tracking-wide text-mist/70 uppercase">Color</span>
            {COLOR_MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={colorMode === m.id}
                onClick={() => setColorMode(m.id)}
                className={`chip transition-colors duration-300 ease-out ${
                  colorMode === m.id ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-l border-ink-950/10 pl-4" role="radiogroup" aria-label="Render style">
            <span className="text-[10px] tracking-wide text-mist/70 uppercase">Style</span>
            {(
              [
                { id: "spheres", label: "Spheres" },
                { id: "tube", label: "Cartoon" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={renderStyle === s.id}
                onClick={() => setRenderStyle(s.id)}
                className={`chip transition-colors duration-300 ease-out ${
                  renderStyle === s.id ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 border-l border-ink-950/10 pl-4">
            <ToggleChip label="Sites" on={showActiveSite} set={setShowActiveSite} dot={MARKER.residue} />
            <ToggleChip label="Metals" on={showMetals} set={setShowMetals} dot={MARKER.metal} />
          </div>

          <button
            type="button"
            onClick={() => setShowPanels((v) => !v)}
            aria-pressed={showPanels}
            aria-label={showPanels ? "Hide side panels" : "Show side panels"}
            className={`chip inline-flex items-center gap-1.5 transition-colors duration-300 ease-out ${showPanels ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"}`}
          >
            <PanelRight className="h-3.5 w-3.5" /> Panels
          </button>
        </div>

        <TabBar
          tabs={fileTabs}
          activeId={activeId}
          onSelect={selectTab}
          onClose={closeTab}
          onNew={() => identRef.current?.focus()}
        />
      </div>

      {/* ── Split workspace ────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 px-4 pb-4">
        <SplitPane
          direction="row"
          storageKey="structure:split"
          initial={62}
          minFirst={38}
          minSecond={24}
          collapsed={!showPanels}
          className="h-full"
          first={<ViewerPanel model={activeModel} status={activeStatus} error={errors[activeId ?? ""]} colorMode={colorMode} renderStyle={renderStyle} showActiveSite={showActiveSite} showMetals={showMetals} mutations={activeMutations} hoverResi={hoverResi} selectedResi={selectedResi} onHover={setHoverResi} onSelect={setSelectedResi} onMutate={applyMutation} onClearMutation={clearMutation} onRetry={() => activeTab && void load(activeTab.kind, activeTab.ident)} />}
          second={
            <div className="flex h-full flex-col gap-3 overflow-y-auto">
              {activeModel && <StatsStrip model={activeModel} />}
              <Panel title="Sequence" note={trackResidues.length ? `${trackResidues.length} residues · hover to inspect` : undefined} className="h-56 shrink-0">
                <PanelBoundary title="Sequence track" className="h-full">
                  <SequenceTrack residues={trackResidues} highlight={focus} selected={selectedResi} onHover={setHoverResi} onSelect={setSelectedResi} />
                </PanelBoundary>
              </Panel>
              <Panel title="pLDDT confidence" note={plddtSeries.length ? `${plddtNote} · ${plddtSeries.length} residues` : undefined} className="h-60 shrink-0">
                <PanelBoundary title="pLDDT chart" className="h-full">
                  {plddtSeries.length === 0 ? (
                    <PanelSkeleton variant="chart" />
                  ) : (
                    <PlddtChart series={plddtSeries} highlight={focus} onHover={setHoverResi} onSelect={setSelectedResi} />
                  )}
                </PanelBoundary>
              </Panel>
              <Panel
                title={confData ? "PAE matrix" : "Backbone writhe"}
                note={
                  confData
                    ? `mean ${confData.mean_pae.toFixed(1)} Å`
                    : activeModel?.source === "alphafold"
                      ? "no PAE file — local writhe shown"
                      : "per-residue local writhe"
                }
                className={confData ? "h-80 shrink-0" : "h-56 shrink-0"}
              >
                <PanelBoundary title={confData ? "PAE heatmap" : "Writhe chart"} className="h-full">
                  {confData ? (
                    <PaeHeatmap data={confData} highlight={focus} onHover={setHoverResi} onSelect={setSelectedResi} />
                  ) : confState === "loading" ? (
                    <PanelSkeleton variant="heatmap" />
                  ) : activeModel?.local_writhe?.length ? (
                    <WritheChart
                      values={activeModel.local_writhe.map((v, i) => ({ resi: activeModel.points[i]?.resi ?? i, value: v }))}
                      highlight={focus}
                      onHover={setHoverResi}
                      onSelect={setSelectedResi}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center px-6 text-center text-sm text-mist/60">
                      No writhe data for this model.
                    </p>
                  )}
                </PanelBoundary>
              </Panel>
            </div>
          }
        />
      </div>
    </div>
  );
}

/* ── Sub-panels ──────────────────────────────────────────────────────────── */

function ViewerPanel({
  model,
  status,
  error,
  colorMode,
  renderStyle,
  showActiveSite,
  showMetals,
  mutations,
  hoverResi,
  selectedResi,
  onHover,
  onSelect,
  onMutate,
  onClearMutation,
  onRetry,
}: {
  model: StructureModel | undefined;
  status: FileTab["status"];
  error?: string;
  colorMode: ColorMode;
  renderStyle: RenderStyle;
  showActiveSite: boolean;
  showMetals: boolean;
  mutations: Mutation[];
  hoverResi: number | null;
  selectedResi: number | null;
  onHover: (resi: number | null) => void;
  onSelect: (resi: number) => void;
  onMutate: (resi: number, to: string) => void;
  onClearMutation: (resi: number) => void;
  onRetry: () => void;
}) {
  return (
    <PanelBoundary title="Structure viewer" className="h-full" onReset={onRetry}>
      <section className="glass-card relative h-full overflow-hidden" aria-label="3D structure viewer">
        {/* The viewer canvas root stays mounted for the panel's whole lifetime.
            Unmounting it on status flips (loading/error swaps) races React
            19's commit phase ("synchronously unmount a root") — so loading
            and error states are translucent overlays instead. */}
        <div className="absolute inset-0">
          <MolViewer
            model={model ?? null}
            colorMode={colorMode}
            renderStyle={renderStyle}
            showActiveSite={showActiveSite}
            showMetals={showMetals}
            mutations={mutations}
            highlightResi={hoverResi}
            selectedResi={selectedResi}
            onResidueHover={onHover}
            onResidueSelect={onSelect}
          />
        </div>

        {status === "loading" && (
          <div className="absolute inset-0 z-10 bg-white/55 backdrop-blur-[2px]">
            <PanelSkeleton variant="viewer" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 p-6 backdrop-blur-[2px]">
            <div className="panel-fallback max-w-md">
              <span className="panel-fallback-icon" aria-hidden>
                <TriangleAlert className="h-4.5 w-4.5" />
              </span>
              <p className="text-sm font-medium text-frost">Structure failed to load</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-mist/80">{error ?? "Upstream unavailable."}</p>
              <button type="button" onClick={onRetry} className="btn-ghost mt-4 !px-4 !py-1.5 text-xs">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Overlay chips — pointer-transparent so the canvas stays interactive. */}
        <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-wrap gap-2">
          {model && (
            <>
              <span className="chip !bg-white/80 backdrop-blur-md">{model.pdb_id ?? model.uniprot}</span>
              <span className="chip !bg-white/80 backdrop-blur-md">{model.source}</span>
            </>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-20">
          <ViewerLegend colorMode={colorMode} model={model} />
        </div>
        {model && status === "ready" && (
          <span className="chip pointer-events-none absolute right-3 bottom-3 z-20 !bg-white/80 text-[10px] backdrop-blur-md">
            hover backbone · click to select
          </span>
        )}

        {/* Click-to-mutate card — appears when a residue is selected. */}
        {model && status === "ready" && selectedResi !== null && (
          <MutateCard
            model={model}
            selectedResi={selectedResi}
            mutations={mutations}
            onMutate={onMutate}
            onClear={onClearMutation}
          />
        )}
      </section>
    </PanelBoundary>
  );
}

const AMINO_LIST = "ACDEFGHIKLMNPQRSTVWY".split("");

function MutateCard({
  model,
  selectedResi,
  mutations,
  onMutate,
  onClear,
}: {
  model: StructureModel;
  selectedResi: number;
  mutations: Mutation[];
  onMutate: (resi: number, to: string) => void;
  onClear: (resi: number) => void;
}) {
  const point = model.points.find((p) => p.resi === selectedResi);
  const current = mutations.find((m) => m.resi === selectedResi);
  const [pick, setPick] = useState<string>(current?.to ?? "A");

  return (
    <div className="glass-card absolute top-3 right-3 z-20 w-64 p-3 text-xs shadow-lg">
      <p className="font-medium text-frost">
        Mutate {point ? `${point.resn}${selectedResi}` : `residue ${selectedResi}`}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label="Replacement amino acid"
          className="glass-panel min-w-0 flex-1 px-2 py-1 font-mono text-xs text-frost focus:border-glow-violet/50 focus:outline-none"
        >
          {AMINO_LIST.filter((aa) => aa !== point?.resn).map((aa) => (
            <option key={aa} value={aa}>
              {aa}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onMutate(selectedResi, pick)} className="btn-primary !px-3 !py-1 text-[11px]">
          Apply
        </button>
      </div>
      {mutations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {mutations.map((m) => (
            <button
              key={`mut:${m.resi}`}
              type="button"
              onClick={() => onClear(m.resi)}
              title="Remove this mutation"
              className="chip inline-flex items-center gap-1 !border-[#c98500]/60 !bg-[#c98500]/10 text-[10px] text-[#7a5200] transition-colors duration-300 ease-out hover:border-[#c98500]"
            >
              Δ {m.from}{m.resi}→{m.to} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-[9px] leading-relaxed text-mist/60">
        Annotation-level mutation marker (amber in the scene). Full side-chain repacking needs an
        external modeling engine — on the roadmap.
      </p>
    </div>
  );
}

function ViewerLegend({ colorMode, model }: { colorMode: ColorMode; model: StructureModel | undefined }) {
  if (!model) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colorMode === "plddt" && <PlddtLegend />}
      {colorMode === "writhe" && (
        <>
          <span className="chip !border-violet-300/50 !bg-white/80 backdrop-blur-md">− twist</span>
          <span
            aria-hidden
            className="h-2 w-40 rounded-full"
            style={{ background: `linear-gradient(90deg, ${writheColor(-1, 1)}, ${writheColor(0, 1)}, ${writheColor(1, 1)})` }}
          />
          <span className="chip !border-sky-300/50 !bg-white/80 backdrop-blur-md">+ twist</span>
        </>
      )}
      {(showActiveSiteMarker(model) || (model.metals?.length ?? 0) > 0) && (
        <>
          <span className="chip !bg-white/80 backdrop-blur-md">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: MARKER.residue }} />
            catalytic
          </span>
          <span className="chip !bg-white/80 backdrop-blur-md">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: MARKER.metal }} />
            metal
          </span>
        </>
      )}
    </div>
  );
}

function showActiveSiteMarker(model: StructureModel): boolean {
  return (model.active_sites ?? []).some((s) => s.residues.length > 0);
}

function StatsStrip({ model }: { model: StructureModel }) {
  const mean = model.mean_plddt;
  const band = mean !== undefined ? plddtBand(mean) : null;
  const meta = model.model_metadata;
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3">
      <StatTile
        dense
        label="Mean pLDDT"
        value={mean === undefined ? "—" : fmt(mean, 1)}
        chip={band ? { color: band.color, label: band.label } : undefined}
      />
      <StatTile
        dense
        label="Total writhe"
        value={model.writhe === null || model.writhe === undefined ? "—" : fmt(model.writhe, 3)}
        accent={model.writhe && model.writhe !== 0 ? (model.writhe > 0 ? "#3987e5" : "#9085e9") : undefined}
      />
      <StatTile dense label="Residues" value={model.full_residue_count ? `${fmt(model.residue_count, 0)} / ${fmt(model.full_residue_count, 0)}` : fmt(model.residue_count, 0)} />
      <StatTile
        dense
        label="Model"
        value={
          meta?.entry_id ??
          (meta?.model_created_date ? `v${meta.latest_version ?? "?"} · ${meta.model_created_date}` : model.pdb_id ?? "—")
        }
      />
    </div>
  );
}

function ToggleChip({
  label,
  on,
  set,
  dot,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className={`chip transition-colors duration-300 ease-out ${on ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"}`}
    >
      {dot && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  );
}
