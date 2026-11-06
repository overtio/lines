import { plugins } from "../plugins/registry.svelte";
import type { CellValue, Cells, FindSheet, FormulaEngine } from "../plugins/types";
import { isFormula } from "./cells";

/*
 * The formula engine that's on (a plugin, IronCalc's), for tables and spreadsheets. It loads the
 * first time a note has a formula; until then, and with no engine on, formulas show as written.
 */

const ready = new WeakSet<FormulaEngine>();

/** A sheet's name as a formula writes it: in quotes unless it's one word that can't be read as a cell (Q1). */
export const sheetName = (name: string) => (/^[A-Za-z_][\w.]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name) ? name : `'${name.replaceAll("'", "''")}'`);

/** The engine that's on, once it has loaded; null if none is on. */
export async function loadFormulas(): Promise<FormulaEngine | null> {
  const engine = plugins.formulas;
  if (!engine) return null;
  await engine.load();
  ready.add(engine);
  return engine;
}

/** The engine that's on if it has loaded already, for what's drawn at once. */
export function loadedFormulas(): FormulaEngine | null {
  const engine = plugins.formulas;
  return engine && ready.has(engine) ? engine : null;
}

/** Every cell of a table worked out, as it shows; `find` finds the other sheets its formulas name. */
export function calculate(engine: FormulaEngine, cells: Cells, find?: FindSheet): CellValue[][] {
  const sheet = engine.sheet(find);
  try {
    sheet.update(cells);
    return cells.map((row, r) => row.map((_, c) => sheet.value(r, c)));
  } finally {
    sheet.free();
  }
}

/**
 * Shows what a table's formulas work out to, in the elements of their cells (by row, as `cells`),
 * once the engine has loaded. Until then, and with no engine on, they show as written, in
 * `classes.pending`; an error (`#DIV/0!`) shows in `classes.error`, and a number in `classes.number`
 * if given. The formula stays in the cell's tooltip. Resolves once they show, for what's printed.
 * `find` finds the other sheets they name, and `show` turns what they work out to into what shows.
 */
export async function showFormulas(
  cells: Cells,
  elements: (HTMLElement | undefined)[][],
  classes: { pending: string; error: string; number?: string },
  { find, show = (text) => text }: { find?: FindSheet; show?: (text: string) => Node | string } = {},
) {
  const formulas = cells.flatMap((row, r) => row.flatMap((input, c) => (isFormula(input) && elements[r]?.[c] ? [{ input, el: elements[r][c]!, r, c }] : [])));
  if (!formulas.length) return;
  for (const { input, el } of formulas) {
    el.textContent = input;
    el.title = input;
    el.classList.add(classes.pending);
  }
  let engine = loadedFormulas();
  try {
    engine ??= await loadFormulas();
  } catch (error) {
    console.error("lines: couldn't load the formula engine", error);
  }
  if (!engine) return;
  const values = calculate(engine, cells, find);
  for (const { el, r, c } of formulas) {
    const { kind } = values[r][c];
    el.replaceChildren(show(values[r][c].text));
    el.dataset.text = el.textContent ?? "";
    el.classList.remove(classes.pending);
    el.classList.toggle(classes.error, kind === "error");
    if (classes.number) el.classList.toggle(classes.number, kind === "number");
  }
}
