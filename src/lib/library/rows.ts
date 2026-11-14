import { type Scale, type Score, scoreIn } from "../editor/scores";
import { propertyOf, readMention } from "../notes/properties";
import type { Note, NoteMeta } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryKind } from "../plugins/types";
import { progressOf } from "../books/books";
import { OVERALL, ratings } from "./ratings.svelte";
import { coverOf } from "./text";

/** Progress worth a line: begun, and not finished. */
const unfinished = (progress: number | null) => (progress !== null && progress > 0 && progress < 1 ? progress : null);

/** What a library note's row on its shelf shows: its cover, what it's by, and where it's got to. */
export interface ShelfRow {
  kind: LibraryKind;
  /** Its cover, an attachment's name. */
  cover: string | null;
  /** Its kind's `subtitle` properties, joined: `Frank Herbert · 1965`. */
  subtitle: string;
  /** Its `status`, shown as its kind names it, or as written if it's one of your own. */
  status?: { value: string; label: string };
  /** How far through it is, 0 to 1, as its note says (`progress: 37%`), while it isn't finished. */
  progress: number | null;
}

const rows = new WeakMap<Note, ShelfRow | null>();

/**
 * What something of a kind is by and from, as its row says it: its kind's `subtitle` properties,
 * joined (`Frank Herbert · 1965`); one its kind writes as a mention (an episode's podcast,
 * `@[The Daily]`) as the note's title.
 */
export function subtitleOf(kind: LibraryKind, value: (key: string) => string | undefined): string {
  const shown = (key: string, text: string) => (kind.mentions?.includes(key) && readMention(text)?.name) || text;
  return kind.subtitle.flatMap((key) => {
    const text = value(key);
    return text ? [shown(key, text)] : [];
  }).join(" · ");
}

/** A library note's row, if its type is a library kind's; worked out once for each version of the note. */
export function shelfRow({ note, meta }: { note: Note; meta: NoteMeta }): ShelfRow | null {
  let row = rows.get(note);
  if (row === undefined) {
    const kind = plugins.libraryKind(meta.type);
    const value = (key: string) => propertyOf(meta.properties, key)?.value.trim() || undefined;
    const written = value("status");
    row = kind
      ? {
          kind,
          cover: coverOf(note.body),
          subtitle: subtitleOf(kind, value),
          status: written ? (kind.statuses?.find((status) => status.value === written.toLowerCase()) ?? { value: written, label: written }) : undefined,
          progress: unfinished(progressOf(value("progress"))),
        }
      : null;
    rows.set(note, row);
  }
  return row;
}

/** A library note's overall rating, on its kind's scale (as written, `score` null, where it doesn't fit), if it has one. Not kept with its row: the scale can change. */
export function ratingOf({ meta }: { meta: NoteMeta }): { score: Score | null; scale: Scale; written: string } | null {
  const written = propertyOf(meta.properties, OVERALL)?.value.trim();
  if (!written || !ratings.rated(meta.type)) return null;
  const scale = ratings.scaleOf(meta.type);
  return { score: scoreIn(written, scale), scale, written };
}
