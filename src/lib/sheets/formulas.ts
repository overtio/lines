import { plugins } from "../plugins/registry.svelte";
import type { CellValue, Cells, FormulaEngine } from "../plugins/types";
import { isFormula } from "./cells";

/*
 * The formula engine that's on (a plugin, IronCalc's), for tables and spreadsheets. It loads the
 * first time a note has a formula; until then, and with no engine on, formulas show as written.
 */

const ready = new WeakSet<FormulaEngine>();

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

/** Every cell of a table worked out, as it shows. */
export function calculate(engine: FormulaEngine, cells: Cells): CellValue[][] {
  const sheet = engine.sheet();
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
 */
export async function showFormulas(
  cells: Cells,
  elements: (HTMLElement | undefined)[][],
  classes: { pending: string; error: string; number?: string },
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
  const values = calculate(engine, cells);
  for (const { el, r, c } of formulas) {
    const { text, kind } = values[r][c];
    el.textContent = text;
    el.dataset.text = text;
    el.classList.remove(classes.pending);
    el.classList.toggle(classes.error, kind === "error");
    if (classes.number) el.classList.toggle(classes.number, kind === "number");
  }
}
