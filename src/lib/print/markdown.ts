import { markdownLanguage } from "@codemirror/lang-markdown";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownParser } from "@lezer/markdown";
import { t } from "../i18n/index.svelte";
import { CALLOUTS, calloutOf } from "../editor/cards";
import { shortLink } from "../editor/shortLinks";
import { valueText } from "../editor/objects";
import { Card, Highlight, Mention, Tag, TexMath, Underline } from "../editor/syntax";
import { tableData } from "../editor/typeTables";
import { fenceLanguage, renderedInfo } from "../editor/rendered";
import { isUnsplashPhoto } from "../editor/unsplash";
import { attachmentName, imageSize, mediaLink } from "../notes/attachments";
import { frontMatter, readTypeRef, typeLabel } from "../notes/properties";
import { isFormula } from "../sheets/cells";
import { withSymbols } from "../notes/symbols";
import { plugins } from "../plugins/registry.svelte";
import type { MarkdownAddition, MarkdownPrint, MarkdownPrinter } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { el, type Parts } from "./parts";

/*
 * A Markdown note as a printed document: the same Linedown the editor reads (docs/linedown.md),
 * drawn as it reads with nothing to edit. Each line of a paragraph stays a line, as on screen.
 * Tags and mentions read as text; type tables are drawn as their tables; front matter becomes a
 * short list of properties at the top. What plugins add to Markdown prints as they say.
 */

const linedown = (markdownLanguage.parser as MarkdownParser).configure([Tag, Highlight, Underline, Card, TexMath, Mention]);

let withPlugins: { additions: MarkdownAddition[]; parser: MarkdownParser; printers: Map<string, MarkdownPrinter> } | undefined;

/** The parser and printers with what plugins add to Markdown, made again when that changes. */
function additions() {
  const added = plugins.markdown;
  if (withPlugins?.additions !== added) {
    withPlugins = {
      additions: added,
      parser: linedown.configure(added.flatMap((addition) => addition.syntax ?? [])),
      printers: new Map(added.flatMap((addition) => Object.entries(addition.print ?? {}))),
    };
  }
  return withPlugins;
}

/** Marks that are only syntax: `**`, `` ` ``, `#`, `>`… */
const MARKS = new Set([
  "EmphasisMark", "CodeMark", "LinkMark", "HeaderMark", "QuoteMark", "ListMark", "HighlightMark", "StrikethroughMark",
  "UnderlineMark", "MathMark", "TaskMarker", "CardMark", "SubscriptMark", "SuperscriptMark", "TagMark", "LinkTitle", "LinkLabel",
  "Comment", "ProcessingInstruction",
]);

const INLINE_TAGS: Record<string, keyof HTMLElementTagNameMap> = {
  Emphasis: "em",
  StrongEmphasis: "strong",
  Strikethrough: "s",
  Highlight: "mark",
  Underline: "u",
  Subscript: "sub",
  Superscript: "sup",
};

export function markdownDocument(body: string, parts: Parts): HTMLElement {
  const doc = el("div", "doc doc-markdown");
  const front = frontMatter(body);
  let text = body;
  if (front) {
    text = body.split("\n").slice(front.lines).join("\n");
    if (front.properties.length) {
      const list = el("dl", "doc-properties");
      for (const { key, value } of front.properties) list.append(el("dt", "", key), el("dd", "", valueText(value)));
      doc.append(list);
    }
  }
  const { parser, printers } = additions();
  const tree = parser.parse(text);
  const slice = (from: number, to: number) => text.slice(from, to);

  const print: MarkdownPrint = {
    slice,
    inline: (node, into) => inline(node, into),
    blocks: (node, into) => {
      for (let child = node.firstChild; child; child = child.nextSibling) block(child, into);
    },
    parts,
  };

  /** Prints a node a plugin added, if it's one. */
  function printed(node: SyntaxNode, into: Node) {
    const printer = printers.get(node.name);
    if (!printer) return false;
    const out = printer(node, print);
    if (out) into.appendChild(out);
    return true;
  }

  /**
   * Text, each line of it a line; the indentation that continues a paragraph is left out. Its
   * `->` shows as → (notes/symbols.ts) as the editor shows it, except in HTML (`symbols` false).
   */
  function plain(value: string, into: Node, symbols = prefs.symbolsInText) {
    value.split("\n").forEach((line, i) => {
      if (i > 0) into.appendChild(el("br"));
      const shown = i > 0 ? line.replace(/^[ \t]+/, "") : line;
      if (shown) into.appendChild(document.createTextNode(symbols ? withSymbols(shown) : shown));
    });
  }

  function inline(node: SyntaxNode, into: Node, from = node.from, to = node.to) {
    let pos = from;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.to <= from || child.from >= to) continue;
      if (child.from > pos) plain(slice(pos, child.from), into);
      inlineNode(child, into);
      pos = Math.max(pos, child.to);
    }
    if (pos < to) plain(slice(pos, to), into);
  }

  /** What's between a node's first and last marks: a code span's code, a link's text. */
  function inside(node: SyntaxNode, mark: string) {
    const marks = node.getChildren(mark);
    return { from: marks[0]?.to ?? node.from, to: marks.length > 1 ? marks[1].from : node.to };
  }

  function link(href: string, label: Node | string) {
    const a = el("a", "doc-link", label);
    if (/^(https?:|mailto:)/i.test(href)) a.href = href;
    return a;
  }

  function inlineNode(node: SyntaxNode, into: Node) {
    const { name } = node;
    if (printed(node, into) || MARKS.has(name)) return;
    if (INLINE_TAGS[name]) {
      const element = el(INLINE_TAGS[name]);
      inline(node, element);
      return void into.appendChild(element);
    }
    switch (name) {
      case "InlineCode": {
        const { from, to } = inside(node, "CodeMark");
        const code = slice(from, to);
        return void into.appendChild(el("code", "doc-inline-code", prefs.symbolsInCode ? withSymbols(code) : code));
      }
      case "InlineMath": {
        const { from, to } = inside(node, "MathMark");
        const display = slice(node.from, node.from + 2) === "$$";
        return void into.appendChild(parts.math(slice(from, to), display));
      }
      case "Link": {
        const url = node.getChild("URL");
        const href = url ? slice(url.from, url.to) : "";
        const marks = node.getChildren("LinkMark");
        const label = el("span");
        inline(node, label, marks[0]?.to ?? node.from, marks[1]?.from ?? node.to);
        // A video's width (`[Sky.mp4|400]`) is how it's shown in the note.
        if (mediaLink(href) === "video") label.textContent = imageSize(label.textContent ?? "").alt;
        if (attachmentName(href)) return void into.appendChild(el("span", "doc-file", parts.icon("paperclip", 13), label));
        return void into.appendChild(link(href, label));
      }
      case "Autolink":
      case "URL": {
        const url = name === "URL" ? node : node.getChild("URL");
        const href = url ? slice(url.from, url.to) : slice(node.from, node.to);
        return void into.appendChild(link(/^www\./i.test(href) ? `https://${href}` : href, shortLink(href)?.text ?? href));
      }
      case "Image": {
        const url = node.getChild("URL");
        const marks = node.getChildren("LinkMark");
        const alt = slice(marks[0]?.to ?? node.from, marks[1]?.from ?? node.from);
        return void into.appendChild(parts.image(url ? slice(url.from, url.to) : "", alt));
      }
      case "Tag":
        return void into.appendChild(el("span", "doc-tag", slice(node.from, node.to)));
      case "Mention":
        return void into.appendChild(el("span", "doc-mention", valueText(slice(node.from, node.to))));
      case "Escape":
        return plain(slice(node.from + 1, node.to), into);
      case "Entity": {
        const decoder = el("textarea");
        decoder.innerHTML = slice(node.from, node.to);
        return plain(decoder.value, into);
      }
      case "HardBreak":
        return void into.appendChild(el("br"));
      case "HTMLTag":
        if (/^<br\s*\/?>$/i.test(slice(node.from, node.to))) into.appendChild(el("br"));
        return;
      default:
        inline(node, into);
    }
  }

  /** The one thing a paragraph holds, if it holds nothing else: an image, a file a plugin shows, or a type table's line. */
  function lone(node: SyntaxNode): HTMLElement | null {
    const written = slice(node.from, node.to).trim();
    const ref = readTypeRef(written);
    if (ref) return typeTable(ref);
    const only = node.firstChild;
    if (!only || only.nextSibling || only.from !== node.from || only.to !== node.to) return null;
    if (only.name === "Image") {
      const figure = el("div", "doc-figure");
      inlineNode(only, figure);
      return figure;
    }
    const url = only.name === "Link" ? only.getChild("URL") : null;
    const name = url && attachmentName(slice(url.from, url.to));
    const viewer = name && plugins.fileView(name);
    if (name && viewer) {
      const marks = only.getChildren("LinkMark");
      return parts.viewedFile(viewer, name, slice(marks[0]?.to ?? only.from, marks[1]?.from ?? only.from).replace(/\\(.)/g, "$1"));
    }
    if (only.name === "URL" && isUnsplashPhoto(written)) return el("div", "doc-figure", parts.image(written, ""));
    return null;
  }

  function typeTable(ref: NonNullable<ReturnType<typeof readTypeRef>>) {
    const data = tableData(ref);
    const head = el("tr", "", el("th", "", typeLabel(data.type)), ...data.columns.map((column) => el("th", "", column.label)));
    const rows = data.rows.map((row) => el("tr", "", el("td", "", row.title), ...row.cells.map((cell) => el("td", "", cell))));
    return el("div", "doc-table", el("table", "", el("thead", "", head), el("tbody", "", ...rows)));
  }

  function table(node: SyntaxNode) {
    const delimiter = node.getChild("TableDelimiter");
    const aligns = delimiter
      ? slice(delimiter.from, delimiter.to)
          .replace(/^\s*\||\|\s*$/g, "")
          .split("|")
          .map((cell) => {
            const spec = cell.trim();
            return spec.startsWith(":") && spec.endsWith(":") ? "center" : spec.endsWith(":") ? "right" : spec.startsWith(":") ? "left" : "";
          })
      : [];
    // Each cell as written, for its formulas: a formula as it is, other cells as they read.
    const cells: string[][] = [];
    const elements: HTMLElement[][] = [];
    const row = (rowNode: SyntaxNode, cellTag: "th" | "td") => {
      const tr = el("tr");
      cells.push([]);
      elements.push([]);
      rowNode.getChildren("TableCell").forEach((cell, i) => {
        const td = el(cellTag);
        if (aligns[i]) td.style.textAlign = aligns[i];
        inline(cell, td);
        const written = slice(cell.from, cell.to).trim();
        cells[cells.length - 1].push(isFormula(written) ? written.replaceAll("\\|", "|") : (td.textContent ?? "").trim());
        elements[elements.length - 1].push(td);
        tr.append(td);
      });
      return tr;
    };
    const header = node.getChild("TableHeader");
    const head = header ? [row(header, "th")] : [];
    const body = node.getChildren("TableRow").map((r) => row(r, "td"));
    parts.formulas(cells, elements);
    return el("div", "doc-table", el("table", "", el("thead", "", ...head), el("tbody", "", ...body)));
  }

  function listItem(node: SyntaxNode) {
    const li = el("li");
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "ListMark") continue;
      if (child.name === "Task") {
        const marker = child.getChild("TaskMarker");
        const done = !!marker && /x/i.test(slice(marker.from, marker.to));
        li.classList.add("doc-task");
        li.classList.toggle("is-done", done);
        const box = el("span", "doc-box");
        box.setAttribute("role", "img");
        box.setAttribute("aria-label", done ? t("print.done") : t("print.notDone"));
        const content = el("p");
        content.append(box);
        inline(child, content, marker?.to ?? child.from);
        li.append(content);
      } else block(child, li);
    }
    return li;
  }

  function block(node: SyntaxNode, into: HTMLElement) {
    const { name } = node;
    if (printed(node, into)) return;
    const heading = /^(?:ATXHeading(\d)|SetextHeading(\d))$/.exec(name);
    if (heading) {
      const h = el(`h${Number(heading[1] ?? heading[2])}` as "h1");
      inline(node, h);
      // The space after `#`.
      const first = h.firstChild;
      if (first?.nodeType === Node.TEXT_NODE) first.textContent = first.textContent!.trimStart();
      return void into.append(h);
    }
    switch (name) {
      case "Paragraph": {
        const special = lone(node);
        if (special) return void into.append(special);
        const p = el("p");
        inline(node, p);
        return void into.append(p);
      }
      case "BulletList":
      case "OrderedList": {
        const list = el(name === "BulletList" ? "ul" : "ol");
        const first = node.firstChild?.getChild("ListMark");
        const start = first ? parseInt(slice(first.from, first.to), 10) : 1;
        if (list instanceof HTMLOListElement && start !== 1) list.start = start;
        for (const item of node.getChildren("ListItem")) list.append(listItem(item));
        if ([...list.children].some((li) => li.classList.contains("doc-task"))) list.classList.add("doc-tasks");
        return void into.append(list);
      }
      case "Blockquote": {
        const quote = el("blockquote");
        for (let child = node.firstChild; child; child = child.nextSibling) block(child, quote);
        return void into.append(quote);
      }
      case "FencedCode": {
        const info = node.getChild("CodeInfo");
        const written = info ? slice(info.from, info.to) : "";
        const language = fenceLanguage(written);
        const code = node.getChild("CodeText");
        const source = code ? slice(code.from, code.to) : "";
        const rendered = renderedInfo(written);
        if (rendered) return void into.append(parts.rendered(rendered.renderer, source, rendered.width, body));
        if (language === "math") return void into.append(parts.math(source, true));
        return void into.append(parts.code(source, language, prefs.symbolsInCode));
      }
      case "CodeBlock": {
        const source = slice(node.from, node.to).replace(/^(?: {4}|\t)/gm, "");
        return void into.append(parts.code(source, "", prefs.symbolsInCode));
      }
      case "MathBlock": {
        const marks = node.getChildren("MathMark");
        const tex = slice(marks[0]?.to ?? node.from, marks.length > 1 ? marks[marks.length - 1].from : node.to);
        return void into.append(parts.math(tex, true));
      }
      case "HorizontalRule":
        return void into.append(el("hr"));
      case "Table":
        return void into.append(table(node));
      case "Card": {
        const fence = slice(node.from, text.indexOf("\n", node.from) < 0 ? text.length : text.indexOf("\n", node.from));
        const callout = calloutOf(fence);
        const card = el("div", callout ? `doc-card doc-callout is-${callout.kind}` : "doc-card");
        const content = el("div", "doc-card-content");
        for (let child = node.firstChild; child; child = child.nextSibling) block(child, content);
        if (callout?.icon) card.append(parts.icon(callout.icon, 16));
        if (callout) card.setAttribute("aria-label", CALLOUTS[callout.kind].label);
        card.append(content);
        return void into.append(card);
      }
      case "HTMLBlock": {
        const p = el("p");
        plain(slice(node.from, node.to), p, false);
        return void into.append(p);
      }
      default:
      // Link references, comments and marks print nothing.
    }
  }

  const top = tree.topNode;
  for (let child = top.firstChild; child; child = child.nextSibling) block(child, doc);
  markLists(doc);
  return doc;
}

/** Bullets by depth, as browsers draw them. */
const BULLETS = ["•", "◦", "▪"];

/**
 * Each list item's bullet or number as text of its own, rather than the browser's marker, which
 * a page drawn as an image (images.ts) would lose. Screen readers still hear a list.
 */
function markLists(doc: HTMLElement) {
  for (const li of doc.querySelectorAll<HTMLLIElement>("ul > li:not(.doc-task), ol > li:not(.doc-task)")) {
    const list = li.parentElement!;
    let depth = 0;
    for (let up = list.parentElement; up && up !== doc; up = up.parentElement) if (up.matches("ul, ol")) depth++;
    const text = list instanceof HTMLOListElement ? `${list.start + [...list.children].indexOf(li)}.` : BULLETS[depth % BULLETS.length];
    const mark = el("span", "doc-mark", text);
    mark.setAttribute("aria-hidden", "true");
    li.prepend(mark);
  }
}
