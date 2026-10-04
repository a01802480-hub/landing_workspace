"use client";

/**
 * workspaceStore.tsx — the cross-tool sequence state bridge.
 *
 * One provider (mounted in the workspace layout) holds the active sequence,
 * its annotations and the current selection. The DNA canvas (seqviz or the
 * classic maps), the properties sidebar, the feature table, the CRISPR
 * workspace and the flow builder all read/write this store — a selection
 * made on the canvas is immediately what "Run CHOPCHOP" receives, with no
 * page-to-page serialization in between.
 *
 * The sequence persists to localStorage (validated on restore, ≤ 100 kb
 * guard) so navigating between tools never loses the file a researcher
 * imported in the browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storageRead, storageWrite } from "@/lib/persistence";
import type { SequenceSelection, WorkspaceSequence } from "@/lib/sequences";

interface WorkspaceState {
  sequence: WorkspaceSequence | null;
  selection: SequenceSelection | null;
  setSequence: (seq: WorkspaceSequence | null) => void;
  setSelection: (sel: SequenceSelection | null) => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

const STORE_KEY = "sequence:viewer";
const MAX_PERSIST_BP = 100_000;

/** Restore gate — localStorage is untrusted input. */
function validateStored(value: unknown): WorkspaceSequence | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<WorkspaceSequence>;
  if (typeof v.seq !== "string" || typeof v.name !== "string") return null;
  if (v.seq.length > MAX_PERSIST_BP) return null;
  if (!/^[A-Za-z]+$/.test(v.seq.replace(/\s+/g, ""))) return null;
  return {
    name: v.name.slice(0, 120),
    seq: v.seq.toUpperCase(),
    circular: v.circular === true,
    annotations: Array.isArray(v.annotations) ? v.annotations.slice(0, 200) : [],
    features: Array.isArray(v.features) ? v.features.slice(0, 200) : [],
    enzymes: Array.isArray(v.enzymes) ? v.enzymes.slice(0, 50) : [],
    source: v.source === "backend" ? "backend" : v.source === "demo" ? "demo" : "file",
    accession: typeof v.accession === "string" ? v.accession.slice(0, 40) : undefined,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [sequence, setSequenceState] = useState<WorkspaceSequence | null>(() => {
    const stored = storageRead<unknown>(STORE_KEY);
    return stored === undefined ? null : validateStored(stored);
  });
  const [selection, setSelection] = useState<SequenceSelection | null>(null);

  // Persist best-effort; huge sequences are memory-only.
  useEffect(() => {
    if (sequence && sequence.seq.length <= MAX_PERSIST_BP) storageWrite(STORE_KEY, sequence);
  }, [sequence]);

  const setSequence = useCallback((seq: WorkspaceSequence | null) => {
    setSequenceState(seq);
    setSelection(null); // a new sequence invalidates the old selection
  }, []);

  const value = useMemo(
    () => ({ sequence, selection, setSequence, setSelection }),
    [sequence, selection, setSequence],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return ctx;
}
