import { extractTags } from "../../lib/notes/parse";
import type { Cells } from "../../lib/plugins/types";
import { el } from "../../lib/print/parts";
import { parseCsv, trimCells, writeCsv } from "../../lib/sheets/csv";

/*
 * A spreadsheet note's text: its title on the first line, with its tags (`Budget 2026 #home`), a
 * blank line, then its cells as CSV, formulas and all. Written without the blank line, the cells
 * start on the second line.
 */

export interface SheetText {
  /** The first line, as written. */
  head: string;
  /** Where the cells' CSV starts. */
  dataFrom: number;
  cells: Cells;
}

export function readSheet(body: string): SheetText {
  const headEnd = body.includes("\n") ? body.indexOf("\n") : body.length;
  let dataFrom = Math.min(body.length, headEnd + 1);
  const blankEnd = body.indexOf("\n", dataFrom);
  if (blankEnd >= 0 && !body.slice(dataFrom, blankEnd).trim()) dataFrom = blankEnd + 1;
  return { head: body.slice(0, headEnd), dataFrom, cells: parseCsv(body.slice(dataFrom)) };
}

const TAGS = /(^|\s)#[\p{L}\p{N}_\-/]+/gu;

/** The title as it reads, without its tags. */
export const titleOf = (head: string) => head.replace(TAGS, "$1").replace(/\s+/g, " ").trim();

export const tagsOf = (head: string) => extractTags(head);

/** A spreadsheet note's text, from the first line (title and tags) and its cells. */
export const sheetBody = (head: string, cells: Cells) => `${head}\n\n${writeCsv(cells)}`;

/** Its cells as a CSV file, formulas and all. */
export const sheetCsv = (body: string) => {
  const csv = writeCsv(readSheet(body).cells);
  return csv ? `${csv}\n` : "";
};

/** Its cells without the empty rows and columns at the end. */
export const sheetCells = (body: string) => trimCells(readSheet(body).cells);

const NUMBER = /^[-+]?[$€£¥]?\s*[\d.,]+%?$/;

/** Cells as a printed table, numbers on the right as in the grid; with each cell's element, for what its formula works out to. */
export function printedCells(cells: Cells) {
  const elements = cells.map((row) => row.map((cell) => el("td", NUMBER.test(cell.trim()) ? "doc-number" : "", cell)));
  const table = el("div", "doc-table", el("table", "", el("tbody", "", ...elements.map((row) => el("tr", "", ...row)))));
  return { table, elements };
}
