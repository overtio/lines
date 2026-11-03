import { frontMatter, nameOf, propertyOf, typeOf } from "./properties";
import { plainLine } from "./stats";
import type { NoteMeta } from "./types";

/** Characters allowed inside a #tag. Nested tags use `/`, e.g. `#work/meetings`. */
export const TAG_CHAR = /[\p{L}\p{N}_\-/]/u;

/** A tag starts a line, follows a space, or follows "(" (but not a link's "](", which is a URL). */
const TAG_RE = /(^|\s|(?<!\])\()#([\p{L}\p{N}_\-/]+)/gu;
/** A code block, indented or not. One that's never closed runs to the end, as in Markdown. */
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})[\s\S]*?(?:^[ \t]*\1|(?![\s\S]))/gm;
const INLINE_CODE_RE = /`[^`\n]*`/g;
const OPEN_TODO_RE = /^\s*[-*+] \[ \]/m;

export function normalizeTag(raw: string): string | null {
  const tag = raw.replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!tag || /^\d+$/.test(tag)) return null;
  return tag;
}

export function extractTags(body: string): string[] {
  const text = body.replace(FENCE_RE, "").replace(INLINE_CODE_RE, "");
  const tags = new Set<string>();
  for (const match of text.matchAll(TAG_RE)) {
    const tag = normalizeTag(match[2]);
    if (tag) tags.add(tag);
  }
  return [...tags].sort();
}

/** A line of nothing but tags, where another tag can go: `#work #ideas`, or after a `comment` mark (`% #work`). */
const tagLine = (comment: string) =>
  new RegExp(`^${comment ? `${comment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*` : ""}(?:#[\\p{L}\\p{N}_\\-/]+[ \\t]*)+$`, "u");

/**
 * Adds `#tag` to a note's text, unless it has it: after the tags on its last line if that's a line
 * of tags, else on a line of its own at the end. In a language whose tags go in a comment, which it
 * then ignores (`% #work` in LaTeX), `comment` is what starts one.
 */
export function addTagIn(body: string, tag: string, comment = ""): string {
  if (extractTags(body).includes(tag)) return body;
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
    // Keep how the rest was written (#Work/Meetings → #job/Meetings) unless it's irregular (#a//b).
    const rest = raw.toLowerCase().startsWith(from) ? raw.slice(from.length) : tag.slice(from.length);
    out += body.slice(last, start) + to + rest;
    last = start + raw.length;
  }
  return last ? out + body.slice(last) : body;
}

/** Where `body`'s code is, inline and in blocks, where tags and type references aren't read. */
function codeRanges(body: string): [number, number][] {
  const code: [number, number][] = [];
  for (const re of [FENCE_RE, INLINE_CODE_RE]) {
    for (const m of body.matchAll(re)) code.push([m.index, m.index + m[0].length]);
  }
  return code;
}

/** A reference to a type, `@type.recipe` (properties.ts); its columns, if any, follow the name. */
const TYPE_REF_RE = /(?<![\p{L}\p{N}_.\/\\@`])@type\.([\p{L}\p{N}_][\p{L}\p{N}_-]*)/giu;

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
    lines[property.line - 1] = `${line.slice(0, line.indexOf(":") + 1)} ${to}`;
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
