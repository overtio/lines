import type { CompletionSection } from "@codemirror/autocomplete";
import { EditorSelection, type EditorState, type Extension, Prec, type Range, type StateCommand, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, WidgetType } from "@codemirror/view";
import { t } from "../i18n/index.svelte";
import { attachmentName, openAttachment } from "../notes/attachments";
import { DOCUMENT_BEGIN, latexEscape, latexLines, latexText, preambleField } from "../notes/latex";
import { openExternal } from "../platform";
import { type AttachmentWriter, attachmentPasting, choose, imageElement } from "./attachments";
import { type Definitions, type Env, LIST_ENVS, scanLatex, type Span, type Table } from "./latexSyntax";
import { BulletWidget, NumberWidget, opensLink } from "./livePreview";
import { numericColumn, tablePasting } from "./tables";
import { InlineMathWidget, type Macros, macrosOf, MathBlockWidget, mathElement } from "./math";
import { insert, type SlashCommand, slashMenu } from "./slashCommands";
import { inOpenMath, MATH_COMMANDS, paragraphBefore, searchWords, TEXT_COMMANDS } from "./texCommands";
import { focusChanged, focused, isEditing } from "./util";

/*
 * Live preview for notes written in LaTeX (docs/latex.md), the way livePreview.ts draws Markdown:
 * the note stays plain LaTeX, and its commands are hidden unless the cursor is on them. \section
 * reads as a heading, \textbf as bold, itemize as a list, math as math, a tabular as a table.
 * Commands it doesn't know stay as they are, faint.
 */

/** A whole document's preamble: up to the end of its \begin{document} line, with its title and authors. */
interface Preamble {
  to: number;
  lines: number;
  title: string | null;
  author: string | null;
}

interface Parsed {
  spans: Span[];
  /** The line the title is on (0 for none: a whole document's title is in its preamble). */
  title: number;
  macros: Macros;
  theorems: Definitions["theorems"];
  preamble: Preamble | null;
}

/** The note read into spans (latexSyntax.ts) and what it defines; read again when the text changes. */
const parsed = StateField.define<Parsed>({
  create: (state) => parse(state),
  update: (value, tr) => (tr.docChanged ? parse(tr.state) : value),
});

function parse(state: EditorState): Parsed {
  const text = state.doc.toString();
  const { spans, definitions } = scanLatex(text);
  const begin = DOCUMENT_BEGIN.exec(text);
  const head = begin && text.slice(0, begin.index);
  const preamble = begin && {
    to: begin.index + begin[0].length,
    lines: state.doc.lineAt(begin.index).number,
    title: preambleField(head!, "title"),
    author: preambleField(head!, "author"),
  };
  const title = preamble ? 0 : latexLines(text).findIndex((line) => line.text.trim()) + 1;
  return { spans, title, macros: macrosOf(definitions.macros), theorems: { ...THEOREMS, ...definitions.theorems }, preamble };
}

/** How theorem-like environments are labelled, before the note's own \newtheorem ones. */
export const THEOREMS: Definitions["theorems"] = Object.fromEntries(
  ["Theorem", "Lemma", "Proposition", "Corollary", "Definition", "Remark", "Example", "Claim", "Conjecture", "Proof"].map((label) => {
    const name = label.toLowerCase();
    return [name, { label, counter: name }];
  }),
);

/** A whole document's preamble, folded: its title and authors, and how long it is. Clicking it shows its LaTeX. */
class PreambleWidget extends WidgetType {
  constructor(readonly preamble: Preamble) {
    super();
  }
  eq(other: PreambleWidget) {
    const [a, b] = [other.preamble, this.preamble];
    return a.title === b.title && a.author === b.author && a.lines === b.lines;
  }
  toDOM() {
    const dom = document.createElement("div");
    dom.className = "cm-lt-preamble";
    if (this.preamble.title) {
      const title = document.createElement("div");
      title.className = "cm-lt-preamble-title";
      title.textContent = this.preamble.title;
      dom.append(title);
    }
    if (this.preamble.author) {
      const author = document.createElement("div");
      author.className = "cm-lt-preamble-author";
      author.textContent = this.preamble.author;
      dom.append(author);
    }
    const chip = document.createElement("span");
    chip.className = "cm-lt-preamble-chip";
    chip.textContent = t("latex.preamble", { count: this.preamble.lines });
    dom.append(chip);
    return dom;
  }
  ignoreEvent() {
    return false;
  }
}

/** A theorem's label (Theorem 2 (Euler).), in place of its \begin{…} line. */
class LabelWidget extends WidgetType {
  constructor(readonly text: string, readonly proof: boolean) {
    super();
  }
  eq(other: LabelWidget) {
    return other.text === this.text && other.proof === this.proof;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.proof ? "cm-lt-theorem-label is-proof" : "cm-lt-theorem-label";
    span.textContent = this.text;
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

/** A character a command or ligature stands for: \ldots, --, ``. */
class TextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: TextWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-lt-symbol";
    span.textContent = this.text;
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

/**
 * Text that screen readers read as `said`, where `shown` alone wouldn't say what it is: a
 * footnote's number, a citation's keys.
 */
function spoken(shown: string, said: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const visible = document.createElement("span");
  visible.textContent = shown;
  visible.setAttribute("aria-hidden", "true");
  const hidden = document.createElement("span");
  hidden.className = "visually-hidden";
  hidden.textContent = said;
  fragment.append(visible, hidden);
  return fragment;
}

/** A footnote's number, in place of `\footnote{`; its text follows, small. */
class FootnoteWidget extends WidgetType {
  constructor(readonly number: number) {
    super();
  }
  eq(other: FootnoteWidget) {
    return other.number === this.number;
  }
  toDOM() {
    const sup = document.createElement("sup");
    sup.className = "cm-lt-footnote-mark";
    sup.append(spoken(String(this.number), t("latex.footnote", { number: this.number })));
    return sup;
  }
  ignoreEvent() {
    return false;
  }
}

/**
 * A citation (`[key]`) or a reference to a label, drawn as a small chip; `said` is what screen
 * readers read for it, if not its text.
 */
class RefWidget extends WidgetType {
  constructor(readonly text: string, readonly cite: boolean, readonly said = "") {
    super();
  }
  eq(other: RefWidget) {
    return other.text === this.text && other.cite === this.cite && other.said === this.said;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.cite ? "cm-lt-ref is-cite" : "cm-lt-ref";
    if (this.said) span.append(spoken(this.text, this.said));
    else span.textContent = this.text;
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

const imageCleanups = new WeakMap<HTMLElement, () => void>();

class ImageWidget extends WidgetType {
  constructor(readonly src: string) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src;
  }
  toDOM(view: EditorView) {
    // LaTeX has no description for an image, so it's named as one rather than left out.
    const image = imageElement(this.src, t("latex.image"), () => view.requestMeasure());
    imageCleanups.set(image.dom, image.destroy);
    return image.dom;
  }
  destroy(dom: HTMLElement) {
    imageCleanups.get(dom)?.();
  }
  ignoreEvent() {
    return false;
  }
}

/** Math in a table cell: $…$ or \(…\). */
const CELL_MATH = /(?<!\\)\$((?:\\.|[^$\\])+)\$|\\\((.+?)\\\)/g;

/** A cell that spans columns: \multicolumn{2}{c}{text}. */
const MULTICOLUMN = /^\\multicolumn\{(\d+)\}\{[^{}]*\}\{([^]*)\}$/;

class TableWidget extends WidgetType {
  constructor(readonly table: Table, readonly macros: Macros) {
    super();
  }
  eq(other: TableWidget) {
    return (
      JSON.stringify(other.table.rows) === JSON.stringify(this.table.rows) &&
      other.table.header === this.table.header &&
      other.table.aligns.join() === this.table.aligns.join() &&
      other.macros.key === this.macros.key
    );
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-lp-table-wrap cm-lt-table";
    const table = document.createElement("table");
    table.className = "cm-lp-table-grid";
    table.setAttribute("aria-label", t("latex.table"));
    const head = document.createElement("thead");
    const body = document.createElement("tbody");
    const columns = Math.max(...this.table.rows.map((row) => row.length));
    this.table.rows.forEach((row, r) => {
      const inHead = r === 0 && this.table.header;
      const tr = document.createElement("tr");
      for (let col = 0, i = 0; col < columns; i++) {
        const cell = document.createElement(inHead ? "th" : "td");
        if (inHead) cell.scope = "col";
        let latex = row[i] ?? "";
        const span = MULTICOLUMN.exec(latex);
        if (span) {
          cell.colSpan = Number(span[1]);
          latex = span[2];
        }
        const align = this.table.aligns[col];
        if (align) cell.style.textAlign = align;
        let last = 0;
        for (const match of latex.matchAll(CELL_MATH)) {
          cell.append(latexText(latex.slice(last, match.index)));
          cell.append(mathElement(match[1] ?? match[2], false, () => view.requestMeasure(), this.macros));
          last = match.index + match[0].length;
        }
        cell.append(latexText(latex.slice(last)));
        tr.append(cell);
        col += cell.colSpan;
      }
      (inHead ? head : body).append(tr);
    });
    if (head.rows.length) table.append(head);
    table.append(body);
    wrap.append(table);
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

/** An enumerate item's number, as LaTeX writes it at each level: 1., (a), i., A. */
export function enumerated(n: number, level: number) {
  const roman = (k: number) =>
    [["x", 10], ["ix", 9], ["v", 5], ["iv", 4], ["i", 1]].reduce((out, [s, v]) => {
      for (; k >= (v as number); k -= v as number) out += s;
      return out;
    }, "");
  if (level === 2) return `(${String.fromCharCode(96 + n)})`;
  if (level === 3) return `${roman(n)}.`;
  if (level >= 4) return `${String.fromCharCode(64 + n)}.`;
  return `${n}.`;
}

const hidden = Decoration.replace({});
const qed = new TextWidget("\u00a0∎");
const bullets = [0, 1, 2].map((shape) => new BulletWidget(shape));
const NO_INSET = { depth: 0, icons: 0 };
const noSpellcheck = { spellcheck: "false" };
/** Lines between these environments' fences are drawn as a quote, centered or to the right. */
const ENV_LINES: Record<string, string> = {
  quote: "cm-lp-quote",
  quotation: "cm-lp-quote",
  abstract: "cm-lp-quote",
  verse: "cm-lp-quote",
  center: "cm-lt-center",
  flushright: "cm-lt-right",
};

function build(state: EditorState): DecorationSet {
  const { doc } = state;
  const { spans, title, macros, theorems, preamble } = state.field(parsed);
  // When the editor isn't focused, everything is drawn.
  const selection = state.field(focused) ? state.selection.ranges : [];
  const touches = (from: number, to: number) => selection.some((r) => r.from <= to && r.to >= from);
  const lineActive = (pos: number) => {
    const line = doc.lineAt(pos);
    return touches(line.from, line.to);
  };
  const decos: Range<Decoration>[] = [];
  const hide = (from: number, to: number) => {
    if (from < to && !doc.sliceString(from, to).includes("\n")) decos.push(hidden.range(from, to));
  };
  const mark = (from: number, to: number, cls: string, attributes?: Record<string, string>) => {
    if (from < to && cls) decos.push(Decoration.mark({ class: cls, attributes }).range(from, to));
  };
  /** The markup around some text: hidden, or faint while the cursor is on `active`. */
  const markup = (active: boolean, ...ranges: [number, number][]) => {
    for (const [from, to] of ranges) active ? mark(from, to, "cm-lt-mark", noSpellcheck) : hide(from, to);
  };
  const lines = new Map<number, { cls: string[]; style?: string }>();
  const lineClass = (n: number, cls: string, style?: string) => {
    const line = lines.get(n) ?? { cls: [] };
    line.cls.push(cls);
    if (style) line.style = style;
    lines.set(n, line);
  };
  const lineRange = (from: number, to: number, cls: (n: number, first: number, last: number) => string) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) lineClass(n, cls(n, first, last));
  };
  /** Whether `from`–`to` has nothing else on its lines. */
  const ownLines = (from: number, to: number) =>
    !doc.sliceString(doc.lineAt(from).from, from).trim() && !doc.sliceString(to, doc.lineAt(to).to).trim();
  /** Lines in lists, by how many lists they're in; and lines that are items, or an environment's fence. */
  const listDepth = new Map<number, number>();
  const itemLines = new Set<number>();
  const fenceLines = new Set<number>();
  const codeLines = new Set<number>();

  /**
   * A theorem, lemma, proof…: its label (numbered, unless it's a proof or starred) in place of its
   * \begin line, its lines marked down the side, and a proof's ∎ at its end.
   */
  const theorem = (span: Env, { label, counter }: Definitions["theorems"][string], first: number, last: number) => {
    const proof = span.name === "proof";
    const begin = doc.lineAt(span.from);
    theoremRanges.push([span.from, span.to]);
    let text = label;
    if (!proof && !span.name.endsWith("*")) {
      const number = (numbers.get(counter) ?? 0) + 1;
      numbers.set(counter, number);
      text += ` ${number}`;
    }
    const note = /\[([^\]]*)\]/.exec(doc.sliceString(span.from, span.beginTo));
    // A proof's note is its label (\begin{proof}[Solution]); a theorem's goes after its number.
    if (note) text = proof ? latexText(note[1]) : `${text} (${latexText(note[1])})`;
    lineClass(begin.number, "cm-lt-theorem cm-lt-theorem-head");
    if (lineActive(span.from)) mark(span.from, span.beginTo, "cm-lt-mark", noSpellcheck);
    else decos.push(Decoration.replace({ widget: new LabelWidget(`${text}.`, proof) }).range(span.from, span.beginTo));
    for (let n = first; n <= last; n++) lineClass(n, "cm-lt-theorem");
    fence(span.endFrom, span.to, true);
    if (proof && last >= first) decos.push(Decoration.widget({ widget: qed, side: 1 }).range(doc.line(last).to));
  };

  /**
   * An environment's `\begin` or `\end`: on a line of its own it shrinks to a small gap. Within a
   * line, or for an environment that never closes, it stays as written, faint.
   */
  const fence = (from: number, to: number, closed: boolean) => {
    if (from >= to) return;
    if (!closed || !ownLines(from, to)) return mark(from, to, "cm-lt-command", noSpellcheck);
    const active = lineActive(from);
    const n = doc.lineAt(from).number;
    fenceLines.add(n);
    lineClass(n, active ? "cm-lt-fence is-active" : "cm-lt-fence");
    markup(active, [from, to]);
  };

  // A whole document's preamble folds away, unless the cursor is in it.
  const folded = preamble && !isEditing(state, 0, preamble.to) ? preamble.to : -1;
  if (preamble && folded > 0) {
    decos.push(Decoration.replace({ widget: new PreambleWidget(preamble), block: true }).range(0, folded));
  }
  /** Theorems so far, by counter, for their numbers; and where they are, so math in them is marked down the side too. */
  const numbers = new Map<string, number>();
  const theoremRanges: [number, number][] = [];
  const inTheorem = (pos: number) => (theoremRanges.some(([from, to]) => from < pos && pos < to) ? "cm-lt-theorem" : "");

  let footnotes = 0;
  for (const span of spans) {
    // What's in a folded preamble isn't drawn; \begin{document}'s \end{document} still is.
    if (span.from < folded && span.type !== "env") continue;
    switch (span.type) {
      case "style":
        mark(span.open, span.close, span.cls);
        markup(touches(span.from, span.to), [span.from, span.open], [span.close, span.to]);
        break;

      case "footnote":
        footnotes++;
        mark(span.open, span.close, "cm-lt-footnote");
        if (touches(span.from, span.to)) markup(true, [span.from, span.open], [span.close, span.to]);
        else {
          decos.push(Decoration.replace({ widget: new FootnoteWidget(footnotes) }).range(span.from, span.open));
          hide(span.close, span.to);
        }
        break;

      case "heading":
        lineClass(doc.lineAt(span.from).number, `cm-lp-h cm-lp-h${span.level}`);
        markup(lineActive(span.from), [span.from, span.open], [span.close, span.to]);
        break;

      case "link":
        mark(span.textFrom, span.textTo, "cm-lp-link", { "data-href": span.href });
        markup(touches(span.from, span.to), [span.from, span.textFrom], [span.textTo, span.to]);
        break;

      case "image":
        if (touches(span.from, span.to)) mark(span.from, span.to, "cm-lt-command", noSpellcheck);
        else decos.push(Decoration.replace({ widget: new ImageWidget(span.src) }).range(span.from, span.to));
        break;

      case "math": {
        if (span.display && ownLines(span.from, span.to)) {
          const first = doc.lineAt(span.from);
          const last = doc.lineAt(span.to);
          if (isEditing(state, span.from, span.to)) {
            lineRange(span.from, span.to, () => "cm-lt-source");
            const widget = new MathBlockWidget(span.tex, NO_INSET, true, macros, inTheorem(span.from));
            decos.push(Decoration.widget({ widget, block: true, side: 1 }).range(last.to));
          } else {
            const widget = new MathBlockWidget(span.tex, NO_INSET, false, macros, inTheorem(span.from));
            decos.push(Decoration.replace({ widget, block: true }).range(first.from, last.to));
          }
        } else if (touches(span.from, span.to) || doc.lineAt(span.from).number !== doc.lineAt(span.to).number) {
          mark(span.from, span.to, "cm-lt-code", noSpellcheck);
        } else {
          decos.push(Decoration.replace({ widget: new InlineMathWidget(span.tex, span.display, macros) }).range(span.from, span.to));
        }
        break;
      }

      case "table":
        if (ownLines(span.from, span.to) && !isEditing(state, span.from, span.to)) {
          const widget = new TableWidget(span, macros);
          decos.push(Decoration.replace({ widget, block: true }).range(doc.lineAt(span.from).from, doc.lineAt(span.to).to));
        } else {
          lineRange(span.from, span.to, () => "cm-lt-source");
        }
        break;

      case "verbatim":
        lineRange(span.from, span.to, (n, first, last) => {
          codeLines.add(n);
          let cls = "cm-lp-codeblock";
          if (n === first) cls += " cm-lp-codeblock-first cm-lp-fence";
          if (n === last) cls += " cm-lp-codeblock-last" + (span.endFrom < span.to ? " cm-lp-fence" : "");
          return cls;
        });
        for (const [from, to] of [[span.from, span.beginTo], [span.endFrom, span.to]]) if (from < to && !lineActive(from)) hide(from, to);
        mark(span.beginTo, span.endFrom, "cm-lt-verbatim", noSpellcheck);
        break;

      case "env": {
        const closed = span.endFrom < span.to;
        const label = theorems[span.name] ?? theorems[span.name.replace(/\*$/, "")];
        const first = doc.lineAt(span.from).number + 1;
        const last = doc.lineAt(span.endFrom).number - 1;
        if (label && closed && ownLines(span.from, span.beginTo)) {
          theorem(span, label, first, last);
          break;
        }
        if (span.name === "thebibliography" && closed && ownLines(span.from, span.beginTo)) {
          // Headed References, as LaTeX heads it.
          lineClass(doc.lineAt(span.from).number, "cm-lp-h cm-lp-h1");
          if (lineActive(span.from)) mark(span.from, span.beginTo, "cm-lt-mark", noSpellcheck);
          else decos.push(Decoration.replace({ widget: new LabelWidget("References", false) }).range(span.from, span.beginTo));
        } else if (span.from >= folded) fence(span.from, span.beginTo, closed);
        fence(span.endFrom, span.to, closed);
        // One that never closes would take in the rest of the note, so its lines stay as they are.
        if (!closed) break;
        for (let n = first; n <= last; n++) {
          if (LIST_ENVS.has(span.name)) listDepth.set(n, (listDepth.get(n) ?? 0) + 1);
          else if (span.name in ENV_LINES) lineClass(n, ENV_LINES[span.name]);
        }
        break;
      }

      case "item": {
        const line = doc.lineAt(span.from);
        const style = `--li-depth: ${span.depth}`;
        const lead = !doc.sliceString(line.from, span.from).trim();
        if (lead) {
          itemLines.add(line.number);
          hide(line.from, span.from);
        }
        const label = span.label;
        if (span.list === "thebibliography" && label) {
          // [key] and the reference, its later lines in line with it.
          if (lead) lineClass(line.number, "cm-lt-li-text", "--li-depth: 0");
          if (touches(span.from, span.to)) mark(span.from, span.to, "cm-lt-mark", noSpellcheck);
          else {
            // The space after it stays, between the key and the reference.
            const to = doc.sliceString(span.to - 1, span.to) === " " ? span.to - 1 : span.to;
            decos.push(Decoration.replace({ widget: new RefWidget(`[${doc.sliceString(label.from, label.to)}]`, true) }).range(span.from, to));
          }
          break;
        }
        if (span.list === "description" && label) {
          // A term in bold, without the \item[ ] around it.
          if (lead) lineClass(line.number, "cm-lt-li-text", style);
          mark(label.from, label.to, "cm-lp-strong");
          markup(touches(span.from, span.to), [span.from, label.from], [label.to, label.to + 1]);
          break;
        }
        if (lead) lineClass(line.number, "cm-lp-li", style);
        if (touches(span.from, span.to)) {
          mark(span.from, span.to, "cm-lt-mark", noSpellcheck);
        } else {
          const widget = label
            ? new NumberWidget(latexText(doc.sliceString(label.from, label.to)))
            : span.list === "enumerate"
              ? new NumberWidget(enumerated(span.number, span.level))
              : bullets[(span.depth - 1) % 3];
          decos.push(Decoration.replace({ widget }).range(span.from, span.to));
        }
        break;
      }

      case "symbol":
        if (!touches(span.from, span.to)) decos.push(Decoration.replace({ widget: new TextWidget(span.text) }).range(span.from, span.to));
        break;

      case "escape":
        // \% reads as %. The backslash is only out of sight: hiding it would let a line wrap between 50 and %.
        if (!touches(span.from, span.to)) mark(span.from, span.from + 1, "cm-lt-hidden");
        break;

      case "break":
        markup(lineActive(span.from), [span.from, span.to]);
        break;

      case "comment": {
        mark(span.from, span.to, "cm-lt-comment");
        // Tags go in comments, where LaTeX ignores them: % #work.
        const text = doc.sliceString(span.from, span.to);
        for (const tag of text.matchAll(/(?<=^|[\s%(])#[\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*/gu)) {
          mark(span.from + tag.index, span.from + tag.index + tag[0].length, "cm-lp-tag");
        }
        break;
      }

      case "command": {
        // What LaTeX prints nothing for: \label{…}, and \maketitle when the folded preamble shows the title.
        const command = doc.sliceString(span.from, span.to);
        const silent = command.startsWith("\\label{") || (folded > 0 && command === "\\maketitle");
        if (!silent || touches(span.from, span.to)) {
          mark(span.from, span.to, "cm-lt-command", noSpellcheck);
          break;
        }
        hide(span.from, span.to);
        // On a line of its own, the line shrinks away like an environment's fence.
        if (ownLines(span.from, span.to)) {
          const n = doc.lineAt(span.from).number;
          fenceLines.add(n);
          lineClass(n, "cm-lt-fence");
        }
        break;
      }

      case "cite":
      case "ref": {
        if (touches(span.from, span.to)) {
          mark(span.from, span.to, "cm-lt-command", noSpellcheck);
          break;
        }
        // Read without the brackets drawn around them: [a, b] is "Citation a, b", (eq:x) "Reference to eq:x".
        const inner = span.text.replace(/^[[(](.*)[\])]$/, "$1");
        const said = span.type === "cite" ? t("latex.citation", { keys: inner }) : t("latex.reference", { label: inner });
        decos.push(Decoration.replace({ widget: new RefWidget(span.text, span.type === "cite", said) }).range(span.from, span.to));
        break;
      }
    }
  }

  // Text in a list that isn't an item's first line lines up with the items' text.
  for (const [n, depth] of listDepth) {
    if (itemLines.has(n) || fenceLines.has(n)) continue;
    const line = doc.line(n);
    if (!line.text.trim()) continue;
    lineClass(n, "cm-lt-li-text", `--li-depth: ${depth}`);
    hide(line.from, line.from + line.text.length - line.text.trimStart().length);
  }

  for (let n = folded > 0 ? doc.lineAt(folded).number + 1 : 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (n === title) lineClass(n, "cm-lp-title");
    else if (doc.length && !line.text.trim() && !codeLines.has(n) && !fenceLines.has(n)) lineClass(n, "cm-lp-blank");
    const classes = lines.get(n);
    if (classes) {
      decos.push(Decoration.line({ class: classes.cls.join(" "), attributes: classes.style ? { style: classes.style } : undefined }).range(line.from));
    }
  }

  return Decoration.set(decos, true);
}

const decorations = StateField.define<DecorationSet>({
  create: build,
  update(decos, tr) {
    if (tr.docChanged || tr.selection || focusChanged(tr) || tr.startState.readOnly !== tr.state.readOnly) return build(tr.state);
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const events = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement;
    // Clicking a folded preamble shows its LaTeX.
    if (target.closest(".cm-lt-preamble")) {
      event.preventDefault();
      if (event.button !== 0 || view.state.readOnly) return true;
      view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
      view.focus();
      return true;
    }
    // Clicking drawn math or a table shows its LaTeX.
    const block = target.closest<HTMLElement>(".cm-lp-math-block, .cm-lt-table");
    if (block) {
      event.preventDefault();
      if (event.button !== 0 || view.state.readOnly || block.classList.contains("is-preview")) return true;
      const { doc } = view.state;
      const line = doc.lineAt(view.posAtDOM(block));
      const span = view.state.field(parsed).spans.find((s) => s.from >= line.from && s.from <= line.to && (s.type === "math" || s.type === "table"));
      const multiline = span && doc.lineAt(span.to).number > line.number;
      const anchor = multiline ? doc.line(line.number + 1).from : span ? Math.min(span.from + 2, span.to) : line.from;
      view.dispatch({ selection: { anchor }, scrollIntoView: true });
      view.focus();
      return true;
    }
    if (opensLink(event, view)) {
      const href = target.closest<HTMLElement>(".cm-lp-link")!.dataset.href!;
      const name = attachmentName(href);
      void (name ? openAttachment(name, name) : openExternal(href));
      event.preventDefault();
      return true;
    }
    return false;
  },
});

// Pasting and dropping, as LaTeX

/** Where a paste stays as it is: in verbatim, math, a table or a comment. */
function literalAt(state: EditorState, pos: number) {
  return state
    .field(parsed)
    .spans.some((s) => (s.type === "verbatim" || s.type === "math" || s.type === "table" || s.type === "comment") && s.from < pos && pos < s.to);
}

/** An address in a LaTeX argument, where `%` would start a comment. */
const address = (url: string) => url.replace(/%/g, "\\%");

/** Pasted and dropped images as \includegraphics, other files as \href links named after them. */
const latexWriter: AttachmentWriter = {
  image: (src) => `\\includegraphics[width=\\linewidth]{${address(src)}}`,
  file: (href, name) => `\\href{${address(href)}}{${latexEscape(name)}}`,
  allowed: (state, pos) => !literalAt(state, pos),
};

/** Rows pasted from a spreadsheet, pgAdmin or a web page as a tabular: the first row over a rule, numeric columns right-aligned. */
function tabular(rows: string[][]) {
  const columns = Math.max(...rows.map((row) => row.length));
  const plain = rows.map((row) => Array.from({ length: columns }, (_, col) => (row[col] ?? "").replace(/\s+/g, " ").trim()));
  const cells = plain.map((row) => row.map(latexEscape));
  const widths = Array.from({ length: columns }, (_, col) => Math.max(...cells.map((row) => row[col].length)));
  // Lined up in the LaTeX too, so it reads as a table while it's edited.
  const line = (row: string[]) => `  ${row.map((cell, col) => (col < columns - 1 ? cell.padEnd(widths[col]) : cell)).join(" & ")} \\\\`;
  const spec = Array.from({ length: columns }, (_, col) => (numericColumn(plain.slice(1), col) ? "r" : "l")).join("");
  const [header, ...body] = cells;
  return [`\\begin{tabular}{${spec}}`, line(header), "  \\hline", ...body.map(line), "\\end{tabular}"].join("\n");
}

/** Pasting a web address over selected text links the text: \href{address}{text}. */
const pasteLink = EditorView.domEventHandlers({
  paste(event, view) {
    const { state } = view;
    const url = event.clipboardData?.getData("text/plain").trim() ?? "";
    const range = state.selection.main;
    if (state.readOnly || range.empty || state.selection.ranges.length > 1 || !/^https?:\/\/\S+$/.test(url)) return false;
    const text = state.sliceDoc(range.from, range.to);
    if (text.includes("\n") || literalAt(state, range.from)) return false;
    event.preventDefault();
    const insert = `\\href{${address(url)}}{${text}}`;
    view.dispatch({ changes: { from: range.from, to: range.to, insert }, selection: { anchor: range.from + insert.length }, userEvent: "input.paste" });
    return true;
  },
});

/** How many times `text` has `needle`. */
const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

/**
 * Enter on an item adds the next item; on an empty item, it ends the list. After a \begin{…}
 * (or \[) that isn't closed yet, it adds the \end{…} (or \]), with the cursor between.
 */
const enter: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;
  if (state.readOnly || !range.empty || state.selection.ranges.length > 1) return false;
  const line = state.doc.lineAt(range.head);
  if (range.head !== line.to) return false;
  const item = /^(\s*)\\item(?:\[[^\]]*\])?\s*(.*)$/.exec(line.text);
  if (item && !item[2].trim()) {
    const next = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;
    if (next && /^\s*\\end\{(itemize|enumerate|description)\}\s*$/.test(next.text)) {
      // Out of the list: the empty item goes, and a line starts after the list's end.
      const changes = state.changes([{ from: line.from - (line.number > 1 ? 1 : 0), to: line.to }, { from: next.to, insert: "\n" }]);
      dispatch(state.update({ changes, selection: { anchor: changes.mapPos(next.to, 1) }, scrollIntoView: true, userEvent: "input" }));
    } else {
      dispatch(state.update({ changes: { from: line.from, to: line.to }, scrollIntoView: true, userEvent: "delete" }));
    }
    return true;
  }
  if (item) {
    const insert = `\n${item[1]}\\item `;
    dispatch(state.update({ changes: { from: range.head, insert }, selection: { anchor: range.head + insert.length }, scrollIntoView: true, userEvent: "input" }));
    return true;
  }
  const text = state.doc.toString();
  const begin = /^(\s*)\\begin\{([^{}]+)\}(?:\[[^\]]*\]|\{[^{}]*\})*\s*$/.exec(line.text);
  const display = /^(\s*)\\\[\s*$/.exec(line.text);
  let inner: string, close: string;
  if (begin && occurrences(text, `\\begin{${begin[2]}}`) > occurrences(text, `\\end{${begin[2]}}`)) {
    inner = LIST_ENVS.has(begin[2]) ? "  \\item " : "";
    close = `\\end{${begin[2]}}`;
  } else if (display && occurrences(text, "\\[") > occurrences(text, "\\]")) {
    inner = "";
    close = "\\]";
  } else return false;
  const indent = (begin ?? display)![1];
  const before = `\n${indent}${inner}`;
  dispatch(
    state.update({
      changes: { from: range.head, insert: `${before}\n${indent}${close}` },
      selection: { anchor: range.head + before.length },
      scrollIntoView: true,
      userEvent: "input",
    }),
  );
  return true;
};

/** Puts the selections in `\command{…}`, or takes them out of it. */
function wrap(command: string): StateCommand {
  const open = `\\${command}{`;
  return ({ state, dispatch }) => {
    if (state.readOnly) return false;
    const tr = state.changeByRange((range) => {
      if (state.sliceDoc(range.from - open.length, range.from) === open && state.sliceDoc(range.to, range.to + 1) === "}") {
        return {
          changes: [{ from: range.from - open.length, to: range.from }, { from: range.to, to: range.to + 1 }],
          range: EditorSelection.range(range.from - open.length, range.to - open.length),
        };
      }
      return {
        changes: [{ from: range.from, insert: open }, { from: range.to, insert: "}" }],
        range: EditorSelection.range(range.from + open.length, range.to + open.length),
      };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

const latexKeymap = Prec.high(
  keymap.of([
    { key: "Enter", run: enter },
    { key: "Mod-b", run: wrap("textbf") },
    { key: "Mod-i", run: wrap("emph") },
    { key: "Mod-e", run: wrap("texttt") },
  ]),
);

const FORMAT: CompletionSection = { name: t("latex.slash.format"), rank: 0 };
const INSERT: CompletionSection = { name: t("latex.slash.insert"), rank: 1 };

type SlashName = "section" | "subsection" | "subsubsection" | "bullets" | "numbers" | "quote" | "math" | "equations" | "code" | "table" | "image" | "file" | "footnote" | "link" | "date";

/** A "/" command, named and found by its messages (`latex.slash.<name>` and its keywords). */
const command = (name: SlashName, hint: string, icon: SlashCommand["icon"], section: CompletionSection, apply: SlashCommand["apply"]): SlashCommand => ({
  name: t(`latex.slash.${name}`),
  hint,
  icon,
  section,
  keywords: searchWords(`latex.slash.${name}`, `latex.slash.${name}.keywords`),
  apply,
});

const COMMANDS: SlashCommand[] = [
  command("section", "\\section", "heading-1", FORMAT, insert("\\section{|}")),
  command("subsection", "\\subsection", "heading-2", FORMAT, insert("\\subsection{|}")),
  command("subsubsection", "\\subsubsection", "heading-3", FORMAT, insert("\\subsubsection{|}")),
  command("bullets", "itemize", "list", FORMAT, insert("\\begin{itemize}\n  \\item |\n\\end{itemize}", true)),
  command("numbers", "enumerate", "list-ordered", FORMAT, insert("\\begin{enumerate}\n  \\item |\n\\end{enumerate}", true)),
  command("quote", "quote", "text-quote", FORMAT, insert("\\begin{quote}\n|\n\\end{quote}", true)),
  command("math", "\\[ \\]", "radical", INSERT, insert("\\[\n|\n\\]", true)),
  command("equations", "align*", "radical", INSERT, insert("\\begin{align*}\n|\n\\end{align*}", true)),
  command("code", "verbatim", "code", INSERT, insert("\\begin{verbatim}\n|\n\\end{verbatim}", true)),
  command("table", "tabular", "table", INSERT, insert("\\begin{tabular}{ll}\n  | &  \\\\\n   &  \\\\\n\\end{tabular}", true)),
  command("image", "\\includegraphics", "image", INSERT, choose("image/*", latexWriter)),
  command("file", "\\href", "paperclip", INSERT, choose("", latexWriter)),
  command("footnote", "\\footnote", "message-circle", INSERT, insert("\\footnote{|}")),
  command("link", "\\href", "link", INSERT, insert("\\href{https://}{|}")),
  command("date", t("latex.slash.date.hint"), "calendar", INSERT, insert(() => new Date().toLocaleDateString(undefined, { dateStyle: "long" }))),
];

/** What "\" offers at `pos`: math commands in math, none in verbatim, and text commands elsewhere. */
function backslashCommands(state: EditorState, pos: number) {
  for (const span of state.field(parsed).spans) {
    if (span.from >= pos || span.to <= pos) continue;
    if (span.type === "math") return MATH_COMMANDS;
    if (span.type === "verbatim" && pos >= span.beginTo) return null;
  }
  return inOpenMath(paragraphBefore(state, pos)) ? MATH_COMMANDS : TEXT_COMMANDS;
}

/** What a LaTeX note's editor adds to the shared ones (setup.ts), in place of the Markdown ones. */
export const latexEditing: Extension = [
  focused,
  parsed,
  decorations,
  events,
  latexKeymap,
  slashMenu(COMMANDS, backslashCommands),
  Prec.high(tablePasting(tabular, literalAt)),
  attachmentPasting(latexWriter),
  pasteLink,
];
