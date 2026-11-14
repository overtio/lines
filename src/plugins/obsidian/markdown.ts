import { between, type Edit, edited, editsIn, isElsewhere, pathOf, readMarkdown, type Span, within } from "../../lib/imports/markdown";
import { attachmentPath, noteLink, type Tally } from "../../lib/imports/notes";
import { attachmentType } from "../../lib/notes/attachments";
import { frontMatter } from "../../lib/notes/properties";
import { linedownParser } from "../../lib/editor/syntax";

/*
 * A note of an Obsidian vault in Linedown (docs/importing.md#obsidian). Most of Obsidian's Markdown
 * is lines' already (properties, ==highlights==, #tags, math, Mermaid, tasks); what isn't becomes
 * what lines has for it: [[links]] and embeds to the notes and files they lead to, callouts as
 * lines' callouts, %%comments%% as HTML's. What lines has nothing for stays as written, and is
 * counted. The note is read as lines reads Markdown, so code, math and HTML are left as they are.
 */

/** What a link leads to in the vault: a note, by its name, or a file, by its index among those kept. */
export type Target = { note: string } | { file: number; name: string };

/** What a note's translation needs of its vault. */
export interface Vault {
  /** What a link's target (a path or a name, as written) leads to from this note; null for nothing in the vault. */
  resolve(target: string): Target | null;
  /** What doesn't come across as it was, with where it is. */
  report: Tally;
}

/** A note's properties and text in Linedown, and what Obsidian's properties say that lines keeps apart. */
export interface Translated {
  /** Its properties, `---` lines and all, or nothing. */
  front: string;
  body: string;
  /** Its `tags:`, which lines has in its text. */
  tags: string[];
  created?: number;
  updated?: number;
}

/** Obsidian's callouts as lines' (cards.ts): its kinds by lines' nearest, with an icon where Obsidian's differs. */
const CALLOUTS: Record<string, string> = {
  note: "info icon=pencil",
  info: "info",
  abstract: "info icon=clipboard",
  summary: "info icon=clipboard",
  tldr: "info icon=clipboard",
  todo: "info icon=square-check",
  tip: "info icon=lightbulb",
  hint: "info icon=lightbulb",
  important: "info icon=flame",
  success: "info icon=check",
  check: "info icon=check",
  done: "info icon=check",
  example: "info icon=list",
  quote: "info icon=text-quote",
  cite: "info icon=text-quote",
  question: "question",
  help: "question",
  faq: "question",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  failure: "error icon=x",
  fail: "error icon=x",
  missing: "error icon=x",
  danger: "error icon=zap",
  error: "error",
  bug: "error icon=bug",
};

/** A wiki link or embed: `[[…]]`, `![[…]]`. */
const WIKI = /(!?)\[\[([^[\]\n]+?)\]\]/g;
/** A block's id at the end of its line: `^37066d`. */
const BLOCK_ID = /(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*$/gm;
/** A task with a status lines doesn't have (`- [/]`, `- [-]`, `- [>]`). */
const TASK_STATUS = /^[ \t]*(?:>[ \t]?)*[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([^\]xX ])\][ \t]/gm;
/** What can't be inside an HTML comment, which would end it or make it something else. */
const UNSAFE_COMMENT = /^-?>|-->|--!>|<!--|<!-$/;

/** A link's parts: what it leads to, the heading after a `#`, and the text after a bar, which in a table is `\|`. */
function partsOf(inner: string) {
  const bar = /\\?\|/.exec(inner);
  const link = bar ? inner.slice(0, bar.index) : inner;
  const hash = link.indexOf("#");
  return {
    path: (hash < 0 ? link : link.slice(0, hash)).trim(),
    heading: hash < 0 ? undefined : link.slice(hash + 1).trim(),
    shown: bar ? inner.slice(bar.index + bar[0].length).trim() : undefined,
    escaped: bar?.[0] === "\\|",
  };
}

/** A link to a note, or a picture or file of the vault, as lines writes it; `escaped` keeps a bar as a table needs it, `\|`. */
function written(target: Target, { heading, shown, embed, image, escaped }: { heading?: string; shown?: string; embed: boolean; image?: boolean; escaped?: boolean }) {
  const bar = escaped ? "\\|" : "|";
  if ("note" in target) return noteLink(target.note, { heading, shown: embed ? undefined : shown }).replace("|", bar);
  const label = (shown ?? "").replace(/[[\]]/g, "");
  const place = attachmentPath(target.file);
  if (embed && attachmentType(target.name).startsWith("image/")) {
    // A Markdown picture keeps its description, a width after a bar in it too, as lines reads one.
    if (image) return `![${label}](${place})`;
    // Obsidian's `![[photo.png|300]]` (or `|300x200`) is lines' `![|300](…)`; anything else after the bar is its description.
    const size = /^(\d{1,5})(?:x\d{1,5})?$/.exec(label.trim());
    return `![${size ? `${bar}${size[1]}` : label}](${place})`;
  }
  return `[${label || target.name.replace(/[[\]]/g, "")}](${place})`;
}

/** What a wiki link or embed written as `[[inner]]` becomes, reported as it needs to be. */
function wiki(vault: Vault, name: string, whole: string, inner: string, embed: boolean) {
  const { path, heading, shown, escaped } = partsOf(inner);
  if (!path) {
    // A link to a heading in the note itself, which lines can't open at.
    vault.report.add("import.report.headingLinks", `${whole} (${name})`);
    return whole;
  }
  const target = vault.resolve(path);
  if (!target) {
    // A note that isn't there stays a link to it, which lines offers to create; a file that isn't is kept as written.
    if (/\.(?!md$)[a-z0-9]{1,8}$/i.test(path)) vault.report.add("import.report.missing", `${whole} (${name})`);
    return embed && !/\.(?!md$)[a-z0-9]{1,8}$/i.test(path) ? whole.slice(1) : whole;
  }
  if (embed && "note" in target) vault.report.add("import.report.embeds", `${whole} (${name})`);
  return written(target, { heading, shown, embed, escaped });
}

/** The wiki links and embeds in `parts` of `text`, as edits. */
const wikiEdits = (vault: Vault, name: string, text: string, parts: Span[]) =>
  editsIn(text, parts, WIKI, ([whole, bang, inner]) => wiki(vault, name, whole, inner, !!bang));

/**
 * Obsidian's `%%comments%%` as HTML's, each `%%` paired with the next outside code. A pair with a
 * code or HTML block between, or text an HTML comment can't hold (`-->`), is left as written.
 */
function comments(vault: Vault, name: string, text: string, kept: Span[], blocks: Span[]) {
  const marks: number[] = [];
  for (const { from, to } of between(kept, 0, text.length)) {
    for (let at = text.indexOf("%%", from); at >= 0 && at + 2 <= to; at = text.indexOf("%%", at + 2)) marks.push(at);
  }
  const edits: Edit[] = [];
  const spans: Span[] = [];
  for (let i = 0; i + 1 < marks.length; i += 2) {
    const span = { from: marks[i], to: marks[i + 1] + 2 };
    const inside = text.slice(marks[i] + 2, marks[i + 1]);
    if (within(span, blocks)) continue;
    spans.push(span);
    if (UNSAFE_COMMENT.test(inside)) {
      const whole = text.slice(span.from, span.to);
      vault.report.add("import.report.comments", `${whole.length > 40 ? `${whole.slice(0, 39)}…` : whole} (${name})`);
      continue;
    }
    edits.push({ from: marks[i], to: marks[i] + 2, insert: "<!--" }, { from: marks[i + 1], to: marks[i + 1] + 2, insert: "-->" });
  }
  return { edits, spans };
}

/** The note's text but its properties, in Linedown. */
function body(text: string, vault: Vault, name: string) {
  const { kept, urls, blocks, links, languages } = readMarkdown(text);
  for (const language of languages) if (/^dataview(?:js)?$/i.test(language)) vault.report.add("import.report.dataview", name);
  const notes = comments(vault, name, text, kept, blocks);
  // What's text: not code, math, HTML, a comment, or a Markdown link (each changed as a whole).
  const prose = between([...kept, ...urls, ...notes.spans, ...links], 0, text.length);
  const edits = [...notes.edits, ...wikiEdits(vault, name, text, prose)];
  for (const link of links) {
    if (within(link, notes.spans) || isElsewhere(link.address)) continue;
    const whole = text.slice(link.from, link.to);
    const hash = link.address.indexOf("#");
    const path = pathOf(hash < 0 ? link.address : link.address.slice(0, hash));
    const target = path && vault.resolve(path);
    if (!target) {
      vault.report.add("import.report.missing", `${whole} (${name})`);
      continue;
    }
    if (link.image && "note" in target) vault.report.add("import.report.embeds", `${whole} (${name})`);
    const heading = hash < 0 ? undefined : pathOf(link.address.slice(hash + 1));
    edits.push({ ...link, insert: written(target, { heading, shown: link.text, embed: link.image, image: true }) });
  }
  for (const { from, to } of prose) {
    const part = text.slice(from, to);
    for (const [, status] of part.matchAll(TASK_STATUS)) vault.report.add("import.report.taskStatuses", `[${status}] (${name})`);
    for (const [, id] of part.matchAll(BLOCK_ID)) vault.report.add("import.report.blockIds", `^${id} (${name})`);
  }
  return edited(text, edits);
}

/**
 * Obsidian's callouts (`> [!tip] Title` and the quote under it) as lines' cards, those in them too.
 * Only quotes at a note's top level: in a list, a card isn't drawn.
 */
function callouts(text: string): string {
  const edits: Edit[] = [];
  const top = linedownParser.parse(text).topNode;
  for (let quote = top.firstChild; quote; quote = quote.nextSibling) {
    if (quote.name !== "Blockquote") continue;
    const lines = text.slice(quote.from, quote.to).split("\n");
    const head = /^>[ \t]?\[!([^\]\s]+)\][+-]?[ \t]*(.*)$/.exec(lines[0]);
    if (!head) continue;
    const inner = lines.slice(1).map((line) => line.replace(/^[ \t]*>[ \t]?/, ""));
    const kind = head[1].toLowerCase();
    const title = head[2].trim();
    const card = [`:::${CALLOUTS[kind] ?? ` ${kind.replace(/:/g, "")}`}`, ...(title ? [`**${title}**`, ...(inner.some((line) => line.trim()) ? [""] : [])] : [])];
    const before = quote.from > 0 && text[quote.from - 2] !== "\n" ? "\n" : "";
    const after = quote.to < text.length && text.slice(quote.to + 1, quote.to + 2).trim() ? "\n" : "";
    edits.push({ from: quote.from, to: quote.to, insert: `${before}${[...card, ...(inner.length ? [callouts(inner.join("\n"))] : []), ":::"].join("\n")}${after}` });
  }
  return edited(text, edits);
}

/** A date a property gives, if it's one. */
function dateOf(value: string | undefined) {
  const time = value ? Date.parse(value.trim()) : NaN;
  return Number.isNaN(time) ? undefined : time;
}

const CREATED = new Set(["created", "date created", "created at", "creation date", "ctime"]);
const UPDATED = new Set(["updated", "modified", "date modified", "last modified", "updated at", "mtime"]);

/** An Obsidian note's text in Linedown: its properties (but its tags, which go in its text), and the rest. */
export function translate(text: string, vault: Vault, name: string): Translated {
  const front = frontMatter(text);
  const lines = text.split("\n");
  const closing = !front && /^---[ \t]*$/.test(lines[0]) ? lines.findIndex((line, i) => i > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line)) : -1;
  const rest = (from: number) => body(callouts(lines.slice(from).join("\n")), vault, name);
  if (!front) {
    if (closing < 0) return { front: "", body: rest(0), tags: [] };
    // Properties lines can't read (a key in quotes, say), kept as YAML to read.
    vault.report.add("import.report.properties", name);
    return { front: "", body: ["```yaml", ...lines.slice(1, closing), "```", "", rest(closing + 1)].join("\n"), tags: [] };
  }
  const tags: string[] = [];
  const kept: string[] = [];
  const dropped = new Set<number>();
  let created: number | undefined;
  let updated: number | undefined;
  for (const { key, value, line, end } of front.properties) {
    const lower = key.toLowerCase().replace(/[_-]/g, " ");
    if (lower === "tags" || lower === "tag") {
      tags.push(...value.replace(/^\[|\]$/g, "").split(/[,\s]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean));
      for (let n = line; n <= end; n++) dropped.add(n);
    }
    if (CREATED.has(lower)) created ??= dateOf(value);
    if (UPDATED.has(lower)) updated ??= dateOf(value);
    if (lower === "cssclasses" || lower === "cssclass") vault.report.add("import.report.cssClasses", `${key}: ${value} (${name})`);
  }
  // Properties are YAML, not Markdown: only their links are followed.
  for (let n = 2; n < front.lines; n++) {
    const line = lines[n - 1];
    if (!dropped.has(n)) kept.push(edited(line, wikiEdits(vault, name, line, [{ from: 0, to: line.length }])));
  }
  const properties = kept.some((line) => line.trim()) ? `---\n${kept.join("\n")}\n---\n` : "";
  return { front: properties, body: rest(front.lines), tags, created, updated };
}
