import { locale, t } from "../../lib/i18n/index.svelte";
import { enumerated, THEOREMS } from "./editor";
import { type Definitions, type Env, LIST_ENVS, scanLatex, type Span } from "./syntax";
import { type Macros, macrosOf } from "../../lib/editor/math";
import { DOCUMENT_BEGIN, latexText } from "./text";
import { el, type Parts } from "../../lib/print/parts";

/*
 * A LaTeX note as a printed document, read the way the editor reads it (syntax.ts) but laid
 * out as LaTeX lays out a page: lines join into paragraphs, a blank line starts a new one, sections,
 * theorems and equations are numbered and \ref shows their numbers, and \maketitle prints the
 * title. Footnotes are gathered at the end. Commands it doesn't know print their last argument's
 * text, or nothing (layout like \vspace). For TeX's own typesetting, see the TeX plugin (plugins/tex).
 */

interface Node {
  span: Span;
  children: Node[];
}

const PAGE_BREAKS = new Set(["newpage", "clearpage", "cleardoublepage", "pagebreak"]);

/** Commands that print nothing here: layout, sizes, definitions and the like. */
const SILENT = new Set(
  (
    "label vspace hspace vskip hskip setlength addtolength setcounter addtocounter usepackage documentclass input include " +
    "bibliographystyle bibliography pagestyle thispagestyle nopagebreak linebreak " +
    "nolinebreak centering raggedright raggedleft small footnotesize scriptsize tiny large Large LARGE huge Huge normalsize " +
    "bfseries itshape ttfamily rmfamily sffamily scshape upshape mdseries slshape em indent noindent smallskip medskip bigskip " +
    "vfill hfill tableofcontents listoffigures listoftables appendix frontmatter mainmatter backmatter newcommand renewcommand " +
    "providecommand DeclareMathOperator def newtheorem theoremstyle graphicspath hypersetup protect phantom hphantom vphantom " +
    "color index nocite lstset definecolor setlist newenvironment renewenvironment let makeatletter makeatother sloppy onecolumn " +
    "twocolumn selectlanguage title author date thanks keywords and"
  ).split(" "),
);

/** Commands that stand for a space. */
const SPACES: Record<string, string> = { quad: " ", qquad: "  ", enspace: " ", thinspace: " " };

/** Theorem-like environments whose text is upright; the rest are in italics, as amsthm's plain style sets them. */
const UPRIGHT = new Set(["definition", "example", "remark", "proof"]);

/** Bullets for itemize, by depth, as LaTeX's are. */
const BULLETS = ["•", "–", "∗", "·"];

/** Today's date, written out as \today writes it: October 29, 2026. */
const today = () => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date());

/** Spans as a tree: each holds the ones inside it. */
function treeOf(spans: Span[]): Node[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from || b.to - a.to);
  const roots: Node[] = [];
  const stack: Node[] = [];
  for (const span of sorted) {
    const node = { span, children: [] };
    while (stack.length && stack[stack.length - 1].span.to <= span.from) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent && span.to <= parent.span.to) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

/** Paragraphs as they're written into a block: text joins until a blank line or a block. */
class Flow {
  #paragraph: HTMLElement | null = null;
  constructor(readonly into: HTMLElement) {}

  /** The paragraph being written, started if there's none. */
  inline(): HTMLElement {
    if (!this.#paragraph) {
      this.#paragraph = el("p");
      this.into.append(this.#paragraph);
    }
    return this.#paragraph;
  }

  /** Text as LaTeX reads it: spaces and single line breaks are one space; a blank line ends the paragraph. */
  text(value: string) {
    value.split(/\n[ \t]*\n\s*/).forEach((part, i) => {
      if (i > 0) this.end();
      const words = part.replace(/\s+/g, " ");
      if (!words.trim() && !this.#paragraph) return;
      const p = this.inline();
      // No space to start a paragraph with.
      if (!p.textContent && !p.firstElementChild) {
        const start = words.trimStart();
        if (start) p.append(start);
      } else p.append(words);
    });
  }

  block(element: HTMLElement) {
    this.end();
    this.into.append(element);
  }

  /** Ends the paragraph, without the space it ended with (or the paragraph, if it's empty). */
  end() {
    const p = this.#paragraph;
    this.#paragraph = null;
    if (!p) return;
    const last = p.lastChild;
    if (last?.nodeType === Node.TEXT_NODE) last.textContent = last.textContent!.trimEnd();
    if (!p.textContent!.trim() && !p.querySelector("img, .doc-math, br")) p.remove();
  }
}

export function printDocument(body: string, parts: Parts): HTMLElement {
  const doc = el("div", "doc doc-latex");
  // Its text is set in KaTeX's Computer Modern, so its fonts are wanted even with no math in it.
  parts.math("", false).remove();
  const { spans, definitions } = scanLatex(body);
  const macros: Macros = macrosOf(definitions.macros);
  const theorems: Definitions["theorems"] = { ...THEOREMS, ...definitions.theorems };
  const begin = DOCUMENT_BEGIN.exec(body);
  const preamble = begin ? body.slice(0, begin.index) : "";
  const start = begin ? begin.index + begin[0].length : 0;
  const end = begin ? (/\\end\{document\}/.exec(body.slice(start))?.index ?? body.length - start) + start : body.length;
  /** The LaTeX being read: the note, or for a moment a table cell or the title, which are read on their own. */
  let current = body;
  const slice = (from: number, to: number) => current.slice(from, to);

  /** Numbers so far: sections at each level, theorems by counter, equations. */
  const sections = [0, 0, 0];
  const counters = new Map<string, number>();
  let equations = 0;
  /** Figures and tables, numbered by their captions; and which one is being drawn. */
  const floats = { figure: 0, table: 0 };
  let float: keyof typeof floats | null = null;
  /** What a \label names: the number of whatever was numbered last before it. */
  let lastNumber = "";
  const labels = new Map<string, string>();
  const refs: { dom: HTMLElement; keys: string[]; wrap: (text: string) => string }[] = [];
  const footnotes: HTMLElement[] = [];

  /** The title block \maketitle prints, from the preamble's \title, \author and \date. */
  function titleBlock() {
    const field = (name: string) => {
      const match = new RegExp(`\\\\${name}\\s*(?:\\[[^\\]]*\\])?\\{((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)\\}`).exec(preamble);
      return match?.[1] ?? null;
    };
    const block = el("div", "doc-title");
    const title = field("title");
    if (title) block.append(el("div", "doc-title-text", ...render(title.replace(/\\\\/g, " ")).childNodes));
    const author = field("author");
    if (author) {
      const names = author.split(/\\and\b/).map((one) => el("div", "doc-author", ...one.split("\\\\").map((line, i) => el("div", i ? "doc-affiliation" : "", latexText(line).trim()))));
      block.append(el("div", "doc-authors", ...names));
    }
    const date = field("date");
    const dated = date === null ? today() : latexText(date.replace(/\\today\b/g, today())).trim();
    if (dated) block.append(el("div", "doc-date", dated));
    return block;
  }

  /** `from`–`to` of the note, drawn into `flow` with the spans inside it. */
  function content(from: number, to: number, nodes: Node[], flow: Flow) {
    let pos = from;
    for (const node of nodes) {
      if (node.span.to <= from || node.span.from >= to) continue;
      if (node.span.from > pos) flow.text(slice(pos, node.span.from));
      draw(node, flow);
      pos = Math.max(pos, node.span.to);
    }
    if (pos < to) flow.text(slice(pos, to));
  }

  /** Text that's all on one line, like a heading's or a table cell's. */
  function inline(from: number, to: number, nodes: Node[], into: HTMLElement) {
    const holder = el("div");
    const flow = new Flow(holder);
    content(from, to, nodes, flow);
    flow.end();
    for (const p of holder.children) into.append(...p.childNodes, " ");
    if (into.lastChild?.textContent === " ") into.lastChild.remove();
    return into;
  }

  /** LaTeX that isn't part of the note's own spans (a table cell, the title): read on its own. */
  function render(source: string): HTMLElement {
    return latexInline(source, treeOf(scanLatex(source).spans));
  }

  function latexInline(source: string, nodes: Node[]) {
    const saved = current;
    current = source;
    const into = inline(0, source.length, nodes, el("span"));
    current = saved;
    return into;
  }

  function draw(node: Node, flow: Flow) {
    const { span } = node;
    const text = slice;
    switch (span.type) {
      case "comment":
        return;
      case "style": {
        if (span.cls === "cm-lt-caption") {
          const caption = inline(span.open, span.close, node.children, el("div", "doc-caption"));
          // In a figure or table it's numbered (Table 1:), and a \label after it names that number.
          if (float) {
            lastNumber = String(++floats[float]);
            caption.prepend(`${t(float === "figure" ? "print.figure" : "print.table", { number: lastNumber })}: `);
          }
          return flow.block(caption);
        }
        const tag = { "cm-lp-strong": "strong", "cm-lp-em": "em", "cm-lp-code": "code", "cm-lp-underline": "u", "cm-lp-strike": "s" }[span.cls] ?? "span";
        const element = el(tag as "span", span.cls === "cm-lt-smallcaps" ? "doc-smallcaps" : "");
        flow.inline().append(inline(span.open, span.close, node.children, element));
        // \paragraph{Title} runs into the text after it.
        if (/^\\paragraph\b/.test(text(span.from, span.open))) flow.inline().append(" ");
        return;
      }
      case "heading": {
        const starred = /^\\[a-z]+\*/.test(text(span.from, span.open));
        const h = el(`h${span.level}` as "h1");
        if (!starred) {
          sections[span.level - 1]++;
          sections.fill(0, span.level);
          lastNumber = sections.slice(0, span.level).join(".");
          h.append(el("span", "doc-section-number", lastNumber), " ");
        }
        return flow.block(inline(span.open, span.close, node.children, h));
      }
      case "footnote": {
        footnotes.push(inline(span.open, span.close, node.children, el("li")));
        return void flow.inline().append(el("sup", "doc-footnote-mark", String(footnotes.length)));
      }
      case "link": {
        const a = el("a", "doc-link");
        if (/^(https?:|mailto:)/i.test(span.href)) a.href = span.href;
        return void flow.inline().append(inline(span.textFrom, span.textTo, node.children, a));
      }
      case "image": {
        const options = /\[([^\]]*)\]/.exec(text(span.from, span.to))?.[1] ?? "";
        const width = /width\s*=\s*([\d.]*)\s*\\(?:line|text|column)width/.exec(options);
        const image = parts.image(span.src, "");
        if (width) image.style.width = `${(parseFloat(width[1] || "1") * 100).toFixed(1)}%`;
        return flow.block(el("div", "doc-figure", image));
      }
      case "math": {
        if (!span.display) return void flow.inline().append(parts.math(span.tex, false, macros));
        let tex = span.tex;
        // A numbered equation shows its number, and its \label names it.
        if (text(span.from, span.to).startsWith("\\begin{equation}")) {
          lastNumber = String(++equations);
          tex = `${tex.replace(/^\\begin\{equation\*\}|\\end\{equation\*\}$/g, "")}\\tag{${lastNumber}}`;
          const label = /\\label\{([^{}]*)\}/.exec(text(span.from, span.to));
          if (label) labels.set(label[1].trim(), lastNumber);
        }
        return flow.block(parts.math(tex, true, macros));
      }
      case "symbol":
        return void flow.inline().append(span.text);
      case "escape":
        return void flow.inline().append(text(span.from + 1, span.to));
      case "break":
        return void flow.inline().append(el("br"));
      case "cite":
        return void flow.inline().append(el("span", "doc-cite", span.text));
      case "ref": {
        const written = text(span.from, span.to);
        const keys = /\{([^{}]*)\}\s*$/.exec(written)?.[1].split(",").map((key) => key.trim()) ?? [];
        const dom = el("span", "doc-ref", span.text);
        refs.push({ dom, keys, wrap: written.startsWith("\\eqref") ? (number) => `(${number})` : (number) => number });
        return void flow.inline().append(dom);
      }
      case "item":
        // Drawn by its list.
        return;
      case "verbatim": {
        const options = /\[([^\]]*)\]/.exec(text(span.from, span.beginTo))?.[1] ?? "";
        const language = /language\s*=\s*\{?([\w+#-]+)/i.exec(options)?.[1] ?? /\{([\w+#-]+)\}\s*$/.exec(span.name === "minted" ? text(span.from, span.beginTo) : "")?.[1] ?? "";
        const source = text(span.beginTo, span.endFrom).replace(/^[ \t]*\n/, "").replace(/\n[ \t]*$/, "");
        return flow.block(parts.code(source, language));
      }
      case "table":
        return flow.block(table(span));
      case "command":
        return command(span, flow);
      case "env":
        return env(node, span, flow);
    }
  }

  function command(span: Span, flow: Flow) {
    const written = slice(span.from, span.to);
    const name = /^\\([A-Za-z]+)/.exec(written)?.[1] ?? "";
    if (name === "label") {
      const key = /\{([^{}]*)\}/.exec(written)?.[1].trim();
      if (key && lastNumber) labels.set(key, lastNumber);
      return;
    }
    if (name === "maketitle") return flow.block(titleBlock());
    // A new page, where pages.ts starts one (at the document's top level).
    if (PAGE_BREAKS.has(name)) {
      if (flow.into === doc) flow.block(el("div", "doc-page-break"));
      return;
    }
    if (name === "today") return void flow.inline().append(today());
    if (name === "newline") return void flow.inline().append(el("br"));
    if (name === "par") return flow.end();
    if (SPACES[name]) return void flow.inline().append(SPACES[name]);
    if (SILENT.has(name)) return;
    // Anything else prints its last argument, the way \textcolor{red}{word} prints "word".
    const groups = [...written.matchAll(/\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g)];
    const last = groups.at(-1);
    if (last) flow.inline().append(...latexInline(last[1], treeOf(scanLatex(last[1]).spans)).childNodes);
  }

  function table(span: Extract<Span, { type: "table" }>) {
    const tbl = el("table");
    const cell = (source: string, header: boolean, column: number) => {
      const multi = /^\\multicolumn\{(\d+)\}\{([^{}]*)\}\{([^]*)\}$/.exec(source);
      const td = el(header ? "th" : "td");
      const align = multi ? (/c/.test(multi[2]) ? "center" : /r/.test(multi[2]) ? "right" : "left") : span.aligns[column];
      if (align) td.style.textAlign = align;
      if (multi) td.colSpan = Number(multi[1]);
      const written = (multi ? multi[3] : source).replace(/^\\multirow\{[^{}]*\}\{[^{}]*\}\{([^]*)\}$/, "$1");
      td.append(...latexInline(written, treeOf(scanLatex(written).spans)).childNodes);
      return { td, span: multi ? Number(multi[1]) : 1 };
    };
    const row = (cells: string[], header: boolean) => {
      const tr = el("tr");
      let column = 0;
      for (const source of cells) {
        const { td, span: width } = cell(source, header, column);
        tr.append(td);
        column += width;
      }
      return tr;
    };
    const [first, ...rest] = span.rows;
    if (span.header && first) tbl.append(el("thead", "", row(first, true)), el("tbody", "", ...rest.map((cells) => row(cells, false))));
    else tbl.append(el("tbody", "", ...span.rows.map((cells) => row(cells, false))));
    return el("div", "doc-table", tbl);
  }

  function env(node: Node, span: Env, flow: Flow) {
    const { name } = span;
    const closed = span.endFrom < span.to;
    const base = name.replace(/\*$/, "");
    if (!closed) {
      // One that never closes is left as text.
      return content(span.beginTo, span.to, node.children, flow);
    }
    if (LIST_ENVS.has(name)) return flow.block(list(node, span));
    const theorem = theorems[name] ?? theorems[base];
    if (theorem) return flow.block(theoremBlock(node, span, theorem));
    const block = (className: string, tag: "div" | "blockquote" = "div") => {
      const element = el(tag, className);
      const inner = new Flow(element);
      content(span.beginTo, span.endFrom, node.children, inner);
      inner.end();
      flow.block(element);
      return element;
    };
    if (base === "abstract") {
      const element = block("doc-abstract");
      element.prepend(el("div", "doc-abstract-title", t("print.abstract")));
      return;
    }
    if (base === "quote" || base === "quotation" || base === "verse") return void block(`doc-quote is-${base}`, "blockquote");
    if (base === "center") return void block("doc-center");
    if (base === "flushright") return void block("doc-right");
    if (base === "figure" || base === "table" || base === "wrapfigure") {
      const outer = float;
      float = base === "table" ? "table" : "figure";
      block("doc-float");
      float = outer;
      return;
    }
    // \begin{document} and anything else: its contents, as they are.
    content(span.beginTo, span.endFrom, node.children, flow);
  }

  function theoremBlock(node: Node, span: Env, { label, counter }: { label: string; counter: string }) {
    const proof = span.name === "proof";
    const base = span.name.replace(/\*$/, "");
    const element = el("div", `doc-theorem${UPRIGHT.has(base) ? " is-upright" : ""}${proof ? " is-proof" : ""}`);
    let heading = label;
    if (!proof && !span.name.endsWith("*")) {
      const number = (counters.get(counter) ?? 0) + 1;
      counters.set(counter, number);
      heading += ` ${number}`;
      lastNumber = String(number);
    }
    const note = /\[([^\]]*)\]/.exec(slice(span.from, span.beginTo));
    if (note) heading = proof ? latexText(note[1]) : `${heading} (${latexText(note[1])})`;
    const flow = new Flow(element);
    flow.inline().append(el("span", "doc-theorem-label", `${heading}.`), " ");
    content(span.beginTo, span.endFrom, node.children, flow);
    if (proof) flow.inline().append(el("span", "doc-qed", "∎"));
    flow.end();
    return element;
  }

  function list(node: Node, span: Env) {
    const items = node.children.filter((child) => child.span.type === "item");
    const element = el("div", `doc-list is-${span.name}`);
    if (span.name === "thebibliography") {
      const wrapper = el("div", "doc-bibliography", el("h1", "", t("print.references")));
      wrapper.append(element);
    }
    items.forEach((item, i) => {
      const from = item.span.to;
      const to = items[i + 1]?.span.from ?? span.endFrom;
      const itemSpan = item.span as Extract<Span, { type: "item" }>;
      const body = el("div", "doc-li-body");
      const mark = el("span", "doc-li-mark");
      if (itemSpan.label) {
        const label = itemSpan.label;
        const labelled = inline(label.from, label.to, item.children, el("span"));
        if (span.name === "thebibliography") mark.append("[", ...labelled.childNodes, "]");
        else mark.append(...labelled.childNodes);
      } else if (span.name === "enumerate") mark.append(enumerated(itemSpan.number, itemSpan.level));
      else mark.append(BULLETS[(itemSpan.depth - 1) % BULLETS.length]);
      const flow = new Flow(body);
      content(from, to, node.children, flow);
      flow.end();
      element.append(el("div", span.name === "description" ? "doc-li is-term" : "doc-li", mark, body));
    });
    return span.name === "thebibliography" ? (element.parentElement as HTMLElement) : element;
  }

  const nodes = treeOf(spans);
  const flow = new Flow(doc);
  content(start, end, nodes.filter((node) => node.span.to > start && node.span.from < end), flow);
  flow.end();

  // References show what they refer to, now that every label is known.
  for (const { dom, keys, wrap } of refs) {
    if (keys.length && keys.every((key) => labels.has(key))) dom.textContent = keys.map((key) => wrap(labels.get(key)!)).join(", ");
  }
  if (footnotes.length) {
    const notes = el("ol", "doc-footnotes", ...footnotes);
    notes.setAttribute("aria-label", t("print.footnotes"));
    doc.append(el("hr", "doc-footnotes-rule"), notes);
  }
  return doc;
}
