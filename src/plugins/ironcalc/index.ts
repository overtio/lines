import { t } from "../../lib/i18n/index.svelte";
import type { FormulaEngine, Plugin } from "../../lib/plugins/types";

/*
 * IronCalc (ironcalc.com) works out the formulas in tables and spreadsheets, and reads and writes
 * Excel workbooks. Its engine (calc.ts) loads the first time a note needs it.
 */

let calc: typeof import("./calc") | undefined;
let loading: Promise<void> | undefined;

/** The engine, once loaded: everything but `load()` is only called after it. */
const loaded = () => calc!;

const engine: FormulaEngine = {
  id: "ironcalc",
  name: "IronCalc",
  load: () =>
    (loading ??= import("./calc")
      .then(async (module) => {
        await module.start();
        calc = module;
      })
      .catch((error: unknown) => {
        // Tried again the next time it's needed.
        loading = undefined;
        throw error;
      })),
  sheet: (find) => loaded().sheet(find),
  shift: (cells, axis, at, count) => loaded().shift(cells, axis, at, count),
  moveCells: (cells, area, rows, columns) => loaded().moveCells(cells, area, rows, columns),
  move: (formula, rows, columns) => loaded().move(formula, rows, columns),
  renameSheets: (formula, rename) => loaded().renameSheets(formula, rename),
  complete: (formula, cursor) => loaded().complete(formula, cursor),
  references: (formula) => loaded().references(formula),
  functions: () => loaded().functions(),
  readWorkbook: (data) => loaded().readWorkbook(data),
  writeWorkbook: (name, cells, find) => loaded().writeWorkbook(name, cells, find),
};

export const ironcalc = (): Plugin => ({
  id: "ironcalc",
  name: t("plugins.ironcalc"),
  description: t("plugins.ironcalc.description"),
  icon: "sigma",
  enabledByDefault: true,
  contributes: { formulas: [engine] },
});
