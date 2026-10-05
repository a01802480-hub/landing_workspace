"use client";

/**
 * SideRail — Benchling-style collapsible left rail. Icon-only when
 * collapsed (tooltips carry the labels), expanding to a labelled section
 * list. Collapse state persists; every transition is ≥0.3s ease-out.
 * Glassmorphic: backdrop blur over the clinical dot field.
 *
 * Iconography: lucide-react stroke icons — scalable vectors that inherit
 * the clinical palette via `currentColor` (cool grays, sterile blues).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  Database,
  Dna,
  Globe,
  LayoutGrid,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { WORKSPACE_TOOLS } from "@/lib/tools";
import { usePersistentState } from "@/lib/persistence";
import { useIde, type WorkspaceTabId } from "@/lib/ide";

interface RailItem {
  href: string;
  /** Tab id inside the IDE (hash link target); undefined for external links. */
  tab?: WorkspaceTabId;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

interface RailSection {
  label: string;
  items: RailItem[];
}

/** Workspace section derives from the single tool registry (lib/tools.ts).
 *  On the IDE route every item is a hash link into a keep-alive tab. */
const SECTIONS: RailSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/workspace", tab: "overview", label: "Overview", icon: LayoutGrid },
      ...WORKSPACE_TOOLS.map((t) => ({
        href: t.href,
        tab: t.href.split("/").pop() as WorkspaceTabId,
        label: t.label,
        icon: t.icon,
      })),
    ],
  },
  {
    label: "Data sources",
    items: [
      { href: "https://alphafold.ebi.ac.uk", label: "AlphaFold DB", icon: Waypoints, external: true },
      { href: "https://www.rcsb.org", label: "RCSB PDB", icon: Database, external: true },
      { href: "https://www.uniprot.org", label: "UniProt", icon: Globe, external: true },
      { href: "https://www.ncbi.nlm.nih.gov", label: "NCBI Entrez", icon: Database, external: true },
    ],
  },
];

export function SideRail() {
  const pathname = usePathname();
  const { activeTab, selectTab } = useIde();
  const [expanded, setExpanded] = usePersistentState<boolean>("rail:expanded", true, (v) =>
    typeof v === "boolean" ? v : null,
  );

  return (
    <aside
      className={`glass-card z-20 m-3 mr-0 flex shrink-0 flex-col overflow-hidden rounded-2xl transition-[width] duration-300 ease-out ${
        expanded ? "w-56" : "w-14"
      }`}
      aria-label="Workspace navigation"
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-ink-950/5 px-3.5 py-4"
        aria-label="Protheon — back to landing"
      >
        <span aria-hidden className="shrink-0 text-glow-violet">
          <Dna className="h-5 w-5" strokeWidth={2} />
        </span>
        {expanded && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-frost">Protheon</span>
            <span className="block text-[9px] tracking-[0.22em] text-mist/60 uppercase">workspace</span>
          </span>
        )}
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto py-3">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {expanded && (
              <p className="px-4 pb-1.5 text-[9px] font-semibold tracking-[0.18em] text-mist/50 uppercase">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => {
                // On the IDE route the active tool is the tab state; legacy
                // deep links keep the pathname-equality check.
                const active = !item.external
                  ? pathname === "/workspace"
                    ? item.tab === activeTab
                    : pathname === item.href
                  : false;
                const Icon = item.icon;
                const link = (
                  <span
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition-colors duration-300 ease-out ${
                      active
                        ? "bg-glow-violet/15 font-medium text-frost"
                        : "text-mist hover:bg-ink-950/5 hover:text-frost"
                    }`}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {expanded && <span className="truncate">{item.label}</span>}
                  </span>
                );
                return (
                  <li key={item.href} title={expanded ? undefined : item.label}>
                    {item.external ? (
                      <a href={item.href} target="_blank" rel="noreferrer noopener" className="block">
                        {link}
                      </a>
                    ) : (
                      <Link
                        href={item.tab ? { pathname: "/workspace", hash: `#${item.tab}` } : item.href}
                        scroll={false}
                        onClick={() => {
                          // Next's hash navigation goes through pushState,
                          // which fires no hashchange — set the tab directly.
                          if (item.tab) selectTab(item.tab);
                        }}
                        aria-current={active ? "page" : undefined}
                        className="block"
                      >
                        {link}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={expanded}
        className="flex items-center gap-2.5 border-t border-ink-950/5 px-3.5 py-3 text-xs text-mist transition-colors duration-300 ease-out hover:bg-ink-950/5 hover:text-frost"
      >
        <ChevronLeft
          aria-hidden
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${expanded ? "" : "rotate-180"}`}
        />
        {expanded && <span>Collapse</span>}
      </button>
    </aside>
  );
}
