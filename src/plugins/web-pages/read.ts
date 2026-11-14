import { absolute, imageOf, namesOf, type Page, textOf, typesOf } from "../../lib/library/page";
import { clock, dayOf, isoSeconds, known, names, runtime, yearOf } from "../../lib/library/text";
import type { LibraryItem } from "../../lib/plugins/types";
import { comicOf, comicTitle } from "./comics";

/*
 * What a page says it is, as a library item: from its JSON-LD (schema.org's Book, Movie, TVSeries,
 * VideoObject, MusicRecording, MusicAlbum, PodcastSeries, PodcastEpisode, Article and its kinds,
 * ScholarlyArticle, ComicSeries), or its Open Graph type (`og:type` video.movie, music.song, book,
 * article…); a book that's a comic, as comics.ts tells. A page that says none of these isn't
 * anything the library keeps: nothing is guessed.
 */

/** schema.org's types, as the library's kinds. */
const SCHEMA: Record<string, string> = {
  Book: "book",
  Audiobook: "book",
  ComicSeries: "comic",
  ComicIssue: "comic",
  ComicStory: "comic",
  Movie: "movie",
  TVSeries: "show",
  VideoObject: "video",
  MusicRecording: "song",
  MusicAlbum: "album",
  PodcastSeries: "podcast",
  PodcastEpisode: "episode",
  ScholarlyArticle: "paper",
  Article: "article",
  BlogPosting: "article",
  NewsArticle: "article",
  AnalysisNewsArticle: "article",
  OpinionNewsArticle: "article",
  ReportageNewsArticle: "article",
  ReviewNewsArticle: "article",
  BackgroundNewsArticle: "article",
  TechArticle: "article",
  Report: "article",
};

/** Open Graph's types, as the library's kinds. */
const OPEN_GRAPH: Record<string, string> = {
  "video.movie": "movie",
  "video.tv_show": "show",
  "video.other": "video",
  "music.song": "song",
  "music.album": "album",
  book: "book",
  "books.book": "book",
  article: "article",
};

const kindOf = (object: Record<string, unknown>) => typesOf(object).map((type) => SCHEMA[type]).find(Boolean);

/** A `<meta>` tag's content that's text, not a link to a profile (as `article:author` often is). */
function said(page: Page, ...keys: string[]) {
  for (const key of keys) {
    const value = page.meta.get(key);
    if (value && !/^https?:\/\//.test(value)) return value;
  }
  return undefined;
}

/** A number of seconds a `<meta>` tag says (`music:duration`, `video:duration`). */
const seconds = (page: Page, key: string) => Number(page.meta.get(key)) || undefined;

/**
 * Artist, album and year from a description written as music streaming pages write theirs:
 * `Rick Astley · Whenever You Need Somebody · Song · 1987`.
 */
function musicLine(description: string | undefined) {
  const parts = description?.split(" · ").map((part) => part.trim()) ?? [];
  const at = parts.findIndex((part) => /^(?:song|single|album|ep)$/i.test(part));
  if (at < 1) return {};
  return { artist: parts[0], album: at > 1 ? parts[1] : undefined, year: yearOf(parts[at + 1]) };
}

/** What a page says of something of `type`, from its JSON-LD object (`o`) and its tags; a comic's `format` as comics.ts read it. */
function propertiesOf(type: string, o: Record<string, unknown>, page: Page, format?: string): [string, string | number | undefined][] {
  const music = musicLine(said(page, "og:description"));
  switch (type) {
    case "comic":
      return [
        // Where JSON-LD doesn't say, its author as the site's own tags do (`com-linewebtoon:webtoon:author`).
        ["author", names(namesOf(o.author ?? o.creator)) ?? said(page, "book:author", ...[...page.meta.keys()].filter((key) => key.endsWith(":author")))],
        ["artist", names(namesOf(o.illustrator ?? o.artist ?? o.penciler))],
        ["format", format],
        ["year", yearOf(o.datePublished ?? o.startDate ?? o.dateCreated)],
      ];
    case "book":
      return [
        ["author", names(namesOf(o.author)) ?? said(page, "book:author")],
        ["year", yearOf(o.datePublished ?? page.meta.get("book:release_date"))],
        ["pages", textOf(o.numberOfPages)],
        ["publisher", textOf(o.publisher)],
        ["isbn", textOf(o.isbn) ?? said(page, "book:isbn")],
      ];
    case "movie":
      return [
        ["director", names(namesOf(o.director))],
        ["year", yearOf(o.datePublished ?? o.dateCreated ?? page.meta.get("video:release_date"))],
        ["runtime", runtime(isoSeconds(o.duration) ?? seconds(page, "video:duration"))],
        ["genre", names(namesOf(o.genre))],
      ];
    case "show":
      return [
        ["creator", names(namesOf(o.creator ?? o.author))],
        ["year", yearOf(o.startDate ?? o.datePublished)],
        ["seasons", textOf(o.numberOfSeasons)],
        ["genre", names(namesOf(o.genre))],
      ];
    case "video":
      return [
        ["channel", names(namesOf(o.author ?? o.creator))],
        ["published", dayOf(o.uploadDate ?? o.datePublished ?? page.meta.get("uploaddate") ?? page.meta.get("datepublished"))],
        ["duration", clock(isoSeconds(o.duration ?? page.meta.get("duration")) ?? seconds(page, "video:duration"))],
      ];
    case "song":
      return [
        ["artist", names(namesOf(o.byArtist)) ?? music.artist],
        ["album", textOf(o.inAlbum) ?? music.album],
        ["year", yearOf(o.datePublished) ?? music.year],
        ["duration", clock(isoSeconds(o.duration) ?? seconds(page, "music:duration"))],
      ];
    case "album":
      return [
        ["artist", names(namesOf(o.byArtist)) ?? music.artist],
        ["year", yearOf(o.datePublished) ?? music.year],
        ["tracks", textOf(o.numTracks) ?? (Array.isArray(o.track) && o.track.length ? o.track.length : undefined)],
      ];
    case "podcast":
      return [
        ["author", names(namesOf(o.author))],
        ["feed", textOf(o.webFeed) ?? page.links.find((link) => link.rel.includes("alternate") && /(?:rss|atom)\+xml/.test(link.type))?.href],
      ];
    case "episode":
      return [
        ["podcast", textOf(o.partOfSeries)],
        ["published", dayOf(o.datePublished)],
        ["duration", clock(isoSeconds(o.duration ?? o.timeRequired))],
        ["audio", imageOf(o.associatedMedia ?? o.audio)],
      ];
    case "paper":
      return [
        ["authors", names(namesOf(o.author))],
        ["year", yearOf(o.datePublished)],
      ];
    default:
      return [
        ["author", names(namesOf(o.author)) ?? said(page, "article:author", "author")],
        ["site", textOf(o.publisher) ?? said(page, "og:site_name")],
        ["published", dayOf(o.datePublished ?? page.meta.get("article:published_time"))],
      ];
  }
}

/** What the page says it is, if it's something the library keeps. */
export function itemOfPage(page: Page): LibraryItem | null {
  const graph = OPEN_GRAPH[page.meta.get("og:type")?.toLowerCase() ?? ""];
  // The thing the page is about: the one its Open Graph type says, or else the first of a kind.
  const found = page.data.find((each) => graph && kindOf(each) === graph) ?? page.data.find((each) => kindOf(each)) ?? {};
  const told = kindOf(found) ?? graph;
  // A book, or a page that doesn't say what it's about, may be a comic.
  const comic = !told || told === "book" || told === "comic" ? comicOf(page) : null;
  const type = comic ? "comic" : told;
  const object = comic?.object ?? found;
  const named = textOf(object.name) ?? textOf(object.headline) ?? said(page, "og:title", "twitter:title") ?? page.title;
  const title = comic && named ? comicTitle(named, page.url) : named;
  if (!type || !title) return null;
  const cover = imageOf(object.image) ?? imageOf(object.thumbnailUrl) ?? page.meta.get("og:image") ?? page.meta.get("twitter:image");
  return {
    type,
    title,
    link: page.url,
    properties: known(propertiesOf(type, object, page, comic?.format)),
    cover: (cover && absolute(cover, page.url)) || undefined,
    description: textOf(object.description) ?? said(page, "og:description", "twitter:description", "description"),
  };
}
