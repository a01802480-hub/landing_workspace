/**
 * geometry.ts — backbone geometry builders and the seeded RNG shared by the
 * 3D viewers (ProteinViewer, HeroScene, UnfoldingViewer).
 *
 * Deterministic by design: the same seed always produces the same ribbon,
 * so synthetic scenes render identically across clients (and tests).
 */
import * as THREE from "three";

export type Vec3 = [number, number, number];

/** Deterministic 32-bit PRNG (mulberry32). Returns [0, 1) per call. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Center + scale of a point cloud — the shared "unit frame" math. */
export interface PointFrame {
  cx: number;
  cy: number;
  cz: number;
  scale: number;
}

export function computeFrame(points: Vec3[]): PointFrame {
  const n = points.length;
  if (n === 0) return { cx: 0, cy: 0, cz: 0, scale: 1 };
  let cx = 0, cy = 0, cz = 0;
  for (const [x, y, z] of points) {
    cx += x;
    cy += y;
    cz += z;
  }
  cx /= n;
  cy /= n;
  cz /= n;

  let maxD = 0;
  for (const [x, y, z] of points) {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2);
    if (d > maxD) maxD = d;
  }
  return { cx, cy, cz, scale: maxD > 0 ? 8 / maxD : 1 };
}

function applyFrame(p: Vec3, f: PointFrame): Vec3 {
  return [(p[0] - f.cx) * f.scale, (p[1] - f.cy) * f.scale, (p[2] - f.cz) * f.scale];
}

/**
 * Center and scale a point cloud into a unit-ish frame so every model
 * renders at a consistent size regardless of source coordinates.
 */
export function normalizePoints(points: Vec3[]): Vec3[] {
  const frame = computeFrame(points);
  return points.map((p) => applyFrame(p, frame));
}

/**
 * The frame's transform as a function — markers, labels and ions are raw
 * PDB coordinates and must map into the same frame the backbone occupies.
 */
export function fitTransform(points: Vec3[]): (p: Vec3) => Vec3 {
  const frame = computeFrame(points);
  return (p: Vec3) => applyFrame(p, frame);
}

/**
 * Build a vertex-colored tube along a coordinate trace (cartoon backbone).
 * Every vertex carries the residue's color so the tube inherits the active
 * color mode (chain / pLDDT / writhe). Callers dispose the geometry.
 */
export function buildBackboneGeometry(
  coords: Vec3[],
  colors: Vec3[],
  radius: number,
  radialSegments: number,
  tubularSegments: number,
): THREE.BufferGeometry {
  if (coords.length < 2) {
    return new THREE.BufferGeometry();
  }

  // Catmull–Rom resampling smooths the Cα trace without overshooting.
  const curve = new THREE.CatmullRomCurve3(
    coords.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "catmullrom",
    0.5,
  );
  const tubeGeo = new THREE.TubeGeometry(curve, Math.max(2, tubularSegments), radius, radialSegments, false);

  // Paint the tube: each tube segment lies between consecutive Cα atoms,
  // so it takes the color of its start residue.
  const pos = tubeGeo.getAttribute("position");
  const vertexColors: number[] = [];
  const segs = tubeGeo.parameters?.tubularSegments ?? tubularSegments;
  for (let i = 0; i < pos.count; i++) {
    // u parameter along the tube length maps 0..1 → segment index.
    const u = tubeGeo.getAttribute("uv") ? tubeGeo.getAttribute("uv").getX(i) : 0;
    const idx = Math.min(coords.length - 2, Math.max(0, Math.floor(u * segs)));
    const c = colors[Math.min(idx, colors.length - 1)] ?? [154, 163, 178];
    vertexColors.push(c[0] / 255, c[1] / 255, c[2] / 255);
  }
  tubeGeo.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  return tubeGeo;
}
