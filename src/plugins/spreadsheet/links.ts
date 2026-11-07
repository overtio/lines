import { blockName } from "../../lib/editor/rendered";
import { t } from "../../lib/i18n/index.svelte";
import { nameOf } from "../../lib/notes/properties";
import { isClosed, notes } from "../../lib/notes/store.svelte";
import type { Cells, FindSheet, LinkedSheet } from "../../lib/plugins/types";
import { parseCsv, writeCsv } from "../../lib/sheets/csv";
import { readSheet } from "./sheet";

/*
 * The other sheets a spreadsheet's formulas can name, as Excel's name a workbook's other sheets:
 * - `Budget!B4`, `'Budget 2026'!B4`: the note of that name, found as a mention finds it: a
 *   spreadsheet note's cells, or a Markdown note's first ```csv block
 * - `'Trip/costs'!B2`: the block named costs (```csv name=costs) in the note Trip
 * - `costs!B2`: in a Markdown note, its own block of that name
 * Notes in the trash, locked ones, and notes in other formats aren't found. Writing a formula, the
 * sheets it can name are suggested (`sheetChoices`).
 */

/** A note's ```csv blocks, outside lists and quotes as the editor draws them: their names and, with `cells`, their cells' text, from `from` to `to` in the note. */
function scan(body: string, cells: boolean) {
  const blocks: { name: string | null; text: string; from: number; to: number }[] = [];
  if (!/^(?:`{3,}|~{3,})\s*csv/im.test(body)) return blocks;
  let open: { fence: string; info: string; line: number; from: number } | null = null;
  const lines = body.split("\n");
  let at = 0;
  lines.forEach((line, i) => {
    if (!open) {
      const start = /^(`{3,}|~{3,})(.*)$/.exec(line);
      if (start && !(start[1][0] === "`" && start[2].includes("`"))) open = { fence: start[1], info: start[2].trim(), line: i + 1, from: at + line.length + 1 };
    } else if (line.trimEnd().startsWith(open.fence) && /^[`~]+$/.test(line.trim()) && line.trim()[0] === open.fence[0]) {
      if (/^csv(\s|$)/i.test(open.info)) {
        const text = cells ? lines.slice(open.line, i).join("\n") : "";
        blocks.push({ name: blockName(open.info), text, from: open.from, to: Math.max(open.from, at - 1) });
      }
      open = null;
    }
    at += line.length + 1;
  });
  return blocks;
}

/** The names of a note's ```csv blocks (null for one without). */
export const blockNames = (body: string) => scan(body, false).map(({ name }) => name);

/**
 * What's read from a note's text, kept for the notes being worked out now: the same cells while the
 * text is the same, so their sheets aren't worked out again.
 */
function cached<T>(cache: Map<string, T>, body: string, read: () => T): T {
  let found = cache.get(body);
  if (found === undefined) {
    cache.set(body, (found = read()));
    if (cache.size > 20) cache.delete(cache.keys().next().value!);
  }
  return found;
}

const blocksRead = new Map<string, { name: string | null; cells: Cells }[]>();
const sheetsRead = new Map<string, Cells>();

/** A Markdown note's blocks, with their cells. */
const blocksIn = (body: string) => cached(blocksRead, body, () => scan(body, true).map(({ name, text }) => ({ name, cells: parseCsv(text) })));

/** A spreadsheet note's cells. */
const cellsIn = (body: string) => cached(sheetsRead, body, () => readSheet(body).cells);

/** A note's text with its ```csv blocks' cells as `rewrite` makes them (null leaves a block as it is). */
export function rewriteBlocks(body: string, rewrite: (cells: Cells) => Cells | null) {
  let text = body;
  for (const { text: code, from, to } of scan(body, true).reverse()) {
    const cells = rewrite(parseCsv(code));
    // Empty rows and columns at the end kept, as the grid writes them.
    if (cells) text = text.slice(0, from) + writeCsv(cells, ",", true) + text.slice(to);
  }
  return text;
}

const named = (blocks: ReturnType<typeof blocksIn>, name: string) => blocks.find((block) => block.name !== null && nameOf(block.name) === nameOf(name));

/** The note called `title`'s sheet: its cells if it's a spreadsheet, or its block named `block` (else its first). */
function inNote(title: string, block?: string): LinkedSheet | null {
  const entry = notes.find(title);
  if (!entry || entry.note.trashed || isClosed(entry.note)) return null;
  const { id, body, format } = entry.note;
  if (format === "spreadsheet") return block === undefined ? { id, cells: cellsIn(body), find: sheetFinder(null, id) } : null;
  if (format) return null;
  const blocks = blocksIn(body);
  const found = block === undefined ? blocks[0] : named(blocks, block);
  return found ? { id: `${id}/${found.name === null ? "" : nameOf(found.name)}`, cells: found.cells, find: sheetFinder(body, id) } : null;
}

/**
 * Finds the sheets formulas name, from a note's text (`body`, null for a spreadsheet note's, which
 * has no blocks) and its id, so a sheet found from different notes is the same one.
 */
export function sheetFinder(body: string | null, id = ""): FindSheet {
  const find: FindSheet = (name) => {
    const own = body === null ? undefined : named(blocksIn(body), name);
    if (own) return { id: `${id}/${nameOf(own.name!)}`, cells: own.cells, find };
    // A note, or a note and one of its blocks; a note's title can have a / in it too.
    const slash = name.lastIndexOf("/");
    return inNote(name) ?? (slash > 0 ? inNote(name.slice(0, slash), name.slice(slash + 1)) : null);
  };
  return find;
}

/** A sheet to suggest while a formula's written: its name as a formula writes it, and what it is. */
export interface SheetChoice {
  name: string;
  about: string;
}

/**
 * The sheets a formula can name, from a note's text (`body`, null for a spreadsheet note's) and
 * title: its own named blocks, spreadsheet notes, and other notes' blocks (by the note's name for
 * the first, and note/name for each named one).
 */
export function sheetChoices(body: string | null, title: string): SheetChoice[] {
  const choices: SheetChoice[] = [];
  if (body !== null) for (const { name } of scan(body, false)) if (name) choices.push({ name, about: t("sheet.inThisNote") });
  // Not this note: by its title, as its text may not be saved yet.
  const own = nameOf(title);
  for (const { note, meta } of notes.entries) {
    if (note.trashed || isClosed(note) || !meta.title || note.body === body || nameOf(meta.title) === own) continue;
    if (note.format === "spreadsheet") choices.push({ name: meta.title, about: t("sheet.spreadsheetNote") });
    if (note.format) continue;
    const blocks = scan(note.body, false);
    if (blocks.length) choices.push({ name: meta.title, about: t("sheet.firstIn") });
    for (const { name } of blocks) if (name) choices.push({ name: `${meta.title}/${name}`, about: t("sheet.blockIn", { note: meta.title }) });
  }
  return choices;
}
