/*
 * Properties and objects. A Markdown note can start with `key: value` lines between `---` lines
 * (front matter, as in Obsidian, Jekyll and Pandoc):
 *
 *   ---
 *   type: person
 *   fullname: Oleksandr Litus
 *   ---
 *   # Oleks
 *
 * `type` makes the note an object of that type, listed under Types in the sidebar. Any note can be
 * mentioned in another as `@Oleks` (or `@[Two Words]`, or as a wiki link, `[[Two Words]]`), and a
 * property of it as `@Oleks.fullname`.
 */

/** How far down a note its front matter can end. */
const MAX_LINES = 100;

const OPEN = /^---[ \t]*$/;
const CLOSE = /^(?:---|\.\.\.)[ \t]*$/;
/** A `key: value` line, or `key:` with its value on the lines after it. */
const PROPERTY = /^([\p{L}\p{N}_][\p{L}\p{N} _-]*?)[ \t]*:(?:[ \t]+(.*?))?[ \t]*$/u;
/** A line that goes on with the property above it: a YAML list's `- item`, or an indented line. */
const CONTINUED = /^(?:[ \t]*-[ \t]+(.*?)|[ \t]+(\S.*?))[ \t]*$/;
const COMMENT = /^[ \t]*#/;

export interface Property {
  /** The key as written. */
  key: string;
  /** The value as written, quotes taken off; a list's items joined with ", ". */
  value: string;
  /** Which line of the note it's on, from 1. */
  line: number;
  /** The last line it takes: further down for a value that goes on below, like a YAML list. */
  end: number;
}

export interface FrontMatter {
  /** How many lines it takes, its `---` lines included. */
  lines: number;
  properties: Property[];
}

/**
 * The note's front matter, if it has one: a `---` first line, `key: value` lines (YAML lists,
 * indented lines, comments and blank lines are fine too), and a closing `---`. Anything else in
 * between, or no closing line, and the `---` is a divider like any other.
 */
export function frontMatter(text: string): FrontMatter | null {
  let end = text.indexOf("\n");
  if (end < 0 || !OPEN.test(text.slice(0, end))) return null;
  const properties: Property[] = [];
  for (let n = 2; n <= MAX_LINES && end < text.length; n++) {
    const from = end + 1;
    end = text.indexOf("\n", from);
    if (end < 0) end = text.length;
    const line = text.slice(from, end);
    if (CLOSE.test(line)) return { lines: n, properties };
    const property = PROPERTY.exec(line);
    const continued = !property && properties.length ? CONTINUED.exec(line) : null;
    if (property) properties.push({ key: property[1], value: unquote(property[2] ?? ""), line: n, end: n });
    else if (continued) {
      const last = properties[properties.length - 1];
      const item = unquote(continued[1] ?? continued[2]);
      last.value = last.value ? `${last.value}${continued[1] !== undefined ? "," : ""} ${item}` : item;
      last.end = n;
    } else if (line.trim() && !COMMENT.test(line)) return null;
  }
  return null;
}

function unquote(value: string) {
  return /^(["']).*\1$/.test(value) && value.length > 1 ? value.slice(1, -1) : value;
}

/** A key as it's looked up: `Full name`, `full_name` and `fullName` are all `fullname`. */
export const keyOf = (key: string) => key.toLowerCase().replace(/[\s_-]+/g, "");

/** A note's title as a mention finds it: `@oleks_litus` and `@[Oleks Litus]` both find "Oleks Litus". */
export const nameOf = (title: string) => title.toLowerCase().replace(/[\s_-]+/g, " ").trim();

export function propertyOf(properties: Property[], key: string): Property | undefined {
  const wanted = keyOf(key);
  return properties.find((property) => keyOf(property.key) === wanted);
}

/** The note's `type`, as the sidebar groups notes: `Person` and `person` are one type. */
export function typeOf(properties: Property[]): string {
  return propertyOf(properties, "type")?.value.trim().toLowerCase() ?? "";
}

/** How a type reads in the sidebar and the list's title: `person` → `Person`. */
export const typeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

/**
 * A mention: `@Name`, or `@[Any title]` for one with spaces or punctuation, and then optionally
 * a property, `.key`. Not after a letter, digit, `.`, `/` or `\`, so emails, `owner/repo@sha`
 * and `\@` stay text. Or a wiki link, as Obsidian writes them: `[[Any title]]`, with the text it
 * shows after a bar (`[[Ada Lovelace|Ada]]`); a heading after a `#` is read past, and an embed
 * (`![[…]]`) isn't one.
 */
export const MENTION =
  /(?<![\p{L}\p{M}\p{N}_./\\@`])@(?:\[([^\]\n]+)\]|([\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*))(?:\.([\p{L}_][\p{L}\p{M}\p{N}_-]*))?|(?<![!\\])\[\[([^[\]\n|#]*[^\s[\]|#][^[\]\n|#]*)(?:#[^[\]\n|]*)?(?:\|([^[\]\n]+))?\]\]/gu;

export interface Mention {
  /** The note's name, as written. */
  name: string;
  /** The property, if it's `@Name.key`. */
  key?: string;
  /** What a wiki link shows in place of the title, if it says (`[[Name|shown]]`). */
  shown?: string;
}

/** What a mention written as `text` refers to. */
export function readMention(text: string): Mention | null {
  MENTION.lastIndex = 0;
  const match = MENTION.exec(text);
  if (!match || match.index !== 0) return null;
  if (match[4] !== undefined) return { name: match[4].trim(), ...(match[5]?.trim() ? { shown: match[5].trim() } : {}) };
  return { name: match[1] ?? match[2], ...(match[3] ? { key: match[3] } : {}) };
}

/** A wiki link to the note titled `title`, without the characters one can't hold. */
export const wikiLinkOf = (title: string) => `[[${title.replace(/[[\]|#\n]/g, "")}]]`;

/** How to write a mention of the note titled `title`: bare if it's one word, in brackets otherwise. */
export function mentionOf(title: string) {
  return /^[\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*$/u.test(title) ? `@${title}` : `@[${title.replace(/[\]\n]/g, "")}]`;
}

/** A property's key as a mention writes it: `Full name` → `full_name`. */
export const mentionKey = (key: string) => key.trim().replace(/\s+/g, "_");

/**
 * A reference to a type, `@type.recipe`: within text, the type; on a line of its own, a table of
 * its notes. `@type.recipe(time, servings)` picks the table's columns, by key.
 */
const TYPE_REF = /^@type\.([\p{L}\p{N}_][\p{L}\p{N}_-]*)(?:\(([^()\n]*)\))?$/iu;

export interface TypeRef {
  /** The type, as the sidebar has it (lowercase, `_` for spaces read as spaces). */
  type: string;
  /** The columns chosen, by key; null for every property the type's notes have. */
  columns: string[] | null;
}

/** What the type reference written as `text` refers to, if it is one. */
export function readTypeRef(text: string): TypeRef | null {
  const match = TYPE_REF.exec(text);
  if (!match) return null;
  const columns = match[2]?.split(",").map((key) => key.trim()).filter(Boolean);
  return { type: match[1].toLowerCase().replace(/_/g, " "), columns: columns ?? null };
}

/** How to write a reference to `type`, with these columns (null for all). */
export function typeRefOf(type: string, columns: string[] | null) {
  return `@type.${type.replace(/\s+/g, "_")}${columns ? `(${columns.join(", ")})` : ""}`;
}

/**
 * The note with its properties changed: each key set to its value (as written, on the line it was
 * on, keeping how its key was written), or taken out where the value is null. New ones go at the
 * end of the properties, which are made if the note has none.
 */
export function setProperties(body: string, changes: Record<string, string | null>): string {
  const front = frontMatter(body);
  const lines = body.split("\n");
  const added: string[] = [];
  const found = new Map<string, Property>();
  for (const property of front?.properties ?? []) if (!found.has(keyOf(property.key))) found.set(keyOf(property.key), property);
  const edits: { property: Property; value: string | null }[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const property = found.get(keyOf(key));
    if (property) edits.push({ property, value });
    else if (value !== null) added.push(`${key}: ${value}`);
  }
  // From the bottom up, so the lines above keep their numbers.
  for (const { property, value } of edits.sort((a, b) => b.property.line - a.property.line)) {
    lines.splice(property.line - 1, property.end - property.line + 1, ...(value === null ? [] : [`${property.key}: ${value}`]));
  }
  if (!added.length) return lines.join("\n");
  if (!front) return ["---", ...added, "---", ...lines].join("\n");
  const removed = edits.reduce((sum, { property, value }) => sum + (property.end - property.line + 1) - (value === null ? 0 : 1), 0);
  lines.splice(front.lines - 1 - removed, 0, ...added);
  return lines.join("\n");
}
