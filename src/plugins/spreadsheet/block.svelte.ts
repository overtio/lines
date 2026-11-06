import { isolateHistory } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { mount, tick, unmount } from "svelte";
import { fenceAt, focusEditable } from "../../lib/editor/rendered";
import { tableMarkdown } from "../../lib/editor/tables";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { BlockEditor, Cells, EditableBlock, FindSheet, MarkdownAddition, Renderer } from "../../lib/plugins/types";
import { parseCsv, trimCells, writeCsv } from "../../lib/sheets/csv";
import { showFormulas } from "../../lib/sheets/formulas";
import Grid from "./Grid.svelte";
import { plugins } from "../../lib/plugins/registry.svelte";
import { blockNames, sheetChoices, sheetFinder } from "./links";
import { settle } from "./renames.svelte";
import { printedCell, printedCells } from "./sheet";
import type { Sheet } from "./state.svelte";

/*
 * Spreadsheets in Markdown notes: a ```csv code block drawn as a grid to work in, as a spreadsheet
 * note's is, its cells written back into the block as CSV. Other Markdown apps show the CSV; it
 * prints as a table, formulas worked out. Named (```csv name=costs), other blocks and notes can
 * use its cells (links.ts).
 */

/** A block's grid, kept up to date with its code. */
class BlockSheet implements Sheet {
  cells = $state.raw<Cells>([]);
  readOnly = $state(false);
  name = $state<string | null>(null);
  readonly fills = false;
  focus: Sheet["focus"];
  layout: Sheet["layout"];
  /** The note's text, for the blocks in it that its formulas name. */
  #note = $state("");
  #source: string | null = null;

  constructor(private readonly block: EditableBlock) {
    this.sync();
  }

  get label() {
    return this.name ? t("sheet.named", { name: this.name }) : t("sheet.label");
  }

  sync() {
    if (this.block.source !== this.#source) {
      this.#source = this.block.source;
      this.cells = parseCsv(this.#source);
    }
    this.readOnly = this.block.readOnly;
    this.name = this.block.name;
    this.#note = this.block.view.state.doc.toString();
  }

  find: FindSheet = (name) => sheetFinder(this.#note)(name);
  sheets = () => sheetChoices(this.#note);

  nameHere = () => {
    if (this.name) return this.name;
    if (this.readOnly) return null;
    // Sheet1, or the next number no block in the note has.
    const taken = new Set(blockNames(this.#note).map((name) => name?.toLocaleLowerCase()));
    let n = 1;
    while (taken.has(t("sheet.defaultName", { n }).toLocaleLowerCase())) n++;
    const name = t("sheet.defaultName", { n });
    this.rename(name);
    return name;
  };

  noteTitle = () => plugins.language().meta(this.#note).title;

  nameElsewhere = () => {
    const title = this.noteTitle();
    if (!title) return null;
    // A note's first block is the note's own sheet, by its title alone.
    const first = !blockNames(this.#note.slice(0, this.block.from)).length;
    if (first && !this.name) return title;
    const name = this.nameHere();
    return name && `${title}/${name}`;
  };

  write(cells: Cells) {
    // Empty rows and columns at the end kept: they're its size.
    this.block.write(writeCsv(cells, ",", true));
  }

  rename(name: string | null) {
    this.block.rename(name);
    // Its formulas, and others', name it so at once.
    settle();
  }

  toTable = () => toTable(this.block.view, this.block.from);

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

/** Printed, its cells as a table, once their formulas are worked out (with the blocks of the `note` it's in that they name). */
async function render(source: string, { note }: { note?: string }) {
  const cells = trimCells(parseCsv(source));
  const { table, elements } = printedCells(cells, printedCell);
  const classes = { pending: "doc-formula-pending", error: "doc-formula-error", number: "doc-number" };
  await showFormulas(cells, elements, classes, { find: sheetFinder(note ?? null), show: printedCell });
  return table;
}

/** The block at `pos` as a Markdown table, its first row the header, so its formulas still point at the same cells. */
function toTable(view: EditorView, pos: number) {
  const node = fenceAt(view.state, pos);
  if (!node || view.state.readOnly) return;
  const { doc } = view.state;
  const code = node.getChild("CodeText");
  const cells = trimCells(parseCsv(code ? view.state.sliceDoc(code.from, code.to) : ""));
  const from = doc.lineAt(node.from).from;
  const to = doc.lineAt(node.to).to;
  const insert = tableMarkdown(cells.length ? cells : [["", ""]]);
  // The cursor on the line after it, so it shows as a table.
  const selection = to < doc.length ? { anchor: from + insert.length + 1 } : undefined;
  view.dispatch({ changes: { from, to, insert }, selection, userEvent: "input", annotations: isolateHistory.of("full") });
  view.focus();
}

export const sheetBlock = (): Renderer => ({
  id: "spreadsheet",
  name: t("sheet.format"),
  languages: ["csv"],
  label: t("sheet.label"),
  render,
  editor,
  actions: [{ label: t("sheet.toTable"), icon: "table", run: toTable }],
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
