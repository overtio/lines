import { linkKey } from "../../lib/library/bookmarks";
import type { ImportWork, NewNote } from "../../lib/library/imports.svelte";
import { nameOf, propertyOf } from "../../lib/notes/properties";
import type { Entry } from "../../lib/notes/store.svelte";
import { isClosed } from "../../lib/notes/types";
import { plugins } from "../../lib/plugins/registry.svelte";
import type { Found, Highlight, Source } from "./sources";
import { HIGHLIGHTS, hasHighlights, highlightText, moreOf, quotesOf } from "./write";

/*
 * What importing what Readwise has would write, against the notes there are: a note for each thing
 * lines hasn't got, and the highlights a note there hasn't got, added at its end; nothing else of a
 * note there is changed. Something's found in lines by Readwise's or Reader's id an import kept in
 * its note (`readwise:`, `reader:`), its link, or its kind, title and who it's by (both saying who,
 * and not linking to different pages). So importing again adds only what's new, and two copies of
 * one book in Readwise (Kindle's and Apple Books') are one note.
 */

/** Who something's by, by its kind: the property telling things of one title apart. */
const BY: Record<string, string> = { book: "author", article: "author", episode: "podcast", video: "channel", paper: "authors" };

/** A note an import writes to: one there (`id`), or one to make for `source`; the highlights it gets, and which it has. */
interface Target {
  id?: string;
  title: string;
  /** Its text, for one there. */
  body?: string;
  source?: Source;
  highlights: Highlight[];
  /** Whether it hasn't got `highlight` (and has it from now on). A locked note that's closed can't be added to. */
  take: (highlight: Highlight) => boolean;
}

export interface Plan {
  work: ImportWork;
  /** New notes, by kind (`book`). */
  kinds: Map<string, number>;
  /** Highlights in new notes. */
  highlights: number;
  /** Highlights added to notes there, and those notes' titles. */
  adding: number;
  addingTo: string[];
  leftOut: number;
}

/** Where its kind's statuses say something's got to (`to read`, `reading`, `read`), or nowhere where Readwise doesn't say. */
function statusOf({ item, progress }: Source) {
  const statuses = plugins.libraryKind(item.type)?.statuses;
  if (progress === undefined || !statuses?.length) return null;
  return statuses[Math.min(progress, statuses.length - 1)].value;
}

/** What tells where something is in lines. */
interface Keys {
  readwise?: string;
  reader?: string;
  link?: string;
  type?: string;
  title: string;
  by?: string;
}

const keysOf = ({ readwise, reader, item }: Source): Keys => ({
  readwise: readwise?.toString(),
  reader,
  link: item.link,
  type: item.type,
  title: item.title,
  by: BY[item.type] && item.properties.find(([key]) => key === BY[item.type])?.[1],
});

const titleKey = (type: string, title: string, by: string) => `${type}\n${nameOf(title)}\n${nameOf(by)}`;

/** Which highlights a note's `body` has, read the first time it's asked (most notes there never are). */
function takes(body: string) {
  let quotes: ReturnType<typeof quotesOf> | undefined;
  return (highlight: Highlight) => (quotes ??= quotesOf(body)).take(highlight);
}

/** The notes there are, as an import finds what's in them; and those it plans to make, found the same way. */
class Notes {
  #ids = new Map<string, Target>();
  #links = new Map<string, Target>();
  #titles = new Map<string, { target: Target; link?: string }[]>();
  there: Target[] = [];
  fresh: Target[] = [];

  constructor(entries: Entry[]) {
    for (const { note, meta } of entries) {
      if (note.trashed) continue;
      const value = (key: string) => propertyOf(meta.properties, key)?.value.trim() || undefined;
      const closed = isClosed(note);
      const target: Target = { id: note.id, title: meta.title, body: note.body, highlights: [], take: closed ? () => false : takes(note.body) };
      this.there.push(target);
      // By its link only if it's a note of a kind (a typed note); by its title only if a kind Readwise has.
      const by = BY[meta.type];
      this.#add(target, { readwise: value("readwise"), reader: value("reader"), link: meta.type ? value("link") : undefined, type: meta.type, title: meta.title, by: by && value(by) });
    }
  }

  #add(target: Target, { readwise, reader, link, type, title, by }: Keys) {
    const keep = (map: Map<string, Target>, key: string | undefined) => {
      if (key && !map.has(key)) map.set(key, target);
    };
    keep(this.#ids, readwise && `readwise:${readwise}`);
    keep(this.#ids, reader && `reader:${reader}`);
    keep(this.#links, link && linkKey(link));
    if (type && by) {
      const key = titleKey(type, title, by);
      const same = this.#titles.get(key);
      if (same) same.push({ target, link });
      else this.#titles.set(key, [{ target, link }]);
    }
  }

  /** Where `source` goes: the note there is of it, or planned; or a note to make for it, found from now on as the rest are. */
  of(source: Source): Target {
    const { readwise, reader, link, type, title, by } = keysOf(source);
    const found =
      (readwise && this.#ids.get(`readwise:${readwise}`)) ||
      (reader && this.#ids.get(`reader:${reader}`)) ||
      (link && this.#links.get(linkKey(link))) ||
      (type && by && this.#titles.get(titleKey(type, title, by))?.find((each) => !each.link || !link || linkKey(each.link) === linkKey(link))?.target);
    if (found) return found;
    const target: Target = { title, source, highlights: [], take: takes("") };
    this.fresh.push(target);
    this.#add(target, keysOf(source));
    return target;
  }
}

/** The new note for a source: the library's note of it, with Readwise's and Reader's ids, where it's got to, and its highlights after. */
function newNote(source: Source, highlights: Highlight[]): NewNote {
  const ids = (
    [
      ["readwise", source.readwise?.toString()],
      ["reader", source.reader],
    ] as const
  ).flatMap(([key, value]): [string, string][] => (value ? [[key, value]] : []));
  return {
    item: { ...source.item, properties: [...source.item.properties, ...ids] },
    status: statusOf(source),
    more: moreOf({ ...source, highlights }),
    created: source.created,
    updated: source.updated,
  };
}

/** What importing `found` writes, with the notes there are, `entries`. */
export function plan({ sources, leftOut }: Found, entries: Entry[]): Plan {
  const notes = new Notes(entries);
  for (const source of sources) {
    const target = notes.of(source);
    for (const highlight of source.highlights) if (target.take(highlight)) target.highlights.push(highlight);
  }
  const adding = notes.there.filter((target) => target.highlights.length);
  const kinds = new Map<string, number>();
  for (const { source } of notes.fresh) kinds.set(source!.item.type, (kinds.get(source!.item.type) ?? 0) + 1);
  return {
    work: {
      add: notes.fresh.map((target) => newNote(target.source!, target.highlights)),
      append: adding.map(({ id, body, highlights }) => ({
        id: id!,
        text: [...(hasHighlights(body!) ? [] : [HIGHLIGHTS]), ...highlights.map(highlightText)].join("\n\n"),
      })),
    },
    kinds,
    highlights: notes.fresh.reduce((sum, target) => sum + target.highlights.length, 0),
    adding: adding.reduce((sum, target) => sum + target.highlights.length, 0),
    addingTo: adding.map((target) => target.title),
    leftOut,
  };
}
