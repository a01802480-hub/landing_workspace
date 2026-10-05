/**
 * audit.ts — sequence edit operations and the hash-chained provenance log.
 *
 * Every change to the workspace sequence is recorded as an entry carrying
 * the SHA-256 hash of the sequence before and after. The log also keeps a
 * `genesis` snapshot of the ORIGINAL sequence, so verification is a true
 * forward replay: hash the genesis, apply every recorded op, check every
 * before/after hash, then compare against the current sequence. That chain
 * is the researcher's proof that the current construct derives from the
 * imported file through exactly the recorded edits — exportable as a JSON
 * report (the Benchling "export the complete history" pattern).
 */
import type { WorkspaceSequence } from "./sequences";

export type EditOp =
  | { kind: "replace"; start: number; end: number; text: string } // 1-based inclusive; text "" ⇒ delete
  | { kind: "insert"; at: number; text: string }; // insert BEFORE base `at`; at = len+1 appends

export type AuditEntryKind = "load" | "edit" | "assemble" | "digest" | "annotate";

export interface AuditEntry {
  /** Sequence revision AFTER this entry. */
  seq: number;
  ts: number;
  kind: AuditEntryKind;
  summary: string;
  op?: EditOp;
  /** The text the op replaced (capped) — needed for forward replay. */
  originalText?: string;
  lengthBefore: number;
  lengthAfter: number;
  hashBefore: string;
  hashAfter: string;
  hashAlgo: "sha-256" | "fnv1a-32";
}

export interface AuditGenesis {
  ts: number;
  name: string;
  source: string;
  accession?: string;
  /** One snapshot of the ORIGINAL sequence (≤ MAX_PERSIST_BP). */
  seq: string;
  hash: string;
  hashAlgo: "sha-256" | "fnv1a-32";
}

export interface AuditLog {
  genesis: AuditGenesis;
  entries: AuditEntry[];
}

export interface AuditStepReport {
  seq: number;
  kind: AuditEntryKind;
  summary: string;
  ok: boolean;
  detail: string;
}

export interface VerifyResult {
  valid: boolean;
  steps: AuditStepReport[];
  finalHash: string;
  hashAlgo: "sha-256" | "fnv1a-32";
}

export const AUDIT_MAX_ENTRIES = 200;
export const AUDIT_ORIGINAL_TEXT_CAP = 2000;
export const AUDIT_SUMMARY_CAP = 300;

/** IUPAC DNA alphabet the editor accepts (ambiguous bases allowed). */
export const EDIT_ALPHABET_RE = /^[ACGTNRYKMSWBDHV]*$/;

export function normalizeEditText(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase();
}

/** Apply an edit op to a sequence (coordinates clamped to the sequence). */
export function applyEditToSequence(seq: string, op: EditOp): string {
  const len = seq.length;
  if (op.kind === "insert") {
    const at = Math.min(Math.max(1, Math.floor(op.at) || 1), len + 1);
    return seq.slice(0, at - 1) + op.text + seq.slice(at - 1);
  }
  let start = Math.min(Math.max(1, Math.floor(op.start) || 1), len);
  let end = Math.min(Math.max(start, Math.floor(op.end) || start), len);
  return seq.slice(0, start - 1) + op.text + seq.slice(end);
}

/* ── Hashing ──────────────────────────────────────────────────────────────── */

/** FNV-1a 32-bit (hex) — synchronous fallback when crypto.subtle is absent. */
export function fnv1a32(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function hashSequence(seq: string): Promise<{ hash: string; algo: "sha-256" | "fnv1a-32" }> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seq));
      const hash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return { hash, algo: "sha-256" };
    }
  } catch {
    /* subtle unavailable — fall through */
  }
  return { hash: fnv1a32(seq), algo: "fnv1a-32" };
}

/* ── Log construction ─────────────────────────────────────────────────────── */

export async function makeGenesis(seq: WorkspaceSequence): Promise<AuditGenesis> {
  const { hash, algo } = await hashSequence(seq.seq);
  return {
    ts: Date.now(),
    name: seq.name,
    source: seq.source,
    accession: seq.accession,
    seq: seq.seq,
    hash,
    hashAlgo: algo,
  };
}

export async function appendAuditEntry(log: AuditLog, entry: AuditEntry): Promise<AuditLog> {
  const entries = [...log.entries, entry];
  if (entries.length > AUDIT_MAX_ENTRIES) entries.splice(0, entries.length - AUDIT_MAX_ENTRIES);
  return { genesis: log.genesis, entries };
}

/* ── Verification ─────────────────────────────────────────────────────────── */

/**
 * Forward replay: hash the genesis snapshot, apply each recorded op, check
 * every before/after hash, and finally compare against the current
 * sequence. A green result means the current sequence provably derives
 * from the imported file through exactly these edits.
 */
export async function verifyHistory(log: AuditLog, currentSeq: string): Promise<VerifyResult> {
  const steps: AuditStepReport[] = [];

  const { hash: genesisHash, algo } = await hashSequence(log.genesis.seq);
  let seq = log.genesis.seq;
  let prevHash = log.genesis.hash;
  let valid = true;

  if (genesisHash !== log.genesis.hash) {
    valid = false;
    steps.push({
      seq: 0,
      kind: "load",
      summary: "genesis snapshot",
      ok: false,
      detail: `genesis hash mismatch (recomputed ${genesisHash.slice(0, 12)}… vs recorded ${log.genesis.hash.slice(0, 12)}…)`,
    });
  }

  for (const entry of log.entries) {
    if (entry.hashBefore !== prevHash) {
      valid = false;
      steps.push({
        seq: entry.seq,
        kind: entry.kind,
        summary: entry.summary,
        ok: false,
        detail: `hash-before does not chain onto the previous state (${entry.hashBefore.slice(0, 12)}… ≠ ${prevHash.slice(0, 12)}…)`,
      });
    }
    if (entry.op) {
      // The op itself is the full replay information (originalText is
      // retained as extra evidence, but inserts legitimately replace
      // nothing).
      seq = applyEditToSequence(seq, entry.op);
      const { hash: after } = await hashSequence(seq);
      if (seq.length !== entry.lengthAfter || after !== entry.hashAfter) {
        valid = false;
        steps.push({
          seq: entry.seq,
          kind: entry.kind,
          summary: entry.summary,
          ok: false,
          detail: `replay mismatch (length ${seq.length} vs ${entry.lengthAfter}; hash ${after.slice(0, 12)}… vs ${entry.hashAfter.slice(0, 12)}…)`,
        });
      } else {
        steps.push({ seq: entry.seq, kind: entry.kind, summary: entry.summary, ok: true, detail: "replayed cleanly" });
      }
    } else {
      // No-op entries (digest/annotate) must not change the sequence.
      if (entry.hashBefore !== entry.hashAfter || entry.hashAfter !== prevHash) {
        valid = false;
        steps.push({
          seq: entry.seq,
          kind: entry.kind,
          summary: entry.summary,
          ok: false,
          detail: "no-op entry claims a sequence change",
        });
      } else {
        steps.push({ seq: entry.seq, kind: entry.kind, summary: entry.summary, ok: true, detail: "no sequence change" });
      }
    }
    prevHash = entry.hashAfter;
  }

  const { hash: finalHash } = await hashSequence(currentSeq);
  if (finalHash !== prevHash) {
    valid = false;
    steps.push({
      seq: 0,
      kind: "edit",
      summary: "current sequence",
      ok: false,
      detail: `the current sequence does not match the logged final state (${finalHash.slice(0, 12)}… ≠ ${prevHash.slice(0, 12)}…)`,
    });
  }

  return { valid, steps, finalHash, hashAlgo: algo };
}

/** The exportable provenance report (JSON). */
export function auditReportJson(log: AuditLog, verify: VerifyResult, currentSeq: WorkspaceSequence): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      sequence_name: currentSeq.name,
      accession: currentSeq.accession ?? null,
      current_length: currentSeq.seq.length,
      current_topology: currentSeq.circular ? "circular" : "linear",
      verification: { valid: verify.valid, final_hash: verify.finalHash, hash_algo: verify.hashAlgo, steps: verify.steps },
      genesis: log.genesis,
      entries: log.entries,
    },
    null,
    2,
  );
}

/* ── Restore gate ─────────────────────────────────────────────────────────── */

const ENTRY_KINDS = new Set(["load", "edit", "assemble", "digest", "annotate"]);

export function validateAuditLog(value: unknown): AuditLog | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<AuditLog>;
  const g = v.genesis as Partial<AuditGenesis> | undefined;
  if (!g || typeof g.seq !== "string" || typeof g.hash !== "string" || typeof g.ts !== "number") return null;
  if (!/^[A-Za-z]+$/.test(g.seq.replace(/\s+/g, ""))) return null;
  if (!Array.isArray(v.entries)) return null;

  const entries: AuditEntry[] = [];
  for (const raw of v.entries.slice(0, AUDIT_MAX_ENTRIES)) {
    if (typeof raw !== "object" || raw === null) return null;
    const e = raw as Partial<AuditEntry>;
    if (
      typeof e.seq !== "number" ||
      typeof e.ts !== "number" ||
      typeof e.kind !== "string" ||
      !ENTRY_KINDS.has(e.kind) ||
      typeof e.summary !== "string" ||
      typeof e.hashBefore !== "string" ||
      typeof e.hashAfter !== "string" ||
      typeof e.lengthBefore !== "number" ||
      typeof e.lengthAfter !== "number"
    ) {
      return null;
    }
    const op = e.op as EditOp | undefined;
    if (op !== undefined && (op.kind !== "replace" && op.kind !== "insert")) return null;
    entries.push({
      seq: e.seq,
      ts: e.ts,
      kind: e.kind as AuditEntryKind,
      summary: e.summary.slice(0, AUDIT_SUMMARY_CAP),
      op,
      originalText: typeof e.originalText === "string" ? e.originalText.slice(0, AUDIT_ORIGINAL_TEXT_CAP) : undefined,
      lengthBefore: e.lengthBefore,
      lengthAfter: e.lengthAfter,
      hashBefore: e.hashBefore,
      hashAfter: e.hashAfter,
      hashAlgo: e.hashAlgo === "fnv1a-32" ? "fnv1a-32" : "sha-256",
    });
  }

  return {
    genesis: {
      ts: g.ts,
      name: typeof g.name === "string" ? g.name.slice(0, 120) : "sequence",
      source: typeof g.source === "string" ? (g.source as AuditGenesis["source"]) : "file",
      accession: typeof g.accession === "string" ? g.accession.slice(0, 40) : undefined,
      seq: g.seq.toUpperCase(),
      hash: g.hash,
      hashAlgo: g.hashAlgo === "fnv1a-32" ? "fnv1a-32" : "sha-256",
    },
    entries,
  };
}
