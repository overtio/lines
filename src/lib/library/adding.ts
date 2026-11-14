import { propertyOf } from "../notes/properties";
import { notes } from "../notes/store.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { ui } from "../ui.svelte";
import { completeNote, openNote, tell } from "./linkNotes";
import { lookUp } from "./lookup";
import { addedAgain, libraryNoteOf } from "./same";
import { firstStatus, shelves } from "./shelves.svelte";
import { known, libraryNoteText } from "./text";

/*
 * Adding to the library from Add to Library (AddToLibrary.svelte): what a search found, or a link
 * looked up there, as a new note on its shelf, opened; or the note there is of it already.
 */

/**
 * Makes `item` a note at once, from what's known of it, opened on its shelf and filed; then fills it
 * in (its cover kept, and what its page says of it besides, for what a search found) as one change,
 * as a note that was a link is. `whole` for an item looked up by its link already. One the Library
 * has of it already is opened instead, added again.
 */
export function addToLibrary(item: LibraryItem, whole = false) {
  const existing = libraryNoteOf(item);
  showShelf(existing?.meta.type ?? item.type);
  notes.query = "";
  if (existing) {
    addedAgain(existing, item);
    openNote(existing.note.id);
    tell(existing.note.id, "already");
    return existing.note.id;
  }
  const text = libraryNoteText(item, { status: firstStatus(item.type), mentions: plugins.libraryKind(item.type)?.mentions });
  // Added, not made like a new note: one left as it is isn't discarded as untouched.
  const id = notes.add(text);
  notes.pendingFocus = id;
  notes.select(id);
  const { link } = item;
  completeNote(id, text, async (signal) => (whole || !link ? item : ((await lookUp(link, signal).catch(() => null)) ?? item)), { fresh: true });
  return id;
}

/**
 * Looks a note of a kind that's only a link so far (a resource) up by its link, and makes it what
 * that is (a book, a video…) where a source knows it, keeping its own properties (its folder) and
 * its tags. It's opened, to show it happening.
 */
export function lookUpDetails(id: string) {
  const entry = notes.get(id);
  const kind = entry && plugins.libraryKind(entry.meta.type);
  const link = entry && propertyOf(entry.meta.properties, "link")?.value;
  if (!entry || !kind || !link) return;
  const kept = known(kind.properties.map((key) => [key, propertyOf(entry.meta.properties, key)?.value]));
  notes.select(id);
  completeNote(id, entry.note.body, async (signal) => {
    const item = await lookUp(link, signal);
    return item && { ...item, properties: [...item.properties, ...kept], tags: [...new Set([...(item.tags ?? []), ...entry.meta.tags])] };
  });
}

/** A new note of a kind, to fill in by hand ("Blank"), on its shelf and filed there. */
export function addBlank(type: string) {
  showShelf(type);
  return notes.create(undefined, shelves.made(type));
}

/** Shows the shelf a kind's notes are on, where the note added goes; on a phone, the sidebar's drawer closes for it. */
export function showShelf(type: string) {
  const shelf = shelves.of(type);
  if (shelf) notes.setFilter({ kind: "library", shelf: shelf.key });
  ui.closeDrawer();
}
