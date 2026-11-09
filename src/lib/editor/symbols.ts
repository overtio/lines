import { syntaxTree } from "@codemirror/language";
import { type Range, StateEffect } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { findSymbols } from "../notes/symbols";
import { prefs } from "../prefs.svelte";
import { frontMatterField } from "./objects";

/*
 * A Markdown note's `->` shown as →, `!=` as ≠ (notes/symbols.ts), in its text and its code as
 * Settings → Editor has it. Like the rest of live preview, the cursor touching one shows what was
 * typed again, to edit.
 */

/** Settings → Editor changed which symbols show: draw them again. */
export const symbolsChanged = StateEffect.define<null>();

const CODE = new Set(["InlineCode", "FencedCode", "CodeBlock"]);

/** Never shown as a symbol: Markdown's own marks, addresses, HTML and math, and what's drawn as something else. */
const SKIP = new Set([
  "QuoteMark", "ListMark", "HeaderMark", "EmphasisMark", "CodeMark", "CodeInfo", "LinkMark", "LinkLabel", "LinkTitle",
  "LinkReference", "URL", "Autolink", "Image", "Escape", "Entity", "HTMLTag", "HTMLBlock", "Comment", "CommentBlock",
  "ProcessingInstruction", "InlineMath", "MathBlock", "Mention", "Tag", "TaskMarker", "TableDelimiter", "CardMark",
]);

class SymbolWidget extends WidgetType {
  constructor(
    readonly symbol: string,
    /** In code, the characters it stands for, so it takes their room and columns still line up. */
    readonly columns: number,
  ) {
    super();
  }
  eq(other: SymbolWidget) {
    return other.symbol === this.symbol && other.columns === this.columns;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-symbol";
    el.textContent = this.symbol;
    if (this.columns) el.style.width = `${this.columns}ch`;
    return el;
  }
  // A click on it puts the cursor there, which shows what was typed.
  ignoreEvent() {
    return false;
  }
}

function build(view: EditorView): DecorationSet {
  const text = prefs.symbolsInText;
  const code = prefs.symbolsInCode;
  if (!text && !code) return Decoration.none;
  const { state } = view;
  const { doc } = state;
  // When the editor isn't focused, every one shows.
  const selection = view.hasFocus ? state.selection.ranges : [];
  const tree = syntaxTree(state);
  const front = state.field(frontMatterField, false);
  const frontEnd = front ? doc.line(front.lines).to : -1;

  /** Whether `from`–`to` is code, or null where it's never shown. */
  const place = (from: number, to: number) => {
    let inCode = false;
    for (let pos = from; pos < to; pos++) {
      for (let node: ReturnType<typeof tree.resolve> | null = tree.resolve(pos, 1); node; node = node.parent) {
        if (SKIP.has(node.name)) return null;
        if (CODE.has(node.name)) inCode = true;
      }
    }
    return inCode;
  };

  const decos: Range<Decoration>[] = [];
  for (const range of view.visibleRanges) {
    const start = doc.lineAt(range.from).from;
    for (const found of findSymbols(doc.sliceString(start, doc.lineAt(range.to).to))) {
      const from = start + found.from;
      const to = start + found.to;
      if (from <= frontEnd || selection.some((r) => r.from <= to && r.to >= from)) continue;
      const inCode = place(from, to);
      if (inCode === null || !(inCode ? code : text)) continue;
      const widget = new SymbolWidget(found.symbol, inCode ? to - from : 0);
      decos.push(Decoration.replace({ widget }).range(from, to));
    }
  }
  return Decoration.set(decos);
}

export const symbols = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.transactions.some((tr) => tr.effects.some((effect) => effect.is(symbolsChanged))) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
