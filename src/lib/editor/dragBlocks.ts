import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateEffect, StateField, type TransactionSpec } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import { t } from "../i18n/index.svelte";
import { reducedMotion } from "../platform";
import { CALLOUT_GUTTER, CARD_PAD, calloutOf, cardInset } from "./cards";
import { ancestors } from "./util";

/*
 * Drag handles: hovering a line or block shows a grip to its left, and dragging the grip moves
 * it. A plain line moves on its own; a list item moves with its sub-items; a heading, code block,
 * table, quote or card (by its ::: line) moves whole. Things can't be dropped inside a code block,
 * table or quote.
 */

interface Block {
  /** Line numbers of its first and last lines. */
  first: number;
  last: number;
  kind: "line" | "item" | "block" | "card";
  node: SyntaxNode | null;
}

/** Blocks whose lines only make sense together, which nothing can be dropped into. */
const ATOMIC = new Set(["FencedCode", "CodeBlock", "Table", "Blockquote", "HTMLBlock"]);

const BLOCKS = new Set([
  ...ATOMIC,
  "HorizontalRule",
  "SetextHeading1",
  "SetextHeading2",
  ...[1, 2, 3, 4, 5, 6].map((n) => `ATXHeading${n}`),
]);

/** What hovering or dragging line `n` picks up: the line, or the block it's part of. */
function blockAt(state: EditorState, n: number): Block | null {
  const line = state.doc.line(n);
  if (!line.text.trim()) return null;
  const start = line.from + /^\s*/.exec(line.text)![0].length;
  let quote: SyntaxNode | null = null;
  let item: SyntaxNode | null = null;
  let block: SyntaxNode | null = null;
  let card: SyntaxNode | null = null;
  let paragraph = false;
  for (const node of ancestors(state, start, 1)) {
    if (node.name === "Blockquote") quote = node;
    else if (node.name === "ListItem") item ??= node;
    else if (node.name === "Paragraph") paragraph = true;
    else if (node.name === "Card") card ??= node;
    else if (BLOCKS.has(node.name)) block ??= node;
  }
  const lines = (node: SyntaxNode, kind: Block["kind"]): Block => ({
    first: state.doc.lineAt(node.from).number,
    last: state.doc.lineAt(node.to).number,
    kind,
    node,
  });
  // A quote moves whole, lists in it included; a list item takes what's in it along.
  if (quote) return lines(quote, "block");
  if (item) return lines(item, "item");
  if (block) return lines(block, "block");
  if (paragraph) return { first: n, last: n, kind: "line", node: null };
  // Not in a paragraph or another block, so one of a card's ::: lines.
  return card ? lines(card, "card") : null;
}

/** The nodes that run across the boundary above line `k` (so it's between two of their lines). */
function spanning(state: EditorState, k: number) {
  const { doc } = state;
  if (k <= 1 || k > doc.lines) return [];
  const above = doc.line(k - 1).to;
  const below = doc.line(k).from;
  const nodes: SyntaxNode[] = [];
  for (const node of ancestors(state, below, 1)) {
    if (node.from <= above && node.to >= below) nodes.push(node);
  }
  return nodes;
}

/** Whether the boundary above line `b` is in the note and not inside a code block, table or quote. */
const droppable = (state: EditorState, b: number) =>
  b >= 1 && b <= state.doc.lines + 1 && !spanning(state, b).some((n) => ATOMIC.has(n.name));

/** The nearest boundary to `k` that's not inside a code block, table or quote. */
function snap(state: EditorState, k: number) {
  const ok = (b: number) => droppable(state, b);
  for (let d = 0; d <= state.doc.lines; d++) {
    if (ok(k - d)) return k - d;
    if (ok(k + d)) return k + d;
  }
  return k;
}

const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])(?:\s|$)/;

/** Whether a node named `name` starts at `pos` (`end` false) or ends there. */
function blockEdge(state: EditorState, pos: number, names: string[], end: boolean) {
  for (const node of ancestors(state, pos, end ? -1 : 1)) {
    if (names.includes(node.name) && (end ? node.to : node.from) === pos) return true;
  }
  return false;
}

/** Moves `block` to the boundary above line `k` (or to the end, for one past the last line). */
export function moveBlock(state: EditorState, block: Block, k: number): TransactionSpec | null {
  const { doc } = state;
  if (k >= block.first && k <= block.last + 1) return null;
  const blank = (n: number) => n >= 1 && n <= doc.lines && !doc.line(n).text.trim();
  const lines: string[] = [];
  for (let n = block.first; n <= block.last; n++) lines.push(doc.line(n).text);

  // A list item takes the indentation of the list it goes into: the item above or below with
  // the nearest indentation, or none at all outside a list.
  if (block.kind === "item") {
    const own = /^\s*/.exec(lines[0])![0].length;
    const near = [k - 1, k]
      .filter((n) => n >= 1 && n <= doc.lines && (n < block.first || n > block.last))
      .map((n) => LIST_ITEM.exec(doc.line(n).text)?.[1].length)
      .filter((indent): indent is number => indent !== undefined);
    const target = near.length ? near.reduce((a, b) => (Math.abs(b - own) < Math.abs(a - own) ? b : a)) : 0;
    const shift = target - own;
    for (let i = 0; i < lines.length; i++) {
      if (shift > 0) lines[i] = " ".repeat(shift) + lines[i];
      else lines[i] = lines[i].slice(Math.min(-shift, /^\s*/.exec(lines[i])![0].length));
    }
  }
  const text = lines.join("\n");

  // Take the lines out; between two blank lines, one of the blanks goes too.
  const first = doc.line(block.first);
  const last = doc.line(block.last);
  let from = first.from;
  let to = last.to + 1;
  if (block.last === doc.lines) {
    from = Math.max(0, first.from - 1);
    to = last.to;
  } else if (blank(block.first - 1) && blank(block.last + 1) && block.last + 1 < doc.lines) {
    to = doc.line(block.last + 1).to + 1;
  }

  // Tables and cards need blank lines around them: text right after a table would be a row of it.
  const separate = block.kind === "card" || block.node?.name === "Table";
  const padAbove =
    k > 1 && !blank(k - 1) && (separate || blockEdge(state, doc.line(k - 1).to, ["Table", "Card"], true));
  const padBelow =
    k <= doc.lines && !blank(k) && (separate || blockEdge(state, doc.line(k).from, ["Table", "Card"], false));
  let at: number;
  let insert: string;
  if (k <= doc.lines) {
    at = doc.line(k).from;
    insert = (padAbove ? "\n" : "") + text + "\n" + (padBelow ? "\n" : "");
  } else {
    at = doc.length;
    insert = "\n" + (padAbove ? "\n" : "") + text;
  }
  const changes = [{ from, to }, { from: at, insert }].sort((a, b) => a.from - b.from);
  return { changes, userEvent: "move.drop", scrollIntoView: false };
}

/* Dimming what's being dragged. */

const setSource = StateEffect.define<{ first: number; last: number } | null>();

const dragSource = StateField.define({
  create: () => Decoration.none,
  update(decos, tr) {
    decos = decos.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setSource)) continue;
      const lines: Range<Decoration>[] = [];
      if (effect.value) {
        for (let n = effect.value.first; n <= effect.value.last; n++) {
          lines.push(Decoration.line({ class: "cm-drag-source" }).range(tr.state.doc.line(n).from));
        }
      }
      decos = Decoration.set(lines);
    }
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/* Sliding lines into place after a drop. */

const SLIDE = { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" };

/** The lines and blocks drawn in the editor, with the line number each one starts on. */
function drawn(view: EditorView) {
  const found: { el: HTMLElement; line: number }[] = [];
  for (const el of view.contentDOM.children) {
    if (!(el instanceof HTMLElement)) continue;
    try {
      found.push({ el, line: view.state.doc.lineAt(view.posAtDOM(el)).number });
    } catch {
      // Not one of the note's lines.
    }
  }
  return found;
}

/**
 * Moves `block` to the boundary above line `k`, and slides it and the lines it passed from where
 * they were drawn to where they are now, rather than leaving them to jump there.
 */
function drop(view: EditorView, block: Block, k: number) {
  const spec = moveBlock(view.state, block, k);
  if (!spec) return;
  const still = reducedMotion.matches;
  // Where each line was on screen, by line number.
  const before = new Map<number, number>();
  if (!still) for (const { el, line } of drawn(view)) before.set(line, el.getBoundingClientRect().top);

  const tr = view.state.update(spec);
  view.dispatch(tr);
  if (still) return;

  // Where the block went: the text inserted, after any blank lines put before it.
  const { doc } = tr.state;
  let first = 0;
  const added: [number, number][] = [];
  tr.changes.iterChanges((_fromA, _toA, fromB, toB, inserted) => {
    if (!inserted.length) return;
    added.push([fromB, toB]);
    first = doc.lineAt(fromB + /^\n*/.exec(inserted.toString())![0].length).number;
  });
  const count = block.last - block.first + 1;
  const inverted = tr.changes.invertedDesc;

  for (const { el, line } of drawn(view)) {
    const moved = line >= first && line < first + count;
    let old: number;
    if (moved) old = block.first + line - first;
    else {
      // A blank line put in beside the block is new: nothing to slide from.
      const from = doc.line(line).from;
      if (added.some(([a, b]) => from >= a && from < b)) continue;
      old = tr.startState.doc.lineAt(inverted.mapPos(from, 1)).number;
    }
    const was = before.get(old);
    if (was === undefined) {
      // It was scrolled out of sight: fade in where it lands.
      if (moved) el.animate([{ opacity: 0.35 }, { opacity: 1 }], SLIDE);
      continue;
    }
    const by = was - el.getBoundingClientRect().top;
    if (Math.abs(by) < 1) continue;
    const start: Keyframe = { transform: `translateY(${by}px)` };
    // The block comes back from the dimmed look it had while dragged.
    if (moved) start.opacity = 0.35;
    el.animate([start, { transform: "none", opacity: 1 }], SLIDE);
  }
}

/* The handle and the drop line. */

/** About how long, in seconds, the drop line takes to catch up with where it's going. */
const GLIDE = 0.07;

/**
 * A number that follows its target like a damped spring: when the target moves again before it
 * gets there, it keeps its speed rather than starting over, so the drop line flows from place to
 * place as the pointer sweeps past lines instead of stepping.
 */
class Spring {
  value = 0;
  speed = 0;
  target = 0;

  jump(value: number) {
    this.value = this.target = value;
    this.speed = 0;
  }

  /** Moves on by `dt` seconds (a critically damped spring, as in Unity's SmoothDamp). */
  step(dt: number) {
    const omega = 2 / GLIDE;
    const x = omega * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - this.target;
    const pull = (this.speed + omega * change) * dt;
    this.speed = (this.speed - omega * pull) * decay;
    this.value = this.target + (change + pull) * decay;
  }
}

/**
 * The space the boundary above line `k` is in: between the nearest lines with text above and
 * below it (`above` and `below`, past any blank lines), and where that text ends and starts on
 * screen (`top`, `bottom`, client coordinates; null at the note's start or end). The line is
 * drawn in it, clear of a heading's letters whatever spacing the heading has.
 */
function gapAround(view: EditorView, k: number) {
  const { state } = view;
  const { doc } = state;
  /** The top or bottom of line `n`'s text, or of what's drawn in its place: a table, a diagram, a card's edge. */
  const edge = (n: number, bottom: boolean) => {
    const line = doc.line(n);
    const info = view.lineBlockAt(line.from);
    // A card's ::: lines are drawn as its padding, so its edge is the bottom or top of theirs.
    const drawn = info.widget || blockAt(state, n)?.kind === "card";
    const coords = drawn ? null : view.coordsAtPos(bottom ? line.to : line.from, bottom ? -1 : 1);
    if (coords) return bottom ? coords.bottom : coords.top;
    return view.documentTop + (bottom ? info.bottom : info.top);
  };
  const blank = (n: number) => !doc.line(n).text.trim();
  let above = k - 1;
  while (above >= 1 && blank(above)) above--;
  let below = k;
  while (below <= doc.lines && blank(below)) below++;
  return {
    above,
    below,
    top: above >= 1 ? edge(above, true) : null,
    bottom: below <= doc.lines ? edge(below, false) : null,
  };
}

const HANDLE_WIDTH = 18;
const HANDLE_HEIGHT = 24;
const fine = matchMedia("(hover: hover) and (pointer: fine)");

interface Drag {
  block: Block;
  /** The text column, measured once when the drag starts rather than on every move. */
  column: { left: number; width: number; pad: number; gutter: number };
  /** The note changed during the drag (sync, another window), so `block`'s lines may be stale. */
  stale: boolean;
  /** The boundary it would go to: above this line number; null where dropping changes nothing. */
  target: number | null;
  /** The note as dropping at each boundary would leave it, or null where that's as it is now. */
  outcomes: Map<number, string | null>;
  startY: number;
  lastY: number;
  moved: boolean;
}

const handles = ViewPlugin.fromClass(
  class {
    handle = document.createElement("div");
    indicator = document.createElement("div");
    icon: Record<string, unknown>;
    block: Block | null = null;
    drag: Drag | null = null;
    frame = 0;
    /** The drop line's place and width in the scroller, and when it last moved. */
    glide = { x: new Spring(), y: new Spring(), width: new Spring(), shown: new Spring(), time: 0 };

    constructor(readonly view: EditorView) {
      this.handle.className = "cm-drag-handle";
      this.handle.title = t("editor.dragHandle");
      // Only for the mouse: ⌥↑ and ⌥↓ move lines from the keyboard, and selecting is the keyboard's own.
      this.handle.setAttribute("aria-hidden", "true");
      this.handle.hidden = true;
      this.icon = mount(Icon, { target: this.handle, props: { name: "grip-vertical", size: 16, strokeWidth: 2 } });
      this.indicator.className = "cm-drop-indicator";
      this.indicator.hidden = true;
      view.scrollDOM.append(this.handle, this.indicator);
      view.scrollDOM.addEventListener("mousemove", this.hover);
      view.scrollDOM.addEventListener("mouseleave", this.leave);
      this.handle.addEventListener("pointerdown", this.start);
      // Not a click in the editor: no cursor moves, no text selection starts.
      this.handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    update(update: ViewUpdate) {
      if (this.drag && update.docChanged) {
        this.drag.stale = true;
        this.drag.outcomes.clear();
      }
      if (!this.drag && (update.docChanged || update.geometryChanged || update.viewportChanged)) this.hide();
    }

    /** Client coordinates of the text column: its left edge and width. */
    column() {
      const content = this.view.contentDOM;
      const style = getComputedStyle(content);
      const box = content.getBoundingClientRect();
      const left = box.left + parseFloat(style.paddingLeft);
      const width = content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const size = parseFloat(getComputedStyle(this.view.dom).fontSize);
      return { left, width, pad: size * CARD_PAD, gutter: size * CALLOUT_GUTTER };
    }

    /** The line under the pointer, if it's over the note's text. */
    lineAtY(clientY: number) {
      const { view } = this;
      const y = clientY - view.documentTop;
      const line = view.lineBlockAtHeight(y);
      return y < line.top - 8 || y > line.bottom + 8 ? null : line;
    }

    hover = (event: MouseEvent) => {
      const { view } = this;
      if (this.drag || event.buttons || view.state.readOnly || !fine.matches) return;
      if (this.handle.contains(event.target as Node)) return;
      const line = this.lineAtY(event.clientY);
      const block = line ? blockAt(view.state, view.state.doc.lineAt(line.from).number) : null;
      if (!block) return this.hide();
      if (this.block && block.first === this.block.first && block.last === this.block.last && !this.handle.hidden) return;
      this.show(block);
    };

    leave = (event: MouseEvent) => {
      if (!this.drag && !this.handle.contains(event.relatedTarget as Node)) this.hide();
    };

    show(block: Block) {
      const { view } = this;
      const scroller = view.scrollDOM.getBoundingClientRect();
      const line = view.state.doc.line(block.first);
      const info = view.lineBlockAt(line.from);
      const column = this.column();
      const { state } = view;
      let centre: number;
      let left: number;
      const start = line.from + /^\s*/.exec(line.text)![0].length;
      const coords = info.widget ? null : view.coordsAtPos(start, 1);
      if (coords) {
        centre = (coords.top + coords.bottom) / 2;
      } else {
        // A table or diagram drawn in place of its lines: level with its first row.
        const lineHeight = view.defaultLineHeight;
        centre = view.documentTop + info.top + Math.min(info.height / 2, lineHeight * 1.1);
      }
      if (block.kind === "card") {
        // At the card's edge: inside the cards and icon columns around it.
        const { depth, icons } = block.node!.parent ? cardInset(state, block.node!.parent) : { depth: 0, icons: 0 };
        left = column.left + depth * column.pad + icons * column.gutter;
      } else if (block.kind === "block" || !coords) {
        const { depth, icons } = cardInset(state, block.node ?? syntaxTree(state).resolveInner(start, 1));
        left = column.left + depth * column.pad + icons * column.gutter;
      } else {
        // Left of a callout's icon column, rather than over its icon.
        const card = [...ancestors(state, start, 1)].find((node) => node.name === "Card");
        const icon = card && calloutOf(state.doc.lineAt(card.from).text)?.icon;
        left = coords.left - (icon ? column.gutter : 0);
      }
      this.block = block;
      this.handle.style.top = `${centre - scroller.top + view.scrollDOM.scrollTop - HANDLE_HEIGHT / 2}px`;
      this.handle.style.left = `${left - scroller.left + view.scrollDOM.scrollLeft - HANDLE_WIDTH - 6}px`;
      this.handle.hidden = false;
    }

    hide() {
      this.handle.hidden = true;
      this.block = null;
    }

    start = (event: PointerEvent) => {
      if (event.button !== 0 || !this.block) return;
      event.preventDefault();
      event.stopPropagation();
      this.handle.setPointerCapture(event.pointerId);
      this.drag = {
        block: this.block,
        column: this.column(),
        stale: false,
        target: null,
        outcomes: new Map(),
        startY: event.clientY,
        lastY: event.clientY,
        moved: false,
      };
      this.handle.addEventListener("pointermove", this.move);
      this.handle.addEventListener("pointerup", this.end);
      this.handle.addEventListener("pointercancel", this.cancel);
    };

    move = (event: PointerEvent) => {
      const drag = this.drag;
      if (!drag) return;
      drag.lastY = event.clientY;
      if (!drag.moved) {
        if (Math.abs(event.clientY - drag.startY) < 4) return;
        drag.moved = true;
        document.documentElement.classList.add("cm-dragging");
        this.view.dispatch({ effects: setSource.of({ first: drag.block.first, last: drag.block.last }) });
        this.glide.time = performance.now();
        this.glide.shown.jump(0);
        this.frame = requestAnimationFrame(this.tick);
      }
      this.aim();
    };

    /** Each frame of a drag: scrolls while the pointer is near the top or bottom edge, and moves the drop line on. */
    tick = (time: number) => {
      if (!this.drag) return;
      const { scrollDOM } = this.view;
      const box = scrollDOM.getBoundingClientRect();
      const edge = 48;
      const y = this.drag.lastY;
      const speed = y < box.top + edge ? -(box.top + edge - y) : y > box.bottom - edge ? y - (box.bottom - edge) : 0;
      if (speed) {
        scrollDOM.scrollTop += speed / 3;
        this.aim();
      }
      const { glide } = this;
      const dt = Math.min((time - glide.time) / 1000, 0.05);
      glide.time = time;
      if (dt > 0) for (const spring of [glide.x, glide.y, glide.width, glide.shown]) spring.step(dt);
      this.draw();
      this.frame = requestAnimationFrame(this.tick);
    };

    /** Works out where a drop would go and draws the line there. */
    aim() {
      const drag = this.drag!;
      const { view } = this;
      const { state } = view;
      const { doc } = state;
      const y = drag.lastY - view.documentTop;
      const line = view.lineBlockAtHeight(y);
      let k: number;
      if (y > view.lineBlockAt(doc.length).bottom) k = doc.lines + 1;
      else k = y < line.top + line.height / 2 ? doc.lineAt(line.from).number : doc.lineAt(line.to).number + 1;
      k = snap(state, Math.max(1, Math.min(k, doc.lines + 1)));
      // The boundaries in one gap that leave the note the same are one place to drop, and one that
      // leaves it as it is (the blank lines around a card are put back either way) is none: the
      // line fades out there, and letting go does nothing.
      const gap = gapAround(view, k);
      const places: { k: number; outcome: string }[] = [];
      for (let b = gap.above + 1; b <= gap.below; b++) {
        const outcome = droppable(state, b) ? this.outcome(b) : null;
        if (outcome !== null && !places.some((place) => place.outcome === outcome)) places.push({ k: b, outcome });
      }
      const outcome = this.outcome(k);
      const index = places.findIndex((place) => place.outcome === outcome);
      const { glide } = this;
      if (outcome === null || index < 0) {
        drag.target = null;
        glide.shown.target = 0;
        if (reducedMotion.matches) glide.shown.jump(0);
        return;
      }
      drag.target = places[index].k;
      glide.shown.target = 1;
      const cards = spanning(state, drag.target).filter((n) => n.name === "Card");
      const icons = cards.filter((card) => calloutOf(doc.lineAt(card.from).text)?.icon).length;
      const { column } = drag;
      const scroller = view.scrollDOM.getBoundingClientRect();
      const right = cards.length * column.pad;
      const inset = right + icons * column.gutter;
      // In the space between the text above and below, with the places in it spread evenly.
      const top = gap.top ?? gap.bottom! - 6;
      const bottom = gap.bottom ?? top + 6;
      const at = top + ((bottom - top) * (index + 1)) / (places.length + 1);
      glide.x.target = column.left + inset - scroller.left;
      glide.y.target = at - scroller.top + view.scrollDOM.scrollTop - 1;
      glide.width.target = column.width - inset - right;
      // It starts where it first shows rather than gliding in; tick() moves it on from there.
      if (this.indicator.hidden || reducedMotion.matches) {
        for (const spring of [glide.x, glide.y, glide.width]) spring.jump(spring.target);
        if (reducedMotion.matches) glide.shown.jump(1);
        this.draw();
        this.indicator.hidden = false;
      }
    }

    /** What dropping above line `k` would leave the note as, or null where it's as it is now. */
    outcome(k: number) {
      const drag = this.drag!;
      let outcome = drag.outcomes.get(k);
      if (outcome === undefined) {
        const { state } = this.view;
        const spec = moveBlock(state, drag.block, k);
        const text = spec && state.update(spec).state.doc.toString();
        outcome = !text || text === state.doc.toString() ? null : text;
        drag.outcomes.set(k, outcome);
      }
      return outcome;
    }

    draw() {
      const { x, y, width } = this.glide;
      // On its way it draws in a little from both ends and fades a little, and goes behind the text
      // so the letters it passes stay whole; it opens to its full length, in front, as it settles
      // (in a gap between lines, clear of any text).
      const moving = Math.min(Math.abs(y.speed) / 1500, 1);
      this.indicator.style.transform = `translate(${x.value}px, ${y.value}px) scaleX(${1 - 0.15 * moving})`;
      this.indicator.style.opacity = `${this.glide.shown.value * (1 - 0.4 * moving)}`;
      this.indicator.classList.toggle("is-moving", moving > 0.03);
      this.indicator.style.width = `${width.value}px`;
    }

    end = () => {
      const drag = this.drag;
      this.stop();
      if (!drag || drag.stale) return;
      const { view } = this;
      if (!drag.moved) {
        // A click selects the block, for copying or cutting it.
        const { doc } = view.state;
        view.dispatch({ selection: { anchor: doc.line(drag.block.first).from, head: doc.line(drag.block.last).to } });
        view.focus();
        return;
      }
      if (drag.target !== null) drop(view, drag.block, drag.target);
    };

    cancel = () => this.stop();

    stop() {
      if (this.drag?.moved) this.view.dispatch({ effects: setSource.of(null) });
      this.drag = null;
      cancelAnimationFrame(this.frame);
      document.documentElement.classList.remove("cm-dragging");
      this.indicator.hidden = true;
      this.handle.removeEventListener("pointermove", this.move);
      this.handle.removeEventListener("pointerup", this.end);
      this.handle.removeEventListener("pointercancel", this.cancel);
      this.hide();
    }

    destroy() {
      cancelAnimationFrame(this.frame);
      document.documentElement.classList.remove("cm-dragging");
      this.view.scrollDOM.removeEventListener("mousemove", this.hover);
      this.view.scrollDOM.removeEventListener("mouseleave", this.leave);
      void unmount(this.icon);
      this.handle.remove();
      this.indicator.remove();
    }
  },
);

export const dragBlocks: Extension = [dragSource, handles];
