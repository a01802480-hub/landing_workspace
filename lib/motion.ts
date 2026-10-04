/**
 * motion.ts — SSR-safe layout effects + reduced-motion preference hooks.
 * Every animated component gates its motion on usePrefersReducedMotion.
 */
import { useEffect, useLayoutEffect, useState } from "react";

/** useLayoutEffect on the client, useEffect during SSR hydration. */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** True when the user prefers reduced motion (matchMedia, live-updating). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
