import { t } from "../../lib/i18n/index.svelte";
import { linkLookups } from "../../lib/library/linkNotes";
import type { LibraryKind, Plugin } from "../../lib/plugins/types";

/*
 * The library (docs/library.md): books, movies, music and the rest, each a note with a `type`, listed
 * in the sidebar's Library; and a Markdown note that's just a link, looked up and filled in with what
 * the link is, by the sources other plugins add (src/plugins/web-pages, youtube…).
 */

/** Where something read, watched or listened to has got to, as written (English, the same on every device) and shown. */
const READ = [
  { value: "to read", label: t("library.status.toRead") },
  { value: "reading", label: t("library.status.reading") },
  { value: "read", label: t("library.status.read") },
];
const WATCHED = [
  { value: "to watch", label: t("library.status.toWatch") },
  { value: "watching", label: t("library.status.watching") },
  { value: "watched", label: t("library.status.watched") },
];
const LISTENED = [
  { value: "to listen", label: t("library.status.toListen") },
  { value: "listening", label: t("library.status.listening") },
  { value: "listened", label: t("library.status.listened") },
];

const KINDS: LibraryKind[] = [
  {
    type: "book",
    name: t("library.book"),
    label: t("library.books"),
    icon: "book-open",
    properties: ["author", "year", "pages", "publisher", "isbn"],
    subtitle: ["author", "year"],
    cover: "tall",
    statuses: READ,
  },
  {
    type: "movie",
    name: t("library.movie"),
    label: t("library.movies"),
    icon: "film",
    properties: ["director", "year", "runtime", "genre"],
    subtitle: ["director", "year"],
    cover: "tall",
    statuses: WATCHED,
  },
  {
    type: "show",
    name: t("library.show"),
    label: t("library.shows"),
    icon: "tv",
    properties: ["creator", "year", "seasons", "genre"],
    subtitle: ["creator", "year"],
    cover: "tall",
    statuses: WATCHED,
  },
  {
    type: "video",
    name: t("library.video"),
    label: t("library.videos"),
    icon: "square-play",
    properties: ["channel", "published", "duration"],
    subtitle: ["channel", "duration"],
    cover: "wide",
    statuses: WATCHED,
  },
  {
    type: "song",
    name: t("library.song"),
    label: t("library.music"),
    icon: "music",
    properties: ["artist", "album", "year", "duration"],
    subtitle: ["artist", "album"],
    statuses: LISTENED,
  },
  {
    type: "album",
    name: t("library.album"),
    label: t("library.music"),
    icon: "music",
    shelf: "song",
    properties: ["artist", "year", "tracks"],
    subtitle: ["artist", "year"],
    statuses: LISTENED,
  },
  {
    type: "podcast",
    name: t("library.podcast"),
    label: t("library.podcasts"),
    icon: "podcast",
    properties: ["author", "feed"],
    subtitle: ["author"],
  },
  {
    type: "episode",
    name: t("library.episode"),
    label: t("library.episodes"),
    icon: "headphones",
    properties: ["podcast", "published", "duration", "audio"],
    subtitle: ["podcast", "duration"],
    mentions: ["podcast"],
    statuses: LISTENED,
  },
  {
    type: "article",
    name: t("library.article"),
    label: t("library.articles"),
    icon: "newspaper",
    properties: ["author", "site", "published"],
    subtitle: ["author", "site"],
    cover: "wide",
    statuses: READ,
  },
  {
    type: "paper",
    name: t("library.paper"),
    label: t("library.papers"),
    icon: "graduation-cap",
    properties: ["authors", "year", "arxiv"],
    subtitle: ["authors", "year"],
    cover: "tall",
    statuses: READ,
  },
];

export const library = (): Plugin => ({
  id: "library",
  name: t("plugins.library.name"),
  description: t("plugins.library.description"),
  icon: "library",
  enabledByDefault: true,
  contributes: {
    libraryKinds: KINDS,
    markdown: [{ editor: linkLookups }],
  },
});
