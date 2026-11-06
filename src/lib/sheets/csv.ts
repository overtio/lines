import type { Cells } from "../plugins/types";

/*
 * CSV, as spreadsheet apps write it (RFC 4180): cells between commas, in double quotes when they
 * hold a comma, a quote ("" inside), a line break, or spaces at either end. Reading is forgiving of
 * what other apps and people write: \r\n or \r line breaks, a byte order mark, semicolons (Excel
 * in much of Europe) or tabs, and spaces after the commas (`Rent, 1200`), which are left out.
 */

const DELIMITERS = [",", ";", "\t"] as const;

const SPACES = /^[ \t]*$/;
const AROUND = /^[ \t]+|[ \t]+$/g;

/** Reads CSV text into rows of cells. */
export function parseCsv(text: string, delimiter = ","): Cells {
  const rows: Cells = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  /** Whether the cell is in quotes, which keep its spaces; without, those around its text are left out (and after quotes, those before the next comma). */
  let inQuotes = false;
  const end = () => {
    row.push(inQuotes ? cell : cell.replace(AROUND, ""));
    cell = "";
    inQuotes = false;
  };
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (i === text.length) return rows;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') cell += text[++i];
      else quoted = false;
    } else if (ch === '"' && !inQuotes && SPACES.test(cell)) {
      quoted = inQuotes = true;
      cell = "";
    } else if (ch === delimiter) end();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      end();
      rows.push(row);
      row = [];
    } else if (!inQuotes || (ch !== " " && ch !== "\t")) cell += ch;
  }
  // The line break after the last row ends it; it doesn't start another.
  if (cell || row.length || inQuotes) {
    end();
    rows.push(row);
  }
  return rows;
}

/** The delimiter a file uses, of comma, semicolon and tab: the one its first lines have the same number of. */
export function sniffDelimiter(text: string): string {
  const lines = text.split(/\r\n?|\n/, 20).filter((line) => line.trim());
  let best: string = ",";
  let score = 0;
  for (const delimiter of DELIMITERS) {
    // Outside quotes only.
    const counts = lines.map((line) => line.replace(/"[^"]*"/g, "").split(delimiter).length - 1);
    const steady = counts.filter((count) => count > 0 && count === counts[0]).length;
    if (counts[0] > 0 && steady > score) [best, score] = [delimiter, steady];
  }
  return best;
}

/** Without the empty rows and columns at its end. */
export function trimCells(cells: Cells): Cells {
  let rows = cells.length;
  while (rows && cells[rows - 1].every((cell) => !cell)) rows--;
  let columns = 0;
  for (let r = 0; r < rows; r++) {
    const row = cells[r];
    for (let c = row.length; c > columns; c--) if (row[c - 1]) columns = c;
  }
  return cells.slice(0, rows).map((row) => Array.from({ length: columns }, (_, c) => row[c] ?? ""));
}

function quote(cell: string, delimiter: string) {
  return cell.includes(delimiter) || /["\r\n]|^\s|\s$/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** Writes cells as CSV (or with another delimiter), every row as wide as the widest, without empty rows or columns at the end. */
export function writeCsv(cells: Cells, delimiter = ","): string {
  return trimCells(cells)
    .map((row) => row.map((cell) => quote(cell, delimiter)).join(delimiter))
    .join("\n");
}
