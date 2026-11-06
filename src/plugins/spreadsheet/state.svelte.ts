import { isolateHistory } from "@codemirror/commands";
import { type EditorState, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Cells, FindSheet } from "../../lib/plugins/types";
import { changeBetween } from "../../lib/editor/util";
import { t } from "../../lib/i18n/index.svelte";
import { writeCsv } from "../../lib/sheets/csv";
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
  /** A block's name for a formula elsewhere in its note, given one (Sheet1, Sheet2…) if it has none, as that formula points at it. */
  nameHere?(): string | null;
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

/** The note read as a sheet, again whenever its text changes. */
export const sheetText = StateField.define<SheetText>({
  create: (state) => readSheet(state.doc.toString()),
  update(text, tr) {
    if (!tr.docChanged) return text;
    // Typing in the title leaves the cells as they are.
    let cellsChanged = false;
    tr.changes.iterChanges((_fromA, toA, _fromB, _toB, inserted) => {
      if (toA > text.head.length || inserted.toString().includes("\n")) cellsChanged = true;
    });
    if (cellsChanged) return readSheet(tr.state.doc.toString());
    const head = tr.state.doc.line(1).text;
    return { ...text, head, dataFrom: text.dataFrom + head.length - text.head.length };
  },
});

/** A spreadsheet note's grid, below its title, kept up to date with the editor. */
export class NoteSheet implements Sheet {
  cells = $state.raw<Cells>([]);
  head = $state("");
  readOnly = $state(false);
  label = $derived(titleOf(this.head) || t("sheet.label"));
  readonly fills = true;
  readonly find = sheetFinder(null);
  sheets = () => sheetChoices(null);
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
    const from = state.field(sheetText).head.length;
    const changes = changeBetween(from, state.doc.sliceString(from), `\n\n${writeCsv(cells)}`);
    if (changes) this.view.dispatch({ changes, userEvent: "input.sheet", annotations: isolateHistory.of("full") });
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
