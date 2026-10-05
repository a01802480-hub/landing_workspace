"use client";

/**
 * ProteinPicker — the researcher chooses WHICH protein the interaction
 * tools operate on. PDB ids feed both docking and the unfolding viewer;
 * UniProt accessions feed the unfolding viewer via AlphaFold model files.
 * The choice is lifted to the interactions page so the docking panel and
 * the solvent panel always share the same structure.
 */
import { useState } from "react";

export type StructureSource = "pdb" | "alphafold";

const PDB_RE = /^[A-Za-z0-9]{4}$/;
const UNIPROT_RE = /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/;

export function ProteinPicker({
  source,
  onSourceChange,
  ident,
  onIdentChange,
}: {
  source: StructureSource;
  onSourceChange: (s: StructureSource) => void;
  ident: string;
  onIdentChange: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const valid =
    source === "pdb" ? PDB_RE.test(ident.trim()) : UNIPROT_RE.test(ident.trim().toUpperCase());

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] tracking-wide text-mist/70 uppercase">Protein</span>
      <div role="radiogroup" aria-label="Structure source" className="flex items-center gap-1.5">
        {(
          [
            { id: "pdb", label: "PDB ID" },
            { id: "alphafold", label: "UniProt" },
          ] as { id: StructureSource; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={source === s.id}
            onClick={() => {
              onSourceChange(s.id);
              setError(null);
            }}
            className={`chip !py-0.5 text-[10px] transition-colors duration-300 ease-out ${
              source === s.id ? "border-glow-violet/50 bg-glow-violet/15 text-frost" : "hover:text-frost"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        value={ident}
        onChange={(e) => {
          onIdentChange(e.target.value);
          setError(null);
        }}
        onBlur={() =>
          setError(valid ? null : source === "pdb" ? "four letters/digits (e.g. 1UBQ)" : "UniProt accession (e.g. P0CG48)")
        }
        placeholder={source === "pdb" ? "1UBQ" : "P0CG48"}
        aria-label={source === "pdb" ? "PDB identifier" : "UniProt accession"}
        className="glass-panel w-32 px-2.5 py-1 font-mono text-xs text-frost placeholder:text-mist/40 focus:border-glow-violet/50 focus:outline-none"
      />
      <span className="text-[9px] text-mist/60">
        {source === "alphafold" ? "AlphaFold model file (unfolding)" : "RCSB structure (docking + unfolding)"}
      </span>
      {error && (
        <span role="alert" className="text-[10px] text-[#c13b3b]">
          {error}
        </span>
      )}
    </div>
  );
}
