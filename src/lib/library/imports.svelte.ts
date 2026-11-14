import { notes } from "../notes/store.svelte";
import type { Note } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { keepCover } from "./covers";
import { libraryNote } from "./note";

/*
 * Bringing things into the Library from elsewhere (a browser's bookmarks, Readwise): what an
 * import's `work` says to write, written a batch at a time so the list and the sidebar keep up, and
 * taken back with Undo. It's done in the main window (Settings in a window of its own asks it to,
 * windows/settings.svelte.ts, and hears how it's going), and kept here rather than in Settings, so
 * closing Settings doesn't stop it, and opening it again shows how it went.
 */

/** A note an import makes: the Library's note of `item`, then `more`, dated as given. */
export interface NewNote {
  item: LibraryItem;
  /** Where it's got to, where the import knows (null: nowhere); its kind's first if left out. */
  status?: string | null;
  /** What follows the Library's part (Readwise's highlights), as Markdown its import made safe. */
  more?: string;
  /** When it was made and last changed (ms); undated, it's dated as it's made, in the order given, the first the latest. */
  created?: number;
  updated?: number;
}

/** Markdown an import adds at the end of a note there already. */
export interface Addition {
  id: string;
  text: string;
}

/** What an import writes: notes it makes, and what it adds to notes there (each note once). */
export interface ImportWork {
  add: NewNote[];
  append: Addition[];
}

/** How an import's going, or how it went, by its `id`. */
export type ImportState =
  | { id: string; kind: "importing"; total: number; written: number }
  /** Done, or stopped, or failed partway: what it wrote, which Undo takes back. */
  | { id: string; kind: "done"; added: number; appended: number; stopped: boolean; failed: boolean }
  /** Undone: the notes it made, removed (but those changed since, kept), and the notes it added to as they were. */
  | { id: string; kind: "undone"; removed: number; kept: number; restored: number };

/** How many notes are written at once: a few frames' work, so the list keeps up between them. */
const BATCH = 250;
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

  /** Imports `input` with the import `id` (what its panel found), unless one's under way. Resolves once it's done. */
  async start(id: string, input: unknown) {
    const source = plugins.libraryImports.find((each) => each.id === id);
    if (!source || this.state?.kind === "importing") return;
    const controller = (this.#controller = new AbortController());
    const { signal } = controller;
    const wrote = (this.#wrote = { added: new Map<string, string>(), appended: [] as { id: string; before: string; after: string }[] });
    const written = () => wrote.added.size + wrote.appended.length;
    this.state = { id, kind: "importing", total: 0, written: 0 };
    let failed = false;
    try {
      // Against the notes as they are now, not as they were when it was asked about.
      const { add, append } = source.work(input);
      const total = add.length + append.length;
      const progress = () => (this.state = { id, kind: "importing", total, written: written() });
      progress();
      const now = Date.now();
      for (let from = 0; from < add.length && !signal.aborted; from += BATCH) {
        const made = await inTurns(add.slice(from, from + BATCH), COVERS, (each, i) => this.#make(each, now - (from + i), signal));
        await notes.insert(...made.map(({ note }) => note));
        for (const { note } of made) wrote.added.set(note.id, note.body);
        await Promise.all(made.map(({ note, library }) => keepCover(library, note.id)));
        // As they are now: a cover that couldn't be kept is out of its note, which Undo takes back all the same.
        for (const { note } of made) wrote.added.set(note.id, notes.get(note.id)?.note.body ?? note.body);
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
    this.state = { id, kind: "done", added: wrote.added.size, appended: wrote.appended.length, stopped: signal.aborted, failed };
  }

  /** The note for `made`, its cover downloaded (kept with `keepCover` once it's written). */
  async #make({ item, status, more, created, updated }: NewNote, undated: number, signal: AbortSignal) {
    const written = await libraryNote(item, signal, { status });
    const time = created ?? undated;
    const note: Note = {
      id: crypto.randomUUID(),
      body: more ? `${written.text}\n${more.trim()}\n` : written.text,
      createdAt: time,
      updatedAt: Math.max(time, updated ?? time),
      pinned: false,
      trashed: false,
    };
    return { note, library: written };
  }

  /** Stops the import under way between notes, keeping what it wrote, which Undo takes back. */
  stop() {
    this.#controller?.abort();
  }

  /**
   * Takes back what the last import wrote: the notes it made are removed, but those changed since,
   * which are yours now; the notes it added to are as they were, but those changed since. Their
   * dates are left as they are.
   */
  async undo() {
    const state = this.state;
    const wrote = this.#wrote;
    if (state?.kind !== "done" || !wrote) return;
    this.#wrote = null;
    const unchanged = [...wrote.added].filter(([id, body]) => notes.get(id)?.note.body === body).map(([id]) => id);
    await notes.deleteForeverMany(unchanged);
    // The last first, so a note added to twice goes back to how it was before both.
    let restored = 0;
    for (const { id, before, after } of [...wrote.appended].reverse()) {
      if (notes.get(id)?.note.body !== after) continue;
      notes.setText(id, before, { keepDate: true });
      restored++;
    }
    this.state = { id: state.id, kind: "undone", removed: unchanged.length, kept: wrote.added.size - unchanged.length, restored };
  }

  /** Forgets how an import of `id` went (and its Undo), as another is asked about. */
  clear(id: string) {
    if (this.state?.id !== id || this.state.kind === "importing") return;
    this.state = null;
    this.#wrote = null;
  }
}

export const imports = new Imports();
