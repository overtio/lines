import { syntaxTree } from "@codemirror/language";
import { type EditorState, StateEffect, StateField, type Text, type Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/** The syntax node at `pos` and each node it's inside, innermost first. */
export function* ancestors(state: EditorState, pos: number, side: -1 | 0 | 1 = 0): Generator<SyntaxNode> {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); node; node = node.parent) yield node;
}

/**
 * Text at `from` changed from `before` to `after`, as a change of only the part that differs, so
 * what's around it stays put (and the cursors in it); null if nothing does.
 */
export function changeBetween(from: number, before: string, after: string) {
  if (before === after) return null;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return { from: from + start, to: from + before.length - end, insert: after.slice(start, after.length - end) };
}

/** Whether line `n` exists and has text on it. */
export const hasText = (doc: Text, n: number) => n >= 1 && n <= doc.lines && !!doc.line(n).text.trim();

const setFocus = StateEffect.define<boolean>();

/** Whether the editor has focus; a rendered block (table, diagram) shows its Markdown only while it does. */
export const focused = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFocus)) value = effect.value;
    return value;
  },
  provide: () => EditorView.focusChangeEffect.of((_state, focusing) => setFocus.of(focusing)),
});

export const focusChanged = (tr: Transaction) => tr.effects.some((effect) => effect.is(setFocus));

/** Whether the cursor, or either end of a selection, is in `from`–`to` of a focused editor. */
export function isEditing(state: EditorState, from: number, to: number) {
  if (!state.field(focused)) return false;
  const inside = (pos: number) => pos >= from && pos <= to;
  return state.selection.ranges.some((range) => inside(range.anchor) || inside(range.head));
}
