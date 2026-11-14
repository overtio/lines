import type { TextBlock, TextSpan } from "../plugins/types";
import { address, BLOCK_ELEMENTS, parseHtml, SKIPPED } from "./html";

/*
 * A comment's HTML as text lines draws itself (Discussion.svelte), for the sites whose comments a
 * plugin reads: read where nothing in it runs or loads (html.ts) and walked, keeping paragraphs,
 * quotes, code, links to the web, emphasis and line breaks, and the words of everything else.
 * Nothing of the HTML itself is kept.
 */

/** Left out with all that's in them: what html.ts leaves out, and pictures and players, which a comment's text doesn't show. */
const LEFT_OUT = new Set([...SKIPPED, "img", "picture", "iframe", "video", "audio"]);
/** Elements that end the paragraph before them and start one of their own. */
const BREAKS = new Set([...BLOCK_ELEMENTS, "dt", "dd", "tr"]);

type Marks = Omit<TextSpan, "text">;

const sameMarks = (span: TextSpan, marks: Marks) =>
  span.href === marks.href && !!span.emphasis === !!marks.emphasis && !!span.strong === !!marks.strong && !!span.code === !!marks.code;

class Reader {
  blocks: TextBlock[] = [];
  #spans: TextSpan[] = [];
  #kind: TextBlock["kind"] = "paragraph";

  constructor(private base?: string) {}

  /** Ends the paragraph being read, if it has any words. */
  flush() {
    const spans = this.#spans;
    this.#spans = [];
    // HTML's spaces around a paragraph aren't the comment's.
    const [first, last] = [spans[0], spans.at(-1)];
    if (first) first.text = first.text.trimStart();
    if (last) last.text = last.text.trimEnd();
    const kept = spans.filter((span) => span.text);
    if (kept.length) this.blocks.push({ kind: this.#kind, spans: kept });
  }

  #add(text: string, marks: Marks) {
    if (!text) return;
    const last = this.#spans.at(-1);
    // Words beside each other in the same marks are one span.
    if (last && sameMarks(last, marks)) last.text += text;
    else this.#spans.push({ text, ...marks });
  }

  #children(node: Node, marks: Marks) {
    for (const child of node.childNodes) this.read(child, marks);
  }

  read(node: Node, marks: Marks = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      // HTML's whitespace as the page shows it: one space between words, and none at a line's start.
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      const before = this.#spans.at(-1)?.text;
      return this.#add(before && !/\s$/.test(before) ? text : text.trimStart(), marks);
    }
    if (!(node instanceof Element)) return;
    const name = node.localName;
    if (LEFT_OUT.has(name)) return;
    if (name === "br") return this.#add("\n", marks);
    if (name === "pre") {
      this.flush();
      const code = (node.textContent ?? "").replace(/\n$/, "");
      if (code.trim()) this.blocks.push({ kind: "code", spans: [{ text: code }] });
      return;
    }
    if (name === "blockquote") {
      this.flush();
      const kind = this.#kind;
      this.#kind = "quote";
      this.#children(node, marks);
      this.flush();
      this.#kind = kind;
      return;
    }
    if (name === "ol" || name === "ul") {
      this.flush();
      // Counted as they come, from where the list says it starts.
      let number = Number(node.getAttribute("start")) || 1;
      for (const item of node.children) {
        if (item.localName !== "li") continue;
        this.#add(name === "ol" ? `${number++}. ` : "• ", marks);
        this.#children(item, marks);
        this.flush();
      }
      return;
    }
    if (BREAKS.has(name)) {
      this.flush();
      this.#children(node, marks);
      this.flush();
      return;
    }
    const inner: Marks = { ...marks };
    if (name === "a") inner.href = address(node.getAttribute("href"), this.base) ?? marks.href;
    else if (name === "i" || name === "em" || name === "cite") inner.emphasis = true;
    else if (name === "b" || name === "strong") inner.strong = true;
    else if (name === "code" || name === "kbd" || name === "samp" || name === "tt") inner.code = true;
    this.#children(node, inner);
  }
}

/** A comment's HTML as paragraphs, quotes and code; relative links are read from `base`. */
export function htmlToText(html: string, base?: string): TextBlock[] {
  const reader = new Reader(base);
  reader.read(parseHtml(html));
  reader.flush();
  return reader.blocks;
}
