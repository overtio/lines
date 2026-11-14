import type { MessageKey } from "../i18n/index.svelte";
import { libraryTag } from "../library/text";
import { ATTACHMENT_PATH, putAttachment, attachmentNameOf } from "../notes/attachments";
import { escapeMarkdown, unescapeMarkdown } from "../notes/escape";
import { addTagIn } from "../notes/parse";
import { nameOf, wikiLinkOf } from "../notes/properties";
import type { Entry } from "../notes/store.svelte";
import type { ExportedFile } from "./exported";
import type { ImportWork, NewNote } from "./imports.svelte";

/*
 * Notes brought from another app (Obsidian), whatever the app: each app's import reads its export
 * into a `Source`, its notes already in Linedown; this says what importing it would do, keeps the
 * files its notes show as lines' attachments, and makes the notes, each knowing where it came from
 * (`Note.source`), so importing the same export again adds only what isn't here yet.
 */

/** A note as another app had it, its text translated into Linedown by that app's import. */
export interface SourceNote {
  /** Its id there (a path in a vault), which importing again knows it by. */
  id: string;
  /** What it's called there, which links to it use: its title here. */
  name: string;
  /** Its text, as Linedown, its title at its top (`withTitle`); the files it shows as `attachmentPath()`s. */
  body: string;
  /** The folders it's in there, the outermost first. */
  folders: string[];
  /** Tags it has there apart from its text (Obsidian's `tags:` property), as written there. */
  tags: string[];
  created?: number;
  updated?: number;
  pinned?: boolean;
  trashed?: boolean;
}

/** Things of a kind that didn't come across as they were: how many, and a few of them to say. */
export class Tally {
  readonly kinds = new Map<MessageKey, { count: number; examples: string[] }>();

  add(kind: MessageKey, example: string) {
    const found = this.kinds.get(kind) ?? { count: 0, examples: [] };
    found.count++;
    if (found.examples.length < 3 && !found.examples.includes(example)) found.examples.push(example);
    this.kinds.set(kind, found);
  }
}

/** What another app's export holds, as its import read it. */
export interface Source {
  /** What it's called: the vault's name. */
  name: string;
  /**
   * Whether its notes' ids are only its own (an Obsidian vault's paths), which another export may
   * have too: then it's a collection of its own, which importing again asks is the same.
   */
  local?: boolean;
  notes: SourceNote[];
  /** The files notes show, by the index their `attachmentPath()` gives. */
  attachments: ExportedFile[];
  /** What doesn't come across as it was: kept as text, as lines has nothing like it, or left out (each kind a message, which takes `count` and `examples`). */
  report: Tally;
}

/** Where a note's text shows the attachment `index` of its source, until it's kept and has its name. */
export const attachmentPath = (index: number) => `${ATTACHMENT_PATH}\uE000${index}\uE000`;
const ATTACHMENT_PLACE = /\.\.\/attachments\/\uE000(\d+)\uE000/g;

/** A link to the note called `name`, at a heading of it if given, showing `shown` if that's other than its name. */
export function noteLink(name: string, { heading, shown }: { heading?: string; shown?: string } = {}) {
  const link = wikiLinkOf(name).slice(0, -2) + (heading ? `#${heading.replace(/[[\]|\n]/g, "")}` : "");
  const text = shown?.replace(/[[\]\n]/g, "").trim();
  return `${link}${text && text !== name ? `|${text}` : ""}]]`;
}

/** A collection imported before, as it's here: its id and name, and the ids of its notes, in the Trash and not. */
interface Imported {
  id: string;
  name: string;
  out: Set<string>;
  trashed: Set<string>;
}

/** What's here of `app`'s imports, by collection (one, without an id, for an app whose ids are its own everywhere). */
function importedOf(app: string, entries: Entry[]) {
  const collections = new Map<string, Imported>();
  for (const { note } of entries) {
    const { source } = note;
    if (source?.app !== app) continue;
    const key = source.collection?.id ?? "";
    let found = collections.get(key);
    if (!found) collections.set(key, (found = { id: key, name: source.collection?.name ?? "", out: new Set(), trashed: new Set() }));
    (note.trashed ? found.trashed : found.out).add(source.id);
  }
  return collections;
}

/**
 * Whether a note is here, from importing before: out of the Trash, or in it but in the app's trash
 * too. One in the Trash otherwise (an import undone) importing again brings back.
 */
const isHere = (imported: Imported | undefined, { id, trashed }: { id: string; trashed?: boolean }) =>
  !!imported && (imported.out.has(id) || (!!trashed && imported.trashed.has(id)));

/** A collection imported before that this export may be: by its name, or the most notes with the same ids. */
export interface Earlier {
  id: string;
  name: string;
  /** How many of its notes there are, and how many have an id this export's notes have. */
  notes: number;
  shared: number;
}

/** What importing a source would do. */
export interface NotesPlan {
  /** Its notes not here yet, to import. */
  add: SourceNote[];
  /** Its notes here already, from importing it before, left out. */
  there: SourceNote[];
  /** The folders the notes to import are in, and the folders those are in. */
  folders: number;
  /** The indexes of the attachments the notes to import show. */
  attachments: number[];
  /** What its notes come from, for a source whose ids are its own: one imported before, or a new one. */
  collection?: { id: string; name: string };
  /** A collection imported before that it may be, for the person to say whether it is. */
  earlier?: Earlier;
}

/**
 * What importing `source` with the import `app` would do, against the notes here. A source whose
 * ids are its own goes into the collection it may be (`earlier`) if it's `same`, or into a new one,
 * `fresh`, with nothing of it here.
 */
export function planNotes(app: string, source: Source, entries: Entry[], { same = true, fresh = "" }: { same?: boolean; fresh?: string } = {}): NotesPlan {
  const collections = importedOf(app, entries);
  let earlier: Earlier | undefined;
  if (source.local) {
    for (const each of collections.values()) {
      if (!each.id) continue;
      const shared = source.notes.filter((note) => each.out.has(note.id) || each.trashed.has(note.id)).length;
      const named = each.name.toLowerCase() === source.name.toLowerCase();
      if ((shared || named) && (!earlier || shared > earlier.shared)) earlier = { id: each.id, name: each.name, notes: each.out.size + each.trashed.size, shared };
    }
  }
  const collection = source.local ? (earlier && same ? { id: earlier.id, name: source.name } : { id: fresh, name: source.name }) : undefined;
  const imported = collections.get(collection?.id ?? "");
  const add = source.notes.filter((note) => !isHere(imported, note));
  const there = source.notes.filter((note) => isHere(imported, note));
  const folders = new Set(add.flatMap((note) => note.folders.map((_, i) => note.folders.slice(0, i + 1).join("/"))));
  const attachments = new Set<number>();
  for (const note of add) for (const [, index] of note.body.matchAll(ATTACHMENT_PLACE)) attachments.add(Number(index));
  return { add, there, folders: folders.size, attachments: [...attachments].sort((a, b) => a - b), collection, earlier };
}

/**
 * Keeps the attachments `plan`'s notes show, each as lines keeps any (by its content: one kept
 * already isn't again), and says what each is called now, by its index. One that can't be read is
 * left out, its links leading nowhere.
 */
export async function keepAttachments(source: Source, plan: NotesPlan, signal: AbortSignal, progress: (done: number) => void): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  for (const index of plan.attachments) {
    signal.throwIfAborted();
    try {
      const file = await source.attachments[index].file();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = await attachmentNameOf(file, bytes);
      await putAttachment(name, file);
      names.set(index, name);
    } catch (error) {
      console.warn(`lines: couldn't keep ${source.attachments[index].path}`, error);
    }
    progress(names.size);
  }
  return names;
}

/** What a panel gives `imports.start` for notes: each as it's made, which goes between windows as JSON. */
export interface NotesInput {
  app: string;
  /** The collection they come from, for a source whose ids are its own. */
  collection?: { id: string; name: string };
  notes: NewNote[];
  /** What didn't come across as it was, a line each, in the app's language. */
  report?: string[];
}

/**
 * The notes of `plan` as they're made: their title at their top, links to their attachments by the
 * names they're kept as (`names`), their tags and, if asked, their folders as nested tags (lines has
 * no folders: `#projects/2026`).
 */
export function notesInput(app: string, plan: NotesPlan, names: Map<number, string>, source: Source, { folderTags }: { folderTags: boolean }): NotesInput {
  const { collection } = plan;
  return {
    app,
    collection,
    notes: plan.add.map((note) => {
      let body = note.body.replace(ATTACHMENT_PLACE, (_, index) => {
        const name = names.get(Number(index));
        return name ? ATTACHMENT_PATH + name : encodeURI(source.attachments[Number(index)].path);
      });
      const tags = [...note.tags.map((tag) => libraryTag(tag.split("/"))), folderTags ? libraryTag(note.folders) : null];
      for (const tag of tags) if (tag) body = addTagIn(body, tag);
      return {
        body,
        source: { app, ...(collection && { collection }), id: note.id, name: note.name },
        created: note.created,
        updated: note.updated,
        pinned: note.pinned,
        trashed: note.trashed,
      };
    }),
  };
}

/** What importing notes writes: those not here by now (imported meanwhile, from another window). */
export function notesWork(input: unknown, entries: Entry[]): ImportWork {
  const { app, collection, notes, report } = input as NotesInput;
  const imported = importedOf(app, entries).get(collection?.id ?? "");
  return { add: notes.filter((note) => "source" in note && !isHere(imported, { id: note.source.id, trashed: note.trashed })), append: [], report };
}

/**
 * A note's text with its title at its top (after its properties, `front`, if it has any), as a
 * heading of exactly that text, unless it starts with that heading already.
 */
export function withTitle(name: string, body: string, front = "") {
  const heading = /^#{1,6}[ \t]+(.*?)[ \t#]*$/.exec(/^\s*(.*)/.exec(body)![1]);
  const titled = heading && nameOf(unescapeMarkdown(heading[1])) === nameOf(name);
  return `${front}${titled ? body.trimStart() : `# ${escapeMarkdown(name)}\n\n${body.trimStart()}`}`;
}
