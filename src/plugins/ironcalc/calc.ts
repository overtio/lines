import init, { columnNameFromNumber, getAllTimezones, getTokens, type MarkedToken, Model } from "@ironcalc/wasm-xlsx";
import wasm from "@ironcalc/wasm-xlsx/wasm_bg.wasm?url";
import { trimCells } from "../../lib/sheets/csv";
import { isFormula, shiftCells, shifted } from "../../lib/sheets/cells";
import type { CellValue, Cells, FormulaCompletion, FormulaFunction, FormulaReference, FormulaSheet } from "../../lib/plugins/types";
import { FUNCTIONS } from "./functions";

/*
 * IronCalc, loaded the first time a note has a formula: a spreadsheet engine in Rust, compiled to
 * WebAssembly. Formulas are read in English with commas between arguments, as in a CSV file or an
 * Excel workbook, whatever the app's language, so a note works out the same on every device.
 */

const MAX_ROW = 1_048_576;
const MAX_COLUMN = 16_384;
const EMPTY: CellValue = { text: "", kind: "empty" };
const KINDS: Record<number, CellValue["kind"]> = { 1: "number", 2: "text", 4: "boolean", 16: "error" };

let timezone = "UTC";

export async function start() {
  await init({ module_or_path: wasm });
  // TODAY() and NOW() as here.
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (getAllTimezones().includes(here)) timezone = here;
}

const newModel = () => new Model("lines", "en", timezone, "en");

/** Sets cells, rows and columns from 1, without working anything out until `evaluate()`. */
function fill(model: Model, cells: Cells, only?: (input: string) => boolean) {
  model.pauseEvaluation();
  cells.forEach((row, r) =>
    row.forEach((input, c) => {
      if (input && (!only || only(input))) setInput(model, r, c, input);
    }),
  );
  model.resumeEvaluation();
}

function setInput(model: Model, row: number, column: number, input: string) {
  try {
    model.setUserInput(0, row + 1, column + 1, input);
  } catch {
    // What IronCalc can't take in shows as text.
    model.setUserInput(0, row + 1, column + 1, `'${input}`);
  }
}

class Sheet implements FormulaSheet {
  #model = newModel();
  #cells: Cells = [];

  update(cells: Cells) {
    const before = this.#cells;
    let changed = false;
    this.#model.pauseEvaluation();
    for (let r = 0; r < Math.max(before.length, cells.length); r++) {
      const was = before[r] ?? [];
      const now = cells[r] ?? [];
      if (was === now) continue;
      for (let c = 0; c < Math.max(was.length, now.length); c++) {
        const input = now[c] ?? "";
        if ((was[c] ?? "") === input) continue;
        changed = true;
        // Formats included: "$5" makes a cell show money, and 5 written over it later shouldn't.
        this.#model.rangeClearAll(0, r + 1, c + 1, r + 1, c + 1);
        if (input) setInput(this.#model, r, c, input);
      }
    }
    this.#model.resumeEvaluation();
    if (changed) this.#model.evaluate();
    this.#cells = cells;
  }

  value(row: number, column: number): CellValue {
    if (row >= MAX_ROW || column >= MAX_COLUMN) return EMPTY;
    const text = this.#model.getFormattedCellValue(0, row + 1, column + 1);
    return text ? { text, kind: KINDS[this.#model.getCellType(0, row + 1, column + 1)] ?? "text" } : EMPTY;
  }

  free() {
    this.#model.free();
  }
}

export const sheet = (): FormulaSheet => new Sheet();

export function shift(cells: Cells, axis: "row" | "column", at: number, count: number): Cells {
  const model = newModel();
  try {
    // References don't need what they point at, only the formulas.
    fill(model, cells, isFormula);
    const formulas: { row: number; column: number; before: string }[] = [];
    cells.forEach((row, r) =>
      row.forEach((input, c) => {
        if (isFormula(input)) formulas.push({ row: r, column: c, before: model.getCellContent(0, r + 1, c + 1) });
      }),
    );
    const n = Math.abs(count);
    if (axis === "row") {
      if (count > 0) model.insertRows(0, at + 1, n);
      else model.deleteRows(0, at + 1, n);
    } else if (count > 0) model.insertColumns(0, at + 1, n);
    else model.deleteColumns(0, at + 1, n);
    const moved = shiftCells(cells, axis, at, count).map((row) => [...row]);
    for (const { row, column, before } of formulas) {
      const to = shifted(row, column, axis, at, count);
      if (!to) continue;
      const after = model.getCellContent(0, to[0] + 1, to[1] + 1);
      // Formulas whose references didn't change stay as they were written.
      if (after !== before) moved[to[0]][to[1]] = after;
    }
    return moved;
  } finally {
    model.free();
  }
}

type Corner = { row: number; column: number; absolute_row: boolean; absolute_column: boolean };

/** A reference copied `rows` down and `columns` across; null when that's off the sheet. */
function moveCorner(corner: Corner, rows: number, columns: number): Corner | null {
  const row = corner.absolute_row ? corner.row : corner.row + rows;
  const column = corner.absolute_column ? corner.column : corner.column + columns;
  return row < 1 || column < 1 || row > MAX_ROW || column > MAX_COLUMN ? null : { ...corner, row, column };
}

const columnText = (corner: Corner) => (corner.absolute_column ? "$" : "") + columnNameFromNumber(corner.column);
const rowText = (corner: Corner) => (corner.absolute_row ? "$" : "") + corner.row;
const cornerText = (corner: Corner) => columnText(corner) + rowText(corner);

/** A reference or range token's text copied elsewhere, keeping its sheet as written; null if it isn't one. */
function movedToken({ token }: MarkedToken, written: string, rows: number, columns: number): string | null {
  if (typeof token !== "object") return null;
  const sheet = written.slice(0, written.lastIndexOf("!") + 1);
  if ("Reference" in token) {
    const moved = moveCorner(token.Reference, rows, columns);
    return moved ? sheet + cornerText(moved) : "#REF!";
  }
  if (!("Range" in token)) return null;
  const { left, right } = token.Range;
  const [from, to] = [moveCorner(left, rows, columns), moveCorner(right, rows, columns)];
  if (!from || !to) return "#REF!";
  // Whole columns (A:B) and whole rows (1:3) stay that way.
  if (left.row === 1 && right.row === MAX_ROW && left.absolute_row && right.absolute_row) return `${sheet}${columnText(from)}:${columnText(to)}`;
  if (left.column === 1 && right.column === MAX_COLUMN && left.absolute_column && right.absolute_column) return `${sheet}${rowText(from)}:${rowText(to)}`;
  return `${sheet}${cornerText(from)}:${cornerText(to)}`;
}

export function move(formula: string, rows: number, columns: number): string {
  if (!isFormula(formula) || (!rows && !columns)) return formula;
  // Token positions count characters, not UTF-16 units.
  const chars = Array.from(formula);
  let out = "";
  let at = 0;
  for (const marked of getTokens(formula)) {
    const written = chars.slice(marked.start, marked.end).join("");
    const text = movedToken(marked, written, rows, columns);
    if (text === null) continue;
    out += chars.slice(at, marked.start).join("") + text;
    at = marked.end;
  }
  return out + chars.slice(at).join("");
}

/** Where the `n`th character of a formula is, in UTF-16 units: IronCalc counts characters. */
const unitsTo = (chars: string[], n: number) => chars.slice(0, n).join("").length;

/** For what doesn't need a sheet's cells: suggestions while writing a formula. */
let scratch: Model | undefined;

export function complete(formula: string, cursor: number): FormulaCompletion {
  const chars = Array.from(formula);
  let found;
  try {
    scratch ??= newModel();
    found = scratch.getFormulaCompletion(0, 1, 1, formula, Array.from(formula.slice(0, cursor)).length);
  } catch {
    return { reference: false };
  }
  const completion: FormulaCompletion = { reference: found.expecting.includes("Range") };
  // Its places count from after the `=`.
  const after = formula.startsWith("=") ? 1 : 0;
  for (const expected of found.expecting) {
    if (typeof expected !== "object") continue;
    if ("FunctionName" in expected) completion.name = { typed: expected.FunctionName, from: unitsTo(chars, found.replace_from + after) };
    else completion.argument = { name: expected.Argument[0], index: expected.Argument[1] - 1 };
  }
  return completion;
}

export function references(formula: string): FormulaReference[] {
  if (!isFormula(formula)) return [];
  const chars = Array.from(formula);
  let tokens: MarkedToken[];
  try {
    tokens = getTokens(formula);
  } catch {
    return [];
  }
  return tokens.flatMap(({ token, start, end }) => {
    if (typeof token !== "object") return [];
    let corners;
    if ("Reference" in token && !token.Reference.sheet) corners = [token.Reference, token.Reference];
    else if ("Range" in token && !token.Range.sheet) corners = [token.Range.left, token.Range.right];
    else return [];
    const [a, b] = corners;
    return [
      {
        from: unitsTo(chars, start),
        to: unitsTo(chars, end),
        top: Math.min(a.row, b.row) - 1,
        left: Math.min(a.column, b.column) - 1,
        bottom: Math.max(a.row, b.row) - 1,
        right: Math.max(a.column, b.column) - 1,
      },
    ];
  });
}

let catalog: FormulaFunction[] | undefined;

export const functions = () =>
  (catalog ??= FUNCTIONS.map(([name, about, args]) => ({
    name,
    about,
    args: args.map(([arg, argAbout]) => ({
      name: arg === "..." ? "…" : arg.replace(/\*$/, ""),
      about: argAbout,
      optional: arg.endsWith("*"),
      more: arg === "...",
    })),
  })));

/** Text that would be read as something else (a number, a formula) if written as it is. */
const LOOKS_TYPED = /^(?:=|[-+]?[$€£¥]?\s*[\d.,]+%?$|true$|false$|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$)/i;

/** A workbook cell as it's written in a note: its formula, or what it shows when that depends on its format (a date, money). */
function written(model: Model, sheet: number, row: number, column: number): string {
  const content = model.getCellContent(sheet, row, column);
  if (isFormula(content)) {
    // A formula that reaches into another sheet can't work in a note of its own: its value instead.
    const elsewhere = getTokens(content).some(({ token }) => typeof token === "object" && (("Reference" in token && token.Reference.sheet) || ("Range" in token && token.Range.sheet)));
    if (!elsewhere) return content;
  } else if (model.getCellType(sheet, row, column) === 2) {
    return LOOKS_TYPED.test(content.trim()) ? `'${content}` : content;
  } else if (model.getCellStyle(sheet, row, column).style.num_fmt.toLowerCase() === "general") return content;
  return model.getFormattedCellValue(sheet, row, column);
}

export function readWorkbook(data: Uint8Array) {
  const model = Model.fromXlsx(data, "workbook", "en", timezone, "en");
  try {
    return model.getWorksheetsProperties().flatMap((properties, sheet) => {
      if (properties.state !== "visible") return [];
      const cells: Cells = [];
      // Column by column, until a long run of empty ones.
      for (let column = 1, empty = 0; column <= MAX_COLUMN && empty < 64; column++) {
        const rows = model.getRowsWithData(sheet, column);
        empty = rows.length ? 0 : empty + 1;
        for (const row of rows) (cells[row - 1] ??= [])[column - 1] = written(model, sheet, row, column);
      }
      return [{ name: properties.name, cells: trimCells(Array.from(cells, (row) => Array.from(row ?? [], (cell) => cell ?? ""))) }];
    });
  } finally {
    model.free();
  }
}

/** A name Excel takes for a sheet: at most 31 characters, none of : \ / ? * [ ]. */
const sheetName = (name: string) => name.replace(/[:\\/?*[\]]+/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Sheet1";

export function writeWorkbook(name: string, cells: Cells) {
  const model = newModel();
  try {
    model.renameSheet(0, sheetName(name));
    fill(model, cells);
    model.evaluate();
    return new Uint8Array(model.toXlsx());
  } finally {
    model.free();
  }
}
