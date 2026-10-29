import { type EditorState, Prec, type Text } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { ancestors } from "./util";

/*
 * Tab and Shift-Tab on a list item nest it under the item above, or move it back out a level,
 * taking its own sub-items along. The indentation is whatever Markdown needs for that (two
 * spaces under "- ", three under "1. "); the editor draws each level the same, wider step.
 * Backspace right after an item's marker moves a nested item out a level, and turns a top-level
 * one into plain text.
 */

/** The list item whose marker is on the cursor's line. */
function itemAt(state: EditorState): SyntaxNode | null {
  const { main } = state.selection;
  const line = state.doc.lineAt(main.head);
  if (state.doc.lineAt(main.anchor).number !== line.number) return null;
  for (const node of ancestors(state, line.to, -1)) {
    if (node.name !== "ListItem") continue;
    const mark = node.getChild("ListMark");
    if (mark && state.doc.lineAt(mark.from).number === line.number) return node;
  }
  return null;
}

/** The column where an item's marker starts. */
function markerColumn(doc: Text, item: SyntaxNode) {
  const mark = item.getChild("ListMark")!;
  return mark.from - doc.lineAt(mark.from).from;
}

/** Quote markers a line starts with; indentation goes after them. */
const QUOTES = /^(?:[ \t]*>[ ]?)*/;

/** Shifts every line of `item` (and its sub-items) by `delta` columns. */
function shift(view: EditorView, item: SyntaxNode, delta: number) {
  const { doc } = view.state;
  const changes = [];
  for (let n = doc.lineAt(item.from).number; n <= doc.lineAt(item.to).number; n++) {
    const line = doc.line(n);
    if (!line.text.trim()) continue;
    const from = line.from + QUOTES.exec(line.text)![0].length;
    if (delta > 0) changes.push({ from, insert: " ".repeat(delta) });
    else changes.push({ from, to: from + Math.min(-delta, /^ */.exec(doc.sliceString(from, line.to))![0].length) });
  }
  view.dispatch({ changes, scrollIntoView: true, userEvent: delta > 0 ? "input.indent" : "delete.dedent" });
}

function indentItem(view: EditorView) {
  const { state } = view;
  const item = state.readOnly ? null : itemAt(state);
  if (!item) return false;
  // In a quote, each line's ">" sits between the items.
  let above = item.prevSibling;
  while (above?.name === "QuoteMark") above = above.prevSibling;
  // The first item of a list has nothing to go under; keep Tab from typing spaces anyway.
  if (above?.name !== "ListItem") return true;
  // Line it up with the text of the item above, which is what makes it that item's child.
  const mark = above.getChild("ListMark")!;
  const target = mark.to + 1 - state.doc.lineAt(mark.from).from;
  shift(view, item, target - markerColumn(state.doc, item));
  return true;
}

function outdentItem(view: EditorView) {
  const { state } = view;
  const item = state.readOnly ? null : itemAt(state);
  if (!item) return false;
  const parent = item.parent?.parent;
  if (parent?.name !== "ListItem") return true;
  shift(view, item, markerColumn(state.doc, parent) - markerColumn(state.doc, item));
  return true;
}

/** The space and checkbox after a list marker. */
const AFTER_MARK = /^[ \t]*(?:\[[ xX]\](?=\s|$)[ \t]*)?/;

function deleteMarker(view: EditorView) {
  const { state } = view;
  const { main } = state.selection;
  const item = main.empty && !state.readOnly ? itemAt(state) : null;
  if (!item) return false;
  const mark = item.getChild("ListMark")!;
  const line = state.doc.lineAt(mark.from);
  if (main.head !== mark.to + AFTER_MARK.exec(state.doc.sliceString(mark.to, line.to))![0].length) return false;
  if (item.parent?.parent?.name === "ListItem") return outdentItem(view);
  const from = line.from + QUOTES.exec(line.text)![0].length;
  view.dispatch({ changes: { from, to: main.head }, scrollIntoView: true, userEvent: "delete.backward" });
  return true;
}

export const listKeymap = Prec.high(
  keymap.of([
    { key: "Tab", run: indentItem, shift: outdentItem },
    { key: "Backspace", run: deleteMarker },
  ]),
);
