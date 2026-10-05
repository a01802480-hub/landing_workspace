"use client";

/**
 * workspaceStore.tsx — the cross-tool sequence/resource state bridge.
 *
 * One provider (mounted in the workspace layout) holds the active sequence,
 * its annotations, the current selection and the global resource registry.
 * The DNA canvas (seqviz or the classic maps), the properties sidebar, the
 * feature table, the CRISPR workspace and the flow builder all read/write
 * this store — a selection made on the canvas is immediately what
 * "Run CHOPCHOP" receives, with no page-to-page serialization in between.
 *
 * Editing: `editSequence` applies an insert/replace op (1-based) with
 * annotation-coordinate shifting, bumps the revision (the seqviz remount
 * key) and appends a hash-chained entry to the provenance audit log —
 * verification is a forward replay (see lib/audit.ts). `annotateSelection`
 * adds a feature from the current selection; `recordAuditNote` logs
 * no-op events (digests) without changing the sequence.
 *
 * Resources are the "unlimited inputs" registry: every imported sequence,
 * FASTA record and dataframe. Both sequence and resources persist to
 * localStorage (validated on restore, ≤ 100 kb payload guard).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { storageRead, storageWrite } from "@/lib/persistence";
import {
  MAX_RESOURCES,
  MAX_PERSIST_BP,
  resourceForStorage,
  validateResource,
  validateSequencePayload,
  type Resource,
} from "@/lib/resources";
import {
  appendAuditEntry,
  applyEditToSequence,
  auditReportJson,
  hashSequence,
  makeGenesis,
  normalizeEditText,
  verifyHistory as runVerify,
  validateAuditLog,
  EDIT_ALPHABET_RE,
  AUDIT_ORIGINAL_TEXT_CAP,
  type AuditLog,
  type EditOp,
  type VerifyResult,
} from "@/lib/audit";
import { downloadText } from "@/lib/export";
import {
  annotationColor,
  shiftAnnotations,
  type SequenceSelection,
  type WorkspaceSequence,
} from "@/lib/sequences";

interface WorkspaceState {
  sequence: WorkspaceSequence | null;
  selection: SequenceSelection | null;
  setSequence: (seq: WorkspaceSequence | null) => void;
  setSelection: (sel: SequenceSelection | null) => void;
  /** The global resource registry — imported files, drag-and-drop inputs. */
  resources: Resource[];
  /** Register only — never changes the active sequence. */
  addResource: (r: Resource) => void;
  removeResource: (id: string) => void;
  /** True once the stored sequence/resources have been adopted (post-hydration). */
  hydrated: boolean;
  /** The provenance log (hash-chained edits) — null until the first edit. */
  audit: AuditLog | null;
  /** True while an async edit is in flight (Apply buttons disable). */
  editing: boolean;
  /** Apply an edit op + record it in the audit log (async — hashing). */
  editSequence: (op: EditOp, summary: string) => Promise<void>;
  /** Record a sequence-neutral event (digest/annotate) in the audit log. */
  recordAuditNote: (kind: "digest" | "annotate", summary: string) => Promise<void>;
  /** Add a feature from the current selection (no sequence change). */
  annotateSelection: (name: string, type: string, direction: 1 | -1) => void;
  /** Forward-replay verification of the audit log against the sequence. */
  verifyHistory: () => Promise<VerifyResult | null>;
  /** Download the provenance report (JSON). */
  exportAudit: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

const STORE_KEY = "sequence:viewer";
const RESOURCES_KEY = "resources:registry";
const AUDIT_KEY = "sequence:audit";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Hydration-safe: the server always renders empty state; stored values
  // are adopted in an effect (storage reads in useState initializers would
  // diverge the prerendered HTML from the client's first render).
  const [sequence, setSequenceState] = useState<WorkspaceSequence | null>(null);
  const [selection, setSelection] = useState<SequenceSelection | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [audit, setAudit] = useState<AuditLog | null>(null);
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipWrite = useRef({ sequence: false, resources: false, audit: false });
  const adopted = useRef({ sequence: false, resources: false, audit: false });
  const editingRef = useRef(false);
  const sequenceRef = useRef<WorkspaceSequence | null>(null);
  sequenceRef.current = sequence;

  useEffect(() => {
    const stored = storageRead<unknown>(STORE_KEY);
    if (stored !== undefined) {
      const valid = validateSequencePayload(stored);
      if (valid) {
        skipWrite.current.sequence = true;
        setSequenceState(valid);
        setSelection(null);
      }
    }
    adopted.current.sequence = true;
    const storedResources = storageRead<unknown>(RESOURCES_KEY);
    if (Array.isArray(storedResources)) {
      const valid = storedResources
        .slice(0, MAX_RESOURCES)
        .map(validateResource)
        .filter((r): r is Resource => r !== null);
      if (valid.length > 0) {
        skipWrite.current.resources = true;
        setResources(valid);
      }
    }
    adopted.current.resources = true;
    const storedAudit = storageRead<unknown>(AUDIT_KEY);
    if (storedAudit !== undefined) {
      const valid = validateAuditLog(storedAudit);
      if (valid) {
        skipWrite.current.audit = true;
        setAudit(valid);
      }
    }
    adopted.current.audit = true;
    setHydrated(true);
  }, []);

  // Persist best-effort; huge sequences are memory-only. Never writes the
  // empty pre-adoption state over stored data.
  useEffect(() => {
    if (skipWrite.current.sequence) {
      skipWrite.current.sequence = false;
      return;
    }
    if (adopted.current.sequence && sequence && sequence.seq.length <= MAX_PERSIST_BP) {
      storageWrite(STORE_KEY, sequence);
    }
  }, [sequence]);

  // Resources persist with payload guards (oversized → metadata-only).
  useEffect(() => {
    if (skipWrite.current.resources) {
      skipWrite.current.resources = false;
      return;
    }
    if (adopted.current.resources) storageWrite(RESOURCES_KEY, resources.map(resourceForStorage));
  }, [resources]);

  // Audit persists alongside the sequence.
  useEffect(() => {
    if (skipWrite.current.audit) {
      skipWrite.current.audit = false;
      return;
    }
    if (adopted.current.audit && audit) storageWrite(AUDIT_KEY, audit);
  }, [audit]);

  const setSequence = useCallback((seq: WorkspaceSequence | null) => {
    setSequenceState(seq);
    setSelection(null); // a new sequence invalidates the old selection
    setAudit(null); // the log is re-genesised on the first edit of this sequence
  }, []);

  const addResource = useCallback((r: Resource) => {
    setResources((prev) => [r, ...prev.filter((p) => p.id !== r.id)].slice(0, MAX_RESOURCES));
  }, []);

  const removeResource = useCallback((id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const editSequence = useCallback(async (op: EditOp, summary: string) => {
    const before = sequenceRef.current;
    if (!before || editingRef.current) return;
    editingRef.current = true;
    setEditing(true);
    try {
      const text = normalizeEditText(op.kind === "insert" ? op.text : op.text);
      if (text && !EDIT_ALPHABET_RE.test(text)) {
        throw new Error("The edit contains characters outside the IUPAC DNA alphabet.");
      }
      const normalized: EditOp = op.kind === "insert" ? { kind: "insert", at: op.at, text } : { kind: "replace", start: op.start, end: op.end, text };
      const after = applyEditToSequence(before.seq, normalized);
      if (after.length < 1 || after.length > MAX_PERSIST_BP) {
        throw new Error(`The edited sequence would be ${after.length.toLocaleString()} bp — the workspace caps editing at ${MAX_PERSIST_BP.toLocaleString()} bp.`);
      }
      const [hashBefore, hashAfter] = await Promise.all([hashSequence(before.seq), hashSequence(after)]);
      const { annotations, features } = shiftAnnotations(before.annotations, before.features, normalized);
      const originalText =
        normalized.kind === "replace" ? before.seq.slice(Math.max(0, normalized.start - 1), normalized.end).slice(0, AUDIT_ORIGINAL_TEXT_CAP) : undefined;
      const entry = {
        seq: before.revision + 1,
        ts: Date.now(),
        kind: "edit" as const,
        summary: summary.slice(0, 300),
        op: normalized,
        originalText,
        lengthBefore: before.seq.length,
        lengthAfter: after.length,
        hashBefore: hashBefore.hash,
        hashAfter: hashAfter.hash,
        hashAlgo: hashAfter.algo,
      };
      const genesis = audit?.genesis ?? (await makeGenesis(before));
      setSequenceState({ ...before, seq: after, annotations, features, enzymes: [], revision: before.revision + 1 });
      setSelection(null);
      setAudit(await appendAuditEntry({ genesis, entries: audit?.entries ?? [] }, entry));
    } finally {
      editingRef.current = false;
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit]);

  const recordAuditNote = useCallback(async (kind: "digest" | "annotate", summary: string) => {
    const current = sequenceRef.current;
    if (!current || editingRef.current) return;
    editingRef.current = true;
    setEditing(true);
    try {
      const { hash, algo } = await hashSequence(current.seq);
      const entry = {
        seq: current.revision,
        ts: Date.now(),
        kind,
        summary: summary.slice(0, 300),
        lengthBefore: current.seq.length,
        lengthAfter: current.seq.length,
        hashBefore: hash,
        hashAfter: hash,
        hashAlgo: algo,
      };
      const genesis = audit?.genesis ?? (await makeGenesis(current));
      setAudit(await appendAuditEntry({ genesis, entries: audit?.entries ?? [] }, entry));
    } finally {
      editingRef.current = false;
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit]);

  const annotateSelection = useCallback((name: string, type: string, direction: 1 | -1) => {
    const current = sequenceRef.current;
    const sel = selection;
    if (!current || !sel) return;
    const color = annotationColor(current.annotations.length);
    const cleanName = (name || type || "feature").slice(0, 80);
    const cleanType = (type || "feature").slice(0, 40);
    const annotation = { name: cleanName, start: sel.start, end: sel.end, direction, color, type: cleanType };
    const feature = {
      key: `${cleanType}:${sel.start}:${sel.end}:${current.features.length}`,
      name: cleanName,
      type: cleanType,
      start: sel.start,
      end: sel.end,
      strand: direction,
      color,
    };
    setSequenceState({ ...current, annotations: [...current.annotations, annotation], features: [...current.features, feature] });
    void recordAuditNote("annotate", `annotated ${sel.start.toLocaleString()}–${sel.end.toLocaleString()} as ${cleanName} (${cleanType})`);
  }, [selection, recordAuditNote]);

  const verifyHistory = useCallback(async (): Promise<VerifyResult | null> => {
    const current = sequenceRef.current;
    const log = audit;
    if (!current || !log) return null;
    return runVerify(log, current.seq);
  }, [audit]);

  const exportAudit = useCallback(async () => {
    const current = sequenceRef.current;
    const log = audit;
    if (!current || !log) return;
    const verify = await runVerify(log, current.seq);
    downloadText(
      `${current.name.replace(/\s+/g, "_")}-provenance.json`,
      auditReportJson(log, verify, current),
    );
  }, [audit]);

  const value = useMemo(
    () => ({
      sequence,
      selection,
      setSequence,
      setSelection,
      resources,
      addResource,
      removeResource,
      hydrated,
      audit,
      editing,
      editSequence,
      recordAuditNote,
      annotateSelection,
      verifyHistory,
      exportAudit,
    }),
    [sequence, selection, setSequence, resources, addResource, removeResource, hydrated, audit, editing, editSequence, recordAuditNote, annotateSelection, verifyHistory, exportAudit],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return ctx;
}
