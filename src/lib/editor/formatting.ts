import {
  EditorSelection,
  type EditorState,
  type Extension,
  type SelectionRange,
  StateEffect,
  StateField,
  type StateCommand,
} from "@codemirror/state";
import { EditorView, type Rect, showTooltip, type Tooltip, type TooltipView, ViewPlugin } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import { coarsePointer, isApple } from "../platform";
import { selectedBlock } from "./attachments";
import { ancestors } from "./util";

/*
 * Inline formatting: bold, italic, strikethrough, code and highlight. The shortcuts and the
 * toolbar that appears over selected text both toggle it, using the parse tree to tell whether
 * the selection is already formatted (so italic on bold text adds italic instead of eating one
 * of the bold's asterisks).
 */

interface Format {
  name: string;
  icon: IconName;
  shortcut: string;
  marker: string;
  /** The syntax node for text formatted this way, and the node for its markers. */
  node: string;
  mark: string;
}

const key = (k: string, shift = false) => (isApple ? `${shift ? "⇧" : ""}⌘${k}` : `Ctrl+${shift ? "Shift+" : ""}${k}`);

export const FORMATS = {
  bold: { name: "Bold", icon: "bold", shortcut: key("B"), marker: "**", node: "StrongEmphasis", mark: "EmphasisMark" },
  italic: { name: "Italic", icon: "italic", shortcut: key("I"), marker: "*", node: "Emphasis", mark: "EmphasisMark" },
  strike: { name: "Strikethrough", icon: "strikethrough", shortcut: key("X", true), marker: "~~", node: "Strikethrough", mark: "StrikethroughMark" },
  code: { name: "Code", icon: "code", shortcut: key("E"), marker: "`", node: "InlineCode", mark: "CodeMark" },
  highlight: { name: "Highlight", icon: "highlighter", shortcut: key("H", true), marker: "==", node: "Highlight", mark: "HighlightMark" },
} satisfies Record<string, Format>;

export type FormatId = keyof typeof FORMATS;

/** Whatever a line starts with before its text: indentation, `#`, `>`, list markers, a checkbox. */
const LINE_PREFIX = /^\s*(?:(?:#{1,6}|>|[-*+](?:\s+\[[ xX]\])?|\d+[.)])(?:\s+|$))*/;

/** Lines that are all markup: code fences, card fences, a table's |---| row. */
const MARKUP_LINE = /^\s*(?:`{3,}|~{3,}|:{3,}|\|?\s*:?-+:?\s*\|[\s|:-]*$)/;

/** Code blocks, where formatting markers would just be text. */
const CODE_BLOCKS = new Set(["FencedCode", "CodeBlock"]);

/** The parts of `range` to format: on each line, the selected text without its prefix or edge spaces. */
function segments(state: EditorState, range: SelectionRange) {
  const parts: { from: number; to: number }[] = [];
  for (let pos = range.from; pos <= range.to; ) {
    const line = state.doc.lineAt(pos);
    pos = line.to + 1;
    if (MARKUP_LINE.test(line.text)) continue;
    let from = Math.max(range.from, line.from + LINE_PREFIX.exec(line.text)![0].length);
    let to = Math.min(range.to, line.to);
    const text = state.sliceDoc(from, to);
    from += text.length - text.trimStart().length;
    to -= text.length - text.trimEnd().length;
    if (from < to) parts.push({ from, to });
  }
  return parts;
}

/** The `format` node that contains `from`–`to` (markers included or not). */
function formatNode(state: EditorState, format: Format, from: number, to: number): SyntaxNode | null {
  for (const node of ancestors(state, from, 1)) {
    if (node.name === format.node && node.from <= from && node.to >= to) return node;
  }
  return null;
}

/** Whether all of the selected text is formatted that way. */
export function isFormatted(state: EditorState, id: FormatId) {
  const format = FORMATS[id];
  const parts = state.selection.ranges.flatMap((range) => segments(state, range));
  return parts.length > 0 && parts.every((part) => formatNode(state, format, part.from, part.to));
}

/** Formats the selection, or removes the formatting if it's all formatted already. */
export function toggleFormat(id: FormatId): StateCommand {
  const format = FORMATS[id];
  return ({ state, dispatch }) => {
    if (state.readOnly) return false;
    const remove = isFormatted(state, id);
    const tr = state.changeByRange((range) => {
      if (range.empty) {
        // Nothing selected: put the cursor between a new pair of markers.
        return {
          changes: { from: range.from, insert: format.marker + format.marker },
          range: EditorSelection.cursor(range.from + format.marker.length),
        };
      }
      const changes: { from: number; to?: number; insert?: string }[] = [];
      const seen = new Set<number>();
      for (const part of segments(state, range)) {
        const node = formatNode(state, format, part.from, part.to);
        if (remove && node && !seen.has(node.from)) {
          seen.add(node.from);
          const marks = node.getChildren(format.mark);
          const open = marks[0];
          const close = marks[marks.length - 1];
          if (open && close && open !== close) changes.push({ from: open.from, to: open.to }, { from: close.from, to: close.to });
        } else if (!remove && !node) {
          changes.push({ from: part.from, insert: format.marker }, { from: part.to, insert: format.marker });
        }
      }
      const set = state.changes(changes);
      // Keep the same text selected, without the markers.
      return { changes: set, range: EditorSelection.range(set.mapPos(range.from, 1), set.mapPos(range.to, -1)) };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

/* The toolbar over selected text. */

const pointer = StateEffect.define<boolean>();
const focus = StateEffect.define<boolean>();
const dismiss = StateEffect.define<null>();

interface ToolbarState {
  /** A mouse button is down, e.g. while dragging out a selection; the toolbar waits for it. */
  pointerDown: boolean;
  focused: boolean;
  /** Escape hid it; it comes back with the next selection. */
  dismissed: boolean;
}

const toolbarState = StateField.define<ToolbarState>({
  create: () => ({ pointerDown: false, focused: false, dismissed: false }),
  update(value, tr) {
    let next = tr.selection ? { ...value, dismissed: false } : value;
    for (const effect of tr.effects) {
      if (effect.is(pointer)) next = { ...next, pointerDown: effect.value };
      if (effect.is(focus)) next = { ...next, focused: effect.value };
      if (effect.is(dismiss)) next = { ...next, dismissed: true };
    }
    return next;
  },
  provide: (field) =>
    showTooltip.compute([field, "selection"], (state) => {
      const { pointerDown, focused, dismissed } = state.field(field);
      const range = state.selection.main;
      if (pointerDown || !focused || dismissed || range.empty || state.readOnly) return null;
      if (!segments(state, range).length || inCodeBlock(state, range.head) || selectedBlock(state)) return null;
      return toolbarTooltip(range);
    }),
});

function inCodeBlock(state: EditorState, pos: number) {
  for (const node of ancestors(state, pos, -1)) {
    if (CODE_BLOCKS.has(node.name)) return true;
  }
  return false;
}

function toolbarTooltip(range: SelectionRange): Tooltip {
  return {
    pos: range.from,
    end: range.to,
    // On touch screens the system's own menu goes above the selection, so this goes below.
    above: !coarsePointer.matches,
    strictSide: false,
    arrow: false,
    create: createToolbar,
  };
}

function createToolbar(view: EditorView): TooltipView {
  const dom = document.createElement("div");
  dom.className = "cm-format-bar";
  dom.setAttribute("role", "toolbar");
  dom.setAttribute("aria-label", "Format");
  // Keep the editor focused and the selection as it is.
  dom.addEventListener("mousedown", (event) => event.preventDefault());
  const icons: Record<string, unknown>[] = [];
  const buttons = (Object.keys(FORMATS) as FormatId[]).map((id) => {
    const format = FORMATS[id];
    const button = document.createElement("button");
    button.type = "button";
    button.title = `${format.name} (${format.shortcut})`;
    button.setAttribute("aria-label", format.name);
    icons.push(mount(Icon, { target: button, props: { name: format.icon, size: 16, strokeWidth: 2 } }));
    button.addEventListener("click", () => {
      toggleFormat(id)(view);
      view.focus();
    });
    dom.append(button);
    return { id, button };
  });
  const sync = (state: EditorState) => {
    for (const { id, button } of buttons) {
      const on = isFormatted(state, id);
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    }
  };
  sync(view.state);
  return {
    dom,
    offset: { x: 0, y: 6 },
    update(update) {
      if (update.docChanged || update.selectionSet) sync(update.state);
    },
    // Centred over the selection's first line, rather than starting where it starts.
    getCoords(pos) {
      const range = view.state.selection.main;
      const end = view.coordsAtPos(range.to, -1);
      // The start can be scrolled out of the drawn part (⌘A at the bottom of a long note).
      const start = view.coordsAtPos(pos, 1) ?? view.coordsAtPos(pos) ?? end;
      // Without coordinates CodeMirror hides the tooltip, though the type doesn't say so.
      if (!start) return null as unknown as Rect;
      const sameLine = end && Math.abs(end.top - start.top) < 4;
      const centre = sameLine ? (start.left + end.right) / 2 : start.left + dom.offsetWidth / 2;
      const left = centre - dom.offsetWidth / 2;
      // Below the selection's last line on touch screens.
      const box = !coarsePointer.matches || !end ? start : end;
      return { left, right: left + dom.offsetWidth, top: box.top, bottom: box.bottom };
    },
    destroy() {
      for (const icon of icons) void unmount(icon);
    },
  };
}

/** Tells the toolbar when a mouse button is down and when the editor has focus. */
const watchPointer = ViewPlugin.fromClass(
  class {
    destroyed = false;
    constructor(readonly view: EditorView) {
      view.contentDOM.addEventListener("mousedown", this.down);
    }
    down = (event: MouseEvent) => {
      if (event.button !== 0) return;
      this.view.dispatch({ effects: pointer.of(true) });
      addEventListener("mouseup", this.up, { once: true });
    };
    up = () => {
      // After CodeMirror has finished its own mouseup handling.
      setTimeout(() => this.destroyed || this.view.dispatch({ effects: pointer.of(false) }));
    };
    destroy() {
      this.destroyed = true;
      this.view.contentDOM.removeEventListener("mousedown", this.down);
      removeEventListener("mouseup", this.up);
    }
  },
);

const hideOnEscape = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key !== "Escape" || !view.state.field(toolbarState).focused || view.state.selection.main.empty) return false;
    if (view.state.field(toolbarState).dismissed) return false;
    view.dispatch({ effects: dismiss.of(null) });
    return true;
  },
});

export const formatToolbar: Extension = [
  toolbarState,
  watchPointer,
  hideOnEscape,
  EditorView.focusChangeEffect.of((_state, focusing) => focus.of(focusing)),
];
