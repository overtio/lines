import { attachmentNameOf, getAttachment, putAttachment } from "../notes/attachments";
import { notes } from "../notes/store.svelte";
import type { LibraryItem } from "../plugins/types";
import { coverAt, type LibraryNote } from "./note";
import { coverOf, libraryCoverOf, replaceCover } from "./text";

/*
 * A library note's cover, once its note is written: kept with it, or, where it can't be, taken out
 * of it, so the note shows none rather than a picture that can't be shown; and mended, when what it
 * is is added again, if the one lines put there is here but isn't a picture.
 */

/** Takes the cover `name` out of the note `id`: an edit like any other, so it syncs as one. */
const dropCover = (id: string, name: string) => notes.setText(id, (body) => replaceCover(body, name));

/** Keeps the cover of `note`, written as the note `id` just now; or, if it can't be kept, takes it out of the note. */
export async function keepCover(note: LibraryNote, id: string) {
  try {
    await note.keep();
  } catch (error) {
    console.warn("lines: couldn't keep a cover", error);
    const name = coverOf(note.text);
    if (name) dropCover(id, name);
  }
}

/**
 * Whether the attachment `name` is on this device but isn't a picture lines can show. One that isn't
 * here yet (still to arrive from another device) isn't broken: nothing is done about it.
 */
async function broken(name: string): Promise<boolean> {
  const data = await getAttachment(name).catch(() => null);
  if (!data) return false;
  try {
    (await createImageBitmap(data)).close();
    return false;
  } catch {
    return true;
  }
}

/**
 * Mends the cover lines put in the library note `id` (the picture right under its title) where it's
 * here but can't be shown (a logo kept before lines knew better), with `item`'s, found again. A
 * picture put there by hand, one still to arrive, or one with nothing to mend it with is left as it is.
 */
export async function mendCover(id: string, item: LibraryItem, signal?: AbortSignal) {
  const name = libraryCoverOf(notes.get(id)?.note.body ?? "");
  if (!name || !item.cover || !(await broken(name))) return;
  const picture = await coverAt(item.cover, signal);
  if (!picture) return;
  const mended = await attachmentNameOf(picture);
  try {
    await putAttachment(mended, picture);
  } catch (error) {
    return console.warn("lines: couldn't keep a cover", error);
  }
  notes.setText(id, (body) => replaceCover(body, name, mended));
}
