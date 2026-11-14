import { linedownParser } from "../editor/syntax";

/*
 * Markdown from another app, read as lines reads Markdown (its own parser, editor/syntax.ts), so an
 * import changes it only where it's text: never in code (fenced, indented, inline), math, HTML or a
 * comment, wherever those are, in lists and quotes too.
 */

/** A part of a text, from `from` up to `to`. */
export interface Span {
  from: number;
  to: number;
}

/** A Markdown link or picture with an address, `[text](address)`. */
export interface MarkdownLink extends Span {
  image: boolean;
  text: string;
  /** Its address as written, without `<…>`. */
  address: string;
}

/** A change to a text: what goes from `from` up to `to`. */
export interface Edit extends Span {
  insert: string;
}

/** What lines reads in a text: where it's left as it is, and its links. */
export interface Read {
  /** Code, math, HTML and comments, which an import leaves as they are. */
  kept: Span[];
  /** Code and HTML blocks, which a comment from another app can't run across. */
  blocks: Span[];
  /** Its Markdown links and pictures. */
  links: MarkdownLink[];
  /** The languages of its code blocks. */
  languages: string[];
}

const KEPT = new Set(["InlineCode", "InlineMath", "Comment", "HTMLTag", "Autolink", "URL"]);
const BLOCKS = new Set(["FencedCode", "CodeBlock", "HTMLBlock", "CommentBlock", "MathBlock", "ProcessingInstructionBlock"]);

export function readMarkdown(text: string): Read {
  const read: Read = { kept: [], blocks: [], links: [], languages: [] };
  linedownParser.parse(text).iterate({
    enter(node) {
      if (BLOCKS.has(node.name)) {
        read.kept.push({ from: node.from, to: node.to });
        read.blocks.push({ from: node.from, to: node.to });
        if (node.name === "FencedCode") read.languages.push(/^[ \t]*[`~]+[ \t]*([^`\s]*)/.exec(text.slice(node.from, node.to))?.[1] ?? "");
        return false;
      }
      if (KEPT.has(node.name)) {
        read.kept.push({ from: node.from, to: node.to });
        return false;
      }
      if (node.name !== "Link" && node.name !== "Image") return;
      // Only one with an address: `[text]` alone, or `![[…]]`, is text to an import.
      const url = node.node.getChild("URL");
      const marks = node.node.getChildren("LinkMark");
      if (!url || marks.length < 2) return;
      read.links.push({
        from: node.from,
        to: node.to,
        image: node.name === "Image",
        text: text.slice(marks[0].to, marks[1].from),
        address: text.slice(url.from, url.to).replace(/^<|>$/g, ""),
      });
      return false;
    },
  });
  return read;
}

/** The parts of `from`…`to` that aren't in any of `taken`, in order. */
export function between(taken: Span[], from: number, to: number): Span[] {
  const parts: Span[] = [];
  let at = from;
  for (const span of [...taken].sort((a, b) => a.from - b.from)) {
    if (span.to <= at || span.from >= to) continue;
    if (span.from > at) parts.push({ from: at, to: span.from });
    at = Math.max(at, span.to);
  }
  if (at < to) parts.push({ from: at, to });
  return parts;
}

/** Whether `span` overlaps any of `spans`. */
export const within = (span: Span, spans: Span[]) => spans.some((each) => each.from < span.to && span.from < each.to);

/** Edits matching `pattern` (global) in each of `parts` of `text`, each as `replace` makes it; those it leaves alone left out. */
export function editsIn(text: string, parts: Span[], pattern: RegExp, replace: (match: RegExpExecArray) => string): Edit[] {
  const edits: Edit[] = [];
  for (const { from, to } of parts) {
    const part = text.slice(from, to);
    pattern.lastIndex = 0;
    for (let match = pattern.exec(part); match; match = pattern.exec(part)) {
      const insert = replace(match);
      if (insert !== match[0]) edits.push({ from: from + match.index, to: from + match.index + match[0].length, insert });
      if (!match[0]) pattern.lastIndex++;
    }
  }
  return edits;
}

/** `text` with `edits` made, which don't overlap. */
export function edited(text: string, edits: Edit[]) {
  let out = "";
  let at = 0;
  for (const edit of [...edits].sort((a, b) => a.from - b.from)) {
    out += text.slice(at, edit.from) + edit.insert;
    at = edit.to;
  }
  return out + text.slice(at);
}

/** Whether a link's address leads elsewhere than a file beside the note: a web page, mail, an app, or a place in the note. */
export const isElsewhere = (address: string) => /^[a-z][a-z0-9+.-]*:/i.test(address) || address.startsWith("#");

/** A link's address as the path it names, each part of it decoded (`%20`, `%26`). */
export const pathOf = (address: string) =>
  address
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join("/");

/** A path with `.` and `..` taken as they lead: `a/./b/../c` → `a/c`. */
export function normalized(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

export const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));
export const baseOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
