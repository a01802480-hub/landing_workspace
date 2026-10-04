"use client";

/**
 * Aurora — layered clinical aurora behind the workspace. React Bits
 * "Aurora" pattern, CSS-only variant (no shader dependency): three
 * deep-ice glow fields drifting on transform-only keyframes, blurred into
 * weightless haze. Under `prefers-reduced-motion` the fields render static.
 */
import { usePrefersReducedMotion } from "@/lib/motion";

export function Aurora({ className = "" }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null; // the page's own gradients remain; no motion, no layer
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="aurora-blob aurora-blob-a" />
      <div className="aurora-blob aurora-blob-b" />
      <div className="aurora-blob aurora-blob-c" />
    </div>
  );
}
