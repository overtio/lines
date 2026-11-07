import { isolateHistory } from "@codemirror/commands";
import { Annotation, type EditorState, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Cells, FindSheet } from "../../lib/plugins/types";
import { changeBetween } from "../../lib/editor/util";
import { t } from "../../lib/i18n/index.svelte";
import { sameRows } from "../../lib/sheets/cells";
import { csvLine, trimCells } from "../../lib/sheets/csv";
import { type SheetChoice, sheetChoices, sheetFinder } from "./links";
import { readSheet, type SheetText, titleOf } from "./sheet";

/*
 * Between a spreadsheet's text, which the editor keeps (with its undo history), and the grid drawn
 * in its place (Grid.svelte): the grid shows the cells read from the text, and writes what's
 * changed back into it. The text is a spreadsheet note's, or a ```csv block's in a Markdown note.
 */

/** What a grid shows, and where it writes. */
export interface Sheet {
  /** Its cells as written, by row. */
  readonly cells: Cells;
  readonly readOnly: boolean;
  /** What screen readers call it. */
  readonly label: string;
  /** Whether it fills the editor, as a spreadsheet note's does, rather than being as tall as its rows, as a block in a note is. */
  readonly fills: boolean;
  /** Finds the other sheets its formulas name (links.ts). */
  readonly find: FindSheet;
  /** The other sheets its formulas can name, suggested while one's written. */
  sheets?(): SheetChoice[];
  /** A block's name, which others find it by; renamed, or named, from the grid. */
  readonly name?: string | null;
  rename?(name: string | null): void;
  /** A block's name for a formula elsewhere in its note: if it has none, the one it's given (Sheet1, Sheet2…) by `keepName`. */
  nameHere?(): string | null;
  /** Gives a block the name `nameHere` gave out, once the pointing's done, so the grid doesn't move under the pointer. */
  keepName?(): void;
  /** The title of the note it's in. */
  noteTitle(): string;
  /** Its name for a formula in another note: the note's title, and a block's name (or none for a note's first block without one). */
  nameElsewhere(): string | null;
  /** Turns a block into a Markdown table. */
  toTable?(): void;
  /** Writes its cells, changed, as one step to undo. */
  write(cells: Cells): void;
  /** Out of the grid, into the note's text above it or below. */
  leave(up: boolean): void;
  /** Shows its text in place of the grid, for a block. */
  showText?(): void;
  /** Set by the grid once it's drawn: takes the keyboard, at the cell it was on, or from the text above it or below. */
  focus?: (from?: "above" | "below") => void;
  /** Set by the grid: fits it to the editor again, after the editor's size or text size changes. */
  layout?: () => void;
}

/** A spreadsheet note as read, and while its CSV is as the grid last wrote it, each row's line of it. */
interface SheetState extends SheetText {
  lines: string[] | null;
}

/**
 * Cells the grid wrote, without empty rows and columns at the end, and the CSV lines it wrote them
 * as, after the title and a blank line: read back, they're the same cells, so they aren't read again.
 */
const written = Annotation.define<{ cells: Cells; lines: string[] }>();

/** The CSV's length, its rows' lines between line breaks. */
const csvLength = (lines: string[]) => lines.reduce((length, line) => length + line.length + 1, 0) - Math.min(1, lines.length);

/** The note read as a sheet, again whenever its text changes. */
export const sheetText = StateField.define<SheetState>({
  create: (state) => ({ ...readSheet(state.doc.toString()), lines: null }),
  update(text, tr) {
    if (!tr.docChanged) return text;
    const wrote = tr.annotation(written);
    const dataFrom = text.head.length + 2;
    if (wrote && tr.state.doc.length === dataFrom + csvLength(wrote.lines)) {
      return { head: text.head, dataFrom, cells: sameRows(text.cells, wrote.cells), lines: wrote.lines };
    }
    // Typing in the title leaves the cells as they are.
    let cellsChanged = false;
    tr.changes.iterChanges((_fromA, toA, _fromB, _toB, inserted) => {
      if (toA > text.head.length || inserted.toString().includes("\n")) cellsChanged = true;
    });
    if (cellsChanged) {
      const read = readSheet(tr.state.doc.toString());
      return { ...read, cells: sameRows(text.cells, read.cells), lines: null };
    }
    const head = tr.state.doc.line(1).text;
    return { ...text, head, dataFrom: text.dataFrom + head.length - text.head.length };
  },
});

/**
 * The change from a note's CSV lines `before` to as many `after`, after its title (`at`) and a blank
 * line: the part that differs, as comparing the whole text finds it, from comparing only the lines
 * from the first that differs to the last.
 */
function changedLines(at: number, before: string[], after: string[]) {
  let first = 0;
  while (first < before.length && before[first] === after[first]) first++;
  if (first === before.length) return null;
  let last = before.length - 1;
  while (before[last] === after[last]) last--;
  const was = before.slice(first, last + 1).join("\n");
  const now = after.slice(first, last + 1).join("\n");
  // Where one is the start or end of the other, the part that differs may reach into the lines around them.
  if (was.startsWith(now) || now.startsWith(was) || was.endsWith(now) || now.endsWith(was)) {
    return changeBetween(at, `\n\n${before.join("\n")}`, `\n\n${after.join("\n")}`);
  }
  let from = at + 2;
  for (let r = 0; r < first; r++) from += before[r].length + 1;
  return changeBetween(from, was, now);
}

/** A spreadsheet note's grid, below its title, kept up to date with the editor. */
export class NoteSheet implements Sheet {
  cells = $state.raw<Cells>([]);
  head = $state("");
  readOnly = $state(false);
  label = $derived(titleOf(this.head) || t("sheet.label"));
  readonly fills = true;
  readonly find = sheetFinder(null);
  sheets = () => sheetChoices(null, this.noteTitle());
  noteTitle = () => titleOf(this.head);
  nameElsewhere = () => this.noteTitle() || null;
  focus: Sheet["focus"];
  layout: Sheet["layout"];

  constructor(
    readonly view: EditorView,
    state: EditorState,
  ) {
    this.sync(state);
  }

  sync(state: EditorState) {
    const { cells, head } = state.field(sheetText);
    this.cells = cells;
    this.head = head;
    this.readOnly = state.readOnly;
  }

  write(cells: Cells) {
    const { state } = this.view;
    const text = state.field(sheetText);
    const rows = trimCells(cells);
    const lines = rows.map((row) => csvLine(row));
    // While the text is as last written, only the lines that changed are compared.
    const changes =
      text.lines?.length === lines.length ?
        changedLines(text.head.length, text.lines, lines)
      : changeBetween(text.head.length, state.doc.sliceString(text.head.length), `\n\n${lines.join("\n")}`);
    if (changes) this.view.dispatch({ changes, userEvent: "input.sheet", annotations: [isolateHistory.of("full"), written.of({ cells: rows, lines })] });
  }

  /** Up into the title; below, the grid goes on. */
  leave(up: boolean) {
    if (!up) return;
    this.view.focus();
    this.view.dispatch({ selection: { anchor: this.view.state.doc.line(1).to }, scrollIntoView: true });
  }
}

/** The grid each spreadsheet note's editor shows. */
export const sheets = new WeakMap<EditorView, NoteSheet>();
