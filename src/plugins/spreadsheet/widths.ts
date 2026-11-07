import type { CellArea, Cells } from "../../lib/plugins/types";
import { isFormula } from "../../lib/sheets/cells";

/*
 * How wide each column's widest cell is, for columns as wide as what's in them. Each cell's width is
 * kept, so a change measures only what it touched (#88): the cells written in, and the formulas
 * whose results may have changed with them, found by what they point at. Every cell is measured
 * only when a sheet opens, or the font or how cells show (Settings) changes.
 */

/** Functions whose result can change with nothing it points at changing. */
const VOLATILE = /\b(?:NOW|TODAY|RAND|RANDBETWEEN|RANDARRAY|INDIRECT|OFFSET|CELL|INFO)\s*\(/i;
/** Functions that can give back several cells' values, whatever they're given, which spill into the cells beside and below. */
const ARRAYS =
  /\b(?:SEQUENCE|RANDARRAY|MUNIT|MAKEARRAY|TEXTSPLIT|EXPAND|HSTACK|VSTACK|WRAPROWS|WRAPCOLS|TOCOL|TOROW|CHOOSECOLS|CHOOSEROWS|TAKE|DROP|TRANSPOSE|MAP|SCAN|BYROW|BYCOL|SORT|SORTBY|FILTER|UNIQUE|FREQUENCY|LINEST|LOGEST|MINVERSE|MMULT|MODE\.MULT|TRIMRANGE|INDIRECT|OFFSET)\s*\(/i;

/** What a formula's result depends on, read from it. */
interface Reads {
  /** The cells its references point at in its own sheet. */
  areas: CellArea[];
  /** Whether it can change with nothing in its sheet changing: it names another sheet, or uses a function like NOW(). */
  always: boolean;
  /** Whether it can spill into the cells beside and below it, as a range or an array does, and be stopped by what's written there. */
  spills: boolean;
}

function readsOf(formula: string, references: (formula: string) => CellArea[]): Reads {
  const areas = references(formula);
  return {
    areas,
    always: formula.includes("!") || VOLATILE.test(formula),
    spills: formula.includes("{") || ARRAYS.test(formula) || areas.some((area) => area.top !== area.bottom || area.left !== area.right),
  };
}

interface Formula {
  row: number;
  column: number;
  reads: Reads;
}

const key = (row: number, column: number) => row * 16_384 + column;
const within = (area: CellArea, row: number, column: number) => row >= area.top && row <= area.bottom && column >= area.left && column <= area.right;
/** Ranges as wide as this are looked through for every cell, rather than kept under each column they span. */
const WIDE = 64;

/** A sheet's formulas, found by the cells they point at. */
class Formulas {
  all: Formula[] = [];
  /** By the cell a reference to one cell points at. */
  #byCell = new Map<number, Formula[]>();
  /** By each column a range is in; and those with ranges across many columns (whole rows). */
  #byColumn = new Map<number, Formula[]>();
  #wide: Formula[] = [];

  constructor(cells: Cells, read: (formula: string) => Reads) {
    const add = (map: Map<number, Formula[]>, at: number, formula: Formula) => {
      const list = map.get(at);
      if (list) list.push(formula);
      else map.set(at, [formula]);
    };
    cells.forEach((row, r) =>
      row.forEach((input, c) => {
        if (!isFormula(input)) return;
        const formula = { row: r, column: c, reads: read(input) };
        this.all.push(formula);
        for (const area of formula.reads.areas) {
          if (area.top === area.bottom && area.left === area.right) add(this.#byCell, key(area.top, area.left), formula);
          else if (area.right - area.left >= WIDE) this.#wide.push(formula);
          else for (let column = area.left; column <= area.right; column++) add(this.#byColumn, column, formula);
        }
      }),
    );
  }

  /** The formulas pointing at a cell. */
  *at(row: number, column: number) {
    yield* this.#byCell.get(key(row, column)) ?? [];
    for (const list of [this.#byColumn.get(column) ?? [], this.#wide]) {
      for (const formula of list) if (formula.reads.areas.some((area) => within(area, row, column))) yield formula;
    }
  }
}

export class ColumnWidths {
  /** The cells as last measured, and each one's width: 0 for one with nothing written. */
  #cells: Cells = [];
  #widths: number[][] = [];
  #widest: number[] = [];
  /** What else they were measured with. */
  #with: unknown[] = [];
  #reads = new Map<string, Reads>();
  /** The formulas, until one's written or changed. */
  #formulas: Formulas | null = null;

  /**
   * The widest cell's width in each column of `cells`, measuring with `width` those that may show
   * something different since last time. `references` reads the cells a formula points at in its
   * own sheet, while formulas are worked out; `using` is what else the widths depend on (the font,
   * how cells show), every cell being measured again when any of it changes.
   */
  measure(cells: Cells, width: (row: number, column: number) => number, references: ((formula: string) => CellArea[]) | null, using: unknown[]): number[] {
    if (using.length !== this.#with.length || using.some((value, i) => value !== this.#with[i])) {
      this.#with = using;
      this.#reads.clear();
      this.#formulas = null;
      this.#widths = cells.map((row, r) => row.map((input, c) => (input ? width(r, c) : 0)));
      this.#widest = [];
      for (const row of this.#widths) row.forEach((w, c) => (this.#widest[c] = Math.max(this.#widest[c] ?? 0, w)));
    } else this.#update(cells, width, references);
    this.#cells = cells;
    const columns = cells.reduce((most, row) => Math.max(most, row.length), 0);
    return Array.from({ length: columns }, (_, c) => this.#widest[c] ?? 0);
  }

  #update(cells: Cells, width: (row: number, column: number) => number, references: ((formula: string) => CellArea[]) | null) {
    const read = (formula: string) => {
      let reads = this.#reads.get(formula);
      if (!reads) this.#reads.set(formula, (reads = readsOf(formula, references!)));
      return reads;
    };
    const changed: [number, number][] = [];
    /** Cells written in or emptied, which can stop a formula above or before them spilling into them, or let it. */
    const filled: [number, number][] = [];
    /** Where formulas taken out or changed were, which may have spilled into the cells below and beside them. */
    const spilled: [number, number][] = [];
    for (let r = 0; r < Math.max(cells.length, this.#cells.length); r++) {
      const now = cells[r] ?? [];
      const was = this.#cells[r] ?? [];
      if (now === was) continue;
      for (let c = 0; c < Math.max(now.length, was.length); c++) {
        const [before, after] = [was[c] ?? "", now[c] ?? ""];
        if (before === after) continue;
        changed.push([r, c]);
        if (!before !== !after) filled.push([r, c]);
        if (isFormula(before) || isFormula(after)) this.#formulas = null;
        if (references && isFormula(before) && read(before).spills) spilled.push([r, c]);
      }
    }

    // The formulas whose results may have changed: those pointing at a cell that has, in turn.
    const remeasure = [...changed];
    if (references) {
      const formulas = (this.#formulas ??= new Formulas(cells, read));
      const reached = new Set<number>();
      const queue = [...changed];
      const reach = (formula: Formula) => {
        if (reached.has(key(formula.row, formula.column))) return;
        reached.add(key(formula.row, formula.column));
        queue.push([formula.row, formula.column]);
        remeasure.push([formula.row, formula.column]);
        if (formula.reads.spills) spilled.push([formula.row, formula.column]);
      };
      for (const formula of formulas.all) {
        const { always, spills } = formula.reads;
        if (always || (spills && filled.some(([r, c]) => r >= formula.row && c >= formula.column))) reach(formula);
      }
      /** Corners below and beside which every cell may have changed, by what's spilled there, looked through already. */
      const corners: [number, number][] = [];
      while (queue.length || spilled.length) {
        for (let cell = queue.pop(); cell; cell = queue.pop()) for (const formula of formulas.at(...cell)) reach(formula);
        // What a formula spills into changes every formula pointing below and beside it.
        const more = spilled.splice(0).filter(([r, c]) => !corners.some(([top, left]) => r >= top && c >= left));
        if (!more.length) continue;
        corners.push(...more);
        for (const formula of formulas.all) {
          if (formula.reads.areas.some((area) => more.some(([r, c]) => area.bottom >= r && area.right >= c))) reach(formula);
        }
      }
    }

    const stale = new Set<number>();
    for (const [r, c] of remeasure) {
      const row = (this.#widths[r] ??= []);
      const before = row[c] ?? 0;
      const now = cells[r]?.[c] ? width(r, c) : 0;
      row[c] = now;
      const widest = this.#widest[c] ?? 0;
      if (now > widest) this.#widest[c] = now;
      else if (now < before && before === widest) stale.add(c);
    }
    this.#widths.length = cells.length;
    for (const c of stale) this.#widest[c] = this.#widths.reduce((most, row) => Math.max(most, row?.[c] ?? 0), 0);
  }
}

/** Text widths measured with the canvas, which is slow at it (WebKit most), so each is measured once for a font. */
let context: CanvasRenderingContext2D | null | undefined;
let contextFont = "";
const measured = new Map<string, Map<string, number>>();

/** How wide text is in `font`, its widest line if it has several. */
export function textWidth(text: string, font: string): number {
  let widths = measured.get(font);
  if (!widths) {
    // A few fonts' (the editor's text size changed), not every one's.
    if (measured.size >= 4) measured.delete(measured.keys().next().value!);
    measured.set(font, (widths = new Map()));
  }
  let width = widths.get(text);
  if (width === undefined) {
    context ??= document.createElement("canvas").getContext("2d");
    if (!context) return text.length * 8;
    if (font !== contextFont) context.font = contextFont = font;
    width = text.includes("\n") ? Math.max(...text.split("\n").map((line) => context!.measureText(line).width)) : context.measureText(text).width;
    if (widths.size >= 100_000) widths.clear();
    widths.set(text, width);
  }
  return width;
}
