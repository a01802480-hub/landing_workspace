"use client";

/**
 * MmParticleSim — the interactive 2D Michaelis–Menten particle bench.
 *
 * A pedagogical *particle* model (labelled as such in the UI, arbitrary
 * units — not a quantitative solver): substrate beads perform a
 * constant-speed random walk in a 2D solution and bind one enzyme active
 * site rendered at the canvas centre. A bound substrate snaps to the pocket,
 * dwells 45·(1+Km/10) frames and is then converted to a product that drifts
 * up and fades. A rolling 90-frame turnover window yields v, normalised to a
 * 0..Vmax display scale (V_SAT turnovers per second reads as Vmax).
 *
 * Inhibition (None / Competitive / Non-competitive / Uncompetitive):
 * - Competitive — red inhibitor beads also bind the pocket (p = 0.5 per
 *   frame inside the capture radius) and block it for a dwell.
 * - Non-competitive — substrates still bind; the turnover dwell (i.e. the
 *   conversion rate) is multiplied by (1 + [I]/Ki).
 * - Uncompetitive — as non-competitive, with an additional 1.15 dwell
 *   lengthening.
 * - None — no inhibitor beads at all.
 *
 * Charts: the LineChart engine positions overlay series on the primary
 * series' index grid, so the theoretical curve — sampled on a 40-point grid
 * over the full axis range — is resampled at each measured point's x value
 * before it is handed to the chart.
 *
 * Canvas: full container width, 320 px tall, DPR-aware, one rAF loop with
 * full cleanup. Under `prefers-reduced-motion` a single static frame is
 * drawn and nothing animates (the charts keep their last state).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  type LinePoint,
  type OverlaySeries,
} from "@/components/workspace/charts/LineChart";
import { fmt } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/motion";

/* ── simulation constants ──────────────────────────────────────────────── */

const CANVAS_H = 320;
const SPEED = 1.15; // px per frame — constant particle speed
const TURN_MIN = 18; // frames between random direction changes
const TURN_MAX = 70;
const BIND_RADIUS = 24; // px capture radius around the active site
const DWELL_BASE = 45; // frames at Km → 0
const WINDOW_FRAMES = 90; // rolling turnover window
const MAX_INHIBITORS = 40;
const INHIBITOR_BIND_P = 0.5;
const PRODUCT_RISE = -0.9; // px per frame (upwards)
const PRODUCT_FADE = 0.014;
const V_SAT = 1; // turnovers/s that reads as Vmax on the display scale
const S_MIN = 10; // [S]0 slider bounds (particle count)
const S_MAX = 120;
const THEORY_STEPS = 40; // theory samples over the full axis range
const LB_SCALE = 1000; // 1/v ×10³ — keeps the double-reciprocal labels legible
const LB_INV_MIN = 1 / S_MAX;
const LB_INV_MAX = 1 / S_MIN;

const SUBSTRATE_COLOR = "#6d5ae0";
const PRODUCT_COLOR = "#199e70";
const INHIBITOR_COLOR = "#d03b3b";
const THEORY_COLOR = "#eb6834";

/* ── types + pure helpers ──────────────────────────────────────────────── */

type Inhibition = "none" | "competitive" | "non-competitive" | "uncompetitive";
type ParticleKind = "substrate" | "inhibitor" | "product";

interface Particle {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  dx: number; // unit direction
  dy: number;
  turnIn: number; // frames until the next random direction change
  state: "free" | "bound";
  dwell: number; // frames left before turnover / release (bound only)
  alpha: number; // product fade
}

const INHIBITION_OPTIONS: { value: Inhibition; label: string }[] = [
  { value: "none", label: "None" },
  { value: "competitive", label: "Competitive" },
  { value: "non-competitive", label: "Non-competitive" },
  { value: "uncompetitive", label: "Uncompetitive" },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** MM steady-state velocity (display units) for the selected inhibition mode. */
function theoreticalV(
  s: number,
  vmax: number,
  km: number,
  mode: Inhibition,
  i: number,
  ki: number,
): number {
  const alpha = 1 + i / Math.max(ki, 1e-6);
  switch (mode) {
    case "competitive":
      return (vmax * s) / (km * alpha + s);
    case "non-competitive":
      return (vmax / alpha) * (s / (km + s));
    case "uncompetitive":
      return (vmax * s) / (km + s * alpha);
    default:
      return (vmax * s) / (km + s);
  }
}

/** Double-reciprocal form: 1/v at 1/[S] = invS (display units). */
function theoreticalInvV(
  invS: number,
  vmax: number,
  km: number,
  mode: Inhibition,
  i: number,
  ki: number,
): number {
  const alpha = 1 + i / Math.max(ki, 1e-6);
  switch (mode) {
    case "competitive":
      return ((alpha * km) / vmax) * invS + 1 / vmax;
    case "non-competitive":
      return ((alpha * km) / vmax) * invS + alpha / vmax;
    case "uncompetitive":
      return (km / vmax) * invS + alpha / vmax;
    default:
      return (km / vmax) * invS + 1 / vmax;
  }
}

/**
 * Linear interpolation over a monotone theory grid — LineChart overlays are
 * drawn on the primary series' index grid, so the theoretical curve must be
 * resampled at each measured x value (see the file header).
 */
function sampleTheory(grid: LinePoint[], x: number): number {
  if (grid.length === 0) return 0;
  const first = grid[0];
  if (x <= first.resi) return first.value ?? 0;
  const last = grid[grid.length - 1];
  if (x >= last.resi) return last.value ?? 0;
  for (let i = 1; i < grid.length; i++) {
    const a = grid[i - 1];
    const b = grid[i];
    if (x <= b.resi) {
      const span = b.resi - a.resi || 1;
      const t = (x - a.resi) / span;
      const av = a.value ?? 0;
      const bv = b.value ?? 0;
      return av + (bv - av) * t;
    }
  }
  return last.value ?? 0;
}

function makeParticle(id: number, kind: ParticleKind, w: number, h: number): Particle {
  const ang = Math.random() * Math.PI * 2;
  return {
    id,
    kind,
    x: 14 + Math.random() * Math.max(1, w - 28),
    y: 14 + Math.random() * Math.max(1, h - 28),
    dx: Math.cos(ang),
    dy: Math.sin(ang),
    turnIn: TURN_MIN + Math.random() * (TURN_MAX - TURN_MIN),
    state: "free",
    dwell: 0,
    alpha: 1,
  };
}

/** Top up / trim one particle kind so its count matches the slider target. */
function reconcileKind(
  ps: Particle[],
  kind: ParticleKind,
  target: number,
  w: number,
  h: number,
  spawn: (k: ParticleKind, w: number, h: number) => Particle,
): void {
  let count = 0;
  for (const p of ps) if (p.kind === kind) count++;
  if (count < target) {
    for (let i = count; i < target; i++) ps.push(spawn(kind, w, h));
  } else if (count > target) {
    for (let i = ps.length - 1; i >= 0 && count > target; i--) {
      const p = ps[i];
      if (p.kind === kind && p.state === "free") {
        ps.splice(i, 1);
        count--;
      }
    }
  }
}

/* ── small presentational pieces (same file — keeps the panel self-contained) ── */

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  digits,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0 text-mist/70">
        {label} <span className="stat-num">{fmt(value, digits)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[#6d5ae0] transition-opacity duration-300 ease-out"
        aria-label={label}
      />
    </label>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="chip !py-0.5 text-[9px]">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ── the panel ─────────────────────────────────────────────────────────── */

export function MmParticleSim() {
  const reduced = usePrefersReducedMotion();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Parameters — React state, mirrored into a ref for the rAF loop. */
  const [vmax, setVmax] = useState(100);
  const [km, setKm] = useState(5);
  const [s0, setS0] = useState(60);
  const [inhibitor, setInhibitor] = useState(0);
  const [ki, setKi] = useState(5);
  const [mode, setMode] = useState<Inhibition>("none");
  const [paused, setPaused] = useState(false);

  const paramsRef = useRef({ vmax, km, s0, inhibitor, ki, mode });
  const pausedRef = useRef(paused);
  useEffect(() => {
    paramsRef.current = { vmax, km, s0, inhibitor, ki, mode };
  }, [vmax, km, s0, inhibitor, ki, mode]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /* Simulation state (refs — mutated per frame, never part of render). */
  const particlesRef = useRef<Particle[]>([]);
  const turnoverFramesRef = useRef<number[]>([]);
  const frameRef = useRef(0);
  const nextIdRef = useRef(1);
  const occupantRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 1, h: CANVAS_H, dpr: 1 });
  const vRef = useRef(0);
  const lastAppendRef = useRef(-1e9);
  const lastHudRef = useRef(-1e9);

  /* Rendered state: live charts + readout. */
  const [mmPoints, setMmPoints] = useState<LinePoint[]>([]);
  const [lbPoints, setLbPoints] = useState<LinePoint[]>([]);
  const [hud, setHud] = useState({ v: 0, turnovers: 0, engaged: false });

  const spawn = useCallback(
    (kind: ParticleKind, w: number, h: number): Particle =>
      makeParticle(nextIdRef.current++, kind, w, h),
    [],
  );

  const reconcile = useCallback(
    (w: number, h: number) => {
      const p = paramsRef.current;
      const targetSub = Math.round(p.s0);
      const targetInh =
        p.mode === "none"
          ? 0
          : Math.min(MAX_INHIBITORS, Math.round((p.inhibitor / Math.max(p.ki, 0.1)) * 15));
      const ps = particlesRef.current;
      reconcileKind(ps, "substrate", targetSub, w, h, spawn);
      reconcileKind(ps, "inhibitor", targetInh, w, h, spawn);
    },
    [spawn],
  );

  /** One simulation frame: dwell, turnover, random walk, binding, products. */
  const step = useCallback((w: number, h: number) => {
    frameRef.current += 1;
    const frame = frameRef.current;
    const ps = particlesRef.current;
    const { vmax: vMax, km: kmVal, inhibitor: iConc, ki: kiVal, mode: inhMode } = paramsRef.current;
    const alpha = 1 + iConc / Math.max(kiVal, 0.1);

    // Dwell: 45·(1+Km/10) frames, lengthened by the [I]/Ki rate term for the
    // non-competitive / uncompetitive modes (conversion rate ÷ (1+[I]/Ki)).
    let dwellFrames = DWELL_BASE * (1 + kmVal / 10);
    if (inhMode === "non-competitive") dwellFrames *= alpha;
    if (inhMode === "uncompetitive") dwellFrames *= alpha * 1.15;

    const siteX = w / 2;
    const siteY = h / 2;

    // 1. Occupant: count down the dwell, then turn over or release.
    const occId = occupantRef.current;
    if (occId !== null) {
      const occ = ps.find((q) => q.id === occId);
      if (!occ) {
        occupantRef.current = null;
      } else if (inhMode === "none" && occ.kind === "inhibitor") {
        // Inhibitors vanish with the mode — never leave the pocket blocked.
        occ.state = "free";
        occupantRef.current = null;
      } else {
        occ.dwell -= 1;
        if (occ.dwell <= 0) {
          if (occ.kind === "substrate") {
            // Convert: the bead becomes a product that drifts up and fades.
            occ.kind = "product";
            occ.state = "free";
            occ.x = siteX;
            occ.y = siteY;
            occ.dx = (Math.random() - 0.5) * 0.6;
            occ.alpha = 1;
            turnoverFramesRef.current.push(frame);
          } else {
            // The inhibitor leaves the pocket and is pushed clear of the
            // capture radius so it cannot immediately rebind.
            const ang = Math.random() * Math.PI * 2;
            occ.state = "free";
            occ.x = clamp(siteX + Math.cos(ang) * (BIND_RADIUS + 34), 8, w - 8);
            occ.y = clamp(siteY + Math.sin(ang) * (BIND_RADIUS + 34), 8, h - 8);
            occ.dx = Math.cos(ang);
            occ.dy = Math.sin(ang);
            occ.turnIn = TURN_MIN;
          }
          occupantRef.current = null;
        }
      }
    }

    // 2. Rolling turnover window → v on the 0..Vmax display scale.
    if (turnoverFramesRef.current.length) {
      const cutoff = frame - WINDOW_FRAMES;
      turnoverFramesRef.current = turnoverFramesRef.current.filter((f) => f > cutoff);
    }
    const perSecond = turnoverFramesRef.current.length * (60 / WINDOW_FRAMES);
    vRef.current = Math.min(vMax, (perSecond / V_SAT) * vMax);

    const bindP = Math.min(1, 0.15 + vMax / 400);
    const siteFree = () => occupantRef.current === null;

    // 3. Motion + interactions.
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];

      if (p.kind === "product") {
        p.x += p.dx * 0.35;
        p.y += PRODUCT_RISE;
        p.alpha -= PRODUCT_FADE;
        if (p.alpha <= 0 || p.y < -8) ps.splice(i, 1);
        continue;
      }
      if (p.state === "bound") continue;

      // Constant-speed random walk: straight runs, random direction changes.
      p.turnIn -= 1;
      if (p.turnIn <= 0) {
        const ang = Math.random() * Math.PI * 2;
        p.dx = Math.cos(ang);
        p.dy = Math.sin(ang);
        p.turnIn = TURN_MIN + Math.random() * (TURN_MAX - TURN_MIN);
      }
      p.x += p.dx * SPEED;
      p.y += p.dy * SPEED;
      const r = 5;
      if (p.x < r) {
        p.x = r;
        p.dx = Math.abs(p.dx);
      } else if (p.x > w - r) {
        p.x = w - r;
        p.dx = -Math.abs(p.dx);
      }
      if (p.y < r) {
        p.y = r;
        p.dy = Math.abs(p.dy);
      } else if (p.y > h - r) {
        p.y = h - r;
        p.dy = -Math.abs(p.dy);
      }

      if (!siteFree()) continue;
      if (Math.hypot(p.x - siteX, p.y - siteY) > BIND_RADIUS) continue;

      if (p.kind === "substrate") {
        if (Math.random() < bindP) {
          p.state = "bound";
          p.x = siteX;
          p.y = siteY;
          p.dwell = dwellFrames;
          occupantRef.current = p.id;
        }
      } else if (inhMode === "competitive" && Math.random() < INHIBITOR_BIND_P) {
        // Competitive inhibitors occupy the pocket and block it for a dwell.
        p.state = "bound";
        p.x = siteX;
        p.y = siteY;
        p.dwell = dwellFrames;
        occupantRef.current = p.id;
      }
    }
  }, []);

  /** One canvas frame — glow, pocket glyph, particles, fading products. */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w <= 1) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Soft solution glow around the enzyme.
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(80, Math.min(w, 260) * 0.9));
    glow.addColorStop(0, "rgba(139, 124, 240, 0.14)");
    glow.addColorStop(1, "rgba(139, 124, 240, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Capture radius (dashed) — the 24 px binding zone.
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = "rgba(109, 90, 224, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, BIND_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // The pocket glyph — stroke colour reports occupancy.
    const occId = occupantRef.current;
    const occ = occId === null ? undefined : particlesRef.current.find((p) => p.id === occId);
    const siteColor = occ
      ? occ.kind === "substrate"
        ? PRODUCT_COLOR
        : INHIBITOR_COLOR
      : "rgba(109, 90, 224, 0.85)";
    ctx.lineCap = "round";
    ctx.lineWidth = 8;
    ctx.strokeStyle = siteColor;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 17, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(109, 90, 224, 0.35)";
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 1);
    ctx.lineTo(cx + 20, cy + 1);
    ctx.stroke();

    // Particles.
    for (const p of particlesRef.current) {
      if (p.kind === "product") {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = PRODUCT_COLOR;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const color = p.kind === "substrate" ? SUBSTRATE_COLOR : INHIBITOR_COLOR;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (p.state === "bound") {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, []);

  /** Append a chart sample every ~1 s (last 60 points kept). */
  const maybeAppend = useCallback((t: number) => {
    if (t - lastAppendRef.current < 1000) return;
    lastAppendRef.current = t;
    const sNow = Math.round(paramsRef.current.s0);
    const v = vRef.current;
    setMmPoints((prev) => [...prev, { resi: sNow, value: v }].slice(-60));
    if (v > 0) {
      // Double-reciprocal point — only defined for a positive velocity.
      setLbPoints((prev) => [...prev, { resi: 1 / sNow, value: LB_SCALE / v }].slice(-60));
    }
  }, []);

  const maybeHud = useCallback((t: number) => {
    if (t - lastHudRef.current < 500) return;
    lastHudRef.current = t;
    setHud({
      v: vRef.current,
      turnovers: turnoverFramesRef.current.length,
      engaged: occupantRef.current !== null,
    });
  }, []);

  /* Canvas lifecycle: size, rAF loop, reduced-motion static frame. */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let alive = true;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(120, Math.floor(rect.width));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w, h: CANVAS_H, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(CANVAS_H * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${CANVAS_H}px`;
      for (const p of particlesRef.current) {
        p.x = clamp(p.x, 8, w - 8);
        p.y = clamp(p.y, 8, CANVAS_H - 8);
      }
      reconcile(w, CANVAS_H);
      drawFrame();
    };

    resize();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    ro?.observe(wrap);
    window.addEventListener("resize", resize);

    const loop = (t: number) => {
      if (!alive) return;
      const { w, h } = sizeRef.current;
      reconcile(w, h);
      if (!pausedRef.current) {
        step(w, h);
        maybeAppend(t);
        maybeHud(t);
      }
      drawFrame();
      raf = requestAnimationFrame(loop);
    };

    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [reduced, reconcile, step, drawFrame, maybeAppend, maybeHud]);

  /* Reduced motion: re-render the static frame when the scene would change. */
  useEffect(() => {
    if (!reduced) return;
    const { w, h } = sizeRef.current;
    reconcile(w, h);
    drawFrame();
  }, [reduced, s0, inhibitor, ki, mode, reconcile, drawFrame]);

  const reset = useCallback(() => {
    particlesRef.current = [];
    turnoverFramesRef.current = [];
    frameRef.current = 0;
    occupantRef.current = null;
    vRef.current = 0;
    lastAppendRef.current = -1e9;
    lastHudRef.current = -1e9;
    const { w, h } = sizeRef.current;
    reconcile(w, h);
    setMmPoints([]);
    setLbPoints([]);
    setHud({ v: 0, turnovers: 0, engaged: false });
    drawFrame();
  }, [reconcile, drawFrame]);

  /* Theoretical curves (40 points over the full axis range). */
  const mmTheory = useMemo(() => {
    const grid: LinePoint[] = [];
    for (let i = 0; i < THEORY_STEPS; i++) {
      const s = (i / (THEORY_STEPS - 1)) * S_MAX;
      grid.push({ resi: s, value: theoreticalV(s, vmax, km, mode, inhibitor, ki) });
    }
    return grid;
  }, [vmax, km, mode, inhibitor, ki]);

  const lbTheory = useMemo(() => {
    const grid: LinePoint[] = [];
    for (let i = 0; i < THEORY_STEPS; i++) {
      const invS = LB_INV_MIN + (i / (THEORY_STEPS - 1)) * (LB_INV_MAX - LB_INV_MIN);
      grid.push({
        resi: invS,
        value: LB_SCALE * theoreticalInvV(invS, vmax, km, mode, inhibitor, ki),
      });
    }
    return grid;
  }, [vmax, km, mode, inhibitor, ki]);

  /* Overlays resampled onto the measured index grid (LineChart contract). */
  const mmOverlay = useMemo<OverlaySeries[]>(() => {
    if (mmPoints.length === 0) return [];
    return [
      {
        points: mmPoints.map((p) => ({ resi: p.resi, value: sampleTheory(mmTheory, p.resi) })),
        color: THEORY_COLOR,
        label: "theory",
      },
    ];
  }, [mmPoints, mmTheory]);

  const lbOverlay = useMemo<OverlaySeries[]>(() => {
    if (lbPoints.length === 0) return [];
    return [
      {
        points: lbPoints.map((p) => ({ resi: p.resi, value: sampleTheory(lbTheory, p.resi) })),
        color: THEORY_COLOR,
        label: "theory",
      },
    ];
  }, [lbPoints, lbTheory]);

  const lbYMax = useMemo(() => {
    let m = 0;
    for (const p of lbPoints) if (p.value != null) m = Math.max(m, p.value);
    for (const p of lbTheory) if (p.value != null) m = Math.max(m, p.value);
    return Math.max(0.5, m * 1.15);
  }, [lbPoints, lbTheory]);

  const inhibitionFactor = inhibitor / Math.max(ki, 0.1);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ── 2D particle canvas ─────────────────────────────────────────── */}
      <div ref={wrapRef} className="glass-panel relative w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Particle simulation: substrate beads random-walking in a 2D solution, binding a central enzyme active site and converting to product. ${Math.round(s0)} substrates, ${mode} inhibition.`}
          className="block w-full"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 text-[10px] tracking-wide text-mist/70"
        >
          enzyme active site
        </span>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="chip !bg-white/85 !py-0.5 text-[9px]">
            v <span className="stat-num">{fmt(hud.v, 1)}</span>
          </span>
          <span className="chip !bg-white/85 !py-0.5 text-[9px]">
            products/90f <span className="stat-num">{hud.turnovers}</span>
          </span>
          <span className="chip !bg-white/85 !py-0.5 text-[9px]">
            site {hud.engaged ? "engaged" : "open"}
          </span>
        </div>
        {reduced && (
          <span className="chip absolute right-3 top-3 !bg-white/85 !py-0.5 text-[9px]">
            reduced motion · static frame
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <LegendDot color={SUBSTRATE_COLOR} label="substrate" />
        <LegendDot color={PRODUCT_COLOR} label="product" />
        {mode !== "none" && <LegendDot color={INHIBITOR_COLOR} label="inhibitor" />}
        <span className="chip !py-0.5 text-[9px]">pedagogical particle model · arbitrary units</span>
        <span className="ml-auto text-[10px] text-mist/60">
          drag [S]₀ while running to trace the v–[S] curve
        </span>
      </div>

      {/* ── controls ───────────────────────────────────────────────────── */}
      <div className="glass-panel p-4">
        <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
          <SliderRow label="Vmax" value={vmax} min={10} max={200} step={10} digits={0} onChange={setVmax} />
          <SliderRow label="Km" value={km} min={0.5} max={20} step={0.5} digits={1} onChange={setKm} />
          <SliderRow label="[S]₀ particles" value={s0} min={S_MIN} max={S_MAX} step={5} digits={0} onChange={setS0} />
          <SliderRow label="[I]" value={inhibitor} min={0} max={100} step={5} digits={0} onChange={setInhibitor} />
          <SliderRow label="Ki" value={ki} min={0.5} max={20} step={0.5} digits={1} onChange={setKi} />
          <label className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 text-mist/70">Inhibition</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Inhibition)}
              aria-label="Inhibition type"
              className="glass-panel min-w-0 flex-1 px-3 py-1.5 text-xs text-frost transition-colors duration-300 ease-out focus:border-glow-violet/50 focus:outline-none"
            >
              {INHIBITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={reduced}
            aria-pressed={paused}
            className="btn-ghost !px-4 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={reset} className="btn-ghost !px-4 !py-1.5 text-xs">
            Reset
          </button>
          <p className="ml-auto text-[10px] text-mist/60">
            [I]/Ki = <span className="stat-num">{fmt(inhibitionFactor, 2)}</span> · dwell{" "}
            {fmt(DWELL_BASE * (1 + km / 10), 0)} frames · v on a 0–Vmax scale (≈{fmt(V_SAT, 1)}{" "}
            turnover/s = Vmax)
          </p>
        </div>
      </div>

      {/* ── live charts ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel p-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-frost/70">v vs [S]</p>
            <p className="text-[10px] text-mist/60">live · last 60 samples · dashed = theory</p>
          </div>
          <div className="h-56">
            <LineChart
              points={mmPoints}
              yMin={0}
              yMax={vmax * 1.05}
              lineColor={SUBSTRATE_COLOR}
              areaOpacity={0.06}
              overlays={mmOverlay}
              xPos={(i) => clamp01((mmPoints[i]?.resi ?? 0) / S_MAX)}
              xTickLabel={(i) => fmt(mmPoints[i]?.resi ?? 0, 0)}
              ariaLabel={`Live velocity versus substrate concentration, ${mmPoints.length} samples, ${mode} inhibition, Vmax ${vmax}, Km ${km}`}
              tooltip={(p, ov) => (
                <span className="chip !bg-white/90 backdrop-blur-md">
                  <span className="stat-num">[S] {fmt(p.resi, 0)}</span>
                  <span className="text-mist/80">v {fmt(p.value ?? 0, 1)}</span>
                  {ov.map((o) => (
                    <span key={o.label} className="text-mist/80">
                      · theory {fmt(o.value ?? 0, 1)}
                    </span>
                  ))}
                </span>
              )}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-mist/60">substrate [S] (particles)</p>
        </div>

        <div className="glass-panel p-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-frost/70">Lineweaver–Burk</p>
            <p className="text-[10px] text-mist/60">1/v ×10³ vs 1/[S] · v &gt; 0 only</p>
          </div>
          <div className="h-56">
            <LineChart
              points={lbPoints}
              yMin={0}
              yMax={lbYMax}
              lineColor={PRODUCT_COLOR}
              areaOpacity={0.05}
              overlays={lbOverlay}
              xPos={(i) =>
                clamp01(((lbPoints[i]?.resi ?? LB_INV_MIN) - LB_INV_MIN) / (LB_INV_MAX - LB_INV_MIN))
              }
              xTickLabel={(i) => fmt(lbPoints[i]?.resi ?? 0, 3)}
              ariaLabel={`Lineweaver-Burk double-reciprocal plot, ${lbPoints.length} positive-velocity samples, ${mode} inhibition`}
              tooltip={(p, ov) => (
                <span className="chip !bg-white/90 backdrop-blur-md">
                  <span className="stat-num">1/[S] {fmt(p.resi, 3)}</span>
                  <span className="text-mist/80">1/v ×10³ {fmt(p.value ?? 0, 1)}</span>
                  {ov.map((o) => (
                    <span key={o.label} className="text-mist/80">
                      · theory {fmt(o.value ?? 0, 1)}
                    </span>
                  ))}
                </span>
              )}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-mist/60">1/[S] (particles⁻¹)</p>
        </div>
      </div>
    </div>
  );
}
