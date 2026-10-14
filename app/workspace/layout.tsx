import { ClinicalBackdrop } from "@/components/bits/ClinicalBackdrop";
import { TopBar } from "@/components/workspace/shell/TopBar";
import { DagRunsProvider } from "@/lib/dagContext";
import { FreeWorkspaceProvider } from "@/lib/freeWorkspaceStore";
import { IdeProvider } from "@/lib/ide";
import { WorkspaceProvider } from "@/lib/workspaceStore";

/**
 * Workspace shell — decluttered frame for a canvas-first workflow:
 * lightweight top bar + full-width viewport for free-form bio blocks.
 * The clinical backdrop (aurora + dot field) floats behind every panel.
 *
 * The whole workspace sits inside WorkspaceProvider: the active sequence
 * and selection are shared across the DNA canvas, the flow builder and the
 * CRISPR tools. IdeProvider owns the IDE tab state (hash-routed), while
 * FreeWorkspaceProvider keeps document-style biological block composition.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <FreeWorkspaceProvider>
      <IdeProvider>
        <DagRunsProvider>
          <div className="relative flex h-dvh overflow-hidden">
            <ClinicalBackdrop />
            <div className="relative z-10 flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="min-h-0 flex-1">{children}</main>
            </div>
          </div>
        </DagRunsProvider>
      </IdeProvider>
      </FreeWorkspaceProvider>
    </WorkspaceProvider>
  );
}
