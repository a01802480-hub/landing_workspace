"use client";

/**
 * FeatureTrack — shared Gantt-style track math for annotation regions.
 *
 * Three surfaces render position/width percent math today: the protein
 * DomainTrack, the DNA feature overview strip (LinearMap) and the CRISPR
 * PAM track. These helpers are the single implementation; each surface
 * keeps its own presentation (bars, buttons, ticks).
 */
import type { ReactNode } from "react";

/** Percent offset of a 1-based region on a track of `length` units. */
export function regionLeft(start: number, length: number): number {
  return ((start - 1) / Math.max(1, length)) * 100;
}

/** Percent width of a 1-based inclusive region, floored so tiny features stay clickable. */
export function regionWidth(start: number, end: number, length: number, minPct = 2): number {
  const raw = ((end - start + 1) / Math.max(1, length)) * 100;
  return Math.max(minPct, Math.min(100 - regionLeft(start, length), raw));
}

/** A positioned region slice, ready for an absolute child. */
export interface RegionSlice {
  left: string;
  width: string;
}

export function regionSlice(start: number, end: number, length: number, minPct = 2): RegionSlice {
  return {
    left: `${regionLeft(start, length)}%`,
    width: `${regionWidth(start, end, length, minPct)}%`,
  };
}

/** The rail itself — a relative container regions are positioned inside. */
export function FeatureTrack({
  length,
  heightClass = "h-8",
  children,
  className = "",
  ariaLabel,
}: {
  length: number;
  heightClass?: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`relative w-full ${heightClass} ${className}`} role={ariaLabel ? "img" : undefined} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
