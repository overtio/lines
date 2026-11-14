import { libraryNote } from "../library/note";
import { notes } from "../notes/store.svelte";
import type { Note, NoteSource } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { keepAttachments, notesInput, type NotesPlan, type Source } from "./notes";

/*
 * Bringing things into lines from elsewhere: notes from another app (Obsidian), and things for the
 * Library (a browser's bookmarks, Readwise). What an import's `work` says to write is written a
 * batch at a time, so the list and the sidebar keep up, and taken back with Undo, into the Trash.
 * It's done in the main window (Settings in a window of its own asks it to, windows/settings.svelte.ts,
 * and hears how it's going), and kept here rather than in Settings, so closing Settings doesn't stop
 * it, and opening it again shows how it went.
 */

/** A note an import makes: the Library's note of an item, or a note of its own; dated as given. */
export type NewNote = NewLibraryNote | (OwnNote & Dated);
export type NewLibraryNote = LibraryNote & Dated;

interface Dated {
  /** When it was made and last changed (ms); undated, it's dated as it's made, in the order given, the first the latest. */
  created?: number;
  updated?: number;
}

/** The Library's note of `item`, then `more`. */
interface LibraryNote {
  item: LibraryItem;
  /** Where it's got to, where the import knows (null: nowhere); its kind's first if left out. */
  status?: string | null;
  /** What follows the Library's part (Readwise's highlights), as Markdown its import made safe. */
  more?: string;
}

/** A note brought from another app: its text, in Linedown, and where it came from. */
interface OwnNote {
  body: string;
  source: NoteSource;
  pinned?: boolean;
  /** In that app's trash, so in lines' too. */
  trashed?: boolean;
}

/** Markdown an import adds at the end of a note there already. */
export interface Addition {
  id: string;
  text: string;
}

/** What an import writes: notes it makes, and what it adds to notes there (each note once). */
export interface ImportWork<Made extends NewNote = NewNote> {
  /** What didn't come across as it was, a line each, said with what it did. */
  report?: string[];
  add: Made[];
  append: Addition[];
}

/** How an import's going, or how it went, by its `id`. */
export type ImportState =
  /** Keeping the files notes from another app show, before they're made. */
  | { id: string; kind: "copying"; total: number; done: number }
  | { id: string; kind: "importing"; total: number; written: number }
  /** Done, or stopped, or failed partway: what it wrote, which Undo takes back, and what didn't come across as it was. */
  | { id: string; kind: "done"; added: number; appended: number; stopped: boolean; failed: boolean; report?: string[] }
  /** Undone: the notes it made, moved to the Trash (but those changed since, kept), and the notes it added to as they were. */
  | { id: string; kind: "undone"; trashed: number; kept: number; restored: number };

/** How many notes are written at once: a few frames' work, so the list keeps up between them. */
const BATCH = 250;
/** How many notes go to the main window at once, from Settings in a window of its own (`receive`). */
const SENT = 500;
/** How often, at most, copying files says how far it's got (ms): a screen reader hears each. */
const COPIED_EVERY = 1000;
/** How many covers are downloaded at once. */
const COVERS = 6;

/** Each of `items` done by `task`, no more than `at` at once, in their order. */
async function inTurns<T, R>(items: T[], at: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await task(items[i], i);
  };
  await Promise.all(Array.from({ length: Math.min(at, items.length) }, worker));
  return results;
}

/** Lets the list and the sidebar draw what's written (a hidden window's frames wait; this doesn't). */
const breathe = () => new Promise((resolve) => setTimeout(resolve));

class Imports {
  state = $state<ImportState | null>(null);
  /** What the import last done wrote: each note it made, as made, and each it added to, before and after. */
  #wrote: { added: Map<string, string>; appended: { id: string; before: string; after: string }[] } | null = null;
  #controller: AbortController | undefined;
  /** Keeping the files of notes from another app, in this window (`importNotes`). */
  #copying: AbortController | undefined;
  /** Notes for an import, sent ahead of starting it (`receive`). */
  #received = new Map<string, NewNote[]>();

  get busy() {
    return this.state?.kind === "importing" || this.state?.kind === "copying";
  }

  /**
   * Imports notes from another app (NotesImport.svelte), unless an import's under way: the files
   * they show are kept here, where they were chosen (they can't go between windows); then the
   * notes go to the main window a part at a time, and are made there (`start`).
   */
  async importNotes(id: string, source: Source, plan: NotesPlan, options: { folderTags: boolean; report: string[] }) {
    if (this.busy) return;
    const controller = (this.#copying = new AbortController());
    const total = plan.attachments.length;
    let said = -Infinity;
    const copied = (done: number) => {
      if (done < total && performance.now() - said < COPIED_EVERY) return;
      said = performance.now();
      this.state = { id, kind: "copying", total, done };
    };
    if (total) copied(0);
    let names: Map<number, string>;
    try {
      names = await keepAttachments(source, plan, controller.signal, copied);
      controller.signal.throwIfAborted();
    } catch {
      // Stopped while copying, before any note was made: nothing to take back.
      this.state = { id, kind: "done", added: 0, appended: 0, stopped: true, failed: false };
      return;
    } finally {
      this.#copying = undefined;
    }
    const { notes, ...input } = { ...notesInput(id, plan, names, source, options), report: options.report };
    // Under way already, as the main window will say.
    this.state = { id, kind: "importing", total: notes.length, written: 0 };
    for (let from = 0; from < notes.length; from += SENT) await this.receive(id, notes.slice(from, from + SENT));
    await this.start(id, { ...input, notes: [] });
  }

  /** Notes for the import `id`, ahead of starting it, so they go between windows a part at a time; `start` takes them. */
  receive(id: string, notes: NewNote[]) {
    this.#received.set(id, [...(this.#received.get(id) ?? []), ...notes]);
  }

  /**
   * Imports `input` with the import `id` (what its panel found), unless one's under way. Resolves
   * once it's done. With nothing to write by then, what the last import wrote is kept, to undo.
   */
  async start(id: string, input: unknown) {
    const source = plugins.imports.find((each) => each.id === id);
    const received = this.#received.get(id);
    this.#received.delete(id);
    if (!source || this.#controller) return;
    if (received) input = { ...(input as object), notes: received };
    // Against the notes as they are now, not as they were when it was asked about.
    let work: ImportWork;
    try {
      work = source.work(input);
    } catch (error) {
      console.error(`lines: the ${id} import couldn't start`, error);
      this.state = { id, kind: "done", added: 0, appended: 0, stopped: false, failed: true };
      return;
    }
    const { add, append, report } = work;
    const total = add.length + append.length;
    if (!total) {
      this.state = { id, kind: "done", added: 0, appended: 0, stopped: false, failed: false };
      return;
    }
    const controller = (this.#controller = new AbortController());
    const { signal } = controller;
    const wrote = (this.#wrote = { added: new Map<string, string>(), appended: [] as { id: string; before: string; after: string }[] });
    const written = () => wrote.added.size + wrote.appended.length;
    let failed = false;
    try {
      const progress = () => (this.state = { id, kind: "importing", total, written: written() });
      progress();
      const now = Date.now();
      for (let from = 0; from < add.length && !signal.aborted; from += BATCH) {
        const made = await inTurns(add.slice(from, from + BATCH), COVERS, (each, i) => this.#make(each, now - (from + i), signal));
        await notes.insert(...made.map(({ note }) => note));
        for (const { note } of made) wrote.added.set(note.id, note.body);
        await Promise.all(made.map(({ keep }) => keep().catch((error) => console.warn("lines: couldn't keep a cover", error))));
        progress();
        await breathe();
      }
      for (let i = 0; i < append.length && !signal.aborted; i++) {
        const { id: note, text } = append[i];
        const before = notes.get(note)?.note.body;
        if (before === undefined) continue;
        const after = `${before.trimEnd()}\n\n${text.trim()}\n`;
        // Something added to, not changed by hand: the list keeps it where it is.
        notes.setText(note, after, { keepDate: true });
        wrote.appended.push({ id: note, before, after });
        if ((i + 1) % BATCH === 0) {
          progress();
          await breathe();
        }
      }
    } catch (error) {
      failed = !signal.aborted;
      if (failed) console.error(`lines: the ${id} import stopped partway`, error);
    }
    this.#controller = undefined;
    this.state = { id, kind: "done", added: wrote.added.size, appended: wrote.appended.length, stopped: signal.aborted, failed, report };
  }

  /** The note for `made`, a library note's cover downloaded (kept with `keep()` once it's written). */
  async #make(made: NewNote, undated: number, signal: AbortSignal) {
    const time = made.created ?? undated;
    const dated = { id: crypto.randomUUID(), createdAt: time, updatedAt: Math.max(time, made.updated ?? time) };
    if ("body" in made) {
      const { body, source, pinned = false, trashed = false } = made;
      // New here, so to be sorted, as a note made here is; but not one that's in the Trash.
      const inbox = prefs.newNotes === "inbox" && !trashed;
      return { note: { ...dated, body, source, pinned, trashed, ...(inbox && { inbox }) } satisfies Note, keep: async () => {} };
    }
    const { item, status, more } = made;
    const written = await libraryNote(item, signal, { status });
    const body = more ? `${written.text}\n${more.trim()}\n` : written.text;
    return { note: { ...dated, body, pinned: false, trashed: false } satisfies Note, keep: written.keep };
  }

  /** Stops the import under way between notes, keeping what it wrote, which Undo takes back. */
  stop() {
    this.#controller?.abort();
  }

  /** Stops the import under way, in this window (copying files) or the main one (making notes). */
  cancel() {
    this.#copying?.abort();
    void this.stop();
  }

  /**
   * Takes back what the last import wrote: the notes it made go to the Trash, but those changed
   * since, which are yours now; the notes it added to are as they were, but those changed since.
   * Their dates are left as they are.
   */
  async undo() {
    const state = this.state;
    const wrote = this.#wrote;
    if (state?.kind !== "done" || !wrote) return;
    this.#wrote = null;
    const unchanged = [...wrote.added].filter(([id, body]) => notes.get(id)?.note.body === body).map(([id]) => id);
    // Some it made in the Trash, as they were in another app's.
    const trashing = unchanged.filter((id) => !notes.get(id)?.note.trashed);
    notes.trashMany(trashing);
    // The last first, so a note added to twice goes back to how it was before both.
    let restored = 0;
    for (const { id, before, after } of [...wrote.appended].reverse()) {
      if (notes.get(id)?.note.body !== after) continue;
      notes.setText(id, before, { keepDate: true });
      restored++;
    }
    await notes.flush();
    this.state = { id: state.id, kind: "undone", trashed: trashing.length, kept: wrote.added.size - unchanged.length, restored };
  }

  /** Forgets how an import of `id` went (and its Undo), as another is asked about. */
  clear(id: string) {
    if (this.state?.id !== id || this.busy) return;
    this.state = null;
    this.#wrote = null;
  }
}

export const imports = new Imports();
