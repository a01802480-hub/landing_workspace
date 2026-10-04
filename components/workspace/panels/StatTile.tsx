"use client";

/**
 * StatTile — the shared KPI tile used by the overview hub, the comparative
 * dashboard and the structure workspace's stats strip. One glass block:
 * uppercase label, big stat-num value, optional color chip and caption.
 */
export function StatTile({
  label,
  value,
  chip,
  accent,
  caption,
  dense = false,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  chip?: { color: string; label: string };
  /** Accent color for the value itself (e.g. diverging writhe sign). */
  accent?: string;
  caption?: React.ReactNode;
  /** Compact variant for in-panel stat strips. */
  dense?: boolean;
  className?: string;
}) {
  return (
    <div className={`glass-card ${dense ? "px-4 py-3" : "px-5 py-4"} ${className}`}>
      <p className={`tracking-[0.18em] text-mist/60 uppercase ${dense ? "text-[9px]" : "text-[10px]"}`}>{label}</p>
      <div className={`flex items-baseline gap-2 ${dense ? "mt-1" : "mt-1.5"}`}>
        <p
          className={`stat-num min-w-0 truncate font-semibold text-frost ${dense ? "text-lg" : "text-2xl"}`}
          style={accent ? { color: accent } : undefined}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </p>
        {chip && (
          <span className="chip shrink-0">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: chip.color }} />
            {chip.label}
          </span>
        )}
      </div>
      {caption && <p className="mt-1 text-xs text-mist/70">{caption}</p>}
    </div>
  );
}
