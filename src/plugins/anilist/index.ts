import { t } from "../../lib/i18n/index.svelte";
import { known, names, seasonOf, yearOf } from "../../lib/library/text";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";
import { ask, MEDIA, type Media } from "./api";

/*
 * AniList (anilist.co), an open catalog of anime: an anime by a link to it there, and anime searched
 * for in Add to Library, with their ids on AniList and MyAnimeList, so each is known on both. Only the
 * id in the link, or the words searched for, is sent. It answers web pages too, and needs no account.
 */

/** The anime a link is to on AniList, by its id: `anilist.co/anime/154587/Sousou-no-Frieren`. */
export function animeIn(url: URL): number | null {
  if (!/^(?:www\.)?anilist\.co$/i.test(url.hostname)) return null;
  const id = /^\/anime\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1];
  return id ? Number(id) : null;
}

/** AniList's formats as a note writes them. */
const FORMATS: Record<string, string> = { TV: "TV", TV_SHORT: "TV Short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music" };

/** An anime as a library item: its English title where it has one, else as it's written in Japanese, in Latin letters. */
export function animeOf(media: Media, cover = media.coverImage?.extraLarge ?? media.coverImage?.large): LibraryItem | null {
  const title = media.title?.english ?? media.title?.romaji ?? media.title?.native;
  if (!title) return null;
  const year = media.seasonYear ?? media.startDate?.year;
  return {
    type: "anime",
    title,
    link: media.siteUrl ?? `https://anilist.co/anime/${media.id}`,
    properties: known([
      ["format", media.format ? (FORMATS[media.format] ?? media.format) : undefined],
      ["studio", names(media.studios?.nodes?.map((studio) => studio.name) ?? [])],
      ["year", yearOf(year ?? undefined)],
      ["season", seasonOf(media.season, year)],
      ["episodes", media.episodes || undefined],
      ["anilist", media.id],
      ["mal", media.idMal || undefined],
    ]),
    cover: cover ?? undefined,
    description: media.description ?? undefined,
  };
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const id = animeIn(url);
  if (id === null) return null;
  const found = await ask<{ Media: Media | null }>(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA} description(asHtml: false) } }`, { id }, signal);
  return found.Media ? animeOf(found.Media) : null;
}

/** Anime `text` names, the best match first, their covers small; none for adults only. */
async function search(_type: string, text: string, signal: AbortSignal): Promise<LibraryItem[]> {
  const found = await ask<{ Page: { media: Media[] } }>(
    `query ($search: String) { Page(perPage: 15) { media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { ${MEDIA} } } }`,
    { search: text },
    signal,
  );
  return found.Page.media.flatMap((media) => animeOf(media, media.coverImage?.medium ?? media.coverImage?.large) ?? []);
}

const source: LibrarySource = {
  id: "anilist",
  name: "AniList",
  recognizes: (url) => animeIn(url) !== null,
  lookup,
  searches: ["anime"],
  search,
};

export const anilist = (): Plugin => ({
  id: "anilist",
  name: "AniList",
  description: t("plugins.anilist.description"),
  icon: "tv-minimal-play",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
