import { propertyOf, readMention } from "../notes/properties";
import type { Note, NoteMeta } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryKind } from "../plugins/types";
import { coverOf } from "./text";

/** What a library note's row on its shelf shows: its cover, what it's by, and where it's got to. */
export interface ShelfRow {
  kind: LibraryKind;
  /** Its cover, an attachment's name. */
  cover: string | null;
  /** Its kind's `subtitle` properties, joined: `Frank Herbert · 1965`. */
  subtitle: string;
  /** Its `status`, shown as its kind names it, or as written if it's one of your own. */
  status?: { value: string; label: string };
}

const rows = new WeakMap<Note, ShelfRow | null>();

/** A library note's row, if its type is a library kind's; worked out once for each version of the note. */
export function shelfRow({ note, meta }: { note: Note; meta: NoteMeta }): ShelfRow | null {
  let row = rows.get(note);
  if (row === undefined) {
    const kind = plugins.libraryKind(meta.type);
    const value = (key: string) => propertyOf(meta.properties, key)?.value.trim() || undefined;
    // A mention (an episode's podcast, `@[The Daily]`) reads as the note's title.
    const shown = (text: string) => readMention(text)?.name ?? text;
    const written = value("status");
    row = kind
      ? {
          kind,
          cover: coverOf(note.body),
          subtitle: kind.subtitle.flatMap((key) => value(key) ?? []).map(shown).join(" · "),
          status: written ? (kind.statuses?.find((status) => status.value === written.toLowerCase()) ?? { value: written, label: written }) : undefined,
        }
      : null;
    rows.set(note, row);
  }
  return row;
}
