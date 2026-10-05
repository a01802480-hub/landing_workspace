import { ClinicalBackdrop } from "@/components/bits/ClinicalBackdrop";
import { SideRail } from "@/components/workspace/shell/SideRail";
import { TopBar } from "@/components/workspace/shell/TopBar";
import { ResourceSidebar } from "@/components/workspace/shell/ResourceSidebar";
import { DagRunsProvider } from "@/lib/dagContext";
import { IdeProvider } from "@/lib/ide";
import { WorkspaceProvider } from "@/lib/workspaceStore";

/**
 * Workspace shell — Benchling-style app frame: collapsible left rail,
 * floating status bar, and a viewport that each tool fills (the structure
 * workspace uses split panes; document-style tools scroll internally).
 * The clinical backdrop (aurora + dot field) floats behind every panel.
 *
 * The whole workspace sits inside WorkspaceProvider: the active sequence
 * and selection are shared across the DNA canvas, the flow builder and the
 * CRISPR tools — a region selected on the map is exactly what a tool node
 * sends upstream. IdeProvider owns the IDE tab state (hash-routed), which
 * the SideRail and TopBar both read on /workspace.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <IdeProvider>
        <DagRunsProvider>
          <div className="relative flex h-dvh overflow-hidden">
            <ClinicalBackdrop />
            <SideRail />
            <ResourceSidebar />
            <div className="relative z-10 flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="min-h-0 flex-1">{children}</main>
            </div>
          </div>
        </DagRunsProvider>
      </IdeProvider>
    </WorkspaceProvider>
  );
}
