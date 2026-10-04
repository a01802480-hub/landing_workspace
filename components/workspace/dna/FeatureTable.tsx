"use client";

/**
 * FeatureTable — the feature annotation table docked at the bottom of the
 * DNA workspace (SnapGene's features panel). Sortable columns; clicking a
 * row selects the region on the canvas through the shared store. Strand is
 * always labeled (→ / ←), never arrow-alone.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { annotationColor } from "@/lib/sequences";
import { useWorkspace } from "@/lib/workspaceStore";

type SortKey = "name" | "type" | "start" | "length";

export function FeatureTable({ className = "" }: { className?: string }) {
  const { sequence, selection, setSelection } = useWorkspace();
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "start", asc: true });

  const rows = useMemo(() => {
    if (!sequence) return [];
    const indexed = sequence.features.map((f, i) => ({
      ...f,
      color: f.color ?? annotationColor(i),
      length: f.end - f.start + 1,
    }));
    const dir = sort.asc ? 1 : -1;
    const by: Record<SortKey, (a: (typeof indexed)[number], b: (typeof indexed)[number]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      type: (a, b) => a.type.localeCompare(b.type),
      start: (a, b) => a.start - b.start,
      length: (a, b) => a.length - b.length,
    };
    return [...indexed].sort((a, b) => dir * by[sort.key](a, b));
  }, [sequence, sort]);

  if (!sequence) return null;

  const toggle = (key: SortKey) => setSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: false }));

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex items-baseline gap-3 px-1 pb-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-frost/80 uppercase">Features</h3>
        <p className="text-[10px] text-mist/60">
          {rows.length} annotated regions · click a row to select it on the map
        </p>
        {selection && (
          <button type="button" onClick={() => setSelection(null)} className="btn-ghost ml-auto !px-2.5 !py-0.5 text-[10px]">
            clear selection
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-ink-950/5">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#f5f3fb] text-[9px] tracking-wide text-mist/70 uppercase">
              <Th label="Feature" k="name" sort={sort} toggle={toggle} />
              <Th label="Type" k="type" sort={sort} toggle={toggle} />
              <th scope="col" className="px-2 py-2 font-medium">Strand</th>
              <Th label="Start" k="start" sort={sort} toggle={toggle} />
              <th scope="col" className="px-2 py-2 font-medium">End</th>
              <Th label="Length" k="length" sort={sort} toggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const selected = selection !== null && f.start <= selection.end && f.end >= selection.start;
              return (
                <tr
                  key={f.key}
                  onClick={() => setSelection({ start: f.start, end: f.end })}
                  aria-selected={selected}
                  className={`cursor-pointer border-t border-ink-950/5 transition-colors duration-300 ease-out ${
                    selected ? "bg-glow-violet/10" : "hover:bg-ink-950/5"
                  }`}
                  title={f.product ? `${f.name} — ${f.product}` : f.name}
                >
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: f.color }} />
                      <span className="truncate text-frost/90">{f.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-mist/80">{f.type}</td>
                  <td className="px-2 py-1.5">
                    {f.strand === -1 ? (
                      <ArrowLeft aria-label="reverse strand" className="h-3 w-3 text-mist/70" />
                    ) : (
                      <ArrowRight aria-label="forward strand" className="h-3 w-3 text-mist/70" />
                    )}
                  </td>
                  <td className="stat-num px-2 py-1.5 text-frost/90">{f.start.toLocaleString()}</td>
                  <td className="stat-num px-2 py-1.5 text-frost/90">{f.end.toLocaleString()}</td>
                  <td className="stat-num px-2 py-1.5 text-mist/80">{f.length.toLocaleString()} bp</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  k,
  sort,
  toggle,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; asc: boolean };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th scope="col" className="px-2 py-2 font-medium">
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1 uppercase transition-colors duration-300 ease-out hover:text-frost ${
          active ? "text-frost" : "text-mist/70"
        }`}
      >
        {label}
        <span aria-hidden className="text-[8px]">{active ? (sort.asc ? "↑" : "↓") : "·"}</span>
      </button>
    </th>
  );
}
