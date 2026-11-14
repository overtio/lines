import { feedStorage, type BookPosition } from "../feeds/storage";
import { propertyOf, setProperties } from "../notes/properties";
import { isClosed, notes, type Entry } from "../notes/store.svelte";
import { plugins } from "../plugins/registry.svelte";
import { bookIn, progressOf, progressValue, quoteMarkdown, statusFor, withQuote, type KeptBook } from "./books";
import type { BookPlace } from "../plugins/types";

/*
 * The book read in a note's place (BookReader.svelte), and where each book was left. Where it was
 * left, and how far it's been read, is kept on this device among the podcast player's positions
 * (feeds/storage.ts: under the note's id, encrypted while the app lock is on). How far through goes
 * into the note (`progress: 37%`) as the reader closes, and as lines locks, quits or is closed, with
 * its status following along its kind's statuses, so both sync and its shelf in the Library shows
 * them, without the note changing at every page. Only pages read count, never a place gone to, and
 * it never goes back: a device that's read less, or a look at the last chapter, leaves it as it is.
 */

class Reading {
  /** The note whose book is read in its place, and a place to open it at (a quote's) rather than where it was left. */
  open = $state.raw<{ note: string; at?: string } | null>(null);
  #positions = new Map<string, BookPosition>();
  #loaded: Promise<void> | undefined;
  /** Positions not yet stored, by note, written a moment after the book stops moving. */
  #unsaved = new Set<string>();
  #saving = 0;

  constructor() {
    // A tab closing or reloading: before the notes are written (the editor's own listeners come after these).
    for (const type of ["pagehide", "beforeunload"]) addEventListener(type, () => void this.leave());
  }

  /**
   * As lines locks, quits or closes: how far through the book read now is goes into its note at
   * once, before the notes are written (call it first), and where each book is is stored.
   */
  leave(): Promise<void> {
    if (this.open) this.record(this.open.note);
    return this.save();
  }

  /** The book a note keeps, if it's a library note, open, and a reader reads its file. */
  bookOf(entry: Entry): KeptBook | null {
    if (!plugins.libraryKind(entry.meta.type) || isClosed(entry.note)) return null;
    return bookIn(entry.note.body, (name) => !!plugins.bookReader(name));
  }

  isReading = (id: string) => this.open?.note === id;

  toggle(id: string) {
    if (this.isReading(id)) this.close();
    else this.open = { note: id };
  }

  close() {
    if (this.open) this.record(this.open.note);
    this.open = null;
  }

  /** Opens the book a quote links to, at its place, in the note that keeps it (the open one, if that does); false if none can. */
  openAt(name: string, at: string) {
    const keeps = (entry: Entry | null | undefined) => !!entry && !entry.note.trashed && this.bookOf(entry)?.name === name;
    const entry = keeps(notes.selected) ? notes.selected : notes.entries.find(keeps);
    if (!entry) return false;
    notes.select(entry.note.id);
    this.open = { note: entry.note.id, at };
    return true;
  }

  /** Reads where books were left on this device, once. */
  load() {
    this.#loaded ??= feedStorage
      .positions()
      .then(({ books }) => {
        for (const position of books) this.#positions.set(position.id, position);
      })
      .catch((error) => console.error("lines: couldn't read where books were left", error));
    return this.#loaded;
  }

  /** Where a note's book was left on this device, and how far it's been read; nothing for another file than it had. */
  positionOf(note: string, book: string): BookPosition | undefined {
    const position = this.#positions.get(note);
    return position?.book === book ? position : undefined;
  }

  /** How far a note says its book has been read (`progress`), 0 if it doesn't. */
  progressIn(id: string) {
    const entry = notes.get(id);
    return (entry && progressOf(propertyOf(entry.meta.properties, "progress")?.value)) ?? 0;
  }

  /** Keeps where a note's book is and how far it's been read, written a moment after it stops moving. */
  keep(note: string, book: string, place: BookPlace, furthest: number) {
    this.#positions.set(note, { id: note, book, place, furthest });
    this.#unsaved.add(note);
    clearTimeout(this.#saving);
    this.#saving = window.setTimeout(() => void this.save(), 500);
  }

  /** Writes the positions not yet stored, now: before lines locks or quits. */
  async save() {
    clearTimeout(this.#saving);
    const positions = [...this.#unsaved].flatMap((id) => this.#positions.get(id) ?? []);
    this.#unsaved.clear();
    await Promise.all(positions.map((position) => feedStorage.putPosition(position))).catch((error) => console.error("lines: couldn't keep where the book was", error));
  }

  /**
   * Writes how far through a note's book has been read, and its status as that makes it, by lines,
   * so ⌘Z stays with what you did: only further than the note says, never back.
   */
  record(id: string) {
    const position = this.#positions.get(id);
    const entry = notes.get(id);
    if (!position || !entry || entry.note.trashed || isClosed(entry.note)) return;
    const value = (key: string) => propertyOf(entry.meta.properties, key)?.value.trim();
    if (progressValue(position.furthest) === progressValue(this.progressIn(id)) || position.furthest < this.progressIn(id)) return;
    const status = value("status");
    const next = statusFor(status, position.furthest, plugins.libraryKind(entry.meta.type)?.statuses?.map((each) => each.value) ?? []);
    notes.setText(id, (body) => setProperties(body, { progress: progressValue(position.furthest), ...(next !== status && next !== undefined && { status: next }) }), { keepDate: true });
  }

  /** Adds a quote to the note that keeps the book, at its end; ⌘Z takes it back. */
  quote(id: string, book: KeptBook, text: string, place: BookPlace, undone: string) {
    const entry = notes.get(id);
    if (!entry) return;
    notes.edit(id, withQuote(entry.note.body, quoteMarkdown(text, place, book.name)), undone);
  }
}

export const reading = new Reading();
