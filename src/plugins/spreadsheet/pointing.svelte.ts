import type { EditorView } from "@codemirror/view";
import { t } from "../../lib/i18n/index.svelte";
import { floating } from "../../lib/components/ui/styles";
import { announce, onAnnounce } from "../../lib/windows/channel";

/*
 * Pointing at cells for a formula being written in another grid: in the same note, the note beside
 * it, or another window or browser tab of lines. The grid writing the formula, where a reference can
 * go, is the writer; a click or drag on any other grid writes those cells' reference there
 * (`Sheet1!B3`, `Budget!B3`), across windows by way of the windows' channel.
 *
 * In another window, the formula waits there while cells are pointed at here, and a note at the
 * bottom says so: Return finishes it (as does a click anywhere but a cell), and Esc leaves it as
 * it was.
 */

export type Point = { row: number; column: number };

export interface Writer {
  view: EditorView;
  grid: symbol;
  /** The title of the note it's in, for the other windows' note. */
  note: string;
  /** Writes a reference to the cells from `anchor` to `corner` of the sheet called `sheet`. */
  point(sheet: string, anchor: Point, corner: Point): void;
  /** Finishes the formula, keeping it or leaving the cell as it was. */
  done(keep: boolean): void;
  /** Takes down the outlines of the cells pointed at for it, once it's done. */
  unmark: Set<() => void>;
}

class Pointing {
  /** The grid in this window writing a formula where a reference can go. */
  writer: Writer | null = null;
  /** The title of the note whose formula another window or tab is writing, so a click on a grid here points for it; null if none is. */
  remote = $state<string | null>(null);
  /** Outlines here of cells pointed at for another window's formula. */
  remoteMarks = new Set<() => void>();

  start(writer: Writer) {
    this.writer = writer;
    void announce({ type: "sheet-writer", writing: true, note: writer.note });
  }

  stop(writer: Writer) {
    // After the update that stops it (the grids' outlines are their state, which an effect shouldn't set).
    queueMicrotask(() => {
      for (const unmark of writer.unmark) unmark();
    });
    if (this.writer !== writer) return;
    this.writer = null;
    void announce({ type: "sheet-writer", writing: false, note: writer.note });
  }

  /** Cells pointed at here for the formula in another window. */
  send(sheet: string, anchor: Point, corner: Point) {
    void announce({ type: "sheet-point", sheet, anchor, corner });
  }

  /** Finishes the other window's formula from here (Return, Esc, or a click elsewhere), and points no more. */
  finish(keep: boolean) {
    void announce({ type: "sheet-done", keep });
    this.release();
  }

  release() {
    this.remote = null;
    for (const unmark of this.remoteMarks) unmark();
    this.remoteMarks.clear();
  }
}

export const pointing = new Pointing();

void onAnnounce((message) => {
  if (message.type === "sheet-point") pointing.writer?.point(message.sheet, message.anchor, message.corner);
  else if (message.type === "sheet-done") pointing.writer?.done(message.keep);
  else if (message.type === "sheet-writer") {
    if (message.writing) pointing.remote = message.note;
    else pointing.release();
  }
});

// Pointing here for another window: Return and Esc finish its formula, as a click on anything but a cell does.
const pointingHere = () => pointing.remote !== null && !pointing.writer;
addEventListener(
  "keydown",
  (event) => {
    if (!pointingHere() || (event.key !== "Enter" && event.key !== "Escape")) return;
    event.preventDefault();
    event.stopPropagation();
    pointing.finish(event.key === "Enter");
  },
  true,
);
addEventListener(
  "pointerdown",
  (event) => {
    if (pointingHere() && !(event.target as Element | null)?.closest?.(".cm-sheet [data-row]")) pointing.finish(true);
  },
  true,
);

// The note saying so, at the bottom of the window.
$effect.root(() => {
  $effect(() => {
    const note = pointing.remote;
    if (note === null || pointing.writer) return;
    const bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.className = `${floating} fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 font-ui text-sm text-fg`;
    bar.textContent = t("sheet.pointingFor", { note: note || t("list.untitled") });
    document.body.append(bar);
    return () => bar.remove();
  });
});
