import type { Exported, ExportedFile } from "../../lib/imports/exported";
import { baseOf, between, type Edit, edited, editsIn, folderOf, isElsewhere, normalized, pathOf, readMarkdown, type Span } from "../../lib/imports/markdown";
import { attachmentPath, noteLink, type Source, type SourceNote, Tally, withTitle } from "../../lib/imports/notes";
import { attachmentType } from "../../lib/notes/attachments";
import { propertyValue } from "../../lib/notes/escape";
import { cleanTagInput, normalizeTag } from "../../lib/notes/parse";
import { nameOf } from "../../lib/notes/properties";
import { formatDay, isoDay, readDay } from "./dates";
import { blocksOf, isEmpty, type Page, readPage, writePage } from "./outline";

/*
 * A Logseq graph, read (docs/importing.md#logseq): a note for each page (pages/) and each day's
 * journal (journals/, dated so they're on the Calendar), titled as Logseq names them, a namespace's
 * pages (`Projects/Acme`, written `Projects___Acme.md`) in its folder; the outline as a list, or
 * as paragraphs where a page is clearly prose (outline.ts); page properties as properties, tasks as
 * tasks, references to blocks as the blocks' text, and assets/ as attachments. Favorites are pinned.
 */

const lower = (text: string) => text.toLowerCase();
const isMarkdown = (path: string) => /\.md$/i.test(path);

/** What config.edn says, of what matters here: journals' names and titles, and the favorite pages. */
function settingsOf(edn: string) {
  // Its own lines, not those commented out, as most of Logseq's examples are.
  const lines = edn.split("\n").filter((line) => !/^\s*;/.test(line)).join("\n");
  const text = (key: string) => new RegExp(`:${key}\\s+"([^"]*)"`).exec(lines)?.[1];
  const favorites = /:favorites\s+\[([^\]]*)\]/.exec(lines)?.[1] ?? "";
  return {
    title: text("journal/page-title-format") || "MMM do, yyyy",
    file: text("journal/file-name-format") || "yyyy_MM_dd",
    favorites: new Set([...favorites.matchAll(/"([^"]*)"/g)].map(([, name]) => lower(name))),
  };
}

/** A page's name from its file's: a namespace's `/` written `___` (or `%2F`, as older versions did), and the rest as written. */
function nameOfFile(path: string) {
  const base = baseOf(path).replace(/\.md$/i, "").replace(/___/g, "/");
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

/** What a property's value names, each `[[page]]` or word in a list: `tags:: [[Big Ideas]], inbox`. */
const namesIn = (value: string) =>
  value
    .split(",")
    .map((name) => name.trim().replace(/^\[\[(.*)\]\]$/, "$1").replace(/^#/, "").trim())
    .filter(Boolean);

/** A tag of several words with dashes for its spaces, as lines writes tags: `#big-ideas`; null where that isn't one. */
function dashed(tag: string) {
  const written = tag
    .split("/")
    .map((part) => cleanTagInput(part.trim()).replace(/-{2,}/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("/");
  return normalizeTag(written) ? written : null;
}

/** Logseq's macros: an embed of a page or a block, a video or a post (its address), or another (a query). */
const MACRO = /\{\{embed \[\[([^[\]\n]+)\]\]\}\}|\{\{embed \(\(([0-9a-f-]{36})\)\)\}\}|\{\{(?:video|youtube|vimeo|tweet|twitter) +([^{}\s]+) *\}\}|\{\{[^{}\n]*\}\}/g;
/** Logseq's own in text: a reference to a block, a tag of several words, a page's link, a highlight. */
const LOGSEQ = /\(\(([0-9a-f-]{36})\)\)|#\[\[([^[\]\n]+)\]\]|\[\[([^[\]\n]+)\]\]|\^\^([^^\n]+)\^\^/g;
/** A picture's size, after it: `{:height 240, :width 320}`. */
const SIZE = /^\{:[^{}\n]*?:width +(\d+)[^{}\n]*\}/;

interface Found {
  file: ExportedFile;
  page: Page;
  name: string;
  journal: ReturnType<typeof readDay>;
}

export async function readGraph({ name: graph, files }: Exported): Promise<Source> {
  const byPath = new Map(files.map((file) => [lower(file.path), file]));
  const settings = settingsOf((await byPath.get("logseq/config.edn")?.text().catch(() => "")) ?? "");
  const report = new Tally();
  const found: Found[] = [];
  for (const file of files) {
    const folder = file.path.split("/")[0];
    if (folder !== "pages" && folder !== "journals") continue;
    if (/\.org$/i.test(file.path)) report.add("import.report.org", file.path);
    if (!isMarkdown(file.path)) continue;
    const page = readPage(await file.text());
    const base = baseOf(file.path).replace(/\.md$/i, "");
    const journal = folder === "journals" ? readDay(base, settings.file) : null;
    const title = page.properties.find(([key]) => lower(key) === "title")?.[1];
    const name = title || (journal ? formatDay(journal, settings.title) : nameOfFile(file.path));
    // An empty page (Logseq makes some itself, as Contents), or a day with nothing written.
    if (!page.properties.length && !page.loose.some((line) => line.trim()) && page.blocks.every(isEmpty)) {
      report.add("import.report.empty", name);
      continue;
    }
    found.push({ file, page, name, journal });
  }

  const byName = new Map<string, string>();
  const refs = new Map<string, { text: string; page: string }>();
  for (const { page, name } of found) {
    byName.set(nameOf(name), name);
    for (const [key, value] of page.properties) if (lower(key) === "alias") for (const alias of namesIn(value)) byName.set(nameOf(alias), name);
    for (const block of blocksOf(page.blocks)) {
      const id = block.properties.find(([key]) => key === "id")?.[1];
      if (id) refs.set(lower(id), { text: block.first.replace(/^(?:TODO|LATER|DOING|NOW|WAITING|WAIT|IN-PROGRESS|DONE|CANCELED|CANCELLED)\s+/, "").trim(), page: name });
    }
  }
  const attachments: ExportedFile[] = [];
  const shown = new Map<ExportedFile, number>();

  const notes: SourceNote[] = found.map(({ file, page, name, journal }) => {
    const body = writePage(page, {
      property: (_, key) => report.add("import.report.blockProperties", `${key}:: (${name})`),
      task: (state, text) => report.add("import.report.taskStates", `${state} ${text.slice(0, 30)} (${name})`),
    });
    for (const line of body.split("\n")) {
      if (/^\s*(?:- )?(?:SCHEDULED|DEADLINE): </.test(line)) report.add("import.report.taskDates", `${line.trim()} (${name})`);
      const priority = /^\s*- \[[ x]\] (?:\S+ )?(\[#[A-C]\])/.exec(line);
      if (priority) report.add("import.report.priorities", `${priority[1]} (${name})`);
    }

    const pageOf = (target: string) => byName.get(nameOf(target));
    const ref = (id: string, whole: string) => {
      const block = refs.get(lower(id));
      if (!block) {
        report.add("import.report.missing", `${whole} (${name})`);
        return whole;
      }
      report.add("import.report.refs", `${block.text.length > 30 ? `${block.text.slice(0, 29)}…` : block.text} (${name})`);
      return block.page === name ? block.text : `${block.text} (${noteLink(block.page)})`;
    };
    const fileAt = (address: string) => {
      const target = byPath.get(lower(normalized(`${folderOf(file.path)}/${pathOf(address)}`)));
      if (!target || isMarkdown(target.path)) return null;
      if (!shown.has(target)) shown.set(target, attachments.push(target) - 1);
      return { index: shown.get(target)!, name: baseOf(target.path) };
    };

    const read = readMarkdown(body);
    const edits: Edit[] = [];
    // A macro first, which a web address can be in: `{{video https://…}}`.
    const macros: Span[] = [];
    edits.push(
      ...editsIn(body, between(read.kept, 0, body.length), MACRO, (match) => {
        const [whole, embedPage, embedBlock, video] = match;
        macros.push({ from: match.index, to: match.index + whole.length });
        if (embedPage !== undefined) {
          report.add("import.report.embeds", `${whole} (${name})`);
          return noteLink(pageOf(embedPage) ?? embedPage);
        }
        if (embedBlock !== undefined) return ref(embedBlock, whole);
        if (video !== undefined) return video;
        report.add("import.report.macros", `${whole.slice(0, 40)} (${name})`);
        return whole;
      }),
    );
    const taken: Span[] = [...read.kept, ...read.urls, ...macros];
    for (const link of read.links) {
      const size = link.image ? SIZE.exec(body.slice(link.to)) : null;
      const span = { from: link.from, to: link.to + (size?.[0].length ?? 0) };
      taken.push(span);
      const whole = body.slice(span.from, span.to);
      const page = /^\[\[(.+)\]\]$/.exec(link.address);
      const block = /^\(\(([0-9a-f-]{36})\)\)$/.exec(link.address);
      let insert = whole;
      if (page) insert = noteLink(pageOf(page[1]) ?? page[1], { shown: link.text });
      else if (block) {
        const target = refs.get(lower(block[1]));
        if (target) insert = noteLink(target.page, { shown: link.text });
        else report.add("import.report.missing", `${whole} (${name})`);
      } else if (!isElsewhere(link.address)) {
        const target = fileAt(link.address);
        if (!target) report.add("import.report.missing", `${whole} (${name})`);
        else if (link.image && attachmentType(target.name).startsWith("image/")) insert = `![${link.text}${size ? `|${size[1]}` : ""}](${attachmentPath(target.index)})`;
        else insert = `[${link.text || target.name}](${attachmentPath(target.index)})`;
      }
      if (insert !== whole) edits.push({ ...span, insert });
    }
    edits.push(
      ...editsIn(body, between(taken, 0, body.length), LOGSEQ, (match) => {
        const [whole, blockRef, tag, link, highlight] = match;
        if (blockRef !== undefined) return ref(blockRef, whole);
        if (tag !== undefined) {
          const tagged = dashed(tag);
          if (!tagged) return whole;
          if (/\s/.test(tag)) report.add("import.report.spacedTags", `${whole} → #${tagged} (${name})`);
          return `#${tagged}`;
        }
        if (link !== undefined) return noteLink(pageOf(link) ?? link);
        return `==${highlight}==`;
      }),
    );
    const text = edited(body, edits);

    // The page's properties, as a note's: but its title, which is its title, and its tags, which go in its text.
    const tags: string[] = [];
    const properties: string[] = [];
    for (const [key, value] of page.properties) {
      const which = lower(key);
      if (which === "title" || which === "id" || which === "collapsed") continue;
      if (which === "tags") tags.push(...namesIn(value));
      else properties.push(`${key}: ${propertyValue(value)}`);
    }
    if (journal) properties.unshift(`date: ${isoDay(journal)}`);
    const front = properties.length ? `---\n${properties.join("\n")}\n---\n` : "";
    const slash = name.lastIndexOf("/");
    return {
      id: file.path,
      name,
      body: `${withTitle(name, text, front).trimEnd()}\n`,
      folders: journal ? ["Journals"] : slash > 0 ? name.slice(0, slash).split("/") : [],
      tags,
      created: journal ? new Date(journal.year, journal.month - 1, journal.day).getTime() : file.modified,
      updated: file.modified,
      pinned: settings.favorites.has(lower(name)),
    };
  });
  // Logseq's drawings and whiteboards are its own: left out, as files no note shows.
  for (const file of files) if (/^(?:assets|draws|whiteboards)\//.test(file.path) && !shown.has(file)) report.add("import.report.unused", file.path);
  return { name: graph, local: true, notes, attachments, report };
}
