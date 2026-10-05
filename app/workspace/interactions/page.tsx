"use client";

/**
 * Interactions workspace — empirical protein–drug docking and solvent-driven
 * denaturation, both served by the /biophysics API. ONE shared protein
 * picker feeds both panels: the researcher chooses the structure (PDB id
 * or UniProt/AlphaFold accession) AND the solvent (eight models with
 * thermal coupling), and both the 2D titration and the 3D unfolding
 * respond to the chosen parameters — different solvents unfold the same
 * protein differently.
 */
import { useState } from "react";
import { Panel } from "@/components/workspace/panels/Panel";
import { PanelBoundary } from "@/components/workspace/panels/PanelBoundary";
import { ToolScroll } from "@/components/workspace/shell/ToolScroll";
import { DockingPanel } from "@/components/workspace/interactions/DockingPanel";
import { SolventPanel, type SolventKey } from "@/components/workspace/interactions/SolventPanel";
import { ProteinPicker, type StructureSource } from "@/components/workspace/interactions/ProteinPicker";

export default function InteractionsPage() {
  const [source, setSource] = useState<StructureSource>("pdb");
  const [ident, setIdent] = useState("1UBQ");
  const [solvent, setSolvent] = useState<SolventKey>("ethanol");
  const [temperature, setTemperature] = useState(25);

  return (
    <ToolScroll>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-frost">Interactions</h1>
        <p className="mt-2 max-w-2xl text-mist">
          Empirical physics for the bench: score a drug-like ligand against your structure — binding
          free energy, dissociation constant and active-site contacts — then titrate the solvent of
          your choice to trace how the hydrophobic core unfolds.
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-mist/60">
          Research preview: both models are empirical parameterizations (Vina-like scoring;
          linear-extrapolation denaturation with per-solvent geometry parameters). Treat the
          numbers as directional hypotheses to design experiments against — not as measured
          affinities or trajectories.
        </p>
      </header>

      <div className="glass-card mb-6 px-4 py-3">
        <ProteinPicker source={source} onSourceChange={setSource} ident={ident} onIdentChange={setIdent} />
      </div>

      <div className="grid gap-6">
        <Panel
          title="Protein–drug docking"
          note="Vina-like empirical score · parameterized ligands"
          className="min-h-[30rem]"
        >
          <PanelBoundary title="Protein–drug docking" className="h-full">
            <DockingPanel pdbId={ident} onPdbIdChange={setIdent} />
          </PanelBoundary>
        </Panel>
        <Panel
          title="Protein–solvent interactions"
          note="eight solvents · thermal coupling · live 3D unfolding · RMSD"
          className="min-h-[34rem]"
        >
          <PanelBoundary title="Protein–solvent interactions" className="h-full">
            <SolventPanel
              pdbId={ident}
              source={source}
              solvent={solvent}
              onSolventChange={setSolvent}
              temperature={temperature}
              onTemperatureChange={setTemperature}
            />
          </PanelBoundary>
        </Panel>
      </div>
    </ToolScroll>
  );
}
