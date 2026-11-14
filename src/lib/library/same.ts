import { propertyOf, setProperties } from "../notes/properties";
import { type Entry, notes } from "../notes/store.svelte";
import { isClosed } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { mendCover } from "./covers";
import { keysOf, keysOfNote, type Thing } from "./keys";

/*
 * Whether something's in the Library already: the note of the same thing (keys.ts says what's the
 * same), however it was added. Every way of adding asks here: a note that's just a link, Add to
 * Library, a link's Add to Library, an import, a feed subscribed to, a post saved. And what adding
 * it again does to its note.
 */

/** The property a library note counts how often what it is was added under (Settings → Library). */
export const TIMES_ADDED = "times added";

/**
 * The Library's notes (not those in the Trash) by each of their keys. Kept up to date when something
 * asks, a note at a time (a note's entry is new only when the note changes), so a library of
 * thousands isn't gone through again for every keystroke while a post is open.
 */
class Index {
  #entries: Entry[] | null = null;
  #plugins: unknown[] = [];
  #notes = new Map<string, { entry: Entry; keys: string[] }>();
  #byKey = new Map<string, Set<string>>();

  #update() {
    const { entries } = notes;
    const { libraryKinds, librarySources } = plugins;
    // A kind or a source on or off now says differently what's the same: all are worked out again.
    if (libraryKinds !== this.#plugins[0] || librarySources !== this.#plugins[1]) {
      this.#plugins = [libraryKinds, librarySources];
      this.#notes.clear();
      this.#byKey.clear();
      this.#entries = null;
    }
    if (entries === this.#entries) return;
    this.#entries = entries;
    const here = new Set<string>();
    for (const entry of entries) {
      const { id } = entry.note;
      here.add(id);
      const was = this.#notes.get(id);
      if (was?.entry === entry) continue;
      if (was) this.#forget(id, was.keys);
      const keys = entry.note.trashed || !plugins.libraryKind(entry.meta.type) ? [] : keysOfNote(entry.meta);
      this.#notes.set(id, { entry, keys });
      for (const key of keys) {
        const ids = this.#byKey.get(key);
        if (ids) ids.add(id);
        else this.#byKey.set(key, new Set([id]));
      }
    }
    for (const [id, was] of this.#notes) {
      if (here.has(id)) continue;
      this.#forget(id, was.keys);
      this.#notes.delete(id);
    }
  }

  #forget(id: string, keys: string[]) {
    for (const key of keys) {
      const ids = this.#byKey.get(key);
      ids?.delete(id);
      if (ids && !ids.size) this.#byKey.delete(key);
    }
  }

  /** The note with any of `keys`, but `except`. */
  find(keys: string[], except?: string): Entry | undefined {
    this.#update();
    for (const key of keys) for (const id of this.#byKey.get(key) ?? []) if (id !== except) return this.#notes.get(id)!.entry;
    return undefined;
  }
}

const index = new Index();

/** The note in the Library of the same thing as `thing` (but not `except`, the note being made), if there's one. */
export const libraryNoteOf = (thing: Thing, except?: string): Entry | undefined => index.find(keysOf(thing), except);

/** Whether the Library has a note of `thing`: to ask of many (an import's). */
export const inLibrary = (thing: Thing) => !!libraryNoteOf(thing);

/**
 * Something the Library has a note of already, added again (one by one, not an import's): as
 * Settings → Library has it, its note counts it (`times added: 2`, the first time it's added again);
 * and its cover, if it can't be shown, is mended from what was found again (`item`).
 * Saying so is the caller's.
 */
export function addedAgain(entry: Entry, item?: LibraryItem) {
  const { id } = entry.note;
  if (prefs.countAddedAgain && !isClosed(entry.note)) {
    const times = (Number(propertyOf(entry.meta.properties, TIMES_ADDED)?.value) || 1) + 1;
    // An edit like any other, its date now: kept as of then, it would lose to an edit on another device and be a copy of its own.
    notes.setText(id, (body) => setProperties(body, { [TIMES_ADDED]: String(times) }));
  }
  if (item) void mendCover(id, item);
}
