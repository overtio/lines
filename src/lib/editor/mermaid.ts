import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { Mermaid } from "mermaid";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { focusChanged, focused, isEditing } from "./util";

/*
 * Mermaid diagrams: a ```mermaid code block is drawn as its diagram, in the theme's colors.
 * With the cursor in it, the code shows with the diagram below it, redrawn as you type.
 * Mermaid is large, so it loads the first time a note has a diagram.
 */

let loading: Promise<Mermaid> | undefined;
const load = () => (loading ??= import("mermaid").then((module) => module.default));

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
const heights = new Map<string, number>();
/** Diagrams on screen: their source and editor, for redrawing in a new theme. */
const live = new Map<HTMLElement, { source: string; view: EditorView }>();
/** The latest draw of each diagram; an older one that finishes later is dropped. */
const latest = new WeakMap<HTMLElement, number>();
let ids = 0;

async function draw(dom: HTMLElement, source: string, view: EditorView, delay = 0) {
  const token = ++ids;
  latest.set(dom, token);
  const theme = themeConfig();
  const key = JSON.stringify(theme) + "\n" + source;
  const show = (content: string | Node) => {
    if (typeof content === "string") dom.innerHTML = content;
    else dom.replaceChildren(content);
    dom.classList.remove("is-pending");
    view.requestMeasure();
  };
  const cached = drawn.get(key);
  if (cached !== undefined) return show(cached);
  if (!source.trim()) return show(message("Empty diagram"));
  // Keep showing the last diagram, faded, until the new one is ready.
  dom.classList.add("is-pending");
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (latest.get(dom) !== token) return;
  const id = `lines-mermaid-${token}`;
  try {
    const mermaid = await load();
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, theme: "base", ...theme });
    const { svg } = await mermaid.render(id, source);
    remember(drawn, key, svg);
    if (latest.get(dom) !== token) return;
    show(svg);
    remember(heights, source, dom.offsetHeight);
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

new MutationObserver(() => {
  theme = undefined;
  for (const [dom, { source, view }] of live) void draw(dom, source, view);
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme", "data-font"] });

class DiagramWidget extends WidgetType {
  constructor(
    readonly source: string,
    /** How far in it sits, in cards. */
    readonly inset: CardInset,
    /** Drawn below its code while the cursor is in it, rather than in its place. */
    readonly preview: boolean,
  ) {
    super();
  }
  eq(other: DiagramWidget) {
    return other.source === this.source && sameInset(other.inset, this.inset) && other.preview === this.preview;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-lp-diagram" + (this.preview ? " is-preview" : "");
    setInset(dom, this.inset);
    live.set(dom, { source: this.source, view });
    void draw(dom, this.source, view);
    return dom;
  }
  updateDOM(dom: HTMLElement, view: EditorView) {
    const before = live.get(dom);
    if (!before || dom.classList.contains("is-preview") !== this.preview) return false;
    setInset(dom, this.inset);
    live.set(dom, { source: this.source, view });
    // While typing, wait for a pause.
    void draw(dom, this.source, view, this.preview ? 250 : 0);
    return true;
  }
  destroy(dom: HTMLElement) {
    live.delete(dom);
    latest.delete(dom);
  }
  get estimatedHeight() {
    return heights.get(this.source) ?? 160;
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
      if (!info || state.sliceDoc(info.from, info.to).trim().toLowerCase() !== "mermaid") return false;
      // Only blocks on lines of their own (not in a quote or list item, whose lines start with > or -).
      const first = state.doc.lineAt(node.from);
      if (state.sliceDoc(first.from, node.from).trim()) return false;
      const code = node.node.getChild("CodeText");
      const source = code ? state.sliceDoc(code.from, code.to) : "";
      const inset = cardInset(state, node.node);
      if (isEditing(state, node.from, node.to)) {
        const widget = new DiagramWidget(source, inset, true);
        decos.push(Decoration.widget({ widget, block: true, side: 1 }).range(state.doc.lineAt(node.to).to));
      } else {
        const widget = new DiagramWidget(source, inset, false);
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
