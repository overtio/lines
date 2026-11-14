import { between, type Edit, edited, editsIn, isElsewhere, pathOf, readMarkdown, type Span, within } from "../../lib/imports/markdown";
import { attachmentPath, noteLink, type Tally } from "../../lib/imports/notes";
import { attachmentType } from "../../lib/notes/attachments";
import { cleanTagInput, normalizeTag } from "../../lib/notes/parse";

/*
 * A Bear note in Linedown (docs/importing.md#bear). Bear 2 writes Markdown much as lines does
 * (#tags, #nested/tags, ==highlights==, tasks, tables, math); what's its own becomes lines': tags
 * of several words (`#big ideas#`) written with dashes, `~underline~` as `<u>`, a picture's size (in
 * a comment after it) as its width, links to notes by title or by Bear's id as wiki links, and the
 * files a note shows as lines' attachments. The note is read as lines reads Markdown, so code,
 * math and HTML are left as they are.
 */

/** What a note's translation needs of the notes and files around it. */
export interface Links {
  /** The name of the note a link to `title` leads to, or of the note with Bear's id `id`; null for none. */
  note(by: { title: string } | { id: string }): string | null;
  /** The file a link's path leads to from the note, by its index among those kept; null for none. */
  file(path: string): { index: number; name: string } | null;
  /** What doesn't come across as it was, with where it is. */
  report: Tally;
}

/**
 * What's Bear's own in text: a wiki link; `~underlined~` (but not `~~struck~~`); or a tag closed
 * by a `#`, as Bear writes one of several words (`#big ideas#`, `#work/next steps#`).
 */
const BEAR = /\[\[([^[\]\n]+?)\]\]|(?<![~\\])~([^~\s\\](?:[^~\n]*[^~\s\\])?)~(?!~)|(^|\s|(?<!\])\()#([^\s#](?:[^#\n]*[^\s#\\])?)#(?![\p{L}\p{N}_/-])/gu;
/** What Bear says of how a link or picture is shown, in a comment right after it: `<!-- {"width":320} -->`. */
const SHOWN = /^<!--[ \t]*(\{[^{}\n]*\})[ \t]*-->/;
/** Bear's link to one of its notes: `bear://x-callback-url/open-note?id=…`. */
const NOTE_LINK = /^bear:\/\/x-callback-url\/open-note\?/;
/** A table's header row, followed by its line of dashes. */
const TABLE = /^\s*\|.*\|\s*$/;
const DASHES = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

/** What Bear's comment after a link says of how it's shown, as JSON. */
function shownAs(json: string | undefined): { width?: unknown; preview?: unknown } {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

/** A tag of several words with dashes for its spaces, `#big-ideas`; null where that isn't a tag (`#2024#`). */
function dashed(tag: string) {
  const parts = tag.split("/").map((part) => cleanTagInput(part.trim()).replace(/-{2,}/g, "-").replace(/^-|-$/g, ""));
  const written = parts.filter(Boolean).join("/");
  return normalizeTag(written) ? written : null;
}

/** A link written as `written`, or a wiki link to `wiki`, as lines has it. */
function linked(links: Links, name: string, written: string, parts: { bang?: string; text?: string; address?: string; json?: string; wiki?: string }) {
  if (parts.wiki !== undefined) {
    const [link, shown] = parts.wiki.split("|");
    const whole = links.note({ title: link.trim() });
    if (whole) return noteLink(whole, { shown });
    // Bear's link to a heading: `[[Note/Heading]]`.
    const slash = link.lastIndexOf("/");
    const note = slash > 0 ? links.note({ title: link.slice(0, slash).trim() }) : null;
    return note ? noteLink(note, { heading: link.slice(slash + 1).trim(), shown }) : written;
  }
  const { bang = "", text = "", address = "", json } = parts;
  const shown = shownAs(json);
  if (NOTE_LINK.test(address)) {
    const query = new URLSearchParams(address.slice(address.indexOf("?") + 1));
    const id = query.get("id");
    const title = query.get("title");
    const note = id ? links.note({ id }) : title ? links.note({ title }) : null;
    if (note) return noteLink(note, { heading: query.get("header") ?? undefined, shown: text });
    links.report.add("import.report.missing", `${written} (${name})`);
    return written;
  }
  if (isElsewhere(address)) {
    if (shown.preview) links.report.add("import.report.previews", `${text || address} (${name})`);
    return `${bang}[${text}](${address})`;
  }
  const file = links.file(pathOf(address));
  if (!file) {
    links.report.add("import.report.missing", `${written} (${name})`);
    return written;
  }
  if (bang && attachmentType(file.name).startsWith("image/")) {
    const width = Number(shown.width);
    return `![${text}${width > 0 ? `|${Math.round(width)}` : ""}](${attachmentPath(file.index)})`;
  }
  return `[${text || file.name}](${attachmentPath(file.index)})`;
}

/** A Bear note's text in Linedown. */
export function translate(text: string, links: Links, name: string): string {
  const read = readMarkdown(text);
  const edits: Edit[] = [];
  const taken: Span[] = [...read.kept, ...read.urls];
  for (const link of read.links) {
    const shown = SHOWN.exec(text.slice(link.to));
    const span = { from: link.from, to: link.to + (shown?.[0].length ?? 0) };
    taken.push(span);
    const written = text.slice(span.from, span.to);
    const insert = linked(links, name, written, { bang: link.image ? "!" : "", text: link.text, address: link.address, json: shown?.[1] });
    if (insert !== written) edits.push({ ...span, insert });
  }
  edits.push(
    ...editsIn(text, between(taken, 0, text.length), BEAR, (match) => {
      const [written, wiki, underlined, before, tag] = match;
      if (wiki !== undefined) return linked(links, name, written, { wiki });
      if (underlined !== undefined) return `<u>${underlined}</u>`;
      const tagged = dashed(tag);
      if (!tagged) return written;
      if (/\s/.test(tag)) links.report.add("import.report.spacedTags", `${written.trim()} → #${tagged} (${name})`);
      return `${before}#${tagged}`;
    }),
  );
  // A table right under a line of text, as Bear writes one, gets a blank line between them, which Markdown needs.
  const lines = text.split("\n");
  for (let i = 1, at = lines[0].length + 1; i < lines.length; at += lines[i].length + 1, i++) {
    if (TABLE.test(lines[i]) && DASHES.test(lines[i + 1] ?? "") && lines[i - 1].trim() && !TABLE.test(lines[i - 1]) && !within({ from: at, to: at + 1 }, read.kept)) {
      edits.push({ from: at, to: at, insert: "\n" });
    }
  }
  return edited(text, edits);
}
