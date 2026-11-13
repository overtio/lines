import { propertyOf } from "../notes/properties";
import { notes } from "../notes/store.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { ui } from "../ui.svelte";
import { completeNote } from "./linkNotes";
import { lookUp } from "./lookup";
import { firstStatus, shelves } from "./shelves.svelte";
import { libraryNoteText } from "./text";

/*
 * Adding to the library from Add to Library (AddToLibrary.svelte): what a search found, or a link
 * looked up there, as a new note on its shelf, opened; or the note there is of it already.
 */

/** The library note there is already of something, by its `link` (any of `links`), if there's one. */
export function libraryNoteOf(...links: (string | undefined)[]) {
  const wanted = new Set(links.filter(Boolean));
  return notes.entries.find(({ note, meta }) => !note.trashed && plugins.libraryKind(meta.type) && wanted.has(propertyOf(meta.properties, "link")?.value ?? ""));
}

/**
 * Makes `item` a note at once, from what's known of it, opened on its shelf and filed; then fills it
 * in (its cover kept, and what its page says of it besides, for what a search found) as one change,
 * as a note that was a link is. `whole` for an item looked up by its link already. One there is of
 * it already, by its link, is opened instead.
 */
export function addToLibrary(item: LibraryItem, whole = false) {
  const existing = libraryNoteOf(item.link);
  showShelf(existing?.meta.type ?? item.type);
  notes.query = "";
  if (existing) {
    notes.select(existing.note.id);
    return existing.note.id;
  }
  const text = libraryNoteText(item, { status: firstStatus(item.type), mentions: plugins.libraryKind(item.type)?.mentions });
  // Added, not made like a new note: one left as it is isn't discarded as untouched.
  const id = notes.add(text);
  notes.pendingFocus = id;
  notes.select(id);
  const { link } = item;
  completeNote(id, text, async (signal) => (whole || !link ? item : ((await lookUp(link, signal).catch(() => null)) ?? item)));
  return id;
}

/** A new note of a kind, to fill in by hand ("Blank"), on its shelf and filed there. */
export function addBlank(type: string) {
  showShelf(type);
  return notes.create(undefined, shelves.made(type));
}

/** Shows the shelf a kind's notes are on, where the note added goes; on a phone, the sidebar's drawer closes for it. */
function showShelf(type: string) {
  const shelf = shelves.of(type);
  if (shelf) notes.setFilter({ kind: "library", shelf: shelf.key });
  ui.closeDrawer();
}
