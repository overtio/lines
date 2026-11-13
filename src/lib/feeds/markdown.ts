/*
 * A feed's HTML as Markdown, for reading a post as a note is drawn: the page is read into a document
 * of its own (DOMParser's, where nothing runs or loads) and walked, keeping paragraphs, headings,
 * links, emphasis, lists, quotes, code, pictures and simple tables, and dropping everything else.
 * No HTML is ever put into the page as it came.
 */

/** Links and pictures only to the web (and mail, for links): no `javascript:`, no `data:`. */
const SAFE_LINK = /^(?:https?:|mailto:)/i;
const SAFE_IMAGE = /^https?:/i;

/** What's left out, with everything in it. */
const SKIPPED = new Set(["script", "style", "noscript", "template", "head", "title", "meta", "link", "svg", "math", "form", "button", "input", "select", "textarea", "object", "embed", "canvas", "map"]);
/** Blocks whose inline content is a paragraph of its own. */
const BLOCKS = new Set(["p", "div", "section", "article", "header", "footer", "main", "aside", "nav", "figure", "address", "details", "summary", "center", "hgroup", "body"]);

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

/** Text that would read as Markdown, or as lines' own syntax (tags, mentions, math, highlights), escaped to stay text. */
export function escapeText(text: string): string {
  return (
    text
      .replace(/[\\`*[\]<]/g, "\\$&")
      // `_` only where it could start or end emphasis, not within a word (snake_case).
      .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, "\\_")
      .replace(/~~/g, "\\~\\~")
      .replace(/==/g, "=\\=")
      // A tag has more than digits (#2 isn't one).
      .replace(/(^|[\s(])#(?=[\p{L}\p{M}\p{N}_/-]*[\p{L}\p{M}_/-])/gu, "$1\\#")
      .replace(/(^|[^\p{L}\p{M}\p{N}_./\\@`])@(?=[[\p{L}\p{N}_])/gu, "$1\\@")
      // Not a price: lines doesn't read "$5" as math anyway.
      .replace(/\$(?![\d\s])/g, "\\$")
  );
}

/** A line's first characters that would make it a heading, list item, quote or rule, escaped. */
const escapeLineStart = (line: string) =>
  line.replace(/^(\s*)(#{1,6}(?=\s|$)|[-+>](?=\s|$)|=+\s*$|-+\s*$)/, "$1\\$2").replace(/^(\s*\d+)([.)])(?=\s|$)/, "$1\\$2");

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

  /** The Markdown of a node within a line: its text escaped, or an element's inline Markdown (a block's, on the line). */
  #within(node: Node): string {
    if (node instanceof Element) return this.block(node)?.join(" ") ?? this.inline(node);
    return node.nodeType === Node.TEXT_NODE ? escapeText(collapse(node.textContent ?? "")) : "";
  }

  /** The Markdown blocks of an element's children, in order, its loose text and inline elements making paragraphs. */
  blocks(parent: Element): string[] {
    const out: string[] = [];
    let inline = "";
    const flush = () => {
      const text = inline.replace(/ *\n */g, "\n").replace(/ +/g, " ").trim();
      if (text) out.push(text.split("\n").map(escapeLineStart).join("\n"));
      inline = "";
    };
    for (const node of parent.childNodes) {
      const block = node instanceof Element ? this.block(node) : null;
      if (block === null) inline += this.#within(node);
      else {
        flush();
        out.push(...block);
      }
    }
    flush();
    return out;
  }

  /** An element's Markdown blocks, if it's a block; null if it's inline. */
  block(element: Element): string[] | null {
    const name = element.localName;
    if (SKIPPED.has(name)) return [];
    if (BLOCKS.has(name)) return this.blocks(element);
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
      case "pre":
        return [this.code(element)];
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

  /** A block of code, fenced, in its language where the page says. */
  code(element: Element): string {
    const text = (element.textContent ?? "").replace(/\n$/, "");
    const classes = `${element.className} ${element.querySelector("code")?.className ?? ""}`;
    const language = /(?:^|\s)(?:language|lang)-([\w+#-]+)/.exec(classes)?.[1] ?? "";
    return `${fenceFor(text, 3)}${language}\n${text}\n${fenceFor(text, 3)}`;
  }

  /** A table of plain cells, as a Markdown table; one with cells across others, as its rows' text. */
  table(element: Element): string[] {
    const rows = [...element.querySelectorAll("tr")].filter((row) => row.closest("table") === element);
    const cells = rows.map((row) => [...row.children].filter((cell) => cell.localName === "td" || cell.localName === "th").map((cell) => this.line(cell).replace(/\|/g, "\\|")));
    const width = Math.max(0, ...cells.map((row) => row.length));
    if (!width) return [];
    if (width === 1 || element.querySelector("[colspan], [rowspan]")) return cells.map((row) => row.filter(Boolean).join(" · ")).filter(Boolean);
    const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
    return [[line(cells[0]), `|${" --- |".repeat(width)}`, ...cells.slice(1).map(line)].join("\n")];
  }
}

/** Text in a mark on each side, its spaces left outside, as Markdown needs. */
function wrap(text: string, mark: string) {
  const [, before, inner, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  return inner ? `${before}${mark}${inner}${mark}${after}` : text;
}

/** Backticks enough to fence `text`: more than the longest run in it, and at least `least`. */
const fenceFor = (text: string, least: number) => "`".repeat(Math.max(least, ...[...text.matchAll(/`+/g)].map((run) => run[0].length + 1)));

function inlineCode(code: string) {
  if (!code.trim()) return code;
  const pad = code.startsWith("`") || code.endsWith("`") ? " " : "";
  return `${fenceFor(code, 1)}${pad}${code}${pad}${fenceFor(code, 1)}`;
}

/** A link's destination, in angle brackets where it has spaces or brackets in it. */
const destination = (url: string) => (/[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url);
