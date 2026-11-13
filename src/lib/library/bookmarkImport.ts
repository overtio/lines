import { notes } from "../notes/store.svelte";
import type { Note } from "../notes/types";
import { libraryLinkOf } from "./adding";
import { type Bookmark, bookmarkItem } from "./bookmarks";
import { libraryNote } from "./note";

/*
 * Bookmarks made into the Library's resources (Settings → Library → Import Bookmarks…), and taken
 * back: thousands at a time, written a batch at a time so the list and the sidebar keep up.
 */

/** The links the library has, of its notes not in the Trash. */
export const libraryLinks = () => notes.entries.flatMap((entry) => libraryLinkOf(entry) ?? []);

/** How many notes are written at once: a few frames' work, so the list keeps up between them. */
const BATCH = 250;

/** What an import made: each note's id and its text as made, to take back only those not changed since. */
export type Imported = Map<string, string>;

/**
 * Makes a resource of each bookmark to add, filed (not in the Inbox), dated when it was bookmarked
 * (or, undated, in the file's order, the first the latest), a batch at a time; `progress` hears
 * how many are made. Nothing is looked up.
 */
export async function importBookmarks(add: Bookmark[], { folderTags = false } = {}, progress?: (done: number) => void): Promise<Imported> {
  const imported: Imported = new Map();
  const now = Date.now();
  for (let from = 0; from < add.length; from += BATCH) {
    const batch: Note[] = await Promise.all(
      add.slice(from, from + BATCH).map(async (bookmark, i) => {
        const { text } = await libraryNote(bookmarkItem(bookmark, { folderTags }));
        const time = bookmark.added ?? now - (from + i);
        return { id: crypto.randomUUID(), body: text, createdAt: time, updatedAt: time, pinned: false, trashed: false };
      }),
    );
    await notes.insert(...batch);
    for (const note of batch) imported.set(note.id, note.body);
    progress?.(imported.size);
    // The list and the sidebar drawn again before the next (a hidden window's frames wait; this doesn't).
    await new Promise((resolve) => setTimeout(resolve));
  }
  return imported;
}

/** Takes an import back: deletes the notes it made that are as they were made. How many it deleted. */
export async function undoImport(imported: Imported): Promise<number> {
  const ids = [...imported].filter(([id, body]) => notes.get(id)?.note.body === body).map(([id]) => id);
  await notes.deleteForeverMany(ids);
  return ids.length;
}
