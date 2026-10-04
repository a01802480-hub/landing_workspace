"use client";

/**
 * DotField — a weightless grid of lavender dots drifting behind the
 * workspace. React Bits "DotField" pattern, retuned for the zero-gravity
 * clinical (white + degraded purple) palette: canvas-rendered (one draw
 * call per frame, zero DOM nodes), pointer-parallax so the field recedes
 * as panels float above it.
 *
 * - `prefers-reduced-motion: reduce` → a single static frame, no rAF loop.
 * - DPR-aware, tracks its container size, fully cleaned up on unmount.
 */
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

const DOT_RGBA = "rgba(124, 103, 214, 0.26)";
const GAP = 26;
const INFLUENCE = 130; // pointer parallax radius (px)

export function DotField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let running = false;
    const pointer = { x: -9999, y: -9999 };

    // Perf rule: the rAF loop only runs while the tab is visible and motion
    // is allowed — hidden tabs cost nothing.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect?.width ?? window.innerWidth));
      height = Math.max(1, Math.floor(rect?.height ?? window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    const draw = (t: number) => {
      if (!running) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const drift = reduced ? 0 : Math.sin(t / 6000) * 0.6;
      ctx.fillStyle = DOT_RGBA;
      for (let y = GAP / 2 + drift; y < height + GAP; y += GAP) {
        for (let x = GAP / 2 - drift; x < width + GAP; x += GAP) {
          let dx = 0;
          let dy = 0;
          let r = 1.1;
          if (!reduced) {
            const ddx = x - pointer.x;
            const ddy = y - pointer.y;
            const d = Math.hypot(ddx, ddy);
            if (d < INFLUENCE) {
              const pull = 1 - d / INFLUENCE;
              dx = (ddx / d) * pull * 5;
              dy = (ddy / d) * pull * 5;
              r = 1.1 + pull * 0.9;
            }
          }
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (running && !reduced) raf = requestAnimationFrame(draw);
    };
    running = true;
    if (!reduced) raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />;
}
