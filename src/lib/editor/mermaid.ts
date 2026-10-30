import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { Mermaid } from "mermaid";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import { t } from "../i18n/index.svelte";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { coarsePointer } from "../platform";
import { drawingFromDiagram } from "./drawings";
import { focusChanged, focused, isEditing } from "./util";

/*
 * Mermaid diagrams: a ```mermaid code block is drawn as its diagram, in the theme's colors.
 * With the cursor in it, the code shows with the diagram below it, redrawn as you type.
 * Mermaid is large, so it loads the first time a note has a diagram. A button on a diagram opens a
 * copy of it in Excalidraw (drawings.ts), and a handle on its corner resizes it, written after the
 * language as an image's width is in its label (```mermaid |400).
 */

/**
 * Whether a code block's info string is a diagram's, and the width it's shown at, if it has one.
 * The language stays a word of its own, so other apps still see a diagram.
 */
export function diagramInfo(info: string): { width: number | null } | null {
  const match = /^mermaid(?:\s+\|\s*(\d{1,5})(?:\s*x\s*\d{1,5})?)?$/i.exec(info.trim());
  return match ? { width: Number(match[1]) || null } : null;
}

let loading: Promise<Mermaid> | undefined;
/** Loads Mermaid, once. */
export const loadMermaid = () => (loading ??= import("mermaid").then((module) => module.default));

/* The theme's colors, as the solid hex colors Mermaid needs. */

let probe: HTMLElement | undefined;
let canvas: CanvasRenderingContext2D | undefined;

/** `css` (any color, `var()` and `color-mix()` included) drawn over the note's background. */
function solid(css: string) {
  if (!probe || !canvas) {
    probe = document.createElement("span");
    probe.hidden = true;
    document.body.append(probe);
    const element = document.createElement("canvas");
    element.width = element.height = 1;
    canvas = element.getContext("2d", { willReadFrequently: true })!;
  }
  const computed = (value: string) => {
    probe!.style.color = value;
    return getComputedStyle(probe!).color;
  };
  canvas.fillStyle = computed("var(--bg)");
  canvas.fillRect(0, 0, 1, 1);
  canvas.fillStyle = computed(css);
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type ThemeConfig = ReturnType<typeof readTheme>;
/** Reading the colors forces style recalculations, so it's done once per theme change. */
let theme: ThemeConfig | undefined;
const themeConfig = () => (theme ??= readTheme());

function readTheme() {
  solid("var(--bg)");
  probe!.style.fontFamily = "var(--font-text)";
  const fontFamily = getComputedStyle(probe!).fontFamily;
  const mix = (color: string, amount: number) => solid(`color-mix(in srgb, ${color} ${amount}%, var(--bg))`);
  const text = solid("var(--text)");
  const background = solid("var(--bg)");
  return {
    fontFamily,
    look: "classic" as const,
    themeVariables: {
      darkMode: document.documentElement.dataset.scheme === "dark",
      fontFamily,
      fontSize: "15px",
      background,
      edgeLabelBackground: background,
      labelBackgroundColor: background,
      // Flat, like the rest of the note.
      dropShadow: "none",
      primaryColor: mix("var(--accent)", 14),
      primaryBorderColor: mix("var(--accent)", 60),
      primaryTextColor: text,
      secondaryColor: mix("var(--ink)", 8),
      tertiaryColor: mix("var(--ink)", 4),
      lineColor: solid("var(--text-muted)"),
      textColor: text,
      noteBkgColor: mix("var(--highlight-base)", 22),
      noteBorderColor: mix("var(--highlight-base)", 60),
      noteTextColor: text,
    },
  };
}

/* Drawing. */

/** Drawn diagrams by theme and source, so redrawing a block (scrolling back to it) is instant. */
const drawn = new Map<string, string>();
/** Heights diagrams were drawn at, by width and source. */
const heights = new Map<string, number>();
/** Diagrams on screen: their source, width and editor, for redrawing in a new theme. */
const live = new Map<HTMLElement, { source: string; width: number | null; view: EditorView }>();
/** The latest draw of each diagram; an older one that finishes later is dropped. */
const latest = new WeakMap<HTMLElement, number>();
/** Each diagram's "Copy and Edit as Drawing" button, and its icon to unmount. */
const drawButtons = new WeakMap<HTMLElement, { button: HTMLButtonElement; icon: Record<string, unknown> }>();
let ids = 0;

async function draw(dom: HTMLElement, source: string, view: EditorView, delay = 0) {
  const token = ++ids;
  latest.set(dom, token);
  const theme = themeConfig();
  const key = JSON.stringify(theme) + "\n" + source;
  const show = (content: string | Node) => {
    if (typeof content === "string") dom.innerHTML = content;
    else dom.replaceChildren(content);
    const svg = dom.querySelector<SVGSVGElement>(":scope > svg");
    if (svg) frame(dom, svg, view);
    const draw = drawButtons.get(dom);
    if (draw) dom.append(draw.button);
    dom.classList.remove("is-pending");
    view.requestMeasure();
  };
  const cached = drawn.get(key);
  if (cached !== undefined) return show(cached);
  if (!source.trim()) return show(message(t("editor.emptyDiagram")));
  // Keep showing the last diagram, faded, until the new one is ready.
  dom.classList.add("is-pending");
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (latest.get(dom) !== token) return;
  const id = `lines-mermaid-${token}`;
  try {
    const mermaid = await loadMermaid();
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, theme: "base", ...theme });
    const { svg } = await mermaid.render(id, source);
    remember(drawn, key, svg);
    if (latest.get(dom) !== token) return;
    show(svg);
    remember(heights, `${live.get(dom)?.width}\n${source}`, dom.offsetHeight);
  } catch (error) {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
    if (latest.get(dom) !== token) return;
    const text = error instanceof Error ? error.message : String(error);
    // Where the error is, without Mermaid's list of every token it would have accepted.
    show(message(text.replace(/\nExpecting [^]*$/, ""), true));
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

/* Resizing. */

/** The narrowest a diagram can be dragged. */
const MIN_WIDTH = 80;

/** Puts a drawn diagram in a frame with its resize handle, at its width. */
function frame(dom: HTMLElement, svg: SVGSVGElement, view: EditorView) {
  // Mermaid draws it as wide as the note, up to its own width.
  svg.dataset.width = String(parseFloat(svg.style.maxWidth) || svg.viewBox.baseVal?.width || "");
  const frame = document.createElement("span");
  frame.className = "cm-lp-diagram-frame";
  svg.replaceWith(frame);
  frame.append(svg, resizeHandle(view, dom));
  setWidth(svg, live.get(dom)?.width ?? null);
}

/** Shows a diagram `width` pixels wide (null: its own width), never wider than the note. */
function setWidth(svg: SVGSVGElement, width: number | null) {
  const own = Number(svg.dataset.width);
  if (width || own) svg.style.width = `${width ?? own}px`;
  // As wide as the note at most (editor.css).
  svg.style.maxWidth = "";
}

/** Writes a diagram's width after its language (```mermaid |400), or takes it out (null). */
function writeWidth(view: EditorView, dom: HTMLElement, width: number | null) {
  const pos = view.posAtDOM(dom);
  // A preview sits after the block's last line; the block is just before it.
  const at = dom.classList.contains("is-preview") ? Math.max(0, pos - 1) : pos;
  for (const side of [1, -1] as const) {
    for (let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(at, side); node; node = node.parent) {
      if (node.name !== "FencedCode") continue;
      const info = node.getChild("CodeInfo");
      const text = info ? view.state.sliceDoc(info.from, info.to) : "";
      if (!info || !diagramInfo(text)) return;
      const insert = text.trim().split(/\s/)[0] + (width ? ` |${width}` : "");
      if (insert !== text) view.dispatch({ changes: { from: info.from, to: info.to, insert }, userEvent: "input.resize" });
      return;
    }
  }
}

/**
 * The handle on a diagram's bottom right corner: dragged, it makes the diagram wider or narrower
 * (keeping its shape, and no wider than the note); double-clicked, back to its own size. From the
 * keyboard, the width is the number after the bar on its first line.
 */
function resizeHandle(view: EditorView, dom: HTMLElement) {
  const handle = document.createElement("span");
  handle.className = "cm-lp-diagram-resize";
  handle.title = coarsePointer.matches ? "" : t("editor.image.resizeHint");
  handle.setAttribute("aria-hidden", "true");
  handle.addEventListener("pointerdown", (event) => {
    const svg = dom.querySelector<SVGSVGElement>(".cm-lp-diagram-frame > svg");
    if (event.button !== 0 || view.state.readOnly || !svg) return;
    // No mousedown follows, so the editor doesn't show the diagram's code.
    event.preventDefault();
    event.stopPropagation();
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: moves over the handle still resize.
    }
    const max = dom.clientWidth;
    const start = svg.getBoundingClientRect().width;
    const x = event.clientX;
    let width = start;
    dom.classList.add("is-resizing");
    const move = (moved: PointerEvent) => {
      width = Math.round(Math.min(max, Math.max(MIN_WIDTH, start + moved.clientX - x)));
      setWidth(svg, width);
      view.requestMeasure();
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      dom.classList.remove("is-resizing");
      if (Math.abs(width - start) >= 1) writeWidth(view, dom, width);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
  handle.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!view.state.readOnly) writeWidth(view, dom, null);
  });
  return handle;
}

new MutationObserver(() => {
  theme = undefined;
  for (const [dom, { source, view }] of live) void draw(dom, source, view);
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme", "data-font"] });

class DiagramWidget extends WidgetType {
  constructor(
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
  eq(other: DiagramWidget) {
    return (
      other.source === this.source &&
      other.width === this.width &&
      sameInset(other.inset, this.inset) &&
      other.preview === this.preview
    );
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-lp-diagram" + (this.preview ? " is-preview" : "");
    // In place of its code; Mermaid's drawing keeps its labels as text, which screen readers read.
    dom.setAttribute("role", "figure");
    dom.setAttribute("aria-label", t("editor.diagram"));
    setInset(dom, this.inset);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-lp-diagram-draw";
    button.title = t("editor.drawing.fromDiagram");
    button.setAttribute("aria-label", t("editor.drawing.fromDiagram"));
    const icon = mount(Icon, { target: button, props: { name: "shapes", size: 15 } });
    button.addEventListener("click", () => {
      const pos = view.posAtDOM(dom);
      // A preview sits after the block's last line; the block is just before it.
      drawingFromDiagram(view, dom.classList.contains("is-preview") ? Math.max(0, pos - 1) : pos);
    });
    drawButtons.set(dom, { button, icon });
    dom.append(button);
    live.set(dom, { source: this.source, width: this.width, view });
    void draw(dom, this.source, view);
    return dom;
  }
  updateDOM(dom: HTMLElement, view: EditorView) {
    const before = live.get(dom);
    if (!before || dom.classList.contains("is-preview") !== this.preview) return false;
    setInset(dom, this.inset);
    live.set(dom, { source: this.source, width: this.width, view });
    if (before.source === this.source) {
      // Only its width changed.
      const svg = dom.querySelector<SVGSVGElement>(".cm-lp-diagram-frame > svg");
      if (svg) setWidth(svg, this.width);
      return true;
    }
    // While typing, wait for a pause.
    void draw(dom, this.source, view, this.preview ? 250 : 0);
    return true;
  }
  destroy(dom: HTMLElement) {
    live.delete(dom);
    latest.delete(dom);
    const draw = drawButtons.get(dom);
    if (draw) void unmount(draw.icon);
  }
  get estimatedHeight() {
    return heights.get(`${this.width}\n${this.source}`) ?? 160;
  }
  ignoreEvent() {
    return false;
  }
}

function buildDiagrams(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      // Diagrams are top-level blocks or in cards; nothing else needs a look inside.
      if (node.name === "Document" || node.name === "Card") return true;
      if (node.name !== "FencedCode") return false;
      const info = node.node.getChild("CodeInfo");
      const diagram = info && diagramInfo(state.sliceDoc(info.from, info.to));
      if (!diagram) return false;
      // Only blocks on lines of their own (not in a quote or list item, whose lines start with > or -).
      const first = state.doc.lineAt(node.from);
      if (state.sliceDoc(first.from, node.from).trim()) return false;
      const code = node.node.getChild("CodeText");
      const source = code ? state.sliceDoc(code.from, code.to) : "";
      const inset = cardInset(state, node.node);
      if (isEditing(state, node.from, node.to)) {
        const widget = new DiagramWidget(source, diagram.width, inset, true);
        decos.push(Decoration.widget({ widget, block: true, side: 1 }).range(state.doc.lineAt(node.to).to));
      } else {
        const widget = new DiagramWidget(source, diagram.width, inset, false);
        decos.push(Decoration.replace({ widget, block: true }).range(first.from, state.doc.lineAt(node.to).to));
      }
      return false;
    },
  });
  return Decoration.set(decos, true);
}

const diagrams = StateField.define<DecorationSet>({
  create: buildDiagrams,
  update(decos, tr) {
    if (tr.docChanged || tr.selection || focusChanged(tr) || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
      return buildDiagrams(tr.state);
    }
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Clicking a diagram shows its code, with the cursor at the start. */
const clickToEdit = EditorView.domEventHandlers({
  mousedown(event, view) {
    const dom = (event.target as HTMLElement).closest<HTMLElement>(".cm-lp-diagram");
    if (!dom) return false;
    event.preventDefault();
    // Its button's own, on click, and its resize handle's.
    if ((event.target as HTMLElement).closest(".cm-lp-diagram-draw, .cm-lp-diagram-resize")) return true;
    if (event.button !== 0 || view.state.readOnly || dom.classList.contains("is-preview")) return true;
    const { doc } = view.state;
    const fence = doc.lineAt(view.posAtDOM(dom));
    const anchor = fence.number < doc.lines ? doc.line(fence.number + 1).from : fence.to;
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
    return true;
  },
});

export const mermaidDiagrams: Extension = [focused, diagrams, clickToEdit];
