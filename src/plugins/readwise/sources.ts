import { known, libraryTag, yearOf } from "../../lib/library/text";
import { dayOf } from "../../lib/notes/calendar";
import type { LibraryItem } from "../../lib/plugins/types";

/*
 * What Readwise keeps, as its API gives it (https://readwise.io/api_deets, https://readwise.io/reader_api),
 * and each thing in it as the library has it: a book, an article, an episode… with the highlights
 * made in it. Readwise's export gives every source of highlights (Kindle's books, articles,
 * podcasts, tweets, and what was read in Reader); Reader's list gives what was saved there, read or
 * not, and where it's got to. A document read in Reader is in both, and is one thing here.
 */

/** A source of highlights in Readwise's export (`/api/v2/export/`). */
export interface ExportBook {
  user_book_id: number;
  is_deleted?: boolean;
  title: string;
  readable_title?: string | null;
  author?: string | null;
  /** Where Readwise has it from: `kindle`, `reader`, `snipd`… */
  source?: string | null;
  cover_image_url?: string | null;
  unique_url?: string | null;
  book_tags?: { name: string }[];
  /** `books`, `articles`, `tweets`, `podcasts` or `supplementals`. */
  category: string;
  document_note?: string | null;
  summary?: string | null;
  source_url?: string | null;
  /** Reader's id of the document, for one read there. */
  external_id?: string | null;
  asin?: string | null;
  highlights: ExportHighlight[];
}

export interface ExportHighlight {
  id: number;
  is_deleted?: boolean;
  text: string;
  location?: number | null;
  /** `location` (Kindle's), `page`, `order`, `offset`, `time_offset` (seconds into a recording) or `none`. */
  location_type?: string | null;
  note?: string | null;
  highlighted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** The highlight's own page: a tweet, a podcast's snippet. */
  url?: string | null;
  tags?: { name: string }[];
}

/** A document saved in Reader (`/api/v3/list/`). */
export interface ReaderDocument {
  id: string;
  source_url?: string | null;
  title?: string | null;
  author?: string | null;
  /** `article`, `email`, `rss`, `pdf`, `epub`, `tweet`, `video`; and `highlight` and `note`, which belong to another (`parent_id`). */
  category: string;
  /** `new`, `later`, `shortlist`, `archive` or `feed`. */
  location?: string | null;
  tags?: Record<string, { name: string }> | { name: string }[] | null;
  site_name?: string | null;
  published_date?: string | number | null;
  summary?: string | null;
  image_url?: string | null;
  notes?: string | null;
  parent_id?: string | null;
  reading_progress?: number | null;
  saved_at?: string | null;
  updated_at?: string | null;
}

/** A highlight, as a note shows it. */
export interface Highlight {
  text: string;
  /** What the person wrote about it. */
  note?: string;
  /** Where it is in the source, if it says: a page, a Kindle location, a time into a recording (seconds). */
  where?: { kind: "page" | "location" | "time"; at: number };
  /** Its own page (a tweet, a podcast's snippet). */
  url?: string;
  /** The day it was made, here: `2024-03-01`. */
  day?: string;
  /** As lines writes tags. */
  tags: string[];
}

/** Something from Readwise, as a note: the library's item, Readwise's and Reader's ids of it, where it's got to, and its highlights. */
export interface Source {
  /** Readwise's id of it (`readwise:`), and Reader's (`reader:`), kept in its note so importing again finds it. */
  readwise?: number;
  reader?: string;
  item: LibraryItem;
  /** Where it's got to, from Reader: started (1) or done (2), or neither (0). Undefined where Readwise doesn't say. */
  progress?: 0 | 1 | 2;
  /** What the person wrote about the whole of it. */
  note?: string;
  highlights: Highlight[];
  /** When it was saved or first highlighted, and last changed (ms). */
  created?: number;
  updated?: number;
}

/** What's in Readwise and Reader together, and what's left out. */
export interface Found {
  sources: Source[];
  /** Readwise's supplemental books (quotes it suggests), which aren't the person's own. */
  leftOut: number;
}

/** The kind of note each category of Readwise's export is. */
const CATEGORIES = new Map([
  ["books", "book"],
  ["articles", "article"],
  ["podcasts", "episode"],
  ["tweets", "article"],
]);
/** The same for Reader's. A PDF saved there is most often a paper. */
const READER_CATEGORIES = new Map([
  ["article", "article"],
  ["email", "article"],
  ["rss", "article"],
  ["tweet", "article"],
  ["epub", "book"],
  ["pdf", "paper"],
  ["video", "video"],
]);
/** Where a highlight is, by Readwise's kinds of location that say (not `order`, `offset` or `none`). */
const PLACES = new Map<string, NonNullable<Highlight["where"]>["kind"]>([
  ["page", "page"],
  ["location", "location"],
  ["time_offset", "time"],
]);

/** The picture Readwise shows for something without a cover of its own: none, to the library. */
const placeholder = (url: string) => /^https:\/\/(?:readwise\.io|readwise-assets\.s3\.amazonaws\.com)\/static\/images\//.test(url);

/** A moment as Readwise writes it (ISO 8601, UTC), in ms; undefined for anything else. */
function time(date: string | null | undefined) {
  const ms = date ? Date.parse(date) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

/** The day a moment was, here. */
const localDay = (ms: number | undefined) => (ms === undefined ? undefined : dayOf(ms));

/** Reader's published date: a day as written (`2017-08-09`), or a moment in ms, as the day it was here. */
function publishedDay(date: string | number | null | undefined) {
  if (typeof date === "number") return Number.isFinite(date) && Math.abs(date) < 8.64e15 ? dayOf(date) : undefined;
  return typeof date === "string" ? /^\d{4}-\d{2}-\d{2}/.exec(date.trim())?.[0] : undefined;
}

/** A web address, or nothing. */
function web(url: string | null | undefined) {
  if (!url?.trim()) return undefined;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

const siteOf = (link: string | undefined) => (link ? new URL(link).hostname.replace(/^www\./, "") : undefined);

/** Readwise's or Reader's tags, as lines writes tags, each once. */
const tagsOf = (...lists: (ReaderDocument["tags"] | ExportBook["book_tags"])[]) => [
  ...new Set(lists.flatMap((tags) => (tags ? Object.values(tags).flatMap(({ name }) => libraryTag([name]) ?? []) : []))),
];

/** Its properties, in its kind's order (src/plugins/library), from what Readwise knows of it. */
function propertiesOf(type: string, { author, site, published }: { author?: string; site?: string; published?: string }): [string, string][] {
  switch (type) {
    case "article":
      return known([["author", author], ["site", site], ["published", published]]);
    case "episode":
      return known([["podcast", author], ["published", published]]);
    case "video":
      return known([["channel", author ?? site], ["published", published]]);
    case "paper":
      return known([["authors", author], ["year", yearOf(published)]]);
    default:
      return known([["author", author]]);
  }
}

function highlightOf(highlight: ExportHighlight): Highlight {
  const at = highlight.location ?? undefined;
  const kind = PLACES.get(highlight.location_type ?? "");
  return {
    text: highlight.text.trim(),
    note: highlight.note?.trim() || undefined,
    where: kind && at !== undefined && Number.isFinite(at) ? { kind, at } : undefined,
    url: web(highlight.url),
    day: localDay(time(highlight.highlighted_at) ?? time(highlight.created_at)),
    tags: tagsOf(highlight.tags),
  };
}

/** Its highlights in the order they're in it, those without a place in it by when they were made. */
function highlightsOf(book: ExportBook): ExportHighlight[] {
  return book.highlights
    .filter((highlight) => !highlight.is_deleted && highlight.text?.trim())
    .sort((a, b) => (a.location ?? Infinity) - (b.location ?? Infinity) || (time(a.highlighted_at) ?? 0) - (time(b.highlighted_at) ?? 0));
}

/** Where a Reader document has got to: done once it's archived, started once it's been read into. */
const progressOf = (document: ReaderDocument): 0 | 1 | 2 => (document.location === "archive" ? 2 : (document.reading_progress ?? 0) > 0 ? 1 : 0);

/**
 * Everything Readwise's export and Reader's list give, as notes to write: each source of highlights,
 * with what Reader knows of it where it was read there, then what was saved in Reader and not
 * highlighted. Deleted highlights and sources, Readwise's supplemental books, what's in Reader's Feed
 * (not saved), and Reader's highlights and notes (in the export already) are left out.
 */
export function sourcesOf(books: ExportBook[], documents: ReaderDocument[]): Found {
  const saved = documents.filter((document) => !document.parent_id && READER_CATEGORIES.has(document.category) && document.location !== "feed");
  const byId = new Map(saved.map((document) => [document.id, document]));
  const byLink = new Map(saved.flatMap((document) => (web(document.source_url) ? [[web(document.source_url)!, document] as const] : [])));
  const used = new Set<ReaderDocument>();
  const sources: Source[] = [];
  let leftOut = 0;

  for (const book of books) {
    if (book.is_deleted) continue;
    const category = CATEGORIES.get(book.category);
    if (category === undefined) {
      leftOut++;
      continue;
    }
    const reader = (book.external_id && byId.get(book.external_id)) || byLink.get(web(book.source_url) ?? "");
    if (reader) used.add(reader);
    const type = reader ? READER_CATEGORIES.get(reader.category)! : category;
    const link = web(reader?.source_url) ?? web(book.source_url) ?? web(book.unique_url);
    const highlights = highlightsOf(book);
    const dates = highlights.flatMap((highlight) => [time(highlight.highlighted_at), time(highlight.updated_at)]).filter((ms) => ms !== undefined);
    const cover = web(reader?.image_url) ?? web(book.cover_image_url);
    sources.push({
      readwise: book.user_book_id,
      reader: reader?.id,
      item: {
        type,
        title: reader?.title?.trim() || book.readable_title?.trim() || book.title?.trim() || link || String(book.user_book_id),
        link,
        properties: propertiesOf(type, {
          author: reader?.author?.trim() || book.author?.trim() || undefined,
          site: reader?.site_name?.trim() || siteOf(link),
          published: publishedDay(reader?.published_date),
        }),
        cover: cover && !placeholder(cover) ? cover : undefined,
        description: reader?.summary?.trim() || book.summary?.trim() || undefined,
        tags: tagsOf(book.book_tags, reader?.tags),
      },
      progress: reader && progressOf(reader),
      note: reader?.notes?.trim() || book.document_note?.trim() || undefined,
      highlights: highlights.map(highlightOf),
      created: time(reader?.saved_at) ?? (dates.length ? dates.reduce((a, b) => Math.min(a, b)) : undefined),
      updated: dates.reduce((a, b) => Math.max(a, b), time(reader?.updated_at) ?? 0) || undefined,
    });
  }

  for (const document of saved) {
    if (used.has(document)) continue;
    const type = READER_CATEGORIES.get(document.category)!;
    const link = web(document.source_url);
    const cover = web(document.image_url);
    sources.push({
      reader: document.id,
      item: {
        type,
        title: document.title?.trim() || link || document.id,
        link,
        properties: propertiesOf(type, { author: document.author?.trim() || undefined, site: document.site_name?.trim() || siteOf(link), published: publishedDay(document.published_date) }),
        cover: cover && !placeholder(cover) ? cover : undefined,
        description: document.summary?.trim() || undefined,
        tags: tagsOf(document.tags),
      },
      progress: progressOf(document),
      note: document.notes?.trim() || undefined,
      highlights: [],
      created: time(document.saved_at),
      updated: time(document.updated_at),
    });
  }
  return { sources, leftOut };
}
