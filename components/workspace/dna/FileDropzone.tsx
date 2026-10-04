"use client";

/**
 * FileDropzone — universal in-browser file parsing.
 *
 * Accepts binary SnapGene (.dna), GenBank (.gb/.gbk) and FASTA (.fa/.fasta)
 * files. Parsing runs entirely in the browser via @teselagen/bio-parsers
 * (dynamic import — the heavy parser never loads until a file is dropped);
 * the result is adapted into the shared viewer state and handed to the
 * workspace store, which the seqviz canvas, feature table, properties
 * sidebar and flow builder all read.
 *
 * Fallback path: if the parser library fails to load, FASTA files still
 * parse through the minimal built-in parser; other formats report a
 * designed error instead of failing silently.
 */
import { useCallback, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { fastaToViewer, teselagenToViewer, type WorkspaceSequence } from "@/lib/sequences";
import { useWorkspace } from "@/lib/workspaceStore";

const ACCEPT = ".gb,.gbk,.dna,.fa,.fasta,.txt";

export function FileDropzone({ className = "" }: { className?: string }) {
  const { setSequence } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const parseFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        let parsed: WorkspaceSequence | null = null;
        const looksFasta = /\.(fa|fasta|txt)$/i.test(file.name);

        // Heavy path: bio-parsers handles .gb / .gbk / .dna (binary SnapGene
        // included) and FASTA alike. The universal entry is `anyToJson`
        // (dispatches on file extension; reads File objects itself).
        try {
          const mod = await import("@teselagen/bio-parsers");
          const result = await mod.anyToJson(file, { fileName: file.name });
          const first = Array.isArray(result) ? result[0] : result;
          if (first && typeof first.sequence === "string" && first.sequence.length > 0) {
            parsed = teselagenToViewer(first);
          }
        } catch (e) {
          // Library unavailable or format rejected — fall through to the
          // minimal FASTA parser for text formats only.
          if (!looksFasta) {
            setError(
              e instanceof Error && e.message
                ? `Could not parse ${file.name}: ${e.message}`
                : `Could not parse ${file.name} — unsupported or malformed file.`,
            );
            return;
          }
        }

        if (!parsed) {
          const text = await file.text();
          parsed = fastaToViewer(text, file.name.replace(/\.[^.]+$/, ""));
        }

        setSequence(parsed);
        setNote(
          `${file.name} · ${parsed.seq.length.toLocaleString()} bp · ${parsed.features.length} features · ${
            parsed.circular ? "circular" : "linear"
          }`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "File parsing failed.");
      } finally {
        setBusy(false);
      }
    },
    [setSequence],
  );

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Upload a sequence file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void parseFile(file);
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a sequence file here or click to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void parseFile(file);
        }}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors duration-300 ease-out ${
          dragging
            ? "border-glow-violet/60 bg-glow-violet/10 text-frost"
            : "border-ink-950/20 text-mist hover:border-glow-violet/40 hover:text-frost"
        }`}
      >
        {busy ? <FileUp className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
        <span className="min-w-0">
          {busy ? "Parsing…" : "Drop .gb / .dna / .fa — parsed in your browser"}
        </span>
      </div>
      {note && <p className="mt-1.5 text-[10px] text-[#0ca30c]">{note}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[10px] leading-relaxed text-[#c13b3b]">
          {error}
        </p>
      )}
    </div>
  );
}
