import { locale } from "../../lib/i18n/index.svelte";
import { extractTags } from "../../lib/notes/parse";
import { prefs } from "../../lib/prefs.svelte";
import type { Cells } from "../../lib/plugins/types";
import { el } from "../../lib/print/parts";
import { parseCsv, trimCells, writeCsv } from "../../lib/sheets/csv";
import { type CellLook, cellShown, displayed } from "../../lib/sheets/display";

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

/** The first line, and where the cells' CSV starts. */
export function headOf(body: string): Omit<SheetText, "cells"> {
  const headEnd = body.includes("\n") ? body.indexOf("\n") : body.length;
  let dataFrom = Math.min(body.length, headEnd + 1);
  const blankEnd = body.indexOf("\n", dataFrom);
  if (blankEnd >= 0 && !body.slice(dataFrom, blankEnd).trim()) dataFrom = blankEnd + 1;
  return { head: body.slice(0, headEnd), dataFrom };
}

export function readSheet(body: string): SheetText {
  const { head, dataFrom } = headOf(body);
  return { head, dataFrom, cells: parseCsv(body.slice(dataFrom)) };
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

/** Numbers, money and dates, which line up on the right. */
const NUMBER = /^(?:[-+]?[$€£¥]?\s*[\d.,]+%?|\d{4}-\d{2}-\d{2})$/;

/** How cells show what's in them, as Settings → Editing → Spreadsheets says. */
export const sheetLook = (): CellLook => ({
  dates: prefs.sheetDates,
  money: prefs.sheetMoney,
  negative: prefs.sheetNegative,
  edge: prefs.sheetMoneyEdge,
  currency: prefs.sheetCurrency,
  locale,
});

/** What a cell shows, as the grid draws it: dates, money and numbers below zero as Settings says. */
export const cellLook = (text: string) => cellShown(text, sheetLook());

/** What a cell shows, as text: to copy, or list. */
export const showCell = (text: string) => displayed(text, sheetLook());

/** What a cell shows, read out: with a minus rather than in parentheses, which screen readers may leave unsaid. */
export const spokenCell = (text: string) => displayed(text, { ...sheetLook(), negative: "minus" });

/** What a cell shows, printed as the grid draws it: money's symbol at its left edge, red, and room for a `)` if Settings says so. */
export function printedCell(text: string): Node | string {
  const shown = cellLook(text);
  if (!shown.symbol && !shown.red && !shown.room) return shown.text;
  const symbol = shown.symbol ? [el("span", "doc-symbol", shown.symbol)] : [];
  const room = shown.room ? [el("span", "doc-room", ")")] : [];
  return el("span", shown.red ? "doc-negative" : "", ...symbol, shown.text, ...room);
}

/**
 * Cells as a printed table, numbers on the right as in the grid, shown as `show` says, and its first
 * row or column a header if Settings has them stand out; with each cell's element, for what its
 * formula works out to.
 */
export function printedCells(cells: Cells, show: (text: string) => Node | string = (text) => text) {
  const elements = cells.map((row, r) =>
    row.map((cell, c) => {
      const header = prefs.sheetHeaderRow && r === 0;
      const classes = [NUMBER.test(cell.trim()) && "doc-number", !header && prefs.sheetHeaderColumn && c === 0 && "doc-head"];
      return el(header ? "th" : "td", classes.filter(Boolean).join(" "), show(cell));
    }),
  );
  const table = el("div", "doc-table", el("table", "", el("tbody", "", ...elements.map((row) => el("tr", "", ...row)))));
  return { table, elements };
}
