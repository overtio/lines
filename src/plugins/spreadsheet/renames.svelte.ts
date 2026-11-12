import { nameOf } from "../../lib/notes/properties";
import { type Entry, isClosed, notes } from "../../lib/notes/store.svelte";
import type { Cells, FindSheet, FormulaEngine } from "../../lib/plugins/types";
import { isFormula } from "../../lib/sheets/cells";
import { writeCsv } from "../../lib/sheets/csv";
import { loadFormulas } from "../../lib/sheets/formulas";
import { panes } from "../../lib/panes.svelte";
import { blockNames, rewriteBlocks, sheetFinder } from "./links";
import { readSheet } from "./sheet";

/*
 * Renaming a sheet renames it in the formulas that name it, as renaming one in Excel does: a block
 * (```csv name=costs to name=expenses, from the name over its grid or in its code), or a note, whose
 * title names its spreadsheet or first block (`Budget!B4`, `'Budget/costs'!B4`). Once a rename's
 * done (at once for a block; for a title, at a pause in typing it), the formulas in every note that
 * name the sheet by a name it had, and so find nothing now, name it by its new one. Undoing a
 * rename renames them back so.
 *
 * Only the notes open in this window are watched, so a rename is taken up once, where it's made.
 */

/** The names in a note that formulas use: its title, and its blocks', in order. */
interface Names {
  title: string;
  blocks: (string | null)[];
}

const namesOf = ({ note, meta }: Entry): Names => ({ title: meta.title, blocks: note.format ? [] : blockNames(note.body) });

/** The open notes' names, as they were when last looked at. */
const seen = new Map<string, Names>();

/** The names notes, and their blocks, had before, by note: what formulas may still call them. */
const former = new Map<string, { titles: Set<string>; blocks: { name: string | null; was: Set<string> }[] }>();

/** Takes note of a note renamed, or its blocks; whether any was. A block's renamed if it's the only change to the blocks. */
function noteRenames(id: string, was: Names, now: Names) {
  const names = former.get(id) ?? { titles: new Set<string>(), blocks: [] };
  let renamed = false;
  if (was.title && nameOf(was.title) !== nameOf(now.title)) {
    names.titles.add(nameOf(was.title));
    renamed = true;
  }
  if (was.blocks.length === now.blocks.length) {
    was.blocks.forEach((old, i) => {
      const name = now.blocks[i];
      if (!old || nameOf(old) === nameOf(name ?? "")) return;
      let block = names.blocks.find((block) => block.name !== null && nameOf(block.name) === nameOf(old));
      if (!block) names.blocks.push((block = { name, was: new Set() }));
      block.name = name;
      block.was.add(nameOf(old));
      renamed = true;
    });
  }
  if (renamed) former.set(id, names);
  return renamed;
}

/** A block's id as `find` gives it: its note's, then its name (none for a note's first block found by the note's title). */
const blockId = (note: string, name: string | null) => `${note}/${name === null ? "" : nameOf(name)}`;

/**
 * What the sheet a formula in note `here` names by a name it no longer has (`written`) is called
 * now, if it was renamed: a block of that note, a note, or a note's block, whichever was. `find`
 * finds sheets from that note.
 */
function renamedTo(written: string, here: string, find: FindSheet): string | undefined {
  const key = nameOf(written);
  const slash = written.lastIndexOf("/");
  const candidates: { name: string; is: (id: string) => boolean }[] = [];
  for (const block of former.get(here)?.blocks ?? []) {
    if (block.name && block.was.has(key)) candidates.push({ name: block.name, is: (id) => id === blockId(here, block.name) });
  }
  for (const [note, { titles, blocks }] of former) {
    const title = notes.get(note)?.meta.title;
    if (!title) continue;
    if (titles.has(key)) candidates.push({ name: title, is: (id) => id === note || id.startsWith(`${note}/`) });
    if (slash <= 0) continue;
    const head = nameOf(written.slice(0, slash));
    const tail = written.slice(slash + 1);
    if (head !== nameOf(title) && !titles.has(head)) continue;
    const block = blocks.find((block) => block.was.has(nameOf(tail)));
    const name = block ? block.name : tail;
    // A block that's lost its name can still be named by its note's title, if it's the first.
    candidates.push({ name: name === null ? title : `${title}/${name}`, is: (id) => id === blockId(note, name) });
  }
  return candidates.find(({ name, is }) => {
    const sheet = find(name);
    return !!sheet && is(sheet.id);
  })?.name;
}

/** Cells with the sheets their formulas name by a name they've since lost renamed; null if none were. */
function renamedIn(engine: FormulaEngine, cells: Cells, here: string, find: FindSheet): Cells | null {
  let changed = false;
  const out = cells.map((row) =>
    row.map((input) => {
      if (!isFormula(input) || !input.includes("!")) return input;
      const renamed = engine.renameSheets(input, (name) => (find(name) ? undefined : renamedTo(name, here, find)));
      if (renamed !== input) changed = true;
      return renamed;
    }),
  );
  return changed ? out : null;
}

/** Renames the sheets renamed in every note's formulas. */
async function follow() {
  const engine = await loadFormulas();
  if (!engine) return;
  notes.rewrite((body, note) => {
    if (!body.includes("!")) return body;
    if (note.format === "spreadsheet") {
      const { dataFrom, cells } = readSheet(body);
      const renamed = renamedIn(engine, cells, note.id, sheetFinder(null, note.id));
      return renamed ? body.slice(0, dataFrom) + writeCsv(renamed) : body;
    }
    if (note.format) return body;
    const find = sheetFinder(body, note.id);
    return rewriteBlocks(body, (cells) => renamedIn(engine, cells, note.id, find));
  });
}

/** The notes open in this window: the selected one, and those in panes beside it. */
const openNotes = () => [notes.selectedId, ...panes.ids].filter((id) => id !== null);

/** Takes up what's been renamed in the notes open since they were last looked at, then looks at those open now. */
export function settle() {
  clearTimeout(timer);
  notes.saveNow();
  const open = openNotes();
  let renamed = false;
  for (const [id, was] of seen) {
    const entry = notes.get(id);
    const now = entry && !isClosed(entry.note) ? namesOf(entry) : null;
    if (now && noteRenames(id, was, now)) renamed = true;
    if (now && open.includes(id)) seen.set(id, now);
    else seen.delete(id);
  }
  for (const id of open) {
    const entry = notes.get(id);
    if (entry && !seen.has(id) && !isClosed(entry.note)) seen.set(id, namesOf(entry));
  }
  if (renamed) void follow();
}

/** A pause after typing, so a title is renamed once it's typed rather than at each letter. */
const PAUSE = 800;
let timer: ReturnType<typeof setTimeout> | undefined;
const settleIn = (delay: number) => {
  clearTimeout(timer);
  timer = setTimeout(settle, delay);
};

// A block renamed (from its name over the grid, or undone) is taken up at once; a title, after a pause.
const sameNames = (a: (string | null)[], b: (string | null)[]) => a.length === b.length && a.every((name, i) => name === b[i]);
notes.onLocalChange(() => {
  const blocksChanged = openNotes().some((id) => {
    const was = seen.get(id);
    const entry = notes.get(id);
    return !!was && !!entry && !sameNames(was.blocks, namesOf(entry).blocks);
  });
  settleIn(blocksChanged ? 0 : PAUSE);
});
// Another note opened: what was renamed in the one before is taken up now.
$effect.root(() => {
  $effect(() => {
    void notes.selectedId;
    void panes.tree;
    settleIn(0);
  });
});
