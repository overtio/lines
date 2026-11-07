import { t } from "../../lib/i18n/index.svelte";
import type { CellArea, Cells, FormulaCompletion, FormulaEngine, FormulaFunction, FormulaSheet } from "../../lib/plugins/types";
import { areaBetween, cellName, columnName, isFormula } from "../../lib/sheets/cells";
import { sheetName } from "../../lib/sheets/formulas";
import { showCell } from "./sheet";
import type { Sheet } from "./state.svelte";

/*
 * Help writing a formula in a grid (Grid.svelte): the functions starting with the word typed, and
 * the other sheets it can name, suggested; after another sheet's name (`Finance!`), its columns and
 * cells, and then what the reference written holds; inside a function's parentheses, its arguments.
 */

/** What the grid is writing. */
interface Writing {
  sheet(): Sheet;
  /** The engine, once it has loaded. */
  engine(): FormulaEngine | null;
  /** The formula being written, or null when none is. */
  formula(): string | null;
  /** Where the cursor is in it. */
  caret(): number;
}

/** Something to write at the cursor, from where what's typed of it starts: a function (`SUM(`), another sheet (`Budget!`), or one of its cells (`B4`). */
export type Suggestion = { name: string; about: string; insert: string; from: number; kind: "function" | "sheet" | "cell" };

/** The functions most formulas use, suggested before the rest that start the same way. */
const COMMON = [
  "SUM", "AVERAGE", "IF", "COUNT", "MIN", "MAX", "ROUND", "SUMIF", "COUNTIF", "IFERROR", "VLOOKUP", "XLOOKUP", "INDEX", "MATCH",
  "AND", "OR", "NOT", "ABS", "TODAY", "NOW", "DATE", "CONCAT", "TEXT", "LEFT", "RIGHT", "MID", "LEN", "UPPER", "LOWER", "TRIM",
  "COUNTA", "AVERAGEIF", "SUMPRODUCT", "MEDIAN", "PRODUCT", "POWER", "SQRT", "ROUNDUP", "ROUNDDOWN", "YEAR", "MONTH", "DAY",
];
/** The most other sheets, and their cells, suggested at once. */
const MAX_SHEETS = 8;
const MAX_CELLS = 60;

/** Text that labels a row or column: written, not a formula or a number. */
const label = (text: string | undefined) => (text && !isFormula(text) && !/^[-+$€£¥\d.,%]+$/.test(text) ? text : "");

/** What a cell of another sheet is about: its row's label (in the first column) and its column's header (in the first row). */
const labels = (cells: Cells, row: number, column: number) =>
  row ? [column ? label(cells[row]?.[0]) : "", label(cells[0]?.[column])].filter(Boolean).join(" · ") : "";

/** A reference's cells, if it's a whole one (B4, $B$4, B2:B9). */
function refArea(ref: string): CellArea | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(ref);
  if (!match) return null;
  const column = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const [a, b] = [{ row: Number(match[2]) - 1, column: column(match[1]) }, { row: Number(match[4] ?? match[2]) - 1, column: column(match[3] ?? match[1]) }];
  return a.row < 0 || b.row < 0 ? null : areaBetween(a, b);
}

export class FormulaHelp {
  /** The suggestions put away with Esc, until more is typed. */
  dismissed = $state(false);
  /** The suggestion ↑ and ↓ are on. */
  picked = $state(0);
  readonly #writing: Writing;
  /** The other sheet's cells, worked out, kept while it's written about. */
  #other: { id: string; cells: Cells; calc: FormulaSheet } | null = null;

  constructor(writing: Writing) {
    this.#writing = writing;
  }

  /** What can go at the cursor. */
  completion = $derived.by((): FormulaCompletion | null => {
    const [engine, formula] = [this.#writing.engine(), this.#writing.formula()];
    return engine && formula !== null ? engine.complete(formula, this.#writing.caret()) : null;
  });

  #catalog = $derived.by(() => {
    const engine = this.#writing.engine();
    return engine && new Map(engine.functions().map((fn) => [fn.name, fn]));
  });

  /** A cell or range of another sheet being written, after its name and `!`: the name, and what's typed of the reference. */
  #elsewhere = $derived.by(() => {
    const formula = this.#writing.formula();
    if (formula === null) return null;
    const caret = this.#writing.caret();
    const match = /(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!(\$?[A-Za-z]{0,3}\$?\d*(?::\$?[A-Za-z]{0,3}\$?\d*)?)$/.exec(formula.slice(0, caret));
    if (!match) return null;
    const name = match[1]?.replaceAll("''", "'") ?? match[2];
    return { name, written: `${match[0].slice(0, match[0].length - match[3].length)}${match[3]}`, ref: match[3], from: caret - match[3].length };
  });

  /** Another sheet's name being written: after a quote (`='Bud`), or as a word that could be a function's name (`=Fin`). */
  #sheetTyped = $derived.by(() => {
    const formula = this.#writing.formula();
    if (formula === null) return null;
    const caret = this.#writing.caret();
    const quoted = /(?:^=|[(,;+\-*/^&<>=:\s])'((?:[^']|'')*)$/.exec(formula.slice(0, caret));
    if (quoted) return { typed: quoted[1].replaceAll("''", "'"), from: caret - quoted[1].length - 1, quoted: true };
    const name = this.completion?.name;
    return name?.typed ? { typed: name.typed, from: name.from, quoted: false } : null;
  });

  /**
   * What's suggested writing a formula: the functions starting with the word typed (everyday ones
   * first), and the other sheets it can name whose name (or a word of it) starts so, after the
   * everyday functions; after a quote, only sheets.
   */
  suggestions = $derived.by((): Suggestion[] => {
    if (this.dismissed) return [];
    if (this.#elsewhere) return this.#cellSuggestions();
    if (!this.#sheetTyped) return [];
    const { typed, from, quoted } = this.#sheetTyped;
    const query = typed.toLocaleLowerCase();
    const rank = (name: string) => {
      const lower = name.toLocaleLowerCase();
      return lower.startsWith(query) ? 3 : lower.split(/[\s/_-]+/).some((word) => word.startsWith(query)) ? 2 : quoted && lower.includes(query) ? 1 : 0;
    };
    const sheets = (this.#writing.sheet().sheets?.() ?? [])
      .map((choice) => ({ choice, rank: rank(choice.name) }))
      .filter(({ rank }) => rank > 0)
      .sort((a, b) => b.rank - a.rank || a.choice.name.localeCompare(b.choice.name))
      .slice(0, MAX_SHEETS)
      .map(({ choice }): Suggestion => ({ ...choice, insert: `${sheetName(choice.name)}!`, from, kind: "sheet" }));
    if (quoted || !this.#catalog) return sheets;
    const upper = typed.toUpperCase();
    const common = (fn: FormulaFunction) => (COMMON.includes(fn.name) ? COMMON.indexOf(fn.name) : COMMON.length);
    const functions = [...this.#catalog.values()]
      .filter((fn) => fn.name.startsWith(upper))
      .sort((a, b) => common(a) - common(b) || a.name.localeCompare(b.name))
      .map((fn): Suggestion => ({ name: fn.name, about: fn.about, insert: `${fn.name}(`, from, kind: "function" }));
    const everyday = functions.filter((fn) => COMMON.includes(fn.name));
    return [...everyday, ...sheets, ...functions.slice(everyday.length)];
  });

  /** What the reference to another sheet just written holds: a cell's value, or a range's first few. */
  preview = $derived.by(() => {
    const elsewhere = this.#elsewhere;
    const area = elsewhere && refArea(elsewhere.ref);
    const found = area && this.#otherSheet(elsewhere.name);
    if (!area || !found) return null;
    const values: string[] = [];
    let count = 0;
    for (let r = area.top; r <= Math.min(area.bottom, found.cells.length - 1); r++) {
      for (let c = area.left; c <= area.right; c++) {
        const text = showCell(found.calc.value(r, c).text);
        if (!text) continue;
        count++;
        if (values.length < 6) values.push(text);
      }
    }
    const one = area.top === area.bottom && area.left === area.right;
    return {
      written: elsewhere.written,
      value: one ? values[0] || t("sheet.empty") : values.join(", ") + (count > values.length ? ", …" : "") || t("sheet.empty"),
      about: one ? labels(found.cells, area.top, area.left) : t("sheet.cells", { count }),
    };
  });

  /** Inside a function's parentheses: the function, and which of its arguments the cursor is on. */
  hint = $derived.by(() => {
    const argument = this.completion?.argument;
    const fn = !this.suggestions.length && argument && this.#catalog?.get(argument.name.toUpperCase());
    return fn ? { fn, at: Math.min(argument.index, fn.args.length - 1) } : null;
  });

  /** After typing: the suggestions again, from the first. */
  typed() {
    this.dismissed = false;
    this.picked = 0;
  }

  free() {
    this.#other?.calc.free();
  }

  #otherSheet(name: string) {
    const linked = this.#writing.sheet().find(name);
    const engine = this.#writing.engine();
    if (!linked || !engine) return null;
    if (this.#other?.id !== linked.id || this.#other.cells !== linked.cells) {
      this.#other?.calc.free();
      const calc = engine.sheet(linked.find);
      calc.update(linked.cells);
      this.#other = { id: linked.id, cells: linked.cells, calc };
    }
    return this.#other;
  }

  /** The other sheet's columns (top to last cell written) and cells with something in them, starting with what's typed after the `!`. */
  #cellSuggestions(): Suggestion[] {
    const elsewhere = this.#elsewhere;
    const at = elsewhere && !elsewhere.ref.includes(":") && !refArea(elsewhere.ref) ? elsewhere : null;
    const found = at && this.#otherSheet(at.name);
    if (!at || !found) return [];
    const typed = at.ref.replaceAll("$", "").toUpperCase();
    const { cells, calc } = found;
    const out: Suggestion[] = [];
    const width = cells.reduce((most, row) => Math.max(most, row.length), 0);
    for (let column = 0; column < width; column++) {
      let last = -1;
      cells.forEach((row, r) => row[column] && (last = r));
      // Below its header, if it has one.
      const header = label(cells[0]?.[column]);
      const first = header && last > 1 ? 1 : 0;
      if (last <= first) continue;
      const name = `${columnName(column)}${first + 1}:${columnName(column)}${last + 1}`;
      if (name.startsWith(typed)) out.push({ name, about: header || t("sheet.column", { name: columnName(column) }), insert: name, from: at.from, kind: "cell" });
    }
    for (const [r, row] of cells.entries()) {
      for (const [c, input] of row.entries()) {
        if (out.length >= MAX_CELLS) return out.slice(0, MAX_CELLS);
        const name = cellName(r, c);
        if (!input || !name.startsWith(typed)) continue;
        const value = showCell(calc.value(r, c).text);
        out.push({ name, about: [value, labels(cells, r, c)].filter(Boolean).join(" · "), insert: name, from: at.from, kind: "cell" });
      }
    }
    return out;
  }
}
