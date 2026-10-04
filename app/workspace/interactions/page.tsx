"use client";

/**
 * Interactions workspace — empirical protein–drug docking and solvent-driven
 * denaturation, both served by the /biophysics API. Two panels in a grid:
 * the docking scorer (ΔG, Kd, pocket, contacts) and the solvent titration
 * curve with its concentration marker and CSV export.
 */
import { Panel } from "@/components/workspace/panels/Panel";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { DockingPanel } from "@/components/workspace/interactions/DockingPanel";
import { SolventPanel } from "@/components/workspace/interactions/SolventPanel";

export default function InteractionsPage() {
  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Interactions</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Empirical physics for the bench: score a drug-like ligand against a PDB entry — binding
          free energy, dissociation constant and active-site contacts — then titrate a solvent to
          trace how the hydrophobic core unfolds.
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-mist/60">
          Research preview: both models are empirical parameterizations (Vina-like scoring;
          linear-extrapolation denaturation). Treat the numbers as directional hypotheses to
          design experiments against — not as measured affinities.
        </p>
      </header>

      <div className="grid gap-6">
        <Panel
          title="Protein–drug docking"
          note="Vina-like empirical score · parameterized ligands"
          className="min-h-[30rem]"
        >
          <PanelBoundary title="Protein–drug docking" className="h-full">
            <DockingPanel />
          </PanelBoundary>
        </Panel>
        <Panel
          title="Protein–solvent interactions"
          note="tri-solvent titration · live 3D unfolding · RMSD"
          className="min-h-[34rem]"
        >
          <PanelBoundary title="Protein–solvent interactions" className="h-full">
            <SolventPanel />
          </PanelBoundary>
        </Panel>
      </div>
    </ToolScroll>
  );
}
