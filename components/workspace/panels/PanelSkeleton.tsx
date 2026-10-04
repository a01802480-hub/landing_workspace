"use client";

/**
 * PanelSkeleton — loading states for every data-fetching step, styled with
 * the zero-gravity clinical aesthetic (shimmer on glass, no layout jumps:
 * each variant fills its panel the same way the content will).
 */

const CAPTIONS: Record<string, string> = {
  viewer: "Suspending coordinates in the void…",
  chart: "Calibrating confidence scales…",
  sequence: "Sequencing the sequence…",
  heatmap: "Condensing the PAE matrix…",
  stats: "Weighing statistics…",
};

export function PanelSkeleton({
  variant = "viewer",
  caption,
  className = "",
}: {
  variant?: "viewer" | "chart" | "sequence" | "heatmap" | "stats";
  caption?: string;
  className?: string;
}) {
  return (
    <div className={`flex h-full min-h-0 w-full flex-col gap-3 p-4 ${className}`} aria-busy="true" aria-label="Loading">
      {variant === "viewer" && (
        <div className="relative flex flex-1 items-center justify-center">
          <span aria-hidden className="skeleton-ring">
            <span className="skeleton-ring-dot" />
            <span className="skeleton-ring-dot" />
            <span className="skeleton-ring-dot" />
          </span>
        </div>
      )}
      {variant === "chart" && (
        <div className="flex flex-1 flex-col justify-end gap-2">
          <div className="skeleton h-1/3 w-full rounded-lg" />
          <div className="skeleton h-1/2 w-full rounded-lg" />
        </div>
      )}
      {variant === "heatmap" && (
        <div className="grid flex-1 grid-cols-8 gap-1">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className="skeleton rounded-[3px]" style={{ animationDelay: `${(i % 8) * 90}ms` }} />
          ))}
        </div>
      )}
      {variant === "sequence" && (
        <div className="flex flex-1 flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex gap-1">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton h-5 flex-1 rounded-[3px]"
                  style={{ animationDelay: `${(i + row * 7) * 35}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {variant === "stats" && (
        <div className="flex flex-1 flex-col justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-mist/60">{caption ?? CAPTIONS[variant]}</p>
    </div>
  );
}
