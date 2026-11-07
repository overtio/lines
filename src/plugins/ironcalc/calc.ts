import init, { columnNameFromNumber, getAllTimezones, getTokens, type MarkedToken, Model } from "@ironcalc/wasm-xlsx";
import wasm from "@ironcalc/wasm-xlsx/wasm_bg.wasm?url";
import { trimCells } from "../../lib/sheets/csv";
import { numberFormat, writtenMoney } from "../../lib/sheets/display";
import { sheetName } from "../../lib/sheets/formulas";
import { isFormula, movedCells, shiftCells, shifted } from "../../lib/sheets/cells";
import type {
  CellArea,
  CellValue,
  Cells,
  FindSheet,
  FormulaCompletion,
  FormulaFunction,
  FormulaReference,
  FormulaSheet,
} from "../../lib/plugins/types";
import { FUNCTIONS } from "./functions";

/*
 * IronCalc, loaded the first time a note has a formula: a spreadsheet engine in Rust, compiled to
 * WebAssembly. Formulas are read in English with commas between arguments, as in a CSV file or an
 * Excel workbook, whatever the app's language, so a note works out the same on every device.
 *
 * A formula can name another sheet (`Budget!B4`, `'Trip/costs'!B2`): another note's, or a block's,
 * found by whoever asks (`FindSheet`). Those sheets go in the same workbook, after the sheet's own,
 * under names of their own, so a note's or block's name can be anything.
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

/**
 * Sets cells, rows and columns from 1, without working anything out until `evaluate()`: what's
 * written first, then formulas, which take on the formats of the cells they point at as they're set
 * (`=B1` of `$5` shows money).
 */
function fill(model: Model, cells: Cells, only?: (input: string) => boolean, sheet = 0) {
  model.pauseEvaluation();
  for (const formulas of [false, true]) {
    cells.forEach((row, r) =>
      row.forEach((input, c) => {
        if (input && isFormula(input) === formulas && (!only || only(input))) setInput(model, sheet, r, c, input);
      }),
    );
  }
  model.resumeEvaluation();
}

function setInput(model: Model, sheet: number, row: number, column: number, input: string) {
  try {
    model.setUserInput(sheet, row + 1, column + 1, input);
  } catch {
    // What IronCalc can't take in shows as text.
    model.setUserInput(sheet, row + 1, column + 1, `'${input}`);
  }
}

/** What IronCalc gives a format of its own: a date. (Money and percentages reach it as plain numbers.) */
const FORMATTED = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;

/*
 * Numbers written with money's symbol, as a percentage or with thousands separators go to IronCalc as
 * plain numbers. Given them as written, it gives them formats of its own, which it shows formula
 * results by: to fewer places than they have (`=$2/3` as $1), and some below zero without their
 * minus (-1 as $1). So a sheet shows each as written, and a formula's result in full, in the way of
 * the first cell it points at.
 */

/** How a number's written: as money (with what's in front of it, `$` or `CHF `), as a percentage, or with thousands separators. */
type Unit = { money: string } | "percent" | "grouped";

const PERCENT = /^([-+]?)\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*%$/;
const GROUPED = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

/** What a cell's written with, if it's a number written so, and the plain number IronCalc's given for it. */
function unitOf(input: string): { unit: Unit; plain: string } | null {
  const text = input.trim();
  const money = writtenMoney(text);
  if (money) return { unit: { money: money.symbol }, plain: String(money.amount) };
  const percent = PERCENT.exec(text);
  if (percent) return { unit: "percent", plain: String((Number(percent[2].replaceAll(",", "")) / 100) * (percent[1] === "-" ? -1 : 1)) };
  return GROUPED.test(text) ? { unit: "grouped", plain: text.replaceAll(",", "") } : null;
}

/**
 * A row as IronCalc's given it, and what each of its cells' numbers is written with; kept for the
 * row they're read from, so a row that's the same stays the same row, and isn't read again.
 */
const rowsRead = new WeakMap<string[], { plain: string[]; units: (Unit | null)[] }>();
function readRow(row: string[]) {
  let read = rowsRead.get(row);
  if (!read) {
    const found = row.map((input) => (isFormula(input) ? null : unitOf(input)));
    const made = row.map((input, c) => found[c]?.plain ?? input);
    read = { plain: made.some((input, c) => input !== row[c]) ? made : row, units: found.map((unit) => unit?.unit ?? null) };
    rowsRead.set(row, read);
  }
  return read;
}

const plain = (cells: Cells): Cells => cells.map((row) => readRow(row).plain);

/** Numbers written out in full: to ten places, without an exponent; and with thousands separators. */
const FULL = numberFormat("en-US", { useGrouping: false, maximumFractionDigits: 10 });
const FULL_GROUPED = numberFormat("en-US", { useGrouping: true, maximumFractionDigits: 10 });

/** A number written out in full, with what it's shown with. */
function withUnit(value: number, unit: Unit) {
  if (unit === "percent") return `${FULL.format(value * 100)}%`;
  if (unit === "grouped") return FULL_GROUPED.format(value);
  return `${value < 0 ? "-" : ""}${unit.money}${FULL.format(Math.abs(value))}`;
}

/**
 * A cell set again: cleared first, formats included ("$5" makes a cell show money, and 5 written
 * over it later shouldn't), unless `clear` is false: a new workbook's cells have nothing to clear.
 */
function reset(model: Model, sheet: number, row: number, column: number, input: string, clear = true) {
  if (clear) model.rangeClearAll(sheet, row + 1, column + 1, row + 1, column + 1);
  if (input) setInput(model, sheet, row, column, input);
}

type Cell = { sheet: number; row: number; column: number };
type Formula = Cell & { input: string };

/**
 * Sets what changed from `was` to `now` in a sheet, but for formulas, which are given back to set
 * once every sheet's cells are (they take on the formats of those they point at as they're set).
 * Gives back the cells whose format may have changed too, which formulas pointing at them need
 * setting again for; says whether anything changed.
 */
function change(model: Model, sheet: number, was: Cells, now: Cells, formulas: Formula[], formatted: Cell[], clear: boolean) {
  let changed = false;
  for (let r = 0; r < Math.max(was.length, now.length); r++) {
    const before = was[r] ?? [];
    const after = now[r] ?? [];
    if (before === after) continue;
    for (let c = 0; c < Math.max(before.length, after.length); c++) {
      const input = after[c] ?? "";
      const old = before[c] ?? "";
      if (old === input) continue;
      changed = true;
      if (isFormula(input)) formulas.push({ sheet, row: r, column: c, input });
      else {
        reset(model, sheet, r, c, input, clear);
        if (FORMATTED.test(input) || FORMATTED.test(old)) formatted.push({ sheet, row: r, column: c });
      }
    }
  }
  return changed;
}

/* Other sheets, named in formulas. */

/** What the sheets of a workbook of linked ones are called: names no note or block would have. */
const inner = (index: number) => `‹${index}›`;

/** A workbook with a sheet for these cells and `linked` more. */
function workbook(linked: number) {
  const model = newModel();
  model.renameSheet(0, inner(0));
  for (let i = 1; i <= linked; i++) {
    model.newSheet();
    model.renameSheet(i, inner(i));
  }
  return model;
}

const sheetOf = ({ token }: MarkedToken) =>
  typeof token !== "object" ? null
  : "Reference" in token ? token.Reference.sheet
  : "Range" in token ? token.Range.sheet
  : null;

/** A formula with the other sheets it names written as `rename` calls them, quoted as they need; those it has no name for stay as written. */
export function renameSheets(formula: string, rename: (name: string) => string | undefined): string {
  let tokens: MarkedToken[];
  try {
    tokens = getTokens(formula);
  } catch {
    return formula;
  }
  const chars = Array.from(formula);
  let out = "";
  let at = 0;
  for (const marked of tokens) {
    const sheet = sheetOf(marked);
    const name = sheet && rename(sheet);
    if (!name) continue;
    const written = chars.slice(marked.start, marked.end).join("");
    out += chars.slice(at, marked.start).join("") + sheetName(name) + written.slice(written.lastIndexOf("!"));
    at = marked.end;
  }
  return out + chars.slice(at).join("");
}

/** The most sheets a sheet's formulas reach, through others' formulas too. */
const MAX_LINKED = 50;

/** Whether what's written in a cell is a formula that may name another sheet. */
const namesSheets = (input: string) => isFormula(input) && input.includes("!");

/**
 * Every sheet the cells' formulas reach, and theirs in turn: each sheet's cells (these first), with
 * the names in its formulas written as the workbook calls those sheets; the linked sheets' ids; and
 * the name each was first found by.
 */
function link(cells: Cells, find?: FindSheet) {
  const sheets: { cells: Cells; find?: FindSheet }[] = [{ cells, find }];
  const ids = new Map<string, number>();
  const names: string[] = [];
  const inputs: Cells[] = [];
  for (let i = 0; i < sheets.length; i++) {
    const { cells, find } = sheets[i];
    const found = new Map<string, number | undefined>();
    const index = (name: string) => {
      if (!found.has(name)) {
        const sheet = find?.(name);
        let at = sheet ? ids.get(sheet.id) : undefined;
        if (sheet && at === undefined && sheets.length <= MAX_LINKED) {
          at = sheets.length;
          ids.set(sheet.id, at);
          sheets.push(sheet);
          names.push(name);
        }
        found.set(name, at);
      }
      const at = found.get(name);
      return at === undefined ? undefined : inner(at);
    };
    inputs.push(
      find ?
        cells.map((row) => {
          if (!row.some(namesSheets)) return row;
          // Rows with nothing renamed stay the same rows, so updating skips them.
          const out = row.map((input) => (namesSheets(input) ? renameSheets(input, index) : input));
          return out.some((input, c) => input !== row[c]) ? out : row;
        })
      : cells,
    );
  }
  return { inputs, ids: [...ids.keys()], names };
}

class Sheet implements FormulaSheet {
  #model = workbook(0);
  #find?: FindSheet;
  /** The linked sheets in the workbook, by id. */
  #ids: string[] = [];
  /** Each sheet's cells as last given to IronCalc, and as written (formulas naming the workbook's sheets). */
  #inputs: Cells[] = [];
  #written: Cells[] = [];

  constructor(find?: FindSheet) {
    this.#find = find;
  }

  update(cells: Cells) {
    const { inputs: written, ids } = link(cells, this.#find);
    const inputs = written.map(plain);
    this.#written = written;
    if (ids.length !== this.#ids.length || ids.some((id, i) => id !== this.#ids[i])) {
      // Other sheets named, or no longer: a workbook with just those.
      this.#model.free();
      this.#model = workbook(ids.length);
      this.#ids = ids;
      this.#inputs = [];
    }
    const fresh = !this.#inputs.length;
    this.#model.pauseEvaluation();
    let changed = false;
    let formulas: Formula[] = [];
    const formatted: Cell[] = [];
    inputs.forEach((now, sheet) => {
      if (change(this.#model, sheet, this.#inputs[sheet] ?? [], now, formulas, formatted, !fresh)) changed = true;
    });
    // Formulas take on the formats of what they point at: in a new workbook, every one; when a cell's
    // format may have changed, those pointing at it, and at them in turn.
    const all = fresh || formatted.length > 0;
    if (fresh) formulas = everyFormula(inputs);
    else if (formatted.length) formulas = pointingAt(everyFormula(inputs), formulas, formatted);
    // The sheets this one names first, then its own; all once more if one points at another set after
    // it, so it takes on the format that one took on.
    formulas.sort((a, b) => b.sheet - a.sheet);
    const passes = all && pointsAhead(formulas) ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (const { sheet, row, column, input } of formulas) reset(this.#model, sheet, row, column, input, pass > 0 || !fresh);
    }
    this.#model.resumeEvaluation();
    if (changed) this.#model.evaluate();
    this.#inputs = inputs;
  }

  value(row: number, column: number): CellValue {
    if (row >= MAX_ROW || column >= MAX_COLUMN) return EMPTY;
    const input = this.#written[0]?.[row]?.[column] ?? "";
    // Written with a unit, a number shows as written: IronCalc was given it plain.
    if (input !== (this.#inputs[0]?.[row]?.[column] ?? "") && !isFormula(input) && this.#model.getCellType(0, row + 1, column + 1) === 1) {
      return { text: input.trim(), kind: "number" };
    }
    const text = this.#model.getFormattedCellValue(0, row + 1, column + 1);
    if (!text) return EMPTY;
    const kind = KINDS[this.#model.getCellType(0, row + 1, column + 1)] ?? "text";
    if (kind !== "number" || !isFormula(input)) return { text, kind };
    // A formula's result: in full, in the way of what it points at.
    const unit = this.#unitAt(0, row, column);
    const value = Number(text);
    return { text: unit && Number.isFinite(value) ? withUnit(value, unit) : text, kind };
  }

  /**
   * What a cell's number is shown with: what it's written with, or for a formula, what the first
   * cell it points at is, if every function in it gives back an amount of what it's given (not
   * COUNT, say): `=B2*2`, `=SUM(B2:B9)` and `=Budget!B4` of money are money.
   */
  #unitAt(sheet: number, row: number, column: number, depth = 0): Unit | null {
    const line = this.#written[sheet]?.[row];
    const input = line?.[column] ?? "";
    if (!isFormula(input)) return line ? (readRow(line).units[column] ?? null) : null;
    // Far enough to go through formulas pointing at formulas, not round a circle of them.
    const first = depth < 20 ? readFormula(input).first : null;
    if (!first) return null;
    const at = first.sheet === null ? sheet : sheetIndex(first.sheet);
    return at < 0 ? null : this.#unitAt(at, first.from.row - 1, first.from.column - 1, depth + 1);
  }

  free() {
    this.#model.free();
  }
}

export const sheet = (find?: FindSheet): FormulaSheet => new Sheet(find);

/** Functions whose result is an amount of what they're given, so money in is money out (and a percentage, a percentage). */
const KEEPS = new Set([
  "SUM", "AVERAGE", "MIN", "MAX", "MEDIAN", "ROUND", "ROUNDUP", "ROUNDDOWN", "MROUND", "TRUNC", "INT", "FLOOR", "CEILING", "ABS", "IF",
  "IFS", "IFERROR", "IFNA", "CHOOSE", "SWITCH", "INDEX", "VLOOKUP", "HLOOKUP", "XLOOKUP", "LOOKUP", "LARGE", "SMALL", "SUMIF", "SUMIFS",
  "AVERAGEIF", "AVERAGEIFS", "MAXIFS", "MINIFS", "SUMPRODUCT",
]);

type Corner = { row: number; column: number; absolute_row: boolean; absolute_column: boolean };

/** A reference in a formula: its sheet as written (null for its own), its corners from 1 as written, and where it's written, in characters. */
interface Reference {
  sheet: string | null;
  from: Corner;
  to: Corner;
  start: number;
  end: number;
}

/** What's read from formulas, by their text: their references, and the first if a unit carries through every function in it. */
const formulasRead = new Map<string, { references: Reference[]; first: Reference | null }>();

function readFormula(formula: string) {
  let read = formulasRead.get(formula);
  if (!read) {
    let references: Reference[] = [];
    try {
      references = getTokens(formula).flatMap(({ token, start, end }) =>
        typeof token !== "object" ? []
        : "Reference" in token ? [{ sheet: token.Reference.sheet ?? null, from: token.Reference, to: token.Reference, start, end }]
        : "Range" in token ? [{ sheet: token.Range.sheet ?? null, from: token.Range.left, to: token.Range.right, start, end }]
        : [],
      );
    } catch {
      // Not a formula IronCalc reads: no references, nor money.
    }
    const functions = [...formula.matchAll(/([A-Za-z][\w.]*)\s*\(/g)].map(([, name]) => name.toUpperCase());
    read = { references, first: functions.every((name) => KEEPS.has(name)) ? (references[0] ?? null) : null };
    if (formulasRead.size >= 50_000) formulasRead.clear();
    formulasRead.set(formula, read);
  }
  return read;
}

/** The workbook's sheet a formula names (`‹1›`); -1 for a name that isn't one of its own. */
const sheetIndex = (name: string) => Number(/^‹(\d+)›$/.exec(name)?.[1] ?? -1);

/** The formulas in each sheet's cells, by row. */
const everyFormula = (inputs: Cells[]): Formula[] =>
  inputs.flatMap((cells, sheet) => cells.flatMap((row, r) => row.flatMap((input, c) => (isFormula(input) ? [{ sheet, row: r, column: c, input }] : []))));

/** Whether a formula in `sheet` points at a cell. */
function pointsAt(formula: string, sheet: number, cell: Cell) {
  return readFormula(formula).references.some(({ sheet: name, from, to }) => {
    const row = cell.row + 1;
    const column = cell.column + 1;
    return (
      (name === null ? sheet : sheetIndex(name)) === cell.sheet &&
      row >= Math.min(from.row, to.row) &&
      row <= Math.max(from.row, to.row) &&
      column >= Math.min(from.column, to.column) &&
      column <= Math.max(from.column, to.column)
    );
  });
}

/** Of `all` formulas, in their order, those `changed` and those pointing at them or the `cells`, and at those in turn. */
function pointingAt(all: Formula[], changed: Formula[], cells: Cell[]): Formula[] {
  const at = ({ sheet, row, column }: Cell) => `${sheet} ${row} ${column}`;
  const found = new Set(changed.map(at));
  for (let reached: Cell[] = [...cells, ...changed]; reached.length; ) {
    const next = all.filter((formula) => !found.has(at(formula)) && reached.some((cell) => pointsAt(formula.input, formula.sheet, cell)));
    for (const formula of next) found.add(at(formula));
    reached = next;
  }
  return all.filter((formula) => found.has(at(formula)));
}

/**
 * Whether a formula points at cells where there may be one set after it, in the order `formulas`
 * are set: the sheets named first, and in a sheet, by row and then column.
 */
function pointsAhead(formulas: Formula[]) {
  // The last row with a formula in each column of each sheet.
  const last = new Map<number, number[]>();
  for (const { sheet, row, column } of formulas) {
    if (!last.has(sheet)) last.set(sheet, []);
    const rows = last.get(sheet)!;
    rows[column] = Math.max(rows[column] ?? -1, row);
  }
  return formulas.some(({ sheet, row, column, input }) =>
    readFormula(input).references.some(({ sheet: name, from, to }) => {
      const at = name === null ? sheet : sheetIndex(name);
      const rows = last.get(at);
      // A sheet set before this one's formulas, or one without formulas.
      if (!rows || at > sheet) return false;
      const top = Math.min(from.row, to.row) - 1;
      const bottom = Math.max(from.row, to.row) - 1;
      const right = Math.min(Math.max(from.column, to.column) - 1, rows.length - 1);
      for (let c = Math.min(from.column, to.column) - 1; c <= right; c++) {
        const most = Math.min(bottom, rows[c] ?? -1);
        if (most >= top && (at < sheet || most > row || (most === row && c > column))) return true;
      }
      return false;
    }),
  );
}

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

/** Selects cells (from 0) for IronCalc's copying and pasting. */
function select(model: Model, top: number, left: number, bottom: number, right: number) {
  model.setSelectedCell(top + 1, left + 1);
  model.setSelectedRange(top + 1, left + 1, bottom + 1, right + 1);
}

export function moveCells(cells: Cells, area: CellArea, rows: number, columns: number): Cells {
  const out = movedCells(cells, area, rows, columns);
  if (!rows && !columns) return out;
  const model = newModel();
  try {
    fill(model, cells, isFormula);
    const formulas: { row: number; column: number; before: string }[] = [];
    cells.forEach((row, r) =>
      row.forEach((input, c) => {
        if (isFormula(input)) formulas.push({ row: r, column: c, before: model.getCellContent(0, r + 1, c + 1) });
      }),
    );
    const height = area.bottom - area.top;
    const width = area.right - area.left;
    const to = { top: area.top + rows, left: area.left + columns };
    // Cut and pasted, which points formulas at where the cells went.
    const cut = (top: number, left: number, toTop: number, toLeft: number) => {
      select(model, top, left, top + height, left + width);
      const { range, data } = model.copyToClipboard();
      select(model, toTop, toLeft, toTop + height, toLeft + width);
      model.pasteFromClipboard(0, range, data, true);
    };
    const overlaps = to.top <= area.bottom && to.top + height >= area.top && to.left <= area.right && to.left + width >= area.left;
    if (overlaps) {
      // Pasted over where they were, IronCalc points the moved formulas wrongly: they go by way of empty rows at the end.
      const spare = MAX_ROW - height - 1;
      cut(area.top, area.left, spare, area.left);
      cut(spare, area.left, to.top, to.left);
    } else cut(area.top, area.left, to.top, to.left);
    const within = (r: number, c: number, top: number, left: number) => r >= top && r <= top + height && c >= left && c <= left + width;
    for (const { row, column, before } of formulas) {
      const moved = within(row, column, area.top, area.left);
      // Written over by the cells moved there.
      if (!moved && within(row, column, to.top, to.left)) continue;
      const [r, c] = moved ? [row + rows, column + columns] : [row, column];
      const after = model.getCellContent(0, r + 1, c + 1);
      // Formulas whose references didn't change stay as they were written.
      if (after !== before) out[r][c] = after;
    }
    return out;
  } finally {
    model.free();
  }
}

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
  // Characters and UTF-16 units are the same but for those beyond them (emoji).
  const chars = /[\uD800-\uDFFF]/.test(formula) ? Array.from(formula) : null;
  const units = (n: number) => (chars ? unitsTo(chars, n) : n);
  return readFormula(formula).references.flatMap(({ sheet, from: a, to: b, start, end }) =>
    sheet ?
      []
    : [
        {
          from: units(start),
          to: units(end),
          top: Math.min(a.row, b.row) - 1,
          left: Math.min(a.column, b.column) - 1,
          bottom: Math.max(a.row, b.row) - 1,
          right: Math.max(a.column, b.column) - 1,
        },
      ],
  );
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
const excelName = (name: string) => name.replace(/[:\\/?*[\]]+/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Sheet1";

export function writeWorkbook(name: string, cells: Cells, find?: FindSheet) {
  const { inputs, names } = link(cells, find);
  const model = workbook(names.length);
  try {
    inputs.forEach((sheet, index) => fill(model, sheet, undefined, index));
    // The sheets named by what they were called (Budget, Trip – costs), formulas following.
    const taken = new Set<string>();
    const unique = (wanted: string) => {
      let name = excelName(wanted);
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${excelName(wanted).slice(0, 26)} (${n})`;
      taken.add(name.toLowerCase());
      return name;
    };
    model.renameSheet(0, unique(name));
    names.forEach((linked, i) => model.renameSheet(i + 1, unique(linked.replaceAll("/", " – "))));
    model.evaluate();
    return new Uint8Array(model.toXlsx());
  } finally {
    model.free();
  }
}
