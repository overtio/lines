import { DEFAULT_LANGUAGE, plugins } from "../plugins/registry.svelte";
import { deserialize } from "../sync/format";
import type { Note } from "./types";

/*
 * Files made into notes (Settings → Export and Import → Import), each by the language its extension belongs
 * to: a Markdown file as a Markdown note, a CSV file or each sheet of an Excel workbook as a
 * spreadsheet note. A language reads a file its own way, or takes its text as it is. A note's own
 * file from a synced folder or bucket comes back as the note it is, by lines' header in it.
 */

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

const languageFor = (extension: string) =>
  plugins.languages.find((language) => language.extensions.includes(extension) || language.opens?.includes(extension));

/** The extensions lines can make notes from, with the plugins on. */
export const importable = () => plugins.languages.flatMap((language) => [...language.extensions, ...(language.opens ?? [])]);

/** Notes made from files, keeping the files' times; files no language reads are skipped. */
export async function notesFromFiles(files: File[]): Promise<{ notes: Note[]; skipped: string[] }> {
  const notes: Note[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const language = languageFor(extensionOf(file.name));
    if (!language) {
      skipped.push(file.name);
      continue;
    }
    const data = new Uint8Array(await file.arrayBuffer());
    // With Windows line endings too, so a file's properties are read.
    const bodies = language.read ? await language.read({ name: file.name, data }) : [new TextDecoder().decode(data).replace(/\r\n?/g, "\n")];
    const time = file.lastModified || Date.now();
    for (const body of bodies) {
      const note: Note = { id: crypto.randomUUID(), body, createdAt: time, updatedAt: time, pinned: false, trashed: false };
      const synced = !language.read && deserialize(body, note.id);
      if (synced && synced.id !== note.id) notes.push(synced);
      else notes.push(language.id === DEFAULT_LANGUAGE ? note : { ...note, format: language.id });
    }
  }
  return { notes, skipped };
}
