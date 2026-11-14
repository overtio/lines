import { ATTACHMENT_PATH } from "../notes/attachments";
import { escapeMarkdown, propertyValue } from "../notes/escape";
import { cleanTagInput, normalizeTag } from "../notes/parse";
import { mentionOf } from "../notes/properties";
import type { LibraryItem } from "../plugins/types";

/*
 * A library note's text, written the same way however it was added (docs/library.md): its type and
 * properties, its title as its heading, its cover, and a few sentences of what it's about.
 *
 *   ---
 *   type: movie
 *   director: Denis Villeneuve
 *   year: 2024
 *   link: https://www.imdb.com/title/tt15239678/
 *   status: to watch
 *   ---
 *   # Dune: Part Two
 *
 *   ![Dune: Part Two|240](../attachments/3f9c….jpg)
 *
 *   Paul Atreides unites with Chani and the Fremen…
 *
 * And how sources write the values they find, so every note reads alike.
 */

/** About as long as what it's about runs, give or take a sentence. */
const SUMMARY = 600;

/** One line of plain text: HTML's tags out, spaces collapsed. */
const oneLine = (text: string) => text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Where a sentence ends in `text`, before `max`: after its stop and the space that follows. */
function sentenceEnd(text: string, max: number) {
  let end = -1;
  for (const match of text.slice(0, max + 1).matchAll(/[.!?…]["”’)]?(?=\s|$)/g)) end = match.index + match[0].length;
  return end;
}

/**
 * What something's about, short, as plain text: its first paragraphs, as many as fit in about
 * SUMMARY characters, a long one cut at a sentence, and one the source cut off (ending "…") back to
 * its last sentence.
 */
export function summary(text: string): string[] {
  const paragraphs = text
    .replace(/<\/p>|<br\s*\/?>/gi, "\n\n")
    .split(/\n\s*\n/)
    .map(oneLine)
    // Not one that's only dots, as a page with nothing to say may say.
    .filter((paragraph) => /[\p{L}\p{N}]/u.test(paragraph));
  const kept: string[] = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    if (length && length + paragraph.length > SUMMARY) break;
    let shown = paragraph;
    if (shown.length > SUMMARY || /(?:\.\.\.|…)$/.test(shown)) {
      const end = sentenceEnd(shown.replace(/(?:\.\.\.|…)$/, ""), SUMMARY);
      if (end > 0) shown = shown.slice(0, end);
      else if (shown.length > SUMMARY) shown = `${shown.slice(0, SUMMARY).replace(/\s+\S*$/, "")}…`;
    }
    kept.push(shown);
    length += shown.length;
    if (shown !== paragraph) break;
  }
  return kept;
}

/** How a library note is written, besides what's found: where it starts, its cover, and which properties name another note. */
export interface NoteOptions {
  /** Its `status`, where its kind starts. */
  status?: string;
  /** Its cover, an attachment's name, and how wide the note shows it. */
  cover?: { name: string; width: number };
  /** The keys whose values are another note's title (an episode's podcast), written as a mention of it. */
  mentions?: string[];
}

/**
 * The note's text for `item`: its properties (type first, then its own, the link and where it's
 * got to, `status`), its title as its heading, its cover, its summary and its tags. What came from
 * elsewhere reads as just that text (escape.ts): no tag, mention, link or picture is made of it.
 */
export function libraryNoteText(item: LibraryItem, { status, cover, mentions = [] }: NoteOptions = {}): string {
  const properties: [string, string][] = [["type", item.type], ...item.properties];
  if (item.link) properties.push(["link", item.link]);
  if (status) properties.push(["status", status]);
  const front = properties.flatMap(([key, value]) => {
    const text = oneLine(value);
    return text ? [`${key}: ${mentions.includes(key) ? mentionOf(text) : propertyValue(text)}`] : [];
  });
  const title = oneLine(item.title);
  const parts = [`---\n${front.join("\n")}\n---\n# ${escapeMarkdown(title)}`];
  if (cover) parts.push(coverLine(title, cover));
  if (item.description) parts.push(...summary(item.description).map(escapeMarkdown));
  if (item.tags?.length) parts.push(item.tags.map((tag) => `#${tag}`).join(" "));
  return parts.join("\n\n") + "\n";
}

/** A cover as a library note shows it, under its title. */
const coverLine = (title: string, { name, width }: { name: string; width: number }) => `![${escapeMarkdown(title.replace(/[[\]|]/g, ""))}|${width}](${ATTACHMENT_PATH}${name})`;

/** A library note's text with a cover put where it shows one, under its title (its first heading), for a note made without one. */
export function withCover(body: string, title: string, cover: { name: string; width: number }): string {
  const front = /^---\n[\s\S]*?\n---(?:\n|$)/.exec(body)?.[0].length ?? 0;
  const heading = /^#[ \t].*$/m.exec(body.slice(front));
  const at = front + (heading ? heading.index + heading[0].length : 0);
  const head = body.slice(0, at).replace(/\n+$/, "");
  const rest = body.slice(at).replace(/^\n+/, "");
  return `${head}${head && "\n\n"}${coverLine(title, cover)}\n${rest && `\n${rest}`}`;
}

/** The picture a library note shows first, its cover: an attachment's name, or null. */
export function coverOf(body: string): string | null {
  return /!\[[^\]\n]*\]\(\.\.\/attachments\/([0-9a-f]{32}\.[a-z0-9]+)(?:\|\d+)?\)/.exec(body)?.[1] ?? null;
}

/** How wide a note shows its cover, by its kind's shape: enough to know it by, leaving room for the rest. */
export const COVER_WIDTH = { tall: 240, square: 240, wide: 400 };

/** A cover as lines puts it in a library note: an attachment right under its title, as wide as it makes covers. */
const LIBRARY_COVER = new RegExp(`\\n# [^\\n]*\\n\\n!\\[[^\\]\\n]*\\|(?:${[...new Set(Object.values(COVER_WIDTH))].join("|")})\\]\\(\\.\\.\\/attachments\\/([0-9a-f]{32}\\.[a-z0-9]+)\\)(?:\\n|$)`);

/** The cover lines put in a library note, if it has one; not a picture put somewhere by hand. */
export const libraryCoverOf = (body: string): string | null => LIBRARY_COVER.exec(body)?.[1] ?? null;

/** `body` without its cover `name` (the paragraph that's only it), or with `to`, another attachment's name, in its place. */
export function replaceCover(body: string, name: string, to?: string): string {
  const line = new RegExp(`(\\n*)(!\\[[^\\]\\n]*\\]\\(\\.\\.\\/attachments\\/)${name.replace(/\./g, "\\.")}(\\)|\\|\\d+\\))`);
  return body.replace(line, (_, before: string, start: string, end: string) => (to ? `${before}${start}${to}${end}` : ""));
}

/**
 * The link a note is, if that's all it is: one http(s) address, bare, in `<…>`, or as a Markdown
 * link (`[text](…)`, as pasting can make it), with nothing else but space around it.
 */
export function linkOnly(text: string): string | null {
  const trimmed = text.trim();
  const match = /^(?:<(https?:\/\/[^\s<>]+)>|\[[^\]\n]*\]\((https?:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)\)|(https?:\/\/\S+))$/i.exec(trimmed);
  const link = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

/** A link written in a note: `<…>`, `[text](…)` or bare. */
const LINK = /<https?:\/\/[^\s<>]+>|\[[^\]\n]*\]\(https?:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*\)|https?:\/\/[^\s<>]+/gi;

/**
 * The link a note is, if that's all it is (`linkOnly`); or, for a note made just now, its start left
 * as it was made (`template`: `# `, or its properties too, made on a shelf) with only a link put in it.
 */
export function linkNoteLink(text: string, template?: string): string | null {
  const whole = linkOnly(text);
  if (whole || !template) return whole;
  const found = [...text.matchAll(LINK)];
  if (found.length !== 1) return null;
  const [{ 0: link, index }] = found;
  const rest = text.slice(0, index) + text.slice(index + link.length);
  return rest.trimEnd() === template.trimEnd() ? linkOnly(link) : null;
}

/* How sources write what they find. */

/** A date's day, as written (`2009-10-24` of `2009-10-24T23:57:33-07:00`); undefined for anything else. */
export function dayOf(date: unknown): string | undefined {
  return typeof date === "string" ? /^\+?(\d{4}-\d{2}-\d{2})/.exec(date.trim())?.[1] : undefined;
}

/** A date's year, from a date (`1987-11-12`), a year, or words with a year in them (`September 1, 1990`). */
export function yearOf(date: unknown): string | undefined {
  if (typeof date === "number") return date > 0 ? String(date) : undefined;
  return typeof date === "string" ? /\b(\d{4})\b/.exec(date)?.[1] : undefined;
}

/** Seconds in an ISO 8601 duration (`PT2H46M`, `P0DT3M34S`), or undefined for anything else. */
export function isoSeconds(duration: unknown): number | undefined {
  if (typeof duration !== "string") return undefined;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(duration.trim());
  if (!match) return undefined;
  const [days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  return Math.round(days * 86400 + hours * 3600 + minutes * 60 + seconds) || undefined;
}

/** How long a video, song or episode is, as a player shows it: `3:34`, `1:02:13`. */
export function clock(seconds: number | undefined): string | undefined {
  if (!seconds || seconds < 1) return undefined;
  const s = Math.round(seconds);
  const [h, m, rest] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(rest)}` : `${m}:${pad(rest)}`;
}

/** How long a movie runs: `166 min`. */
export const runtime = (seconds: number | undefined) => (seconds && seconds >= 60 ? `${Math.round(seconds / 60)} min` : undefined);

/** Names as a property lists them: `Ada Lovelace, Charles Babbage`, each once. */
export const names = (list: (string | undefined)[]) => [...new Set(list.map((name) => name?.trim()).filter(Boolean))].join(", ") || undefined;

/**
 * A tag another app files something under (a bookmark's, a highlight's), or a path of them (a
 * bookmark's folders, `Dev / Rust` as `dev/rust`), as lines writes tags: `Web Browsers` as
 * `web-browsers`. Null where nothing of it can be one (a tag of only digits).
 */
export function libraryTag(names: string[]): string | null {
  const parts = names.map((name) => cleanTagInput(name.replace(/[/#]/g, " ")).replace(/-{2,}/g, "-").replace(/^-|-$/g, "")).filter(Boolean);
  return parts.length ? normalizeTag(parts.join("/")) : null;
}

/** An item's properties, in order, leaving out those with nothing found. */
export const known = (properties: [string, string | number | undefined][]): [string, string][] =>
  properties.flatMap(([key, value]) => (value === undefined || value === "" ? [] : [[key, String(value)] as [string, string]]));
