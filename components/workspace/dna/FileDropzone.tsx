"use client";

/**
 * FileDropzone — universal in-browser file parsing.
 *
 * Accepts binary SnapGene (.dna), GenBank (.gb/.gbk), FASTA (.fa/.fasta)
 * and dataframe (.csv/.tsv) files. Parsing runs entirely in the browser
 * via @teselagen/bio-parsers (dynamic import — the heavy parser never
 * loads until a file is dropped); sequence files adapt into the shared
 * viewer state AND register as resources, so the file appears in the
 * global resource sidebar and can be dragged onto the flow canvas.
 * Multi-record FASTA files: record 1 becomes the active sequence, every
 * record becomes a resource. CSV/TSV register as dataframe resources and
 * never touch the active sequence.
 *
 * Fallback path: if the parser library fails to load, FASTA files still
 * parse through the minimal built-in parser; other formats report a
 * designed error instead of failing silently.
 */
import { useCallback, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { parseFileToResources } from "@/lib/resources";
import { useWorkspace } from "@/lib/workspaceStore";

const ACCEPT = ".gb,.gbk,.dna,.fa,.fasta,.txt,.csv,.tsv";

export function FileDropzone({ className = "" }: { className?: string }) {
  const { setSequence, addResource } = useWorkspace();
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
        const { resources, sequence, note } = await parseFileToResources(file);
        for (const r of resources) addResource(r);
        if (sequence) setSequence(sequence);
        setNote(note);
      } catch (e) {
        setError(e instanceof Error ? e.message : "File parsing failed.");
      } finally {
        setBusy(false);
      }
    },
    [setSequence, addResource],
  );

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Upload a sequence or data file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void parseFile(file);
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a file here or click to browse"
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
          {busy ? "Parsing…" : "Drop .gb / .dna / .fa / .csv — parsed in your browser"}
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
