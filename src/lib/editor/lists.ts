import { type EditorState, Prec, type Text } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { ancestors } from "./util";

/*
 * Tab and Shift-Tab on a list item nest it under the item above, or move it back out a level,
 * taking its own sub-items along. The indentation is whatever Markdown needs for that (two
 * spaces under "- ", three under "1. "); the editor draws each level the same, wider step.
 * Backspace right after an item's marker moves a nested item out a level, and turns a top-level
 * one into plain text. Enter there puts an empty item above it.
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

/**
 * The changes that number an ordered list's items from `item` on, starting at `number`, as far as
 * they were numbered one after another.
 */
function renumber(doc: Text, item: SyntaxNode | null, number: number) {
  const changes = [];
  for (let last = -1; item; item = item.nextSibling) {
    if (item.name !== "ListItem") continue;
    const mark = item.getChild("ListMark")!;
    const written = parseInt(doc.sliceString(mark.from, mark.to), 10);
    if (last >= 0 && written !== last + 1) break;
    last = written;
    if (written !== number) changes.push({ from: mark.from, to: mark.to - 1, insert: String(number) });
    number++;
  }
  return changes;
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

/**
 * Enter at the start of an item's text puts an empty item above it, the item keeping its checkbox
 * as it was. Right under a paragraph, a blank line goes first: an empty item there would be read as
 * part of the paragraph, and a `-` as a heading's underline.
 */
function itemAbove(view: EditorView) {
  const { state } = view;
  const { main } = state.selection;
  const item = main.empty && state.selection.ranges.length === 1 && !state.readOnly ? itemAt(state) : null;
  if (!item) return false;
  const { doc } = state;
  const mark = item.getChild("ListMark")!;
  const line = doc.lineAt(mark.from);
  const start = mark.to + AFTER_MARK.exec(doc.sliceString(mark.to, line.to))![0].length;
  if (main.head !== start || !doc.sliceString(start, line.to).trim()) return false;
  const list = item.parent!;
  let before = list.prevSibling;
  while (before?.name === "QuoteMark") before = before.prevSibling;
  const underParagraph =
    list.firstChild?.from === item.from && list.parent?.name !== "ListItem" && before?.name === "Paragraph" && doc.lineAt(before.to).number === line.number - 1;
  const blank = underParagraph ? `${QUOTES.exec(line.text)![0].trimEnd()}\n` : "";
  const changes = [{ from: line.from, to: line.from, insert: `${blank}${line.text.slice(0, start - line.from).replace(/\[[xX]\]/, "[ ]")}\n` }];
  if (list.name === "OrderedList") changes.push(...renumber(doc, item, parseInt(doc.sliceString(mark.from, mark.to), 10) + 1));
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  return true;
}

export const listKeymap = Prec.high(
  keymap.of([
    { key: "Tab", run: indentItem, shift: outdentItem },
    { key: "Backspace", run: deleteMarker },
    { key: "Enter", run: itemAbove },
  ]),
);
