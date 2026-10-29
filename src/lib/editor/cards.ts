import { syntaxTree } from "@codemirror/language";
import { type EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, layer, RectangleMarker, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import { ICONS, type IconName } from "../icons/icons";
import { ui } from "../ui.svelte";
import { ancestors, hasText } from "./util";

/*
 * Cards: Markdown between `::: card` and `:::`. The text inside is decorated like any other
 * (see livePreview), inset from the card's edges; this draws the cards themselves behind it.
 */

/**
 * Callouts: cards named for what they hold, tinted in their own color, with an icon in a column
 * on the left. Each has a long name and a short one (`:::warning` or `:::!`), and an icon of its
 * own unless the fence names another (`:::! icon=flag`) or none (`:::! icon=none`).
 */
export const CALLOUTS = {
  info: { short: "i", label: "Info", icon: "info" },
  question: { short: "?", label: "Question", icon: "circle-question" },
  warning: { short: "!", label: "Warning", icon: "triangle-alert" },
  error: { short: "!!!", label: "Error", icon: "octagon-x" },
  decision: { short: "^", label: "Decision", icon: "signpost" },
} satisfies Record<string, { short: string; label: string; icon: IconName }>;

export type CalloutKind = keyof typeof CALLOUTS;

/** The icon column of a callout, and the icon in it, in the editor's font size. Match editor.css. */
export const CALLOUT_GUTTER = 1.8;

export interface Callout {
  kind: CalloutKind;
  /** The icon it shows, if any. */
  icon: IconName | null;
  /** Whether its fence chose the icon (or none), rather than leaving the kind's own. */
  chosen: boolean;
}

/** The callout a card's opening fence makes, if it makes one. */
export function calloutOf(fence: string): Callout | null {
  const match = /^\s*:{3,}\s*([!?^]+|[a-z]+)(\s.*)?$/i.exec(fence);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const kind = (Object.keys(CALLOUTS) as CalloutKind[]).find((k) => k === name || CALLOUTS[k].short === name);
  if (!kind) return null;
  const chosen = /\sicon=(\S+)/i.exec(match[2] ?? "")?.[1].toLowerCase();
  if (chosen === "none") return { kind, icon: null, chosen: true };
  if (chosen && chosen in ICONS) return { kind, icon: chosen as IconName, chosen: true };
  return { kind, icon: CALLOUTS[kind].icon, chosen: false };
}

/** The callout that `card` is, if it's one. */
function calloutAt(state: EditorState, card: SyntaxNode) {
  return calloutOf(state.doc.lineAt(card.from).text);
}

/** Gives a callout another icon (`null` for its kind's own, `"none"` for none) by rewriting its fence. */
function setIcon(view: EditorView, fenceFrom: number, icon: IconName | "none" | null) {
  const line = view.state.doc.lineAt(fenceFrom);
  const callout = calloutOf(line.text);
  if (!callout) return;
  // The kind's own icon is the default, so it isn't written out.
  const written = icon === CALLOUTS[callout.kind].icon ? null : icon;
  const fence = line.text.replace(/\s+icon=\S*/gi, "").trimEnd();
  const text = written ? `${fence} icon=${written}` : fence;
  if (text !== line.text) view.dispatch({ changes: { from: line.from, to: line.to, insert: text }, userEvent: "input" });
}

/** Opens the icon picker for the callout whose fence starts at `fenceFrom`. */
function pickIcon(view: EditorView, fenceFrom: number, anchor: HTMLElement) {
  const current = () => calloutOf(view.state.doc.lineAt(fenceFrom).text);
  const callout = current();
  if (!callout) return;
  const rect = anchor.getBoundingClientRect();
  ui.iconPicker = {
    key: `callout:${fenceFrom}`,
    label: `${CALLOUTS[callout.kind].label} callout`,
    fallback: CALLOUTS[callout.kind].icon,
    icon: () => {
      const now = current();
      return now?.chosen ? now.icon : null;
    },
    set: (icon) => setIcon(view, fenceFrom, icon),
    none: { active: () => current()?.icon === null, set: () => setIcon(view, fenceFrom, "none") },
    x: rect.left,
    y: rect.bottom + 6,
  };
}

const calloutIcons = new WeakMap<HTMLElement, Record<string, unknown>>();

/**
 * A callout's icon, drawn on its opening fence line but placed in the column to the left of its
 * first line. Clicking it picks another. Without an icon, there's a faint button for adding one
 * while the fence is hovered or has the cursor.
 */
export class CalloutIcon extends WidgetType {
  constructor(
    readonly icon: IconName | null,
    readonly active: boolean,
  ) {
    super();
  }
  eq(other: CalloutIcon) {
    return other.icon === this.icon && other.active === this.active;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("span");
    dom.className = "cm-lp-callout-icon" + (this.icon ? "" : " is-empty") + (this.active ? " is-active" : "");
    dom.setAttribute("role", "button");
    dom.setAttribute("aria-label", this.icon ? "Change icon" : "Add icon");
    dom.title = this.icon ? "Change icon" : "Add icon";
    calloutIcons.set(dom, mount(Icon, { target: dom, props: { name: this.icon ?? "plus", size: 18, strokeWidth: 2 } }));
    // Keeps the cursor and focus where they are.
    dom.addEventListener("mousedown", (event) => event.preventDefault());
    dom.addEventListener("click", () => {
      if (!view.state.readOnly) pickIcon(view, view.state.doc.lineAt(view.posAtDOM(dom)).from, dom);
    });
    return dom;
  }
  destroy(dom: HTMLElement) {
    const icon = calloutIcons.get(dom);
    if (icon) void unmount(icon);
  }
}

/** How far a card's text sits inside its edges, in the editor's font size. Matches editor.css. */
export const CARD_PAD = 1.4;

/** The space between cards that follow each other with no blank line between, in px. */
const CARD_GAP = 10;

const CLOSE_FENCE = /^\s*:{3,}\s*$/;

/** How far something in cards sits in from the text column: how many cards it's in, and how many of those have an icon column. */
export interface CardInset {
  depth: number;
  icons: number;
}

/** The inset of what's inside `node`, counting `node` itself if it's a card. */
export function cardInset(state: EditorState, node: SyntaxNode): CardInset {
  let depth = 0;
  let icons = 0;
  for (let n: SyntaxNode | null = node; n; n = n.parent) {
    if (n.name !== "Card") continue;
    depth++;
    if (calloutAt(state, n)?.icon) icons++;
  }
  return { depth, icons };
}

export const sameInset = (a: CardInset, b: CardInset) => a.depth === b.depth && a.icons === b.icons;

/** Insets a block drawn in cards (a table, diagram or attachment) the way livePreview insets lines. */
export function setInset(dom: HTMLElement, { depth, icons }: CardInset) {
  dom.classList.toggle("cm-lp-card", depth > 0);
  dom.style.setProperty("--card-depth", String(depth));
  dom.style.setProperty("--card-icons", String(icons));
}

/** Whether a code block or a card ends on line `n`, so a block starting on the next line would touch it. */
export function endsBlock(state: EditorState, n: number) {
  if (n < 1) return false;
  const end = state.doc.line(n).to;
  for (const node of ancestors(state, end, -1)) {
    if ((node.name === "FencedCode" || node.name === "Card") && node.to === end) return true;
  }
  return false;
}

/** Whether `line` (of a card from `from` to `to`) is one of its `:::` fences. */
export function isCardFence(text: string, line: number, first: number, last: number) {
  return line === first || (line === last && CLOSE_FENCE.test(text));
}

const cardLayer = layer({
  above: false,
  class: "cm-lp-cards",
  update: (update) =>
    update.docChanged ||
    update.viewportChanged ||
    update.geometryChanged ||
    syntaxTree(update.startState) !== syntaxTree(update.state),
  markers(view) {
    const markers: RectangleMarker[] = [];
    const content = view.contentDOM;
    const style = getComputedStyle(content);
    const scroller = view.scrollDOM.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    const left = box.left + parseFloat(style.paddingLeft) - scroller.left + view.scrollDOM.scrollLeft;
    const width = content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const top = view.documentTop - scroller.top + view.scrollDOM.scrollTop;
    const pad = parseFloat(getComputedStyle(view.dom).fontSize) * CARD_PAD;
    const { from, to } = view.viewport;
    const gutter = parseFloat(getComputedStyle(view.dom).fontSize) * CALLOUT_GUTTER;
    const cards: { depth: number; left: number; top: number; bottom: number; after: boolean; callout?: CalloutKind }[] = [];
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "Card") return;
        const after = endsBlock(view.state, view.state.doc.lineAt(node.from).number - 1);
        const callout = calloutAt(view.state, node.node);
        const { depth, icons } = cardInset(view.state, node.node);
        // Inside the cards around it, and their icon columns, but not its own.
        const left = (depth - 1) * pad + (icons - (callout?.icon ? 1 : 0)) * gutter;
        cards.push({ depth, left, top: view.lineBlockAt(node.from).top, bottom: view.lineBlockAt(node.to).bottom, after, callout: callout?.kind });
      },
    });
    // Cards that touch (one's closing fence right above the next one's opening) share a gap between
    // them; a card right after a code block leaves the whole gap itself.
    for (const card of cards) {
      const below = cards.find((other) => other.depth === card.depth && Math.abs(other.top - card.bottom) < 1);
      if (below) {
        card.bottom -= CARD_GAP / 2;
        below.top += CARD_GAP / 2;
        below.after = false;
      }
    }
    for (const card of cards) if (card.after) card.top += CARD_GAP;
    for (const { depth, left: inset, top: cardTop, bottom, callout } of cards) {
      const right = (depth - 1) * pad;
      const cls = callout ? `cm-lp-card-bg cm-lp-callout cm-lp-callout-${callout}` : "cm-lp-card-bg";
      markers.push(new RectangleMarker(cls, left + inset, top + cardTop, width - inset - right, bottom - cardTop));
    }
    return markers;
  },
});

/** The innermost card around `pos`. */
function cardAt(view: EditorView, pos: number): SyntaxNode | null {
  for (let n: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, -1); n; n = n.parent) {
    if (n.name === "Card") return n;
  }
  return null;
}

/**
 * Enter on a second empty line at the end of a card leaves the card (one empty line is still
 * a paragraph break inside it).
 */
function exitCard(view: EditorView) {
  const { state } = view;
  const { doc } = state;
  const range = state.selection.main;
  if (state.readOnly || state.selection.ranges.length > 1 || !range.empty) return false;
  const line = doc.lineAt(range.head);
  if (line.text.trim() || line.number < 2 || line.number === doc.lines) return false;
  const above = doc.line(line.number - 1);
  const next = doc.line(line.number + 1);
  const card = cardAt(view, range.head);
  if (above.text.trim() || !card || next.to !== card.to || !CLOSE_FENCE.test(next.text)) return false;
  // Drop both empty lines, and continue on a new line after the card.
  const removed = line.to - above.from + 1;
  view.dispatch({
    changes: [
      { from: above.from - 1, to: line.to },
      { from: next.to, insert: "\n" },
    ],
    selection: { anchor: next.to - removed + 1 },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

/** The `/card` command (or `/warning` and the other callouts): puts the line's text in a new card, or starts an empty one. */
export function insertCard(view: EditorView, from: number, to: number, name = "card") {
  const { doc } = view.state;
  const line = doc.lineAt(from);
  const text = (line.text.slice(0, from - line.from) + line.text.slice(to - line.from)).trim();
  // Blank lines around a card keep it a card in other Markdown apps too (Pandoc's rule).
  const before = hasText(doc, line.number - 1) ? "\n" : "";
  const after = hasText(doc, line.number + 1) || line.number === doc.lines ? "\n" : "";
  const open = `${before}::: ${name}\n`;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: `${open}${text}\n:::${after}` },
    selection: { anchor: line.from + open.length + text.length },
    scrollIntoView: true,
    userEvent: "input",
  });
}

/** The icon picker knows a callout by where its fence was, so any edit while it's open closes it. */
const closePicker = EditorView.updateListener.of((update) => {
  if (update.docChanged && ui.iconPicker?.key.startsWith("callout:")) ui.iconPicker = null;
});

export const cards: Extension = [cardLayer, closePicker, Prec.high(keymap.of([{ key: "Enter", run: exitCard }]))];
