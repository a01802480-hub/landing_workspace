"use client";

/**
 * PipelineLogViewer — the live log tail (monospace, dark clinical ink).
 * Text nodes only — log lines are data, never markup.
 */
export function PipelineLogViewer({ lines }: { lines: string[] }) {
  return (
    <div className="h-full overflow-y-auto rounded-lg bg-[#12182b] p-3 font-mono text-[10px] leading-5">
      {lines.length === 0 ? (
        <p className="text-mist/40">Waiting for log output…</p>
      ) : (
        lines.map((line, i) => (
          <p key={`${i}:${line.length}`} className={line.includes("ERROR") ? "text-[#ff8f7d]" : line.includes("INFO") ? "text-[#9fb6e8]" : "text-mist/70"}>
            {line}
          </p>
        ))
      )}
    </div>
  );
}
