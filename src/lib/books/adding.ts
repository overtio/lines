import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { showShelf } from "../library/adding";
import { COVER_WIDTH } from "../library/note";
import { firstStatus } from "../library/shelves.svelte";
import { libraryNoteText } from "../library/text";
import { ATTACHMENT_PATH, attachmentNameOf, putAttachment, saveAttachment } from "../notes/attachments";
import { escapeMarkdown } from "../notes/escape";
import { notes } from "../notes/store.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { BookDetails, BookReader } from "../plugins/types";
import { bookIn } from "./books";

/** The biggest book kept: scanned books run to a few hundred MB, and each is read whole to show it. */
const MAX_SIZE = 512 * 1024 * 1024;

/** Whether a file is a book lines reads: a reader plugin reads its kind. */
export const isBook = (file: File) => !!plugins.bookReader(file.name);

/** The media types of books' files, which is all a drag says of them until they're dropped. */
export const bookTypes = () => plugins.bookReaders.flatMap((reader) => reader.types);

/** Books being added, by their attachment's name: the same file twice at once is one note. */
const adding = new Map<string, Promise<string | null>>();

/**
 * Adds a book from its file (Add to Library, or a file dropped on lines): a `book` note filled in
 * from what the file says of itself (title, author, publisher, language, ISBN, cover, what it's
 * about), with the file kept with it, opened on the Books shelf. A file added before opens its note.
 * What went wrong is said, never thrown.
 */
export async function addBookFile(file: File): Promise<string | null> {
  const reader = plugins.bookReader(file.name);
  if (!reader) {
    speak(t("books.notABook", { name: file.name }));
    return null;
  }
  if (file.size > MAX_SIZE) {
    speak(t("books.tooBig", { name: file.name, size: Math.round(MAX_SIZE / 1024 / 1024) }));
    return null;
  }
  try {
    // Read once: hashed for its name, then given to the reader for what it says of itself.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = await attachmentNameOf(file, bytes);
    let added = adding.get(name);
    if (!added) {
      added = add(file, name, bytes, reader).finally(() => adding.delete(name));
      adding.set(name, added);
    }
    return await added;
  } catch (error) {
    console.error("lines: couldn't add the book", error);
    speak(t("books.addFailed", { name: file.name }));
    return null;
  }
}

async function add(file: File, name: string, bytes: Uint8Array<ArrayBuffer>, reader: BookReader) {
  showShelf("book");
  notes.query = "";
  const existing = notes.entries.find(({ note }) => !note.trashed && bookIn(note.body, (each) => each === name));
  if (existing) {
    notes.select(existing.note.id);
    return existing.note.id;
  }
  await putAttachment(name, file);
  const details: BookDetails = await reader.details(bytes).catch((error) => {
    console.warn("lines: couldn't read what the book says of itself", error);
    return { properties: [] };
  });
  const cover = details.cover && (await saveAttachment(details.cover).catch(() => undefined));
  const title = details.title || file.name.replace(/\.[^.]+$/, "");
  const text = libraryNoteText(
    { type: "book", title, properties: details.properties, description: details.description },
    { status: firstStatus("book"), cover: cover ? { name: cover, width: COVER_WIDTH.tall } : undefined },
  );
  const id = notes.add(`${text}\n[${escapeMarkdown(file.name.replace(/[[\]]/g, ""))}](${ATTACHMENT_PATH}${name})\n`);
  notes.select(id);
  speak(t("books.added", { title }));
  return id;
}
