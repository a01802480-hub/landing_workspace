"use client";

/**
 * CrisprToolSwitcher — tabbed tool selector for the three CRISPR engines
 * (CHOPCHOP · CRISPR-GATE · CRISPR-P 2.0). Benchling-style segmented tabs:
 * the active tool owns the whole workflow below.
 */
import { CRISPR_TOOLS, type CrisprTool } from "@/lib/crispr";

export function CrisprToolSwitcher({
  active,
  onChange,
  disabled = false,
}: {
  active: CrisprTool;
  onChange: (tool: CrisprTool) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="CRISPR design tool">
      {CRISPR_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          role="tab"
          aria-selected={active === tool.id}
          disabled={disabled}
          onClick={() => onChange(tool.id)}
          title={`${tool.blurb} PAM: ${tool.pam}`}
          className={`chip transition-colors duration-300 ease-out disabled:opacity-50 ${
            active === tool.id
              ? "border-glow-violet/50 bg-glow-violet/15 font-medium text-frost"
              : "hover:border-glow-violet/40 hover:text-frost"
          }`}
        >
          {tool.label}
          <span className="stat-num text-[9px] text-mist/50">{tool.pam}</span>
        </button>
      ))}
    </div>
  );
}
