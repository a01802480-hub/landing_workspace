"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type BioBlockType = "notes" | "sequence" | "alignment" | "protein";

export interface BioBlock {
  id: string;
  type: BioBlockType;
  title: string;
  content: string;
  createdAt: number;
}

interface FreeWorkspaceState {
  blocks: BioBlock[];
  addBlock: (type: BioBlockType, index?: number) => void;
  updateBlock: (id: string, patch: Partial<Pick<BioBlock, "title" | "content">>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, direction: -1 | 1) => void;
}

const FreeWorkspaceContext = createContext<FreeWorkspaceState | null>(null);

function blockFactory(type: BioBlockType): BioBlock {
  const now = Date.now();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `block-${now}`,
    type,
    title:
      type === "notes"
        ? "Research notes"
        : type === "sequence"
          ? "Sequence explorer"
          : type === "alignment"
            ? "Alignment board"
            : "Protein model handoff",
    content: "",
    createdAt: now,
  };
}

export function FreeWorkspaceProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useState<BioBlock[]>([
    {
      id: "intro-notes",
      type: "notes",
      title: "Untitled analysis",
      content: "Start typing. Use /sequence, /alignment, or /protein to add biological blocks.",
      createdAt: Date.now(),
    },
  ]);

  const addBlock = useCallback((type: BioBlockType, index?: number) => {
    const block = blockFactory(type);
    setBlocks((prev) => {
      if (index === undefined || index < 0 || index >= prev.length) return [...prev, block];
      return [...prev.slice(0, index + 1), block, ...prev.slice(index + 1)];
    });
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<Pick<BioBlock, "title" | "content">>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));
  }, []);

  const moveBlock = useCallback((id: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const clone = [...prev];
      [clone[idx], clone[nextIdx]] = [clone[nextIdx], clone[idx]];
      return clone;
    });
  }, []);

  const value = useMemo(
    () => ({ blocks, addBlock, updateBlock, removeBlock, moveBlock }),
    [blocks, addBlock, updateBlock, removeBlock, moveBlock],
  );

  return <FreeWorkspaceContext.Provider value={value}>{children}</FreeWorkspaceContext.Provider>;
}

export function useFreeWorkspace() {
  const ctx = useContext(FreeWorkspaceContext);
  if (!ctx) throw new Error("useFreeWorkspace must be used inside FreeWorkspaceProvider.");
  return ctx;
}
