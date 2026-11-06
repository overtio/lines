import { mount, tick, unmount } from "svelte";
import { focusEditable } from "../../lib/editor/rendered";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { BlockEditor, Cells, EditableBlock, MarkdownAddition, Renderer } from "../../lib/plugins/types";
import { parseCsv, trimCells, writeCsv } from "../../lib/sheets/csv";
import { showFormulas } from "../../lib/sheets/formulas";
import Grid from "./Grid.svelte";
import { printedCells } from "./sheet";
import type { Sheet } from "./state.svelte";

/*
 * Spreadsheets in Markdown notes: a ```csv code block drawn as a grid to work in, as a spreadsheet
 * note's is, its cells written back into the block as CSV. Other Markdown apps show the CSV; it
 * prints as a table, formulas worked out.
 */

/** A block's grid, kept up to date with its code. */
class BlockSheet implements Sheet {
  cells = $state.raw<Cells>([]);
  readOnly = $state(false);
  readonly fills = false;
  focus: Sheet["focus"];
  layout: Sheet["layout"];

  constructor(private readonly block: EditableBlock) {
    this.sync();
  }

  get label() {
    return t("sheet.label");
  }

  sync() {
    this.cells = parseCsv(this.block.source);
    this.readOnly = this.block.readOnly;
  }

  write(cells: Cells) {
    this.block.write(writeCsv(cells));
  }

  leave(up: boolean) {
    this.block.leave(up);
  }

  showText = () => this.block.showCode();
}

function editor(dom: HTMLElement, block: EditableBlock): BlockEditor {
  dom.classList.add("cm-sheet");
  const sheet = new BlockSheet(block);
  const grid = mount(Grid, { target: dom, props: { sheet, view: block.view } });
  return {
    update: () => sheet.sync(),
    focus: (from) => sheet.focus?.(from),
    layout: () => sheet.layout?.(),
    destroy: () => void unmount(grid),
  };
}

/** Printed, its cells as a table, once their formulas are worked out. */
async function render(source: string) {
  const cells = trimCells(parseCsv(source));
  const { table, elements } = printedCells(cells);
  await showFormulas(cells, elements, { pending: "doc-formula-pending", error: "doc-formula-error", number: "doc-number" });
  return table;
}

export const sheetBlock = (): Renderer => ({
  id: "spreadsheet",
  name: t("sheet.format"),
  languages: ["csv"],
  label: t("sheet.label"),
  render,
  editor,
});

/** "/Spreadsheet", which puts an empty one in. */
export const sheetCommand = (): MarkdownAddition => ({
  commands: [
    {
      ...named("editor.slash.spreadsheet"),
      after: "table",
      hint: "csv",
      icon: "sheet",
      section: SECTIONS.insert,
      apply: (view, from, to) => {
        // An empty grid, with the cursor on a line after it, then into its first cell once it's drawn.
        insert("```csv\n```\n|", true)(view, from, to);
        const { doc, selection } = view.state;
        const fence = doc.line(doc.lineAt(selection.main.head).number - 2).from;
        void tick().then(() => focusEditable(view, fence, "above"));
      },
    },
  ],
});
