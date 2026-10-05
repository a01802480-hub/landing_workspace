/**
 * resources.ts — the IDE's global resource registry.
 *
 * Every imported file becomes a resource: sequences (.gb/.dna), raw FASTA
 * records and dataframes (CSV/TSV). Resources feed the left sidebar and
 * are draggable onto the flow canvas to create input nodes — the
 * "unlimited inputs" half of the ProtoFlow-style builder. The active
 * workspace sequence (lib/workspaceStore) is independent: registering a
 * resource never changes it; activating is an explicit call.
 *
 * Persistence: resources are localStorage-backed with strict restore
 * validation (localStorage is untrusted input). Sequence payloads over
 * MAX_PERSIST_BP and oversized dataframes are stored metadata-only.
 */
import { fastaToViewer, teselagenToViewer, type WorkspaceSequence } from "@/lib/sequences";
import { parseDataframe, DF_MAX_CELLS } from "@/lib/dataframe";

export type ResourceKind = "sequence" | "fasta" | "dataframe";

export interface DataframeData {
  columns: string[];
  rows: string[][];
}

export interface Resource {
  id: string;
  kind: ResourceKind;
  name: string;
  createdAt: number;
  /** Sequence payload (sequence/fasta kinds). Undefined after restore when
   *  the payload exceeded the persistence cap — the sidebar badges it. */
  payload?: WorkspaceSequence;
  dataframe?: DataframeData;
}

/** Drag-and-drop MIME: a resource id, set by the sidebar, consumed by the
 *  flow canvas to spawn an input node. */
export const RESOURCE_DROP_MIME = "application/protheon-resource";

export const MAX_PERSIST_BP = 100_000;
export const MAX_RESOURCES = 20;
export const MAX_DATAFRAME_CELLS = DF_MAX_CELLS;

const RESOURCE_KINDS = new Set<ResourceKind>(["sequence", "fasta", "dataframe"]);

/* ── Restore validation ───────────────────────────────────────────────────── */

/** Validate a persisted WorkspaceSequence (the store's restore gate). */
export function validateSequencePayload(value: unknown): WorkspaceSequence | null {
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
    description: typeof v.description === "string" ? v.description.slice(0, 500) : undefined,
    revision: typeof v.revision === "number" && Number.isInteger(v.revision) && v.revision >= 0 ? v.revision : 0,
  };
}

/** Validate a persisted dataframe payload against the caps. */
export function validateDataframePayload(value: unknown): DataframeData | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<DataframeData>;
  if (!Array.isArray(v.columns) || !Array.isArray(v.rows)) return null;
  const columns = v.columns
    .slice(0, 50)
    .map((c) => (typeof c === "string" ? c.slice(0, 200) : ""));
  if (columns.length === 0) return null;
  const rows = v.rows.slice(0, 2000).map((r) =>
    Array.isArray(r)
      ? r.slice(0, columns.length).map((c) => (typeof c === "string" ? c.slice(0, 200) : ""))
      : columns.map(() => ""),
  );
  if (rows.length * columns.length > MAX_DATAFRAME_CELLS) return null;
  return { columns, rows };
}

/** Validate one persisted resource. Payloads that fail (size/corruption)
 *  restore metadata-only rather than killing the whole registry. */
export function validateResource(value: unknown): Resource | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<Resource>;
  if (typeof v.id !== "string" || !v.id || v.id.length > 80) return null;
  if (typeof v.kind !== "string" || !(RESOURCE_KINDS as Set<string>).has(v.kind)) return null;
  if (typeof v.name !== "string") return null;
  const base = {
    id: v.id,
    kind: v.kind as ResourceKind,
    name: v.name.slice(0, 120),
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
  };
  if (v.kind === "dataframe") {
    const dataframe = v.dataframe === undefined ? undefined : validateDataframePayload(v.dataframe);
    return dataframe ? { ...base, dataframe } : { ...base };
  }
  const payload = v.payload === undefined ? undefined : validateSequencePayload(v.payload);
  return payload ? { ...base, payload } : { ...base };
}

/** Serialize a resource for persistence — oversized payloads become
 *  metadata-only (the in-memory resource keeps its full payload). */
export function resourceForStorage(r: Resource): Resource {
  if (r.kind === "dataframe") {
    const cells = r.dataframe ? r.dataframe.rows.length * r.dataframe.columns.length : 0;
    return cells > MAX_DATAFRAME_CELLS ? { ...r, dataframe: undefined } : r;
  }
  return r.payload && r.payload.seq.length > MAX_PERSIST_BP ? { ...r, payload: undefined } : r;
}

/* ── Construction ─────────────────────────────────────────────────────────── */

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeResource(
  kind: ResourceKind,
  name: string,
  extra: { payload?: WorkspaceSequence; dataframe?: DataframeData },
): Resource {
  return { id: newId(), kind, name: name.slice(0, 120), createdAt: Date.now(), ...extra };
}

/* ── The shared file parser ───────────────────────────────────────────────── */

export interface ParsedFileResult {
  resources: Resource[];
  /** The sequence to activate (first record of sequence files); null for dataframes. */
  sequence: WorkspaceSequence | null;
  note: string;
}

/**
 * Parse one dropped file into resources — the single import pipeline for
 * the FileDropzone, the ResourceSidebar drop target and OS file drops on
 * the flow canvas.
 *
 * - CSV/TSV → one dataframe resource (never activates a sequence)
 * - .gb/.gbk/.dna/.fa/.fasta → bio-parsers (`anyToJson`, dynamic import);
 *   multi-record files: record 1 → a `sequence` resource + active
 *   sequence, records 2+ → `fasta` resources
 * - FASTA fallback: the minimal built-in parser when bio-parsers is
 *   unavailable or rejects the file
 */
export async function parseFileToResources(file: File): Promise<ParsedFileResult> {
  const name = file.name;

  if (/\.(csv|tsv)$/i.test(name)) {
    const df = await parseDataframe(file);
    return {
      resources: [makeResource("dataframe", df.name, { dataframe: df })],
      sequence: null,
      note: `${df.name} · ${df.rows.length.toLocaleString()} rows × ${df.columns.length} columns`,
    };
  }

  const looksFasta = /\.(fa|fasta|txt)$/i.test(name);
  let records: { sequence?: string; [key: string]: unknown }[] | null = null;
  try {
    const mod = await import("@teselagen/bio-parsers");
    const result = await mod.anyToJson(file, { fileName: name });
    // anyToJson returns [{parsedSequence: SequenceData, success, messages}]
    // — the flattened TeselaGen schema lives inside `.parsedSequence`.
    records = (Array.isArray(result) ? result : [result])
      .filter((r): r is { parsedSequence: { sequence?: unknown } } => !!r && r.success !== false && !!r.parsedSequence)
      .map((r) => r.parsedSequence as { sequence?: string; [key: string]: unknown })
      .filter((p) => typeof p.sequence === "string" && p.sequence.length > 0);
  } catch (e) {
    // Library unavailable or format rejected — fall through to the minimal
    // FASTA parser for text formats only.
    if (!looksFasta) {
      throw new Error(`Could not parse ${name} — unsupported or malformed file.`);
    }
    console.warn("[protheon] bio-parsers unavailable, falling back to the built-in FASTA parser:", e);
  }

  if (!records || records.length === 0) {
    const text = await file.text();
    const parsed = fastaToViewer(text, name.replace(/\.[^.]+$/, ""));
    return {
      resources: [makeResource("fasta", parsed.name, { payload: parsed })],
      sequence: parsed,
      note: `${parsed.name} · ${parsed.seq.length.toLocaleString()} bp`,
    };
  }

  const parsed = records.map((r) => teselagenToViewer(r));
  const first = parsed[0];
  const resources = parsed.map((p, i) =>
    makeResource(i === 0 ? "sequence" : "fasta", p.name, { payload: p }),
  );
  const note =
    parsed.length > 1
      ? `${name} · ${parsed.length} records · ${first.seq.length.toLocaleString()} bp (first record active)`
      : `${first.name} · ${first.seq.length.toLocaleString()} bp · ${first.features.length} features · ${
          first.circular ? "circular" : "linear"
        }`;
  return { resources, sequence: first, note };
}
