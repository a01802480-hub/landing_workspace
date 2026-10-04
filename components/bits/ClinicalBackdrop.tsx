"use client";

/**
 * ClinicalBackdrop — the workspace's zero-gravity background field:
 * aurora haze + drifting ice dots, both retuned to the clinical palette.
 * Sits behind every panel (z-index below content); all layers are
 * transform-only and honor prefers-reduced-motion.
 */
import { Aurora } from "./Aurora";
import { DotField } from "./DotField";

export function ClinicalBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Aurora />
      <DotField />
    </div>
  );
}
