/**
 * export.ts — single implementation of client-side file downloads.
 * Every CSV/FASTA export in the workspace routes through here (the PAE
 * heatmap, digest gel, kinetics, dose–response, FASTA button…).
 */

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Detached-anchor click works in every browser and never touches
  // React-managed DOM.
  document.body.appendChild(a);
  a.click();
  try {
    document.body.removeChild(a);
  } catch {
    /* already removed — ignore */
  }
  URL.revokeObjectURL(url);
}

/** Download a UTF-8 text file (FASTA, logs, JSON). */
export function downloadText(filename: string, content: string): void {
  downloadBlob(filename, new Blob([content], { type: "text/plain;charset=utf-8" }));
}

/**
 * Download rows as CSV. Cells are stringified; commas/quotes/newlines are
 * escaped per RFC 4180.
 */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (cell: string | number): string => {
    const s = String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((row) => row.map(escape).join(",")).join("\n");
  downloadBlob(filename, new Blob([body], { type: "text/csv;charset=utf-8" }));
}
