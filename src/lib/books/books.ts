import { ATTACHMENT_PATH, attachmentName } from "../notes/attachments";
import { escapeMarkdown } from "../notes/escape";

/*
 * Books kept with their notes (docs/library.md#books-you-keep): a PDF or an EPUB attached to a
 * library note, read in the note's place by a reader plugin (`bookReaders`), and the quotes kept
 * from it, each a quote in the note with a link back to where it is:
 *
 *   > It is a truth universally acknowledged…
 *   > — [Page 1](../attachments/3f9c….pdf#page=1)
 *
 * The place after `#` is the reader's own: `page=12` for a PDF, as PDF readers read a link's
 * fragment, and an EPUB CFI for an EPUB, as EPUB readers do.
 */

/** A book kept with a note: its attachment's name, and what the note calls it. */
export interface KeptBook {
  name: string;
  label: string;
}

/** A link to an attached file, on a line of its own. */
const FILE_LINE = /^\[([^\]\n]*)\]\(\.\.\/attachments\/([0-9a-f]{32}\.[a-z0-9]{1,10})\)\s*$/gm;

/** The first file on a line of its own in a note that `reads` says is a book. */
export function bookIn(body: string, reads: (name: string) => boolean): KeptBook | null {
  for (const [, label, name] of body.matchAll(FILE_LINE)) if (reads(name)) return { name, label };
  return null;
}

/** A link to a place in a book kept with a note, `../attachments/….pdf#page=12`: the book's file and the place. */
export function placeLink(href: string): { name: string; at: string } | null {
  const hash = href.indexOf("#");
  if (hash < 0) return null;
  const name = attachmentName(href.slice(0, hash));
  const at = href.slice(hash + 1);
  return name && at ? { name, at } : null;
}

/**
 * A quote kept from a book, as Markdown: the text chosen, each of its paragraphs as one of the
 * quote's, as just that text (escaped), and on its last line a link to where it is, named as its
 * reader names the place; as a highlight from Readwise is written (src/plugins/readwise), with its
 * place where Readwise has its location.
 */
export function quoteMarkdown(text: string, place: { at: string; label: string }, book: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => escapeMarkdown(paragraph))
    .filter(Boolean);
  const label = escapeMarkdown(place.label.replace(/[[\]]/g, ""));
  return `${paragraphs.map((paragraph) => `> ${paragraph}`).join("\n>\n")}\n> — [${label}](${ATTACHMENT_PATH}${book}#${place.at})`;
}

/** The note with a quote added at its end. */
export const withQuote = (body: string, quote: string) => `${body.trimEnd()}\n\n${quote}\n`;

/** How far through its book a note says it is, `progress: 37%`, from 0 to 1; null if it doesn't say. */
export function progressOf(value: string | undefined): number | null {
  const match = /^\s*(\d{1,3}(?:\.\d+)?)\s*%\s*$/.exec(value ?? "");
  return match ? Math.min(1, Number(match[1]) / 100) : null;
}

/** How far through, as a note writes it. */
export const progressValue = (progress: number) => `${Math.floor(Math.min(1, Math.max(0, progress)) * 100)}%`;

/**
 * Where a library item's status goes as it's read, along its kind's own (`to read`, `reading`,
 * `read`): started, the second; at its end, the last. Only forward, and only from those: a status of
 * your own (`abandoned`) stays, and a kind without three has none written.
 */
export function statusFor(status: string | undefined, progress: number, statuses: string[]): string | undefined {
  if (statuses.length < 3) return status;
  const now = statuses.indexOf(status?.trim().toLowerCase() || statuses[0]);
  if (now < 0) return status;
  return statuses[Math.max(now, progress >= 0.99 ? statuses.length - 1 : progress > 0 ? 1 : 0)];
}
