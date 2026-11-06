import type { Cells } from "../plugins/types";

/*
 * Cells as tables and spreadsheets keep them: rows of what's written in each, formulas included
 * (`=SUM(B2:B4)`). Rows and columns count from 0 here, and from 1 and A as people read them.
 */

/** Column `n` as a spreadsheet names it: A, B… Z, AA, AB… */
export function columnName(n: number): string {
  let name = "";
  for (let rest = n + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  return name;
}

/** A cell as people name it: B4. */
export const cellName = (row: number, column: number) => `${columnName(column)}${row + 1}`;

/** Whether a cell as written is a formula: `=` and something after it. */
export const isFormula = (input: string) => input.length > 1 && input.startsWith("=");

/** The cells with `count` empty rows or columns put in at `at`, or (negative) as many taken out there. */
export function shiftCells(cells: Cells, axis: "row" | "column", at: number, count: number): Cells {
  const splice = (list: string[] | string[][], fill: () => string | string[]) => {
    const copy = [...list];
    if (count > 0) copy.splice(at, 0, ...Array.from({ length: count }, fill));
    else copy.splice(at, -count);
    return copy;
  };
  if (axis === "row") return splice(cells, () => []) as Cells;
  return cells.map((row) => (row.length > at ? (splice(row, () => "") as string[]) : row));
}

/** Where a cell ends up when rows or columns are put in or taken out; null if it's taken out. */
export function shifted(row: number, column: number, axis: "row" | "column", at: number, count: number): [number, number] | null {
  const index = axis === "row" ? row : column;
  if (index < at) return [row, column];
  if (count < 0 && index < at - count) return null;
  return axis === "row" ? [row + count, column] : [row, column + count];
}
