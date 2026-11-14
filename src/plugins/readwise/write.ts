import { t } from "../../lib/i18n/index.svelte";
import { clock } from "../../lib/library/text";
import { escapeMarkdown, escapeMarkdownText } from "../../lib/notes/escape";
import type { Highlight, Source } from "./sources";

/*
 * What a note brought from Readwise has after what the library writes of it (its properties, title,
 * cover, summary and tags): what the person wrote about it, and its highlights, each a quote with
 * where it is and when it was made, its tags, and the person's note on it under it.
 *
 *   ## Highlights
 *
 *   > Call me Ishmael.
 *   > — Location 12 · 2024-03-01 #openings
 *
 *   The best first line there is.
 *
 * All of it came from elsewhere, so it reads as just that text (escape.ts), but for the tags.
 */

/** The heading highlights are under: in English, as property keys are, so importing again in another language finds it. */
export const HIGHLIGHTS = "## Highlights";

/** A web address as a Markdown link's, its parentheses kept from ending it. */
const href = (url: string) => url.replace(/\(/g, "%28").replace(/\)/g, "%29");

/** The site an address is on, or the address. */
function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function whereOf({ kind, at }: NonNullable<Highlight["where"]>) {
  if (kind === "time") return clock(at) ?? "";
  return escapeMarkdown(kind === "page" ? t("readwise.page", { page: String(at) }) : t("readwise.location", { location: String(at) }));
}

/** Where a highlight is and when it was made, linked to its own page if it has one, then its tags. */
function aboutOf(highlight: Highlight) {
  const parts = [highlight.where && whereOf(highlight.where), highlight.day].filter((part): part is string => !!part);
  if (highlight.url) {
    const label = parts.shift() ?? escapeMarkdown(hostOf(highlight.url));
    parts.unshift(`[${label}](${href(highlight.url)})`);
  }
  return [parts.join(" · "), ...highlight.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" ");
}

/** A quote's lines as written, without the `> ` before each: its paragraphs, an empty line between. */
const quoteLines = (text: string) => escapeMarkdownText(text).flatMap((paragraph, i) => [...(i ? [""] : []), ...paragraph.split("\n")]);

/** A highlight as a note shows it: a quote, where it is under it, and the person's note after. */
export function highlightText(highlight: Highlight): string {
  const quote = quoteLines(highlight.text).map((line) => (line ? `> ${line}` : ">"));
  const about = aboutOf(highlight);
  if (about) quote.push(`> — ${about}`);
  return [quote.join("\n"), ...escapeMarkdownText(highlight.note ?? "")].join("\n\n");
}

/** What follows the library's part of a new note for `source`: the person's note on it, then its highlights. */
export function moreOf(source: Source): string {
  const parts = escapeMarkdownText(source.note ?? "");
  if (source.highlights.length) parts.push(HIGHLIGHTS, ...source.highlights.map(highlightText));
  return parts.join("\n\n");
}

/** Text as a quote is compared: without line breaks, runs of spaces or case. */
const flat = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
/** A quote's lines as compared: but the line saying where it is (`— …`). */
const keyOf = (lines: string[]) => flat(lines.filter((line) => !line.startsWith("— ")).join(" "));
/** How long a quote has to be to be found within other text too (one reflowed, or written around). */
const LONG = 60;

/**
 * The quotes a note has, as they're compared, so a highlight is found there however it's been laid
 * out since: each quote as written, and for a long one, anywhere in the note's text.
 */
export function quotesOf(body: string) {
  const quotes = new Set<string>();
  let lines: string[] = [];
  const end = () => {
    if (lines.length) quotes.add(keyOf(lines));
    lines = [];
  };
  for (const line of body.split("\n")) {
    const quoted = /^ {0,3}> ?(.*)$/.exec(line);
    if (quoted) lines.push(quoted[1]);
    else end();
  }
  end();
  const text = flat(body.replace(/^ {0,3}> ?/gm, ""));
  return {
    /** Whether the note has `highlight`; if not, it's taken as having it from now on, so it's added once. */
    take(highlight: Highlight) {
      const key = keyOf(quoteLines(highlight.text));
      if (quotes.has(key) || (key.length >= LONG && text.includes(key))) return false;
      quotes.add(key);
      return true;
    },
  };
}

/** Whether a note has highlights' heading already. */
export const hasHighlights = (body: string) => body.split("\n").some((line) => line.trim() === HIGHLIGHTS);
