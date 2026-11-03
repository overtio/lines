import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, Prec, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { t } from "../i18n/index.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { MathEngine } from "../plugins/types";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { focusChanged, focused, isEditing } from "./util";

/*
 * Math, drawn by a math engine plugin (KaTeX): `$x^2$` within text (livePreview.ts and tables.ts
 * draw it), and blocks between `$$` lines or in a ```math code block, drawn here like diagrams.
 * With the cursor in a block, its LaTeX shows with the math below it. The engine loads the first
 * time a note has math; with none on, math stays as it's written.
 */

/** Engines that have loaded, and so draw at once. */
const loaded = new WeakSet<MathEngine>();

/** The math engine, once it's ready to draw; null with none on. */
export async function loadMath(): Promise<MathEngine | null> {
  const engine = plugins.math;
  if (!engine) return null;
  await engine.load();
  loaded.add(engine);
  return engine;
}

/** A note's own math commands (\newcommand…), and a key that's the same for the same ones. */
export interface Macros {
  map: Record<string, string>;
  key: string;
}

export const NO_MACROS: Macros = { map: {}, key: "" };

export const macrosOf = (map: Record<string, string>): Macros => ({ map, key: JSON.stringify(map) });

/** Draws `tex` into `dom`; LaTeX the engine can't read shows as it is, marked, with the reason on hover. */
function draw(engine: MathEngine, dom: HTMLElement, tex: string, display: boolean, macros: Macros) {
  try {
    engine.render(dom, tex, { display, macros: macros.map });
    dom.classList.remove("is-error");
    dom.removeAttribute("title");
  } catch (error) {
    dom.textContent = tex;
    dom.classList.add("is-error");
    dom.title = error instanceof Error ? error.message : String(error);
  }
}

/** `tex` drawn as math, now or once the engine has loaded (`onLoad` then runs, to measure again). */
export function mathElement(tex: string, display: boolean, onLoad?: () => void, macros = NO_MACROS): HTMLElement {
  const dom = document.createElement("span");
  dom.className = display ? "cm-lp-math is-display" : "cm-lp-math";
  const engine = plugins.math;
  if (engine && loaded.has(engine)) draw(engine, dom, tex, display, macros);
  else {
    // As written until it's drawn, or for good with no engine on.
    dom.textContent = tex;
    dom.classList.add("is-pending");
    void loadMath().then((ready) => {
      if (!ready) return;
      dom.classList.remove("is-pending");
      draw(ready, dom, tex, display, macros);
      onLoad?.();
    });
  }
  return dom;
}

/** Math within a line of text: `$x$`, or `$$x$$` displayed. */
export class InlineMathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean, readonly macros = NO_MACROS) {
    super();
  }
  eq(other: InlineMathWidget) {
    return other.tex === this.tex && other.display === this.display && other.macros.key === this.macros.key;
  }
  toDOM(view: EditorView) {
    return mathElement(this.tex, this.display, () => view.requestMeasure(), this.macros);
  }
  // A click puts the cursor here, which shows the LaTeX.
  ignoreEvent() {
    return false;
  }
}

const heights = new Map<string, number>();

export class MathBlockWidget extends WidgetType {
  constructor(
    readonly tex: string,
    /** How far in it sits, in cards. */
    readonly inset: CardInset,
    /** Drawn below its LaTeX while the cursor is in it, rather than in its place. */
    readonly preview: boolean,
    readonly macros = NO_MACROS,
    /** A class for what it's inside, e.g. a LaTeX theorem's lines (latex.ts). */
    readonly within = "",
  ) {
    super();
  }
  eq(other: MathBlockWidget) {
    return (
      other.tex === this.tex &&
      sameInset(other.inset, this.inset) &&
      other.preview === this.preview &&
      other.macros.key === this.macros.key &&
      other.within === this.within
    );
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-lp-math-block" + (this.preview ? " is-preview" : "") + (this.within ? ` ${this.within}` : "");
    setInset(dom, this.inset);
    if (!this.tex.trim()) {
      dom.classList.add("is-empty");
      dom.textContent = t("latex.emptyMath");
      return dom;
    }
    dom.append(
      mathElement(
        this.tex,
        true,
        () => {
          heights.set(this.tex, dom.offsetHeight);
          view.requestMeasure();
        },
        this.macros,
      ),
    );
    return dom;
  }
  get estimatedHeight() {
    return heights.get(this.tex) ?? 60;
  }
  ignoreEvent() {
    return false;
  }
}

/** The LaTeX of a `$$` block or a ```math code block, or null for any other node. */
function blockTex(state: EditorState, node: SyntaxNode): string | null {
  const { doc } = state;
  if (node.name === "MathBlock") {
    const first = doc.lineAt(node.from).number;
    const last = doc.lineAt(node.to).number;
    const closed = last > first && doc.line(last).text.trim() === "$$";
    const end = closed ? last - 1 : last;
    return end > first ? doc.sliceString(doc.line(first + 1).from, doc.line(end).to) : "";
  }
  if (node.name !== "FencedCode") return null;
  const info = node.getChild("CodeInfo");
  if (!info || doc.sliceString(info.from, info.to).trim().toLowerCase() !== "math") return null;
  const code = node.getChild("CodeText");
  return code ? doc.sliceString(code.from, code.to) : "";
}

function buildBlocks(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(ref) {
      // Blocks are drawn at the top level or in cards; nothing else needs a look inside.
      if (ref.name === "Document" || ref.name === "Card") return true;
      const tex = blockTex(state, ref.node);
      if (tex === null) return false;
      // Only blocks on lines of their own (not in a quote or list item, whose lines start with > or -).
      const first = state.doc.lineAt(ref.from);
      if (state.sliceDoc(first.from, ref.from).trim()) return false;
      const inset = cardInset(state, ref.node);
      if (isEditing(state, ref.from, ref.to)) {
        const widget = new MathBlockWidget(tex, inset, true);
        decos.push(Decoration.widget({ widget, block: true, side: 1 }).range(state.doc.lineAt(ref.to).to));
      } else {
        const widget = new MathBlockWidget(tex, inset, false);
        decos.push(Decoration.replace({ widget, block: true }).range(first.from, state.doc.lineAt(ref.to).to));
      }
      return false;
    },
  });
  return Decoration.set(decos, true);
}

const blocks = StateField.define<DecorationSet>({
  create: buildBlocks,
  update(decos, tr) {
    if (tr.docChanged || tr.selection || focusChanged(tr) || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
      return buildBlocks(tr.state);
    }
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Clicking a block shows its LaTeX, with the cursor at the start. */
const clickToEdit = EditorView.domEventHandlers({
  mousedown(event, view) {
    const dom = (event.target as HTMLElement).closest<HTMLElement>(".cm-lp-math-block");
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

/** Enter after a `$$` that opens a block adds the closing `$$`, with the cursor on the line between. */
const closeBlock = Prec.high(
  keymap.of([
    {
      key: "Enter",
      run(view) {
        const { state } = view;
        const range = state.selection.main;
        const line = state.doc.lineAt(range.head);
        if (state.readOnly || !range.empty || range.head !== line.to || state.selection.ranges.length > 1) return false;
        const fence = /^(\s*)\$\$\s*$/.exec(line.text);
        if (!fence) return false;
        const node = syntaxTree(state).resolveInner(line.to, -1);
        const block = node.name === "MathMark" ? node.parent : node;
        if (block?.name !== "MathBlock" || block.from !== line.from + fence[1].length) return false;
        // Only one with nothing to close it, which runs to the end of the note.
        if (block.to > line.to && state.doc.lineAt(block.to).text.trim() === "$$") return false;
        view.dispatch({
          changes: { from: line.to, insert: `\n${fence[1]}\n${fence[1]}$$` },
          selection: { anchor: line.to + 1 + fence[1].length },
          scrollIntoView: true,
          userEvent: "input",
        });
        return true;
      },
    },
  ]),
);

export const mathBlocks: Extension = [focused, blocks, clickToEdit, closeBlock];
