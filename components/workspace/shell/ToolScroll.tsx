"use client";

/**
 * ToolScroll — scroll container for the document-style workspace tools
 * (overview, comparative, variants). The structure workspace fills its
 * own viewport with split panes instead.
 */
import type { ReactNode } from "react";

export function ToolScroll({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
