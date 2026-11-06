import { t } from "../../lib/i18n/index.svelte";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import { plugins } from "../../lib/plugins/registry.svelte";
import type { Cells, NoteExport, Plugin } from "../../lib/plugins/types";
import { el, type Parts } from "../../lib/print/parts";
import { isFormula } from "../../lib/sheets/cells";
import { parseCsv, sniffDelimiter, writeCsv } from "../../lib/sheets/csv";
import { calculate, loadFormulas, loadedFormulas } from "../../lib/sheets/formulas";
import { sheetBlock, sheetCommand } from "./block.svelte";
import { sheetEditing } from "./editor";
import { sheetFinder } from "./links";
import { printedCell, printedCells, readSheet, sheetBody, sheetCells, sheetCsv, tagsOf, titleOf } from "./sheet";

/*
 * Spreadsheet notes: cells and formulas, kept as CSV under the note's title (sheet.ts), and drawn
 * as a grid to work in (editor.ts). Their formulas are worked out by the formula engine that's on
 * (IronCalc's plugin); with none, they show as written. They open CSV and Excel files, and
 * download as either, with their formulas or just the values they work out to. In Markdown notes,
 * a ```csv code block is drawn as a grid too (block.svelte.ts).
 */

/** Its cells as they show: formulas worked out, if the engine has loaded. */
function values(cells: Cells): Cells {
  const engine = loadedFormulas();
  return engine ? calculate(engine, cells, sheetFinder(null)).map((row) => row.map((value) => value.text)) : cells;
}

function meta(body: string): NoteMeta {
  const { head, cells } = readSheet(body);
  return {
    title: titleOf(head),
    excerpt: cells
      .flat()
      .filter((cell) => cell && !isFormula(cell))
      .join(" ")
      .slice(0, 200),
    tags: tagsOf(head),
    hasOpenTodos: false,
    searchText: body.toLowerCase(),
    properties: [],
    type: "",
  };
}

/** Its title, then its cells as a table, formulas worked out. */
function print(body: string, parts: Parts): HTMLElement {
  const cells = sheetCells(body);
  const { table, elements } = printedCells(cells, printedCell);
  parts.formulas(cells, elements, { numbers: true, find: sheetFinder(null), show: printedCell });
  const title = titleOf(readSheet(body).head);
  return el("div", "doc doc-sheet", ...(title ? [el("h1", "", title)] : []), table);
}

/** Its first line with `#tag` added after its title, unless it has it. */
function addTag(body: string, tag: string) {
  const { head } = readSheet(body);
  if (tagsOf(head).includes(tag)) return body;
  return `${head.replace(/\s+$/, "")}${head.trim() ? " " : ""}#${tag}${body.slice(head.length)}`;
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const encode = (text: string) => new TextEncoder().encode(text);

/** Downloads besides its CSV (formulas and all): just the values, and an Excel workbook. Both need the formula engine. */
const downloads = (): NoteExport[] => [
  {
    label: t("sheet.downloadValues"),
    icon: "download",
    extension: "csv",
    mimeType: "text/csv",
    write: async (body) => {
      await loadFormulas();
      return encode(`${writeCsv(values(sheetCells(body)))}\n`);
    },
  },
  {
    label: t("sheet.downloadWorkbook"),
    icon: "download",
    extension: "xlsx",
    mimeType: XLSX,
    write: async (body) => {
      const engine = await loadFormulas();
      if (!engine?.writeWorkbook) throw new Error(t("sheet.noEngine"));
      return engine.writeWorkbook(titleOf(readSheet(body).head) || t("sheet.label"), sheetCells(body), sheetFinder(null));
    },
  },
];

/** A spreadsheet note for each sheet of a workbook, or one for a CSV file, titled by the file's name. */
async function read({ name, data }: { name: string; data: Uint8Array }) {
  const dot = name.lastIndexOf(".");
  const title = (dot > 0 ? name.slice(0, dot) : name).replace(/\s+/g, " ").trim();
  if (name.toLowerCase().endsWith(".xlsx")) {
    const engine = await loadFormulas();
    if (!engine?.readWorkbook) throw new Error(t("sheet.noEngine"));
    const sheets = engine.readWorkbook(data);
    return sheets.map((sheet) => sheetBody(sheets.length > 1 ? `${title} – ${sheet.name}` : title, sheet.cells));
  }
  const text = new TextDecoder().decode(data);
  const delimiter = name.toLowerCase().endsWith(".tsv") ? "\t" : sniffDelimiter(text);
  return [sheetBody(title, parseCsv(text, delimiter))];
}

export const spreadsheet = (): Plugin => ({
  id: "spreadsheet",
  name: t("plugins.spreadsheet"),
  description: t("plugins.spreadsheet.description"),
  icon: "sheet",
  enabledByDefault: true,
  contributes: {
    languages: [
      {
        id: "spreadsheet",
        name: t("sheet.format"),
        extensions: ["csv"],
        mimeType: "text/csv",
        editor: () => sheetEditing,
        meta,
        // Its title, then its cells as tab-separated values, as other apps paste them.
        plainText: (body) => [titleOf(readSheet(body).head), writeCsv(values(sheetCells(body)), "\t")].filter(Boolean).join("\n\n"),
        stats: (body) => {
          const { head, cells } = readSheet(body);
          return countLines([{ text: titleOf(head), heading: true }, ...cells.map((row) => ({ text: row.filter((cell) => !isFormula(cell)).join(" "), heading: false }))]);
        },
        addTag,
        newNote: ({ tag }) => (tag ? `#${tag}\n\n` : "\n\n"),
        file: sheetCsv,
        print,
        copyAs: { name: "CSV", text: sheetCsv },
        get exports() {
          return plugins.formulas ? downloads() : [];
        },
        opens: ["tsv", "xlsx"],
        read,
      },
    ],
    renderers: [sheetBlock()],
    markdown: [sheetCommand()],
  },
});
