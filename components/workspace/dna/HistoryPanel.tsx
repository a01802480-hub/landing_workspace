"use client";

/**
 * HistoryPanel — the provenance surface (Benchling's History tab).
 *
 * Lists every audit entry (newest first) with the before→after hashes,
 * verifies the whole chain by forward replay (lib/audit.verifyHistory)
 * and exports the provenance report as JSON — the researcher's proof that
 * the current construct derives from the imported file through exactly
 * the recorded edits.
 */
import { useCallback, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import type { VerifyResult } from "@/lib/audit";
import { useWorkspace } from "@/lib/workspaceStore";
import { StatusDot } from "@/components/workspace/shell/StatusDot";

const KIND_LABEL: Record<string, string> = {
  load: "import",
  edit: "edit",
  assemble: "assemble",
  digest: "digest",
  annotate: "annotate",
};

export function HistoryPanel() {
  const { audit, verifyHistory, exportAudit, editing } = useWorkspace();
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  const runVerify = useCallback(async () => {
    setBusy(true);
    try {
      setVerify(await verifyHistory());
    } finally {
      setBusy(false);
    }
  }, [verifyHistory]);

  if (!audit) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-xs leading-relaxed text-mist/70">
          No edits recorded yet — the provenance log begins with the first edit or annotation.
        </p>
      </div>
    );
  }

  const failing = verify?.steps.filter((s) => !s.ok).length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-frost">History</h3>
        <span className="stat-num text-[9px] text-mist/60">
          {audit.entries.length} entr{audit.entries.length === 1 ? "y" : "ies"}
        </span>
      </div>

      <p className="text-[9px] leading-relaxed text-mist/60">
        genesis <span className="font-mono">{audit.genesis.hash.slice(0, 12)}…</span> · {audit.genesis.name} ·{" "}
        {audit.genesis.hashAlgo}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void runVerify()}
          disabled={busy || editing}
          className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px] disabled:opacity-40"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> {busy ? "Verifying…" : "Verify chain"}
        </button>
        <button
          type="button"
          onClick={() => void exportAudit()}
          disabled={busy || editing}
          className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-[11px] disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Export report
        </button>
      </div>

      {verify && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border p-2.5 text-[10px] leading-relaxed ${
            verify.valid ? "border-[#0ca30c]/30 bg-[#0ca30c]/5 text-[#0ca30c]" : "border-[#c13b3b]/30 bg-[#c13b3b]/5 text-[#c13b3b]"
          }`}
        >
          <StatusDot className={verify.valid ? "bg-[#0ca30c]" : "bg-[#c13b3b]"} />
          <span>
            {verify.valid
              ? `verified — ${verify.steps.length} step${verify.steps.length === 1 ? "" : "s"} replay cleanly · final ${verify.hashAlgo} ${verify.finalHash.slice(0, 12)}…`
              : `${failing} step${failing === 1 ? "" : "s"} failed verification — see the details below.`}
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {[...audit.entries].reverse().map((entry) => {
          const step = verify?.steps.find((s) => s.seq === entry.seq && s.summary === entry.summary);
          return (
            <li key={`${entry.seq}-${entry.ts}`} className="rounded-lg border border-ink-950/5 bg-white/70 p-2">
              <div className="flex items-center gap-2">
                <span className="chip !py-0.5 text-[9px]">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
                <span className="stat-num text-[9px] text-mist/60">rev {entry.seq}</span>
                <span className="ml-auto text-[9px] text-mist/50">
                  {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-frost/85">{entry.summary}</p>
              <p className="stat-num mt-0.5 font-mono text-[9px] text-mist/60">
                {entry.lengthBefore.toLocaleString()} → {entry.lengthAfter.toLocaleString()} bp ·{" "}
                {entry.hashBefore.slice(0, 10)}… → {entry.hashAfter.slice(0, 10)}…
              </p>
              {step && !step.ok && (
                <p className="mt-0.5 text-[9px] leading-relaxed text-[#c13b3b]">{step.detail}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
