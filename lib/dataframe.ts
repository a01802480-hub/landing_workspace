/**
 * dataframe.ts — in-browser CSV/TSV parsing into the resource registry's
 * dataframe shape. Delimiter sniffing (tab wins when the header has one),
 * quote-aware splitting, and strict caps so localStorage persistence and
 * the DAG payload stay bounded.
 */
export const DF_MAX_COLUMNS = 50;
export const DF_MAX_ROWS = 2000;
export const DF_MAX_CELL = 200;
export const DF_MAX_CELLS = 100_000;

export interface ParsedDataframe {
  name: string;
  columns: string[];
  rows: string[][];
}

/** Split one CSV/TSV line, honoring double-quoted fields ("a,b", "" → "). */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function parseDataframe(file: File): Promise<ParsedDataframe> {
  const text = await file.text();
  if (!text.trim()) throw new Error(`${file.name} is empty.`);
  const nl = text.indexOf("\n");
  const firstLine = nl >= 0 ? text.slice(0, nl) : text;
  const sep = firstLine.includes("\t") ? "\t" : ",";

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const columns = splitLine(lines[0], sep)
    .map((c) => c.trim().slice(0, DF_MAX_CELL))
    .slice(0, DF_MAX_COLUMNS);
  if (columns.length === 0 || columns.every((c) => !c)) {
    throw new Error(`${file.name} has no header row.`);
  }
  const rows = lines
    .slice(1, DF_MAX_ROWS + 1)
    .map((l) => splitLine(l, sep).map((c) => c.trim().slice(0, DF_MAX_CELL)).slice(0, columns.length));
  if (rows.length * columns.length > DF_MAX_CELLS) {
    throw new Error(
      `${file.name} is too large for the workspace (cap ${DF_MAX_CELLS.toLocaleString()} cells).`,
    );
  }
  return { name: file.name.replace(/\.[^.]+$/, ""), columns, rows };
}
