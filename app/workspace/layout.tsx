import { ClinicalBackdrop } from "@/components/bits/ClinicalBackdrop";
import { SideRail } from "@/components/workspace/shell/SideRail";
import { TopBar } from "@/components/workspace/shell/TopBar";

/**
 * Workspace shell — Benchling-style app frame: collapsible left rail,
 * floating status bar, and a viewport that each tool fills (the structure
 * workspace uses split panes; document-style tools scroll internally).
 * The clinical backdrop (aurora + dot field) floats behind every panel.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh overflow-hidden">
      <ClinicalBackdrop />
      <SideRail />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
