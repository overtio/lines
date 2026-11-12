import { frontMatter, nameOf, propertyOf, typeOf } from "./properties";
import { plainLine } from "./stats";
import { TAG_CHAR, TAG_NAME } from "./tags";
import type { NoteMeta } from "./types";

/**
 * A tag starts a line, follows a space, or follows "(" (but not a link's "](", which is a URL); not
 * at the start of a heading's text, where it's `##` being typed (editor/syntax.ts).
 */
const TAG_RE = new RegExp(`(^|\\s|(?<!\\])\\()(?<!^[ \\t]{0,3}#{1,6}[ \\t]+)#(${TAG_NAME})`, "gmu");
/** A code block, indented or not. One that's never closed runs to the end, as in Markdown. */
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})[\s\S]*?(?:^[ \t]*\1|(?![\s\S]))/gm;
/** Inline code: from a run of backticks to the next run as long (``a `b` c``), on one line. */
const INLINE_CODE_RE = /(`+)[^\n]*?(?<!`)\1(?!`)/g;
/** An HTML comment, which Markdown apps don't show. */
const COMMENT_RE = /<!--[\s\S]*?-->/g;
/**
 * Lines indented as code (four spaces, or a tab) after a blank line or at the start, and the
 * indented lines after them, blank lines between.
 */
const INDENTED_RE = /(?:^|\n[ \t]*\n)((?: {4}|\t)[^\n]*(?:\n(?:[ \t]*\n)*(?: {4}|\t)[^\n]*)*)/g;
/** A line in a list, or going on with one: indented, or a list item's. */
const IN_LIST_RE = /^(?:\s|[-*+](?:\s|$)|\d+[.)](?:\s|$))/;
const OPEN_TODO_RE = /^\s*[-*+] \[ \]/m;

/**
 * A tag as it's kept, in lowercase and composed (NFC), so one typed with combining marks is the
 * same tag; null for a name that can't be one (`123`, `two words`, `a#b`).
 */
export function normalizeTag(raw: string): string | null {
  // İ lowercases to i and a combining dot, which i has already.
  const tag = raw.replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase().normalize("NFC").replaceAll("i\u0307", "i");
  if (!tag || /^\d+$/.test(tag) || ![...tag].every((char) => TAG_CHAR.test(char))) return null;
  return tag;
}

/** A tag's name as it's typed: spaces become dashes, and characters a tag can't hold go (but `#`). */
export const cleanTagInput = (text: string) => text.replace(/\s+/g, "-").replace(/[^#]/gu, (char) => (TAG_CHAR.test(char) ? char : ""));

export function extractTags(body: string): string[] {
  // Tags in code or a comment don't count.
  const code = codeRanges(body);
  const tags = new Set<string>();
  for (const match of body.matchAll(TAG_RE)) {
    const start = match.index + match[1].length;
    if (code.some(([from, to]) => start >= from && start < to)) continue;
    const tag = normalizeTag(match[2]);
    if (tag) tags.add(tag);
  }
  return [...tags].sort();
}

/** A line of nothing but tags, where another tag can go: `#work #ideas`, or after a `comment` mark (`% #work`). */
const tagLine = (comment: string) =>
  new RegExp(`^${comment ? `${comment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*` : ""}(?:#${TAG_NAME}[ \\t]*)+$`, "u");

/**
 * Adds `#tag` to a note's text, unless it has it (among `tags`, where its language reads them): after
 * the tags on its last line if that's a line of tags, else on a line of its own at the end. In a
 * language whose tags go in a comment, which it then ignores (`% #work` in LaTeX), `comment` is what
 * starts one.
 */
export function addTagIn(body: string, tag: string, comment = "", tags = extractTags(body)): string {
  if (tags.includes(tag)) return body;
  const text = body.replace(/\s+$/, "");
  const end = body.slice(text.length);
  const last = text.slice(text.lastIndexOf("\n") + 1);
  if (text && tagLine(comment).test(last)) return `${text.replace(/[ \t]+$/, "")} #${tag}${end}`;
  return `${text}${text ? "\n\n" : ""}${comment ? `${comment} ` : ""}#${tag}${end}`;
}

/**
 * Renames `from` (and tags nested under it) to `to` wherever it appears as a tag in `body`,
 * skipping code just like extractTags does.
 */
export function renameTagIn(body: string, from: string, to: string): string {
  const code = codeRanges(body);
  let out = "";
  let last = 0;
  for (const match of body.matchAll(TAG_RE)) {
    const start = match.index + match[1].length + 1;
    const raw = match[2];
    if (code.some(([a, b]) => start >= a && start < b)) continue;
    const tag = normalizeTag(raw);
    if (!tag || (tag !== from && !tag.startsWith(from + "/"))) continue;
    // Keep how the rest was written (#Work/Meetings → #job/Meetings) unless it's irregular (#a//b),
    // part by part, as a part can be longer or shorter in lowercase (İ).
    const parts = raw.split("/");
    const rest = parts.slice(0, -1).includes("") ? tag.slice(from.length) : parts.slice(from.split("/").length).map((part) => `/${part}`).join("");
    out += body.slice(last, start) + to + rest;
    last = start + raw.length;
  }
  return last ? out + body.slice(last) : body;
}

/**
 * Where `body`'s code (inline, fenced and indented) and HTML comments are, where tags and type
 * references aren't read. Most notes have none, and looking for them is most of the work.
 */
function codeRanges(body: string): [number, number][] {
  const code: [number, number][] = [];
  const add = (re: RegExp) => {
    for (const m of body.matchAll(re)) code.push([m.index, m.index + m[0].length]);
  };
  if (body.includes("```") || body.includes("~~~")) add(FENCE_RE);
  if (body.includes("`")) add(INLINE_CODE_RE);
  if (body.includes("<!--")) add(COMMENT_RE);
  if (body.includes("    ") || body.includes("\t")) code.push(...indentedCode(body));
  return code;
}

/** Indented code: indented lines after a blank line, but not after a list, where the indent is its items'. */
function indentedCode(body: string): [number, number][] {
  const code: [number, number][] = [];
  for (const m of body.matchAll(INDENTED_RE)) {
    // The text above it, past the blank lines.
    let end = m.index;
    while (end > 0 && /\s/.test(body[end - 1])) end--;
    const above = body.slice(body.lastIndexOf("\n", end - 1) + 1, end);
    if (!end || !IN_LIST_RE.test(above)) code.push([m.index + m[0].length - m[1].length, m.index + m[0].length]);
  }
  return code;
}

/** A reference to a type, `@type.recipe` (properties.ts); its columns, if any, follow the name. */
const TYPE_REF_RE = /(?<![\p{L}\p{N}_./\\@`])@type\.([\p{L}\p{N}_][\p{L}\p{N}_-]*)/giu;

/**
 * Renames the type `from` to `to` in `body`: its `type` property, if it's of that type, as `to` is
 * written, and every `@type.…` of it outside code, in lowercase, keeping their columns.
 */
export function renameTypeIn(body: string, from: string, to: string): string {
  const target = nameOf(from);
  const front = frontMatter(body);
  const property = front && propertyOf(front.properties, "type");
  if (property && nameOf(property.value) === target) {
    const lines = body.split("\n");
    const line = lines[property.line - 1];
    // A value written over several lines (a YAML list) is replaced whole.
    lines.splice(property.line - 1, property.end - property.line + 1, `${line.slice(0, line.indexOf(":") + 1)} ${to}`);
    body = lines.join("\n");
  }
  const code = codeRanges(body);
  return body.replace(TYPE_REF_RE, (written, name: string, offset: number) =>
    nameOf(name) !== target || code.some(([a, b]) => offset >= a && offset < b) ? written : `@type.${to.toLowerCase().replace(/\s+/g, "_")}`,
  );
}

/** A line as it reads in the note list: no Markdown, card fences dropped, table cells spaced. */
function plain(line: string): string {
  return /^\s*:{3,}/.test(line) ? "" : plainLine(line).replace(/\s+/g, " ").trim();
}

/** What the list, sidebar and search know of a Markdown note. */
export function computeMeta(body: string): NoteMeta {
  const lines = body.split("\n");
  // The title is the first line after the note's properties, or failing that its `title` or `name`.
  const front = frontMatter(body);
  const properties = front?.properties ?? [];
  let title = "";
  let i = front?.lines ?? 0;
  for (; i < lines.length; i++) {
    title = plain(lines[i]);
    if (title) break;
  }
  if (!title) title = plain(propertyOf(properties, "title")?.value ?? propertyOf(properties, "name")?.value ?? "");
  const rest: string[] = [];
  let inFence = false;
  for (i++; i < lines.length && rest.join(" ").length < 200; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    const text = plain(lines[i]);
    // Skip dividers and the |---|---| line under a table's header.
    if (text && !/^[-*_]{3,}$/.test(text) && !/^[\s|:-]+$/.test(text)) rest.push(text);
  }
  return {
    title,
    excerpt: rest.join(" ").slice(0, 200),
    tags: extractTags(body),
    hasOpenTodos: OPEN_TODO_RE.test(body),
    searchText: body.toLowerCase(),
    properties,
    type: typeOf(properties),
  };
}
