"use client";

/**
 * SgRnaTable — the ranked guide table (Benchling's guide-design panel).
 *
 * Columns: rank · spacer + PAM · position (strand) · GC · self-comp ·
 * on-target score bar · off-targets · notes. Selecting a row drives the
 * PAM track marker and the off-target detail list. Off-target counts stay
 * "—" until an upstream tool supplies them (never fabricated).
 */
import { useMemo, useState } from "react";
import type { SgRna } from "@/lib/validation";

type SortKey = "rank" | "score" | "gc" | "off";

export function SgRnaTable({
  guides,
  selectedId,
  onSelect,
  hoverId,
  onHover,
  excludedIds,
  onToggleExcluded,
}: {
  guides: SgRna[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hoverId?: string | null;
  onHover?: (id: string | null) => void;
  /** Excluded guides stay listed (dimmed) but drop out of the map,
   *  the wizard and the plasmid handoff. */
  excludedIds?: Set<string>;
  onToggleExcluded?: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "score", asc: false });

  const rows = useMemo(() => {
    const indexed = guides.map((g, i) => ({ ...g, rank: i + 1 }));
    const dir = sort.asc ? 1 : -1;
    const by: Record<SortKey, (a: SgRna & { rank: number }, b: SgRna & { rank: number }) => number> = {
      rank: (a, b) => a.rank - b.rank,
      score: (a, b) => a.on_target_score - b.on_target_score,
      gc: (a, b) => a.gc - b.gc,
      off: (a, b) => a.off_target_count - b.off_target_count,
    };
    return [...indexed].sort((a, b) => dir * by[sort.key](a, b));
  }, [guides, sort]);

  const toggle = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: false }));

  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-ink-950/5">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#f5f3fb] text-[9px] tracking-wide text-mist/70 uppercase">
            <th scope="col" className="w-8 px-2 py-2 font-medium" aria-label="Exclude guide" />
            <SortTh label="Rank" active={sort.key === "rank"} dir={sort.asc ? "↑" : "↓"} onClick={() => toggle("rank")} />
            <th scope="col" className="px-2 py-2 font-medium">Spacer · PAM</th>
            <th scope="col" className="px-2 py-2 font-medium">Position</th>
            <SortTh label="GC" active={sort.key === "gc"} dir={sort.asc ? "↑" : "↓"} onClick={() => toggle("gc")} />
            <th scope="col" className="px-2 py-2 font-medium">Self-comp</th>
            <SortTh label="Score" active={sort.key === "score"} dir={sort.asc ? "↑" : "↓"} onClick={() => toggle("score")} />
            <SortTh label="Off-targets" active={sort.key === "off"} dir={sort.asc ? "↑" : "↓"} onClick={() => toggle("off")} />
            <th scope="col" className="px-2 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const selected = g.id === selectedId;
            const hovered = g.id === hoverId;
            const excluded = excludedIds?.has(g.id) ?? false;
            const manual = g.on_target_score < 0;
            return (
              <tr
                key={g.id}
                onClick={() => onSelect(g.id)}
                onPointerEnter={() => onHover?.(g.id)}
                onPointerLeave={() => onHover?.(null)}
                aria-selected={selected}
                className={`cursor-pointer border-t border-ink-950/5 transition-colors duration-300 ease-out ${
                  excluded
                    ? "opacity-40"
                    : selected
                      ? "bg-glow-violet/10"
                      : hovered
                        ? "bg-ink-950/5"
                        : "hover:bg-ink-950/5"
                }`}
              >
                <td className="px-2 py-2">
                  {onToggleExcluded && (
                    <input
                      type="checkbox"
                      checked={excluded}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleExcluded(g.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Exclude ${g.id}`}
                      className="accent-glow-violet"
                    />
                  )}
                </td>
                <td className="stat-num px-3 py-2 font-semibold text-frost">{g.rank}</td>
                <td className="px-2 py-2 font-mono text-[11px]">
                  <span className="text-frost/90">{g.sequence.slice(0, 10)}…</span>
                  <span className="text-glow-violet/80">{g.pam}</span>
                </td>
                <td className="stat-num px-2 py-2 text-mist/80">
                  {g.start}–{g.end} ({g.strand})
                </td>
                <td className="stat-num px-2 py-2" style={{ color: g.gc >= 40 && g.gc <= 70 ? "#0ca30c" : "#9a6b00" }}>
                  {g.gc.toFixed(0)}%
                </td>
                <td className="stat-num px-2 py-2 text-mist/80">{g.self_comp?.toFixed(2) ?? "—"}</td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-950/[0.08]">
                      <span
                        className="block h-full rounded-full bg-glow-violet"
                        style={{ width: `${Math.min(100, Math.max(0, g.on_target_score))}%` }}
                      />
                    </span>
                    <span className="stat-num w-10 text-mist/80">
                      {manual ? <span className="text-mist/60" title="manually entered — no score is fabricated">manual</span> : g.on_target_score.toFixed(0)}
                    </span>
                  </span>
                </td>
                <td className="stat-num px-2 py-2">
                  {g.efficiency_note?.includes("unavailable") ? <span className="text-mist/50">n/a</span> : g.off_target_count}
                </td>
                <td className="max-w-[12rem] truncate px-2 py-2 text-[10px] text-mist/70" title={g.efficiency_note}>
                  {g.efficiency_note || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: string;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-2 py-2 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase transition-colors duration-300 ease-out hover:text-frost ${
          active ? "text-frost" : "text-mist/70"
        }`}
      >
        {label}
        <span aria-hidden className="text-[8px]">{active ? dir : "·"}</span>
      </button>
    </th>
  );
}
