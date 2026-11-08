import { isolateHistory } from "@codemirror/commands";
import { type EditorState, type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, ViewPlugin, WidgetType } from "@codemirror/view";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import { t } from "../i18n/index.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { BlockAction, BlockEditor, EditableBlock, Renderer } from "../plugins/types";
import { actionBar, dropBar, keepBeside, resizeHandle } from "./actions";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { ancestors, arrowsInto, blockPos, changeBetween, clickToShowCode, drawnBlock, drawnBlocks, focused, isEditing, showCode } from "./util";

/*
 * Code blocks drawn by a renderer plugin: ```mermaid as its diagram, say, in the theme's colors.
 * With the cursor in one, the code shows with the drawing below it, redrawn as you type. Buttons
 * the renderer gives sit on the drawing, and a handle on its corner resizes it, written after the
 * language as an image's width is in its label (```mermaid |400). A block can have a name there too
 * (```csv name=costs), which others find it by.
 *
 * A renderer can draw its blocks as something to work in instead (`Renderer.editor`): a ```csv
 * block as a spreadsheet's grid, which writes its changes back into the code. The code shows only
 * while the cursor is in it, from the find bar, say, or the block's own "Edit as CSV".
 */

/** A code block's language as its info string gives it: its first word, in lowercase. */
export const fenceLanguage = (info: string) => (/\S*/.exec(info.trim())![0] ?? "").toLowerCase();

/** An info string: its language, then a name (name=costs, or name="Q1 costs"), then a width (|400). */
const INFO = /^(\S+)(?:\s+name=(?:"([^"]*)"|(\S+)))?(?:\s+\|\s*(\d{1,5})(?:\s*x\s*\d{1,5})?)?$/;

/** A code block's name, from its info string, if it has one. */
export function blockName(info: string): string | null {
  const match = INFO.exec(info.trim());
  return (match?.[2] ?? match?.[3])?.trim() || null;
}

/** An info string with a name and width. */
const infoText = (language: string, name: string | null, width: number | null) =>
  language + (name ? ` name=${/[\s"]/.test(name) ? `"${name.replaceAll('"', "")}"` : name}` : "") + (width ? ` |${width}` : "");

/**
 * The renderer for a code block's info string, and the width it's shown at, if it gives one. The
 * language stays a word of its own, so other apps still see what it is.
 */
export function renderedInfo(info: string): { renderer: Renderer; width: number | null; name: string | null } | null {
  const match = INFO.exec(info.trim());
  const renderer = match && plugins.renderer(match[1]);
  return renderer ? { renderer, width: Number(match[4]) || null, name: blockName(info) } : null;
}

/** Writes a block's info string again with its name or width changed, keeping the rest. */
function writeInfo(view: EditorView, node: SyntaxNode, change: { name?: string | null; width?: number | null }, userEvent: string) {
  const info = node.getChild("CodeInfo");
  const text = info ? view.state.sliceDoc(info.from, info.to) : "";
  const rendered = info && renderedInfo(text);
  if (!info || !rendered) return;
  const insert = infoText(fenceLanguage(text), change.name !== undefined ? change.name : rendered.name, change.width !== undefined ? change.width : rendered.width);
  if (insert !== text) view.dispatch({ changes: { from: info.from, to: info.to, insert }, userEvent });
}

/** The code block at `pos`, or the one ending just before it. */
export function fenceAt(state: EditorState, pos: number): SyntaxNode | null {
  for (const side of [1, -1] as const) {
    for (const node of ancestors(state, pos, side)) if (node.name === "FencedCode") return node;
  }
  return null;
}

/** What drawings' colors depend on: one made in one look is drawn again in another. */
export const lookKey = () => {
  const { theme, scheme, font, contrast } = document.documentElement.dataset;
  return `${theme} ${scheme} ${font} ${contrast ?? ""}`;
};

/* Drawing. */

/** Drawings by look, renderer and source, so drawing a block again (scrolling back to it) is instant. */
const drawn = new Map<string, string>();
/** Heights blocks were drawn at, by width and source. */
const heights = new Map<string, number>();
/** Blocks on screen: what draws them, their source and width, and their editor, for drawing them again in a new look. */
const live = new Map<HTMLElement, { renderer: Renderer; source: string; width: number | null; view: EditorView }>();
/** The latest draw of each block; an older one that finishes later is dropped. */
const latest = new WeakMap<HTMLElement, number>();
/** Each block's buttons (its renderer's actions), and their icons to unmount. */
const actionBars = new WeakMap<HTMLElement, { bar: HTMLElement; icons: Record<string, unknown>[] }>();
let ids = 0;

async function draw(dom: HTMLElement, view: EditorView, delay = 0) {
  const block = live.get(dom);
  if (!block) return;
  const { renderer, source } = block;
  const token = ++ids;
  latest.set(dom, token);
  const key = `${lookKey()}\n${renderer.id}\n${source}`;
  const show = (content: string | Node) => {
    if (typeof content === "string") dom.innerHTML = content;
    else dom.replaceChildren(content);
    const svg = dom.querySelector<SVGSVGElement>(":scope > svg");
    if (svg) frame(dom, svg, view);
    // Its buttons beside the drawing.
    const actions = actionBars.get(dom);
    if (actions) {
      const holder = dom.querySelector<HTMLElement>(":scope > .cm-lp-diagram-frame") ?? dom;
      holder.append(actions.bar);
      keepBeside(actions.bar, dom, holder);
    }
    dom.classList.remove("is-pending");
    view.requestMeasure();
  };
  const cached = drawn.get(key);
  if (cached !== undefined) return show(cached);
  if (!source.trim()) return show(message(t("editor.emptyDiagram")));
  // Keep showing the last drawing, faded, until the new one is ready.
  dom.classList.add("is-pending");
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (latest.get(dom) !== token) return;
  try {
    const result = await renderer.render(source, { paper: false });
    if (typeof result === "string") remember(drawn, key, result);
    if (latest.get(dom) !== token) return;
    show(result);
    remember(heights, `${live.get(dom)?.width}\n${source}`, dom.offsetHeight);
  } catch (error) {
    if (latest.get(dom) !== token) return;
    show(message(error instanceof Error ? error.message : String(error), true));
  }
}

/** Adds to a cache, dropping the oldest entry past 100. */
function remember<V>(cache: Map<string, V>, key: string, value: V) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
}

function message(text: string, error = false) {
  const pre = document.createElement("pre");
  pre.className = error ? "cm-lp-diagram-message is-error" : "cm-lp-diagram-message";
  pre.textContent = text;
  return pre;
}

/** Puts a drawing in a frame with its resize handle, at its width. */
function frame(dom: HTMLElement, svg: SVGSVGElement, view: EditorView) {
  // Its own width: Mermaid's in its style's max-width (it draws it as wide as the note, up to that), others' in its view box.
  const maxWidth = svg.style.maxWidth.endsWith("px") ? parseFloat(svg.style.maxWidth) : 0;
  svg.dataset.width = String(maxWidth || svg.viewBox.baseVal?.width || "");
  const frame = document.createElement("span");
  frame.className = "cm-lp-diagram-frame";
  svg.replaceWith(frame);
  const handle = resizeHandle(view, dom, "cm-lp-diagram-resize", {
    target: () => svg,
    min: 80,
    max: () => dom.clientWidth,
    show: setWidth,
    write: (width) => writeWidth(view, dom, width),
  });
  frame.append(svg, handle);
  setWidth(svg, live.get(dom)?.width ?? null);
}

/** Shows a drawing `width` pixels wide (null: its own width), never wider than the note. */
function setWidth(svg: SVGSVGElement, width: number | null) {
  const own = Number(svg.dataset.width);
  if (width || own) svg.style.width = `${width ?? own}px`;
  // As wide as the note at most (editor.css).
  svg.style.maxWidth = "";
}

/** Writes a drawing's width after its language (```mermaid |400), or takes it out (null). */
function writeWidth(view: EditorView, dom: HTMLElement, width: number | null) {
  const node = fenceAt(view.state, blockPos(view, dom));
  if (node) writeInfo(view, node, { width }, "input.resize");
}

/**
 * A block's buttons, from its renderer's actions, beside `target` (actions.ts). Each is given where
 * the block is in the note when it's clicked.
 */
export function addActions(view: EditorView, dom: HTMLElement, actions: BlockAction[] = [], target: Element = dom) {
  if (!actions.length) return;
  const bar = actionBar(dom, target);
  const icons = actions.map((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-lp-action";
    button.title = action.label;
    button.setAttribute("aria-label", action.label);
    button.addEventListener("click", () => action.run(view, blockPos(view, dom)));
    bar.append(button);
    return mount(Icon, { target: button, props: { name: action.icon, size: 15 } });
  });
  actionBars.set(dom, { bar, icons });
  dom.append(bar);
}

/** Takes down a block's buttons. */
export function removeActions(dom: HTMLElement) {
  const actions = actionBars.get(dom);
  if (!actions) return;
  dropBar(actions.bar);
  for (const icon of actions.icons) void unmount(icon);
  actionBars.delete(dom);
}

new MutationObserver(() => {
  for (const [dom, { view }] of live) void draw(dom, view);
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme", "data-font", "data-contrast"] });

class RenderedWidget extends WidgetType {
  constructor(
    readonly renderer: Renderer,
    readonly source: string,
    /** The width it's shown at, if one is given. */
    readonly width: number | null,
    /** How far in it sits, in cards. */
    readonly inset: CardInset,
    /** Drawn below its code while the cursor is in it, rather than in its place. */
    readonly preview: boolean,
  ) {
    super();
  }
  eq(other: RenderedWidget) {
    return (
      other.renderer === this.renderer &&
      other.source === this.source &&
      other.width === this.width &&
      sameInset(other.inset, this.inset) &&
      other.preview === this.preview
    );
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-lp-diagram" + (this.preview ? " is-preview" : "");
    // In place of its code. Diagrams keep their labels as text, which screen readers read.
    dom.setAttribute("role", "figure");
    dom.setAttribute("aria-label", this.renderer.label);
    setInset(dom, this.inset);
    addActions(view, dom, this.renderer.actions);
    live.set(dom, { renderer: this.renderer, source: this.source, width: this.width, view });
    void draw(dom, view);
    return dom;
  }
  updateDOM(dom: HTMLElement, view: EditorView) {
    const before = live.get(dom);
    if (!before || before.renderer !== this.renderer || dom.classList.contains("is-preview") !== this.preview) return false;
    setInset(dom, this.inset);
    live.set(dom, { renderer: this.renderer, source: this.source, width: this.width, view });
    if (before.source === this.source) {
      // Only its width changed.
      const svg = dom.querySelector<SVGSVGElement>(".cm-lp-diagram-frame > svg");
      if (svg) setWidth(svg, this.width);
      return true;
    }
    // While typing, wait for a pause.
    void draw(dom, view, this.preview ? 250 : 0);
    return true;
  }
  destroy(dom: HTMLElement) {
    live.delete(dom);
    latest.delete(dom);
    removeActions(dom);
  }
  get estimatedHeight() {
    return heights.get(`${this.width}\n${this.source}`) ?? 160;
  }
  ignoreEvent() {
    return false;
  }
}

/* Blocks to work in. */

/** A block drawn by its renderer's editor, as the editor sees it. */
class Block implements EditableBlock {
  constructor(
    readonly view: EditorView,
    readonly dom: HTMLElement,
    public source: string,
    public name: string | null,
  ) {}

  get readOnly() {
    return this.view.state.readOnly;
  }

  get from() {
    return this.view.posAtDOM(this.dom);
  }

  /** Where it is in the note now. */
  #node() {
    return fenceAt(this.view.state, this.view.posAtDOM(this.dom));
  }

  write(source: string) {
    const node = this.#node();
    if (!node || this.readOnly) return;
    const { state } = this.view;
    // Its code goes between the fence lines: none, or a line break and the code.
    const marks = node.getChildren("CodeMark");
    const from = state.doc.lineAt(node.from).to;
    const to = marks.length > 1 ? state.doc.lineAt(marks[marks.length - 1].from).from - 1 : node.to;
    const changes = changeBetween(from, state.sliceDoc(from, to), source ? `\n${source}` : "");
    if (changes) this.view.dispatch({ changes, userEvent: "input", annotations: isolateHistory.of("full") });
  }

  rename(name: string | null) {
    const node = this.#node();
    if (node && !this.readOnly) writeInfo(this.view, node, { name: name?.trim() || null }, "input");
  }

  leave(up: boolean) {
    const node = this.#node();
    if (!node) return;
    const { doc } = this.view.state;
    const first = doc.lineAt(node.from);
    const last = doc.lineAt(node.to);
    if (up && first.number === 1) return;
    const spec =
      up ? { selection: { anchor: doc.line(first.number - 1).to } }
      : last.number < doc.lines ? { selection: { anchor: doc.line(last.number + 1).from } }
      : { changes: { from: doc.length, insert: "\n" }, selection: { anchor: doc.length + 1 } };
    // Moved first, so it doesn't show its code as the editor takes focus with the cursor still in it.
    this.view.dispatch({ ...spec, scrollIntoView: true, userEvent: "select" });
    this.view.focus();
  }

  showCode() {
    const node = this.#node();
    if (node) showCode(this.view, node.from);
  }
}

/** Blocks on screen drawn to work in: what draws them, and the editor it made for each. */
const editables = new Map<HTMLElement, { renderer: Renderer; block: Block; editor: BlockEditor }>();

class EditableWidget extends WidgetType {
  constructor(
    readonly renderer: Renderer,
    readonly source: string,
    readonly name: string | null,
    readonly inset: CardInset,
  ) {
    super();
  }
  eq(other: EditableWidget) {
    return other.renderer === this.renderer && other.source === this.source && other.name === this.name && sameInset(other.inset, this.inset);
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-lp-editable";
    setInset(dom, this.inset);
    const block = new Block(view, dom, this.source, this.name);
    editables.set(dom, { renderer: this.renderer, block, editor: this.renderer.editor!(dom, block) });
    // Beside what its editor drew, which sets where that starts and how wide it is (--actions-top, --actions-left).
    addActions(view, dom, this.renderer.actions, dom.firstElementChild ?? dom);
    measure(view, dom, this.source);
    return dom;
  }
  // Its code changed, often from what's drawn: it keeps what's drawn (and the keyboard) and shows the change.
  updateDOM(dom: HTMLElement, view: EditorView) {
    const live = editables.get(dom);
    if (!live || live.renderer !== this.renderer) return false;
    setInset(dom, this.inset);
    if (live.block.source !== this.source || live.block.name !== this.name) {
      live.block.source = this.source;
      live.block.name = this.name;
      live.editor.update();
      measure(view, dom, this.source);
    }
    return true;
  }
  destroy(dom: HTMLElement) {
    editables.get(dom)?.editor.destroy();
    editables.delete(dom);
    removeActions(dom);
  }
  get estimatedHeight() {
    return heights.get(`editable\n${this.source}`) ?? 160;
  }
  ignoreEvent() {
    return true;
  }
}

/** Keeps what's drawn up to date with the note around it and whether it's read-only, and with the editor's size. */
const editableUpdates = ViewPlugin.define((view) => ({
  update(update) {
    const changed = update.docChanged || update.startState.readOnly !== update.state.readOnly;
    if (!changed && !update.geometryChanged) return;
    for (const { block, editor } of editables.values()) {
      if (block.view !== view) continue;
      if (changed) editor.update();
      if (update.geometryChanged) editor.layout?.();
    }
  },
}));

/** Remembers how tall a block is drawn, for the next time it's off screen. */
function measure(view: EditorView, dom: HTMLElement, source: string) {
  view.requestMeasure({ read: () => dom.offsetHeight, write: (height) => void (height && remember(heights, `editable\n${source}`, height)) });
}

/**
 * ↓ on the line above a block drawn to work in, or ↑ on the line below it, goes into it, rather
 * than into its code.
 */
function intoEditable(forward: boolean) {
  return (view: EditorView) => {
    const { state } = view;
    const range = state.selection.main;
    if (state.selection.ranges.length > 1 || !range.empty) return false;
    const line = state.doc.lineAt(range.head);
    // Within a wrapped line, ↑ and ↓ move along it.
    if (state.doc.lineAt(view.moveVertically(range, forward).head).number === line.number) return false;
    const n = line.number + (forward ? 1 : -1);
    if (n < 1 || n > state.doc.lines) return false;
    const next = state.doc.line(n);
    const at = forward ? next.from : next.to;
    let start = -1;
    state.field(blocks).between(at, at, (from, to, deco) => {
      if (deco.spec.widget instanceof EditableWidget && (forward ? from : to) === at) start = from;
    });
    return start >= 0 && focusEditable(view, start, forward ? "above" : "below");
  };
}

/** Gives the keyboard to the block drawn to work in whose fence starts at `start`, as if moving into it from above or below. */
export function focusEditable(view: EditorView, start: number, from: "above" | "below") {
  for (const [dom, { block, editor }] of editables) {
    if (block.view === view && view.posAtDOM(dom) === start) {
      editor.focus(from);
      return true;
    }
  }
  return false;
}

const editableKeymap = Prec.high(
  keymap.of([
    { key: "ArrowDown", run: intoEditable(true) },
    { key: "ArrowUp", run: intoEditable(false) },
  ]),
);

function drawBlock(state: EditorState, node: SyntaxNodeRef) {
  if (node.name !== "FencedCode") return null;
  const info = node.node.getChild("CodeInfo");
  const rendered = info && renderedInfo(state.sliceDoc(info.from, info.to));
  if (!rendered) return null;
  // Only blocks on lines of their own (not in a quote or list item, whose lines start with > or -).
  const first = state.doc.lineAt(node.from);
  if (state.sliceDoc(first.from, node.from).trim()) return null;
  const code = node.node.getChild("CodeText");
  const source = code ? state.sliceDoc(code.from, code.to) : "";
  const inset = cardInset(state, node.node);
  const last = state.doc.lineAt(node.to).to;
  const editing = isEditing(state, node.from, node.to);
  // A block to work in shows its code as it is while the cursor's in it; a drawing, above it.
  if (!rendered.renderer.editor) return drawnBlock(new RenderedWidget(rendered.renderer, source, rendered.width, inset, editing), first.from, last, editing);
  return editing ? null : drawnBlock(new EditableWidget(rendered.renderer, source, rendered.name, inset), first.from, last);
}

// Drawn blocks are top-level blocks or in cards.
const blocks = drawnBlocks(drawBlock);

/** Clicking a drawing shows its code, with the cursor at the start; its buttons and resize handle do their own. */
const clickToEdit = clickToShowCode(".cm-lp-diagram", ".cm-lp-actions, .cm-lp-diagram-resize");

// ↑ and ↓ go into a spreadsheet's grid, or else into a block's code.
export const renderedBlocks: Extension = [focused, blocks, clickToEdit, editableUpdates, editableKeymap, arrowsInto(blocks)];
