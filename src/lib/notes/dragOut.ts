import { plugins } from "../plugins/registry.svelte";
import { fileName } from "./fileName";
import type { Note } from "./types";

/**
 * A note as a file of its own, as downloading it makes one: named after its title, with its
 * language's extension, holding what that language writes (even while its plugin is off).
 */
export function noteFile(note: Note, title: string) {
  const language = plugins.ownLanguage(note.format);
  return { name: `${fileName(title)}.${language.extensions[0]}`, text: language.file(note.body), type: `${language.mimeType};charset=utf-8` };
}

/** The file last dragged on the web, freed as the next is (it's read after the drop, when the browser saves it). */
let dragged: string | null = null;

/**
 * Dragging a note out of the list in a browser: wherever it's dropped gets a copy, as a file.
 * Chromium's browsers (and the Windows app's WebView2) save it where it's dropped, a folder or the
 * desktop; anywhere else, and in a text field, it's the note's text.
 */
export function dragNoteOut(event: DragEvent, note: Note, title: string) {
  const data = event.dataTransfer;
  if (!data) return;
  const file = noteFile(note, title);
  data.effectAllowed = "copy";
  data.setData("text/plain", file.text);
  if (dragged) URL.revokeObjectURL(dragged);
  dragged = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  data.setData("DownloadURL", `${file.type.split(";")[0]}:${file.name}:${dragged}`);
}

/**
 * In the Mac app, the note dragged out of the window (NoteRow.svelte follows it inside): macOS
 * drags it on from where the pointer is, as a file, to Finder, the desktop, the Dock or any app
 * that takes files (src-tauri/src/drag_out.rs). Done once it's let go, wherever that is: brought
 * back into the window, it's still the note being dragged (panes.svelte.ts), not a file.
 */
export async function handNoteOut(note: Note, title: string) {
  const file = noteFile(note, title);
  const [{ invoke }, { once }] = await Promise.all([import("@tauri-apps/api/core"), import("@tauri-apps/api/event")]);
  let resolve!: () => void;
  const ended = new Promise<void>((done) => (resolve = done));
  const unlisten = await once("note-drag-ended", () => resolve());
  try {
    await invoke("drag_note_out", { name: file.name, text: file.text });
  } catch (error) {
    unlisten();
    throw error;
  }
  return ended;
}
