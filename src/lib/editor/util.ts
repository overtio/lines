import { syntaxTree } from "@codemirror/language";
import { searchPanelOpen } from "@codemirror/search";
import { type EditorSelection, type EditorState, type Line, Prec, type Range, StateEffect, type StateEffectType, StateField, type Text, type Transaction } from "@codemirror/state";
import { type Command, Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type WidgetType } from "@codemirror/view";
import type { SyntaxNode, SyntaxNodeRef, Tree } from "@lezer/common";
import { markupMode } from "./markupMode";

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

/**
 * The changes that make `before` into `after`, touching only the parts that differ: line by line
 * if they have as many lines (as a word renamed in several places does), so what's between those
 * stays as it is; else as one change.
 */
export function changesBetween(before: string, after: string) {
  const lines = before.split("\n");
  const others = after.split("\n");
  if (lines.length !== others.length) return [changeBetween(0, before, after)].filter((change) => change !== null);
  let at = 0;
  return lines.flatMap((line, i) => {
    const change = changeBetween(at, line, others[i]);
    at += line.length + 1;
    return change ? [change] : [];
  });
}

/** Says something was done (a todo ticked, a typing drill finished) to whatever cares in the window (a mascot, lib/mascot/), as a window event. */
export const cheer = () => dispatchEvent(new Event("lines:done"));

/** The lines a selection covers, each once; a range ending at a line's very start (as a triple click selects) stops before it. */
export function selectedLines(state: EditorState): Line[] {
  const { doc } = state;
  const lines = new Map<number, Line>();
  for (const range of state.selection.ranges) {
    const end = range.to > range.from && doc.lineAt(range.to).from === range.to ? range.to - 1 : range.to;
    for (let n = doc.lineAt(range.from).number; n <= doc.lineAt(end).number; n++) if (!lines.has(n)) lines.set(n, doc.line(n));
  }
  return [...lines.values()];
}

/** Whether line `n` exists and has text on it. */
export const hasText = (doc: Text, n: number) => n >= 1 && n <= doc.lines && !!doc.line(n).text.trim();

/**
 * Says `focus.of(true)` when an editor that has focus already is given a note (one opened from a
 * mention, say), which no focus event will tell; a field that keeps track of focus starts without it.
 */
export const focusAtStart = (focus: StateEffectType<boolean>) =>
  ViewPlugin.define((view) => {
    if (view.hasFocus) queueMicrotask(() => view.hasFocus && view.dispatch({ effects: focus.of(true) }));
    return {};
  });

const setFocus = StateEffect.define<boolean>();

/** Whether the editor has focus; a rendered block (table, diagram) shows its Markdown only while it does. */
export const focused = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFocus)) value = effect.value;
    return value;
  },
  provide: () => [EditorView.focusChangeEffect.of((_state, focusing) => setFocus.of(focusing)), focusAtStart(setFocus)],
});

/**
 * Whether the selection is being worked on, so the Markdown it's on shows: in an editor that has
 * focus, or while its find bar is open, the match it's on being the selection.
 */
export const selectionInUse = (state: EditorState) => !!state.field(focused, false) || searchPanelOpen(state);

/** Whether a transaction starts or stops the selection being worked on. */
export const selectionInUseChanged = (tr: Transaction) => selectionInUse(tr.startState) !== selectionInUse(tr.state);

/** `selectionInUse` for what a view draws, in any editor: whether it has focus, or its find bar is open. */
export const viewSelectionInUse = (view: EditorView) => view.hasFocus || searchPanelOpen(view.state);

/** Whether the cursor, or either end of a selection, is in `from`–`to`. */
const touches = (selection: EditorSelection, from: number, to: number) =>
  selection.ranges.some((range) => (range.anchor >= from && range.anchor <= to) || (range.head >= from && range.head <= to));

/**
 * Whether `from`–`to` shows its Markdown: where the cursor, or either end of a selection, is while
 * it's being worked on (`selectionInUse`), or everywhere while Markdown is all in sight (markupMode.ts).
 */
export function isEditing(state: EditorState, from: number, to: number) {
  return state.facet(markupMode) === "visible" || (selectionInUse(state) && touches(state.selection, from, to));
}

/**
 * A block (a diagram, a table, an image) drawn in place of the lines `from`–`to`, or, while they're
 * edited, below them.
 */
export const drawnBlock = (widget: WidgetType, from: number, to: number, below = false) =>
  below ? Decoration.widget({ widget, block: true, side: 1 }).range(to) : Decoration.replace({ widget, block: true }).range(from, to);

/** A part of the note, from the start of a line to the end of one. */
interface Part {
  from: number;
  to: number;
}

/** The start of the top-level block `pos` is in, or else of the last one before it (0 if there's none). */
const blockBefore = (tree: Tree, pos: number) => tree.topNode.childBefore(pos)?.from ?? 0;

/** `pos`, or the start of a top-level block in one of `trees` that runs across it. */
function notInBlock(trees: Tree[], pos: number) {
  for (let i = 0; i < trees.length; ) {
    const node = trees[i].topNode.childAfter(pos);
    if (node && node.from < pos) [pos, i] = [node.from, 0];
    else i++;
  }
  return pos;
}

/**
 * Where a change to the note changed its top-level blocks: from the block it starts in (as it was
 * parsed and as it is) to the first block after it that's the same as before, only moved; to the
 * end of the note if none is.
 */
function changedBlocks(tr: Transaction): Part {
  const { doc } = tr.state;
  const before = syntaxTree(tr.startState);
  const after = syntaxTree(tr.state);
  let start = -1;
  let endA = 0;
  let endB = 0;
  tr.changes.iterChangedRanges((_fromA, toA, fromB, toB) => {
    if (start < 0) start = fromB;
    [endA, endB] = [toA, toB];
  });
  const from = notInBlock([after, before], Math.min(blockBefore(after, start), blockBefore(before, start)));
  const moved = endB - endA;
  for (let node = after.topNode.childAfter(endB); node; node = node.nextSibling) {
    if (node.from <= endB) continue;
    const was = before.topNode.childAfter(node.from - moved);
    if (was?.from === node.from - moved && was.to + moved === node.to && was.name === node.name) {
      return { from: doc.lineAt(from).from, to: doc.lineAt(node.from).from - 1 };
    }
  }
  return { from: doc.lineAt(from).from, to: doc.length };
}

/** What `changedParts` found for each transaction, which every kind of drawn block asks. */
const changed = new WeakMap<Transaction, Part[]>();

/**
 * The parts of the note whose drawn blocks a transaction can change, each whole top-level blocks:
 * where the note or its parse changed, and, while the selection is worked on (`selectionInUse`),
 * around the cursor before and after, which shows or hides a block's Markdown.
 */
function changedParts(tr: Transaction): Part[] {
  let parts = changed.get(tr);
  if (!parts) changed.set(tr, (parts = findParts(tr)));
  return parts;
}

function findParts(tr: Transaction): Part[] {
  const { state, startState } = tr;
  const { doc } = state;
  const tree = syntaxTree(state);
  const before = syntaxTree(startState);
  const parts: Part[] = [];
  if (tr.docChanged) parts.push(changedBlocks(tr));
  // Parsed further than before (or not as far): from the last block it had, which can go on, to
  // the end. A code block's language loading parses its code again, which changes no blocks.
  const parsed = tr.changes.mapPos(before.length);
  if (parsed !== tree.length) {
    const from = Math.min(blockBefore(tree, Math.min(parsed, tree.length)), tr.changes.mapPos(blockBefore(before, before.length)));
    parts.push({ from: doc.lineAt(notInBlock([tree], from)).from, to: doc.length });
  }
  if (tr.docChanged || tr.selection || selectionInUseChanged(tr)) {
    const ends = (selection: EditorSelection, map: boolean) =>
      selection.ranges.flatMap((range) => [range.anchor, range.head]).map((pos) => (map ? tr.changes.mapPos(pos) : pos));
    const cursors = [...(selectionInUse(startState) ? ends(startState.selection, true) : []), ...(selectionInUse(state) ? ends(state.selection, false) : [])];
    for (const pos of cursors) {
      const line = doc.lineAt(pos);
      const block = tree.topNode.childAfter(line.from);
      parts.push(block && block.from <= line.to ? { from: doc.lineAt(block.from).from, to: Math.max(block.to, line.to) } : line);
    }
  }
  return parts
    .filter((part) => part.from <= part.to)
    .sort((a, b) => a.from - b.from)
    .reduce<Part[]>((merged, part) => {
      const last = merged.at(-1);
      if (last && part.from <= last.to + 1) last.to = Math.max(last.to, part.to);
      else merged.push({ ...part });
      return merged;
    }, []);
}

/**
 * The blocks `draw` makes (with `drawnBlock`) from the syntax nodes in the note's top-level blocks
 * and cards (`inside` says where else to look). They're drawn once, then moved along with the text;
 * a change draws again only the top-level blocks it touched, or whose parse it changed, and moving
 * the cursor only those it leaves or goes into, which shows or hides their Markdown. Everything is
 * drawn again when `also` says to.
 */
export function drawnBlocks(
  draw: (state: EditorState, node: SyntaxNodeRef) => Range<Decoration> | null,
  { inside = ["Document", "Card"], also }: { inside?: string[]; also?: (tr: Transaction) => boolean } = {},
) {
  const containers = new Set(inside);
  const collect = (state: EditorState, from: number, to: number) => {
    const blocks: Range<Decoration>[] = [];
    // Markdown as written draws none.
    if (state.facet(markupMode) === "source") return blocks;
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (containers.has(node.name)) return true;
        const block = draw(state, node);
        if (block) blocks.push(block);
        return false;
      },
    });
    return blocks;
  };
  const all = (state: EditorState) => Decoration.set(collect(state, 0, state.doc.length), true);
  return StateField.define<DecorationSet>({
    create: all,
    update(blocks, tr) {
      if (also?.(tr)) return all(tr.state);
      blocks = blocks.map(tr.changes);
      for (const { from, to } of changedParts(tr)) {
        blocks = blocks.update({ filterFrom: from, filterTo: to, filter: (start) => start < from || start > to, add: collect(tr.state, from, to), sort: true });
      }
      return blocks;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

/**
 * ↓ on the line above a block drawn in place of its Markdown, or ↑ on the line below it, goes onto
 * its first line or its last, which shows its Markdown, rather than past it as if it weren't there.
 */
function arrowInto(blocks: StateField<DecorationSet>, forward: boolean): Command {
  return (view) => {
    const { state } = view;
    const { doc } = state;
    const range = state.selection.main;
    if (state.selection.ranges.length > 1 || !range.empty) return false;
    const line = doc.lineAt(range.head);
    const n = line.number + (forward ? 1 : -1);
    // Within a line that wraps, ↑ and ↓ move along it.
    if (n < 1 || n > doc.lines || doc.lineAt(view.moveVertically(range, forward).head).number === line.number) return false;
    const next = doc.line(n);
    let drawn = false;
    state.field(blocks).between(next.from, next.to, (from, to, deco) => {
      if (from < to && deco.spec.block && doc.lineAt(forward ? from : to).number === n) drawn = true;
    });
    if (!drawn) return false;
    view.dispatch({ selection: { anchor: Math.min(next.from + range.head - line.from, next.to) }, scrollIntoView: true, userEvent: "select" });
    return true;
  };
}

/** ↑ and ↓ stop on the blocks drawn in place of their text in `blocks` (a field of decorations) rather than skipping them. */
export const arrowsInto = (blocks: StateField<DecorationSet>) =>
  Prec.high(
    keymap.of([
      { key: "ArrowDown", run: arrowInto(blocks, true) },
      { key: "ArrowUp", run: arrowInto(blocks, false) },
    ]),
  );

/** Where in the note the block drawn as `dom` is: one drawn below its Markdown sits just past its last line. */
export function blockPos(view: EditorView, dom: HTMLElement) {
  const pos = view.posAtDOM(dom);
  return dom.classList.contains("is-preview") ? Math.max(0, pos - 1) : pos;
}

/** Shows the code of the block whose opening fence is on the line at `pos`, with the cursor at its start. */
export function showCode(view: EditorView, pos: number) {
  const { doc } = view.state;
  const fence = doc.lineAt(pos);
  view.dispatch({ selection: { anchor: fence.number < doc.lines ? doc.line(fence.number + 1).from : fence.to }, scrollIntoView: true });
  view.focus();
}

/** What's drawn in a block that takes drags of its own (a 3D model, turned around): pressing it is a click only if it isn't dragged. */
export const INTERACTIVE = ".cm-lp-interactive";

/**
 * What's drawn in a block that takes clicks and keys of its own (a recording's player): the editor
 * leaves them alone, and Esc in it goes back to the note's text.
 */
export const OWN_INPUT = ".cm-lp-own-input";

/** Runs `click` once the button that went down in `event` comes up in the same place: unless it was a drag. */
export function whenClicked(event: MouseEvent, click: () => void) {
  const { clientX, clientY } = event;
  window.addEventListener("mouseup", (up) => Math.hypot(up.clientX - clientX, up.clientY - clientY) < 4 && click(), { once: true, capture: true });
}

/**
 * Clicking a block drawn from code (`selector`: math, a diagram) shows its code, but not a click on
 * its own controls (`controls`), or on one drawn below its code, which shows already.
 */
export const clickToShowCode = (selector: string, controls?: string) =>
  EditorView.domEventHandlers({
    mousedown(event, view) {
      const target = event.target as HTMLElement;
      const dom = target.closest<HTMLElement>(selector);
      if (!dom) return false;
      event.preventDefault();
      if (controls && target.closest(controls)) return true;
      if (event.button !== 0 || view.state.readOnly || dom.classList.contains("is-preview")) return true;
      const show = () => dom.isConnected && showCode(view, view.posAtDOM(dom));
      if (target.closest(INTERACTIVE)) whenClicked(event, show);
      else show();
      return true;
    },
  });
