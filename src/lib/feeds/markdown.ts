import { fenceFor } from "../editor/codeFence";
import { escapeMarkdown } from "../notes/escape";

/*
 * A feed's HTML as Markdown, for reading a post as a note is drawn: the page is read into a document
 * of its own (DOMParser's, where nothing runs or loads) and walked, keeping paragraphs, headings,
 * links, emphasis, lists, quotes, code, pictures and simple tables, and dropping everything else.
 * No HTML is ever put into the page as it came, and nothing in a post is ever more than text there:
 * its words are escaped (notes/escape.ts), its code has no language (so nothing draws or runs it),
 * and its links go only to the web or to mail.
 */

/** Links and pictures only to the web (and mail, for links): no `file:`, `javascript:` or `data:`. */
const SAFE_LINK = /^(?:https?:|mailto:)/i;
const SAFE_IMAGE = /^https?:/i;

/** What's left out, with everything in it. */
const SKIPPED = new Set(["script", "style", "noscript", "template", "head", "title", "meta", "link", "svg", "math", "form", "button", "input", "select", "textarea", "object", "embed", "canvas", "map"]);
/** Blocks whose inline content is a paragraph of its own. */
const BLOCKS = new Set(["p", "div", "section", "article", "header", "footer", "main", "aside", "nav", "figure", "address", "details", "summary", "center", "hgroup", "body"]);
/** Every element that makes a block, those above and those with Markdown of their own. */
const BLOCK_ELEMENTS = new Set([...BLOCKS, "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "hr", "table", "figcaption", "dl", "iframe", "video", "audio"]);

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html").body;

/** The plain text of some HTML, its spaces collapsed: for excerpts and titles. */
export function plainText(html: string): string {
  if (!/[<&]/.test(html)) return html.replace(/\s+/g, " ").trim();
  const body = parse(html);
  for (const skipped of body.querySelectorAll([...SKIPPED].join(","))) skipped.remove();
  // Blocks and line breaks part words, as they do on the page.
  for (const element of body.querySelectorAll("br, p, div, li, h1, h2, h3, h4, h5, h6, blockquote, tr, td, th")) element.append(" ");
  return (body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** HTML as Markdown, its relative links and pictures read from `base`. */
export function htmlToMarkdown(html: string, base?: string): string {
  return new Writer(base).blocks(parse(html)).join("\n\n").trim();
}

/** A text node's words, escaped as a line of text is (notes/escape.ts), with a space kept at either end that had one: it parts them from what's beside them. */
function escapeText(text: string): string {
  const words = escapeMarkdown(text);
  if (!words) return /\s/.test(text) ? " " : "";
  return `${/^\s/.test(text) ? " " : ""}${words}${/\s$/.test(text) ? " " : ""}`;
}

/** What a line under another can make of both, which a line alone can't: a table's row, a heading's underline. */
const escapeUnder = (line: string) => line.replace(/^(\||[=-]+\s*$)/, "\\$1");

/** HTML's whitespace as the page shows it: one space. */
const collapse = (text: string) => text.replace(/\s+/g, " ");

class Writer {
  constructor(private base?: string) {}

  /** A URL as the page wrote it, made whole, if it's one that's kept. */
  #url(value: string | null | undefined, safe: RegExp): string | null {
    if (!value?.trim()) return null;
    try {
      const url = new URL(value.trim(), this.base).href;
      return safe.test(url) ? url : null;
    } catch {
      return null;
    }
  }

  /**
   * The Markdown of a node within a line: its text escaped, or an element's inline Markdown. A block
   * found within a line (a page's `<i><pre>…</pre></i>`) is only its words there: block Markdown in
   * the middle of a paragraph would break out of it.
   */
  #within(node: Node): string {
    if (!(node instanceof Element)) return node.nodeType === Node.TEXT_NODE ? escapeText(node.textContent ?? "") : "";
    const name = node.localName;
    if (SKIPPED.has(name)) return "";
    if (name === "pre") return ` ${inlineCode(collapse(node.textContent ?? "").trim())} `;
    // An embedded player is a link, which a line can hold.
    if (name === "iframe" || name === "video" || name === "audio") return this.block(node)!.join(" ");
    return BLOCK_ELEMENTS.has(name) ? ` ${this.line(node)} ` : this.inline(node);
  }

  /** The Markdown blocks of an element's children, in order, its loose text and inline elements making paragraphs. */
  blocks(parent: Element): string[] {
    const out: string[] = [];
    let inline = "";
    const flush = () => {
      const text = inline.replace(/ *\n */g, "\n").replace(/ +/g, " ").trim();
      if (text) out.push(text.split("\n").map(escapeUnder).join("\n"));
      inline = "";
    };
    for (const node of parent.childNodes) {
      if (node instanceof Element && BLOCK_ELEMENTS.has(node.localName)) {
        flush();
        out.push(...this.block(node)!);
      } else inline += this.#within(node);
    }
    flush();
    return out;
  }

  /** An element's Markdown blocks, if it's a block; null if it's inline. */
  block(element: Element): string[] | null {
    const name = element.localName;
    if (SKIPPED.has(name)) return [];
    if (BLOCKS.has(name) || name === "li") return this.blocks(element);
    const heading = /^h([1-6])$/.exec(name);
    if (heading) {
      // The post's title is the note's heading: its own go under it.
      const text = this.line(element);
      return text ? [`${"#".repeat(Math.max(2, Number(heading[1])))} ${text}`] : [];
    }
    switch (name) {
      case "ul":
      case "ol": {
        const list = this.list(element);
        return list ? [list] : [];
      }
      case "blockquote": {
        const inner = this.blocks(element).join("\n\n");
        return inner ? [inner.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n")] : [];
      }
      case "pre": {
        // Without its language: a post's code is shown, never drawn or run (a diagram, a request).
        const code = (element.textContent ?? "").replace(/\n$/, "");
        const fence = fenceFor(code);
        return code.trim() ? [`${fence}\n${code}\n${fence}`] : [];
      }
      case "hr":
        return ["---"];
      case "table":
        return this.table(element);
      case "figcaption": {
        const text = this.line(element);
        return text ? [`*${text}*`] : [];
      }
      case "dl":
        return [...element.children].flatMap((item) => {
          const text = this.line(item);
          return text ? [item.localName === "dt" ? `**${text}**` : text] : [];
        });
      case "iframe":
      case "video":
      case "audio": {
        // An embedded player is a link to what it plays.
        const src = this.#url(element.getAttribute("src") ?? element.querySelector("source")?.getAttribute("src"), SAFE_IMAGE);
        if (!src) return [];
        const label = element.getAttribute("title")?.trim() || new URL(src).hostname;
        return [`[${escapeText(label)}](${destination(src)})`];
      }
      default:
        return null;
    }
  }

  /** An element's content on one line: a heading's, a table cell's. */
  line(element: Element): string {
    return [...element.childNodes].map((node) => this.#within(node)).join("").replace(/\s+/g, " ").trim();
  }

  /** An inline element as Markdown: emphasis, links, code, pictures; any other, its content. */
  inline(element: Element): string {
    const content = () => [...element.childNodes].map((node) => this.#within(node)).join("");
    switch (element.localName) {
      case "br":
        return "\n";
      case "strong":
      case "b":
        return wrap(content(), "**");
      case "em":
      case "i":
      case "cite":
        return wrap(content(), "*");
      case "del":
      case "s":
      case "strike":
        return wrap(content(), "~~");
      case "code":
      case "kbd":
      case "samp":
      case "tt":
        return inlineCode(collapse(element.textContent ?? ""));
      case "img": {
        const src = this.#url(element.getAttribute("src"), SAFE_IMAGE);
        // Tracking pixels aren't pictures.
        if (!src || element.getAttribute("width") === "1" || element.getAttribute("height") === "1") return "";
        const alt = collapse(element.getAttribute("alt") ?? "").replace(/[[\]\\]/g, "\\$&").trim();
        return `![${alt}](${destination(src)})`;
      }
      case "a": {
        const text = content().trim();
        const href = this.#url(element.getAttribute("href"), SAFE_LINK);
        return href && text ? `[${text}](${destination(href)})` : text;
      }
      default:
        return content();
    }
  }

  /** A list, the lists in its items nested under them. */
  list(element: Element): string {
    const ordered = element.localName === "ol";
    let number = Number(element.getAttribute("start")) || 1;
    const items: string[] = [];
    for (const item of element.children) {
      if (item.localName !== "li") continue;
      const marker = ordered ? `${number++}. ` : "- ";
      const nested = [...item.children].some((child) => child.localName === "ul" || child.localName === "ol");
      const text = (nested ? this.#tight(item) : this.blocks(item).join("\n\n")).replace(/\n(?=.)/g, `\n${" ".repeat(marker.length)}`);
      if (text) items.push(marker + text);
    }
    return items.join("\n");
  }

  /** A list item with a list in it: its own text, then the list right under it. */
  #tight(item: Element): string {
    const out: string[] = [];
    let inline = "";
    const flush = () => {
      if (inline.trim()) out.push(inline.replace(/\s+/g, " ").trim());
      inline = "";
    };
    for (const node of item.childNodes) {
      if (node instanceof Element && (node.localName === "ul" || node.localName === "ol")) {
        flush();
        out.push(this.list(node));
      } else inline += this.#within(node);
    }
    flush();
    return out.join("\n");
  }

  /** A table of plain cells, as a Markdown table; one with cells across others, as its rows' text. */
  table(element: Element): string[] {
    const rows = [...element.querySelectorAll("tr")].filter((row) => row.closest("table") === element);
    // A cell's `|` would end it, and a leading `=` make it a formula.
    const text = (cell: Element) => this.line(cell).replace(/\|/g, "\\|").replace(/^=/, "\\=");
    const cells = rows.map((row) => [...row.children].filter((cell) => cell.localName === "td" || cell.localName === "th").map(text));
    const width = Math.max(0, ...cells.map((row) => row.length));
    if (!width) return [];
    if (width === 1 || element.querySelector("[colspan], [rowspan]")) return cells.map((row) => row.filter(Boolean).join(" · ")).filter(Boolean);
    const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
    return [[line(cells[0]), `|${" --- |".repeat(width)}`, ...cells.slice(1).map(line)].join("\n")];
  }
}

/** Text in a mark on each side, its spaces left outside, as Markdown needs. */
function wrap(text: string, mark: string) {
  const inner = text.trim();
  if (!inner) return text;
  const before = text.slice(0, text.length - text.trimStart().length);
  const after = text.slice(text.trimEnd().length);
  return `${before}${mark}${inner}${mark}${after}`;
}

/** Code within a line, between backticks enough that none in it ends it. */
function inlineCode(code: string) {
  if (!code.trim()) return code;
  const fence = "`".repeat(Math.max(1, ...[...code.matchAll(/`+/g)].map((run) => run[0].length + 1)));
  const pad = code.startsWith("`") || code.endsWith("`") ? " " : "";
  return `${fence}${pad}${code}${pad}${fence}`;
}

/** A link's destination, in angle brackets where it has spaces or brackets in it. */
const destination = (url: string) => (/[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url);
