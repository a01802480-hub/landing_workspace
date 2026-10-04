"use client";

/**
 * Interactive R3F structure viewer — AlphaFold-style rendering.
 *
 * Render styles:
 * - `spheres` (default): one instanced sphere per Cα atom, colored by the
 *   canonical AlphaFold pLDDT bands — the classic AlphaFold confidence
 *   view. A single InstancedMesh draw call; color changes are written to
 *   the instance buffer in place (no geometry churn).
 * - `tube`: smooth vertex-colored backbone cartoon (chain / pLDDT / local
 *   writhe modes); geometry is disposed whenever it is rebuilt.
 *
 * Labels are in-canvas sprites (canvas-generated textures) — there are no
 * DOM portals in the scene, which removes the React 19 "synchronously
 * unmount a root" race and per-label DOM overhead.
 *
 * Workspace sync: hovering the backbone raycasts to the nearest residue
 * (or reads the sphere instance id) and reports it (`onResidueHover`) —
 * the sequence track scrolls to it, the pLDDT chart moves its crosshair,
 * the PAE heatmap draws its cursor line. Clicking selects; focus markers
 * mirror the residue the other panels report back.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useCursor } from "@react-three/drei";
import * as THREE from "three";
import {
  buildBackboneGeometry,
  fitTransform,
  normalizePoints,
  type Vec3,
} from "@/lib/geometry";
import { hexToRgb, plddtBand, writheColorRgb, MARKER } from "@/lib/format";
import type { StructureModel } from "@/lib/types";

export type ColorMode = "chain" | "plddt" | "writhe";
export type RenderStyle = "spheres" | "tube";

/** A click-to-mutate annotation: residue replaced, drawn in amber with a
 *  "Δ" marker. (Annotation-level — full repacking needs an external
 *  modeling engine; the workspace makes the edit visible and reversible.) */
export interface Mutation {
  resi: number;
  from: string;
  to: string;
}

interface ProteinViewerProps {
  /**
   * May be null: the Canvas root is mounted ONCE for the panel's whole
   * lifetime and never unmounts mid-render (R3F's reconciler root teardown
   * races React 19's commit phase — "Attempted to synchronously unmount a
   * root…"). With a null model it renders an empty clinical scene under
   * the loading/error overlays instead of being replaced by them.
   */
  model: StructureModel | null;
  colorMode: ColorMode;
  renderStyle: RenderStyle;
  showActiveSite: boolean;
  showMetals: boolean;
  /** Click-to-mutate annotations for the current model. */
  mutations?: Mutation[];
  /** Residue under the cursor elsewhere in the workspace (hover). */
  highlightResi?: number | null;
  /** Residue selected by click (anywhere in the workspace). */
  selectedResi?: number | null;
  onResidueHover?: (resi: number | null) => void;
  onResidueSelect?: (resi: number) => void;
}

/** Validated light-mode categorical slots (see lib/format.ts palette notes). */
const CHAIN_PALETTE: [number, number, number][] = [
  hexToRgb("#2a78d6"),
  hexToRgb("#eb6834"),
  hexToRgb("#1baf7a"),
  hexToRgb("#eda100"),
  hexToRgb("#d55181"),
  hexToRgb("#6d5ae0"),
];
const GRAY: Vec3 = [154, 163, 178];
const CLICK_DRAG_PX = 6;
const SPHERE_RADIUS = 0.34;

function colorForPoint(
  p: StructureModel["points"][number],
  index: number,
  mode: ColorMode,
  model: StructureModel,
): Vec3 {
  if (mode === "chain") {
    return CHAIN_PALETTE[p.chain.charCodeAt(0) % CHAIN_PALETTE.length];
  }
  if (mode === "plddt") {
    if (p.plddt === null || p.plddt === undefined) return GRAY;
    return hexToRgb(plddtBand(p.plddt).color);
  }
  const extent = model.local_writhe?.length
    ? Math.max(0.05, ...model.local_writhe.map((v) => Math.abs(v)))
    : 0.05;
  return writheColorRgb(model.local_writhe?.[index] ?? 0, extent);
}

/* ── Sprite labels (no DOM portals) ──────────────────────────────────────── */

function makeLabelTexture(text: string, accent: string): THREE.CanvasTexture {
  const pad = 12;
  const fontSize = 30;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = fontSize + pad * 2;
  canvas.width = w;
  canvas.height = h;
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#202a44";
  ctx.fillText(text, pad, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function LabelSprite({
  position,
  text,
  accent,
  scale = 1,
}: {
  position: Vec3;
  text: string;
  accent: string;
  scale?: number;
}) {
  const texture = useMemo(() => makeLabelTexture(text, accent), [text, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  const w = scale * 2.4;
  const h = w * (texture.image.height / texture.image.width);
  return (
    <sprite position={position} scale={[w, h, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

/* ── Backbone representations ────────────────────────────────────────────── */

/** AlphaFold-style: instanced Cα spheres. One draw call, in-place recolors. */
function BackboneSpheres({
  coords,
  colors,
  onHoverIndex,
  onSelectIndex,
}: {
  coords: Vec3[];
  colors: Vec3[];
  onHoverIndex: (index: number | null) => void;
  onSelectIndex: (index: number) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // Instance transforms — set once per coordinate set; the instance count
  // follows the trace length (models differ, e.g. 160 vs 152 points).
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.count = coords.length;
    const dummy = new THREE.Object3D();
    coords.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [coords]);

  // Per-instance colors — written in place when the color mode changes,
  // never re-allocating geometry (the memory-safe path).
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    colors.forEach((rgb, i) => {
      c.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colors]);

  const emitHover = (e: { instanceId?: number }) => {
    const id = typeof e.instanceId === "number" ? e.instanceId : null;
    onHoverIndex(id);
  };

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, coords.length]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => {
        setHovered(false);
        onHoverIndex(null);
      }}
      onPointerMove={emitHover}
      onClick={(e) => {
        if (e.delta > CLICK_DRAG_PX) return; // an orbit drag, not a click
        if (typeof e.instanceId === "number") onSelectIndex(e.instanceId);
      }}
    >
      <sphereGeometry args={[SPHERE_RADIUS, 14, 14]} />
      <meshStandardMaterial roughness={0.35} metalness={0.05} />
    </instancedMesh>
  );
}

/** Cartoon — helices as thick ribbons, sheets as flat arrows (PDB
 *  HELIX/SHEET records), loops as thin traces. One mesh per segment;
 *  every geometry is disposed whenever it is rebuilt. */
function BackboneCartoon({
  coords,
  colors,
  model,
  onHoverIndex,
  onSelectIndex,
}: {
  coords: Vec3[];
  colors: Vec3[];
  model: StructureModel;
  onHoverIndex: (index: number | null) => void;
  onSelectIndex: (index: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const segments = useMemo(() => {
    const spans = (model.secondary ?? []).filter((s) => s.end > s.start);
    const segs: { start: number; end: number; kind: "helix" | "sheet" | "loop" }[] = [];
    // Residue-index spans (inclusive) over the trace, split by secondary.
    let cursor = 0;
    for (const span of spans) {
      const start = model.points.findIndex((p) => p.resi >= span.start);
      const end = model.points.findIndex((p) => p.resi > span.end);
      const a = start === -1 ? 0 : start;
      const b = end === -1 ? model.points.length : end;
      if (a > cursor) segs.push({ start: cursor, end: a, kind: "loop" });
      if (b > a) segs.push({ start: a, end: b, kind: span.kind });
      cursor = Math.max(cursor, b);
    }
    if (cursor < model.points.length) segs.push({ start: cursor, end: model.points.length, kind: "loop" });
    return segs;
  }, [model]);

  const geometries = useMemo(() => {
    return segments.map((seg) => {
      const segCoords = coords.slice(seg.start, seg.end);
      const segColors = colors.slice(seg.start, seg.end);
      if (segCoords.length < 2) return null;
      const radius = seg.kind === "helix" ? 0.3 : seg.kind === "sheet" ? 0.09 : 0.11;
      const radial = seg.kind === "helix" ? 7 : 4;
      return { kind: seg.kind, geo: buildBackboneGeometry(segCoords, segColors, radius, radial, 5) };
    }).filter((g): g is { kind: "helix" | "sheet" | "loop"; geo: THREE.BufferGeometry } => g !== null);
  }, [segments, coords, colors]);

  // Memory rule: every rebuilt geometry is explicitly disposed.
  useEffect(() => {
    const geos = geometries.map((g) => g.geo);
    return () => geos.forEach((geo) => geo.dispose());
  }, [geometries]);

  const nearestIndex = (point: { x: number; y: number; z: number }): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = (point.x - coords[i][0]) ** 2 + (point.y - coords[i][1]) ** 2 + (point.z - coords[i][2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => {
        setHovered(false);
        onHoverIndex(null);
      }}
    >
      {geometries.map(({ kind, geo }, i) => (
        <group key={`${kind}:${i}`}>
          <mesh
            geometry={geo}
            onPointerMove={(e) => onHoverIndex(nearestIndex(e.point))}
            onClick={(e) => {
              if (e.delta > CLICK_DRAG_PX) return;
              onSelectIndex(nearestIndex(e.point));
            }}
          >
            <meshStandardMaterial vertexColors roughness={0.28} metalness={0.05} />
          </mesh>
          {kind === "sheet" && (
            <SheetArrow segments={segments[i]} coords={coords} colors={colors} />
          )}
        </group>
      ))}
    </group>
  );
}

/** Directional arrowhead at the end of a beta-strand segment. */
function SheetArrow({
  segments,
  coords,
  colors,
}: {
  segments: { start: number; end: number; kind: string };
  coords: Vec3[];
  colors: Vec3[];
}) {
  const end = segments.end - 1;
  const prev = Math.max(segments.start, end - 1);
  if (end <= segments.start) return null;
  const p = coords[end];
  const q = coords[prev];
  const dir = new THREE.Vector3(p[0] - q[0], p[1] - q[1], p[2] - q[2]).normalize();
  const pos = new THREE.Vector3(p[0] + dir.x * 0.4, p[1] + dir.y * 0.4, p[2] + dir.z * 0.4);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const color = new THREE.Color(
    colors[end][0] / 255,
    colors[end][1] / 255,
    colors[end][2] / 255,
  );
  return (
    <mesh position={pos} quaternion={quat}>
      <coneGeometry args={[0.26, 0.7, 4, 1]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.05} />
    </mesh>
  );
}

/** Dashed electrostatic contact lines between metal ions and their
 *  coordinating residues (server-computed distance cutoff). */
function CoordinationLines({
  model,
  fit,
}: {
  model: StructureModel;
  fit: (p: Vec3) => Vec3;
}) {
  const lines = useMemo(() => {
    const out: { a: Vec3; b: Vec3; label: string }[] = [];
    const metals = model.metals ?? [];
    for (const c of model.coordinations ?? []) {
      const m = metals[c.metal];
      if (!m) continue;
      const resi = model.points.find((p) => p.resi === c.resi);
      out.push({
        a: fit([m.x, m.y, m.z]),
        b: fit([c.x, c.y, c.z]),
        label: `${m.element}²⁺ ↔ ${resi?.resn ?? "X"}${c.resi} · ${c.dist.toFixed(1)} Å`,
      });
    }
    return out;
  }, [model, fit]);

  return (
    <>
      {lines.map((l, i) => (
        <CoordinationLine key={`coord:${i}`} a={l.a} b={l.b} label={l.label} />
      ))}
    </>
  );
}

function CoordinationLine({ a, b, label }: { a: Vec3; b: Vec3; label: string }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a[0], a[1], a[2]),
      new THREE.Vector3(b[0], b[1], b[2]),
    ]);
    const m = new THREE.LineDashedMaterial({
      color: "#1baf7a",
      dashSize: 0.22,
      gapSize: 0.16,
      transparent: true,
      opacity: 0.85,
    });
    const l = new THREE.Line(g, m);
    l.computeLineDistances(); // dashes require per-vertex line distances
    return l;
  }, [a, b]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return (
    <group>
      <primitive object={line} />
      <LabelSprite position={[a[0], a[1] - 0.65, a[2]]} text={label} accent="rgba(27,175,122,0.55)" scale={0.72} />
    </group>
  );
}

/** Glowing focus sphere + label at the hovered / selected residue. */
function ResidueFocus({
  coords,
  index,
  kind,
  label,
  accent,
}: {
  coords: Vec3[];
  index: number | null;
  kind: "hover" | "selected";
  label: string;
  accent: string;
}) {
  if (index === null || index < 0 || index >= coords.length) return null;
  const pos = coords[index];
  const color = kind === "selected" ? "#0ea5c9" : "#6d5ae0";
  return (
    <group>
      <mesh position={pos}>
        <sphereGeometry args={[kind === "selected" ? 0.62 : 0.48, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={kind === "selected" ? 0.85 : 0.5} depthTest={false} />
      </mesh>
      <LabelSprite
        position={[pos[0], pos[1] + (kind === "selected" ? 1.15 : 0.9), pos[2]]}
        text={label}
        accent={accent}
        scale={kind === "selected" ? 1 : 0.85}
      />
    </group>
  );
}

function Markers({
  model,
  showActiveSite,
  showMetals,
  onHoverResi,
  onSelectResi,
}: {
  model: StructureModel;
  showActiveSite: boolean;
  showMetals: boolean;
  onHoverResi: (resi: number | null) => void;
  onSelectResi: (resi: number) => void;
}) {
  const traceCoords = useMemo(
    () => model.points.map((p) => [p.x, p.y, p.z] as Vec3),
    [model.points],
  );
  const fit = useMemo(() => fitTransform(traceCoords), [traceCoords]);

  const residueMarkers = useMemo(() => {
    if (!showActiveSite) return [];
    const out: { key: string; pos: Vec3; label: string; resi: number }[] = [];
    const seen = new Set<string>();
    for (const site of model.active_sites ?? []) {
      for (const r of site.residues) {
        if (r.x === undefined || r.x === null || r.y == null || r.z == null) continue;
        // The same residue appears in several SITE records (e.g. 8RUC lists
        // ASP 203 in many sites) — one marker per residue.
        const dedupeKey = `${r.chain}:${r.resi}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        out.push({
          key: `${site.site_id}:${r.chain}:${r.resi}`,
          pos: fit([r.x, r.y, r.z]),
          label: `${r.resname} ${r.resi}`,
          resi: r.resi,
        });
      }
    }
    return out;
  }, [model, fit, showActiveSite]);

  const metalMarkers = useMemo(() => {
    if (!showMetals) return [];
    return (model.metals ?? []).map((m) => ({
      key: `${m.element}:${m.chain}:${m.resi}`,
      pos: fit([m.x, m.y, m.z]),
      label: `${m.element}${m.element.length === 1 ? "⁺" : "²⁺"}`,
    }));
  }, [model, fit, showMetals]);

  return (
    <>
      {residueMarkers.map((m) => (
        <group
          key={m.key}
          position={m.pos}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverResi(m.resi);
          }}
          onPointerOut={() => onHoverResi(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectResi(m.resi);
          }}
        >
          <mesh>
            <sphereGeometry args={[0.42, 16, 16]} />
            <meshStandardMaterial
              color={MARKER.residue}
              emissive={MARKER.residue}
              emissiveIntensity={0.3}
              roughness={0.3}
            />
          </mesh>
          <LabelSprite position={[0, 0.95, 0]} text={m.label} accent="rgba(201,133,0,0.6)" scale={0.9} />
        </group>
      ))}
      {metalMarkers.map((m) => (
        <group key={m.key} position={m.pos}>
          <mesh>
            <sphereGeometry args={[0.58, 20, 20]} />
            <meshStandardMaterial
              color={MARKER.metal}
              emissive={MARKER.metal}
              emissiveIntensity={0.35}
              roughness={0.2}
              metalness={0.35}
            />
          </mesh>
          <LabelSprite position={[0, 1.05, 0]} text={m.label} accent="rgba(25,158,112,0.55)" scale={0.9} />
        </group>
      ))}
    </>
  );
}

export default function ProteinViewer(props: ProteinViewerProps) {
  const {
    model,
    colorMode,
    renderStyle,
    mutations = [],
    highlightResi,
    selectedResi,
    onResidueHover,
    onResidueSelect,
  } = props;

  // One shared normalized frame for the backbone, the raycast lookup and the
  // focus markers — all three must agree on coordinates. Null-model safe:
  // the Canvas stays mounted with an empty scene while a structure loads.
  const coords = useMemo(
    () => (model ? normalizePoints(model.points.map((p) => [p.x, p.y, p.z] as Vec3)) : []),
    [model],
  );
  const traceCoords = useMemo(
    () => (model ? model.points.map((p) => [p.x, p.y, p.z] as Vec3) : []),
    [model],
  );
  const fit = useMemo(() => fitTransform(traceCoords), [traceCoords]);
  const colors = useMemo(
    () =>
      model
        ? model.points.map((p, i) => {
            const mut = mutations.find((m) => m.resi === p.resi);
            if (mut) return hexToRgb("#c98500"); // mutated residues read as amber
            return colorForPoint(p, i, colorMode, model);
          })
        : [],
    [model, colorMode, mutations],
  );
  const resiAt = useMemo(() => {
    const map = new Map<number, number>();
    model?.points.forEach((p, i) => map.set(p.resi, i));
    return map;
  }, [model]);

  const highlightIndex = model && highlightResi != null ? (resiAt.get(highlightResi) ?? null) : null;
  const selectedIndex = model && selectedResi != null ? (resiAt.get(selectedResi) ?? null) : null;
  const highlightPoint = model && highlightIndex != null ? model.points[highlightIndex] : null;
  const selectedPoint = model && selectedIndex != null ? model.points[selectedIndex] : null;

  const handleHoverIndex = (index: number | null) => {
    if (index === null || !model) onResidueHover?.(null);
    else {
      const p = model.points[index];
      if (p) onResidueHover?.(p.resi);
    }
  };
  const handleSelectIndex = (index: number) => {
    if (!model) return;
    const p = model.points[index];
    if (p) onResidueSelect?.(p.resi);
  };

  return (
    <Canvas
      camera={{ position: [0, 4, 15], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Zero-gravity clinical scene: white fog, cool key light, violet rim. */}
      <fog attach="fog" args={["#f5f6fc", 26, 62]} />
      <hemisphereLight args={["#ffffff", "#dfe4f2", 0.9]} />
      <directionalLight position={[8, 12, 8]} intensity={1.35} />
      <directionalLight position={[-8, -6, -4]} intensity={0.45} color="#8b7cf0" />
      {model ? (
        renderStyle === "spheres" ? (
          <BackboneSpheres
            coords={coords}
            colors={colors}
            onHoverIndex={handleHoverIndex}
            onSelectIndex={handleSelectIndex}
          />
        ) : (
          <BackboneCartoon
            coords={coords}
            colors={colors}
            model={model}
            onHoverIndex={handleHoverIndex}
            onSelectIndex={handleSelectIndex}
          />
        )
      ) : (
        /* Empty-state scene: a weightless ring so the void never looks broken. */
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[3.4, 0.02, 12, 96]} />
          <meshBasicMaterial color="#c4b5fd" transparent opacity={0.5} />
        </mesh>
      )}
      {model && (
        <>
          <CoordinationLines model={model} fit={fit} />
          <Markers
            model={model}
            showActiveSite={props.showActiveSite}
            showMetals={props.showMetals}
            onHoverResi={onResidueHover ?? (() => {})}
            onSelectResi={onResidueSelect ?? (() => {})}
          />
          {mutations.map((m) => {
            const index = resiAt.get(m.resi);
            if (index === undefined) return null;
            return (
              <LabelSprite
                key={`mut:${m.resi}`}
                position={[coords[index][0], coords[index][1] + 0.75, coords[index][2]]}
                text={`Δ ${m.from}${m.resi}→${m.to}`}
                accent="rgba(201,133,0,0.7)"
                scale={0.85}
              />
            );
          })}
          <ResidueFocus
            coords={coords}
            index={highlightIndex}
            kind="hover"
            label={highlightPoint ? `${highlightPoint.resn} ${highlightPoint.resi}` : ""}
            accent="rgba(109,90,224,0.55)"
          />
          <ResidueFocus
            coords={coords}
            index={selectedIndex}
            kind="selected"
            label={selectedPoint ? `${selectedPoint.resn} ${selectedPoint.resi}` : ""}
            accent="rgba(14,165,201,0.55)"
          />
        </>
      )}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        minDistance={6}
        maxDistance={34}
      />
    </Canvas>
  );
}
