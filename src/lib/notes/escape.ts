import { TAG_CHAR } from "./tags";

/*
 * Text from elsewhere (a page's title, a catalog's description, a feed's post) written into a note
 * so it reads as just that text: nothing in it becomes a tag, a mention, a link, a picture, a heading
 * or code. It's escaped with Markdown's backslashes, which lines shows as other Markdown apps do (the
 * character alone, livePreview.ts) and reads past (stats.ts, properties.ts).
 */

/** A `#` that would start a tag: at the start, after a space or "(", before a tag's character. */
const TAG_START = new RegExp(`(^|[\\s(])#(?=${TAG_CHAR.source})`, "gu");
/** An `@` that would start a mention (properties.ts's MENTION): not after a letter, digit, `.`, `/` or `\`. */
const MENTION_START = /(^|[^\p{L}\p{M}\p{N}_./\\@`])@(?=[\p{L}\p{N}_[])/gu;
/** What starts a block at a line's start: a heading, a quote, a list, a card, a divider. */
const LINE_START = /^(#{1,6}(?=\s|$)|>|[-+](?=\s|$)|:::|---)/;
const NUMBERED = /^(\d+)([.)])(?=\s|$)/;

/** Text with no `#` in it read as a tag: `\#`. */
export const escapeTags = (text: string) => text.replace(TAG_START, "$1\\#");

/**
 * One line of plain text as Markdown that reads as exactly that text (a title, a paragraph): what
 * Markdown or lines would read as more than text (emphasis, code, links and pictures, wiki links,
 * highlights, math, HTML, tags, mentions, a block's mark at its start) escaped with a backslash,
 * never taken out. Line breaks become spaces.
 */
export function escapeMarkdown(text: string): string {
  const escaped = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*~<$[]/g, "\\$&")
    .replace(/==/g, "\\=\\=")
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, "\\_")
    .replace(MENTION_START, "$1\\@");
  return escapeTags(escaped).replace(LINE_START, "\\$1").replace(NUMBERED, "$1\\$2");
}

/**
 * Plain text of several lines as Markdown that reads as exactly that text (a quote, a note on it):
 * its paragraphs, each its lines as `escapeMarkdown` keeps a line, and escaped too what only lines
 * together make: a table's bars, and a heading's underline (`=`, `--`) under a line of text.
 */
export function escapeMarkdownText(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => escapeMarkdown(line).replace(/\|/g, "\\|").replace(/^(?=[=-]+$)/, "\\"))
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);
}

/** A value YAML would read as something else, or not at all: starting with its syntax, with `: ` or ` #` in it, or a word it reads as true, false or nothing. */
const YAML_MISREADS = /^[-?:,[\]{}#&*!|>'"%@`]|: |\s#|:$|^(?:true|false|yes|no|on|off|null|~)$/i;

/**
 * A property's value as front matter writes it: on one line, without a tag or mention made of it in
 * lines (`\#`, `\@`), and in single quotes where YAML (Obsidian's, Jekyll's, Pandoc's) would read it
 * as something else. properties.ts reads it back as it was.
 */
export function propertyValue(value: string): string {
  const text = escapeTags(value.replace(/\s+/g, " ").trim()).replace(MENTION_START, "$1\\@");
  return YAML_MISREADS.test(text) ? `'${text.replace(/'/g, "''")}'` : text;
}

/** Markdown's backslash escapes (`\#`, `\*`) as the characters they keep. */
export const unescapeMarkdown = (text: string) => text.replace(/\\([!-/:-@[-`{-~])/g, "$1");
