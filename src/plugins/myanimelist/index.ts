import { t } from "../../lib/i18n/index.svelte";
import { known, names, seasonOf, yearOf } from "../../lib/library/text";
import { getJson } from "../../lib/library/web";
import { pacing } from "../../lib/pacing";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * MyAnimeList (myanimelist.net): an anime by a link to it there, asked of Jikan (jikan.moe), the
 * open API that reads MyAnimeList for apps without an account or a key. Only the id in the link is
 * sent. Jikan asks for no more than three requests a second and sixty a minute, so lines asks once
 * a second at most.
 */

export const JIKAN = "https://api.jikan.moe/v4";
const paced = pacing(1000);

/** The anime a link is to on MyAnimeList, by its id: `myanimelist.net/anime/52991/Sousou_no_Frieren`. */
export function animeIn(url: URL): number | null {
  if (!/^(?:www\.)?myanimelist\.net$/i.test(url.hostname)) return null;
  const id = /^\/anime\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1];
  return id ? Number(id) : null;
}

/** An anime, as Jikan says what MyAnimeList has of it. */
interface Anime {
  mal_id: number;
  url?: string;
  titles?: { type: string; title: string }[];
  title?: string;
  type?: string | null;
  episodes?: number | null;
  season?: string | null;
  year?: number | null;
  aired?: { from?: string | null } | null;
  studios?: { name: string }[];
  synopsis?: string | null;
  images?: { jpg?: { large_image_url?: string | null; image_url?: string | null } };
}

/** An anime as a library item: its English title where it has one, else its own. */
function animeOf(anime: Anime): LibraryItem | null {
  const titled = (type: string) => anime.titles?.find((each) => each.type === type)?.title;
  const title = titled("English") ?? titled("Default") ?? anime.title;
  if (!title) return null;
  const year = anime.year ?? yearOf(anime.aired?.from ?? undefined);
  return {
    type: "anime",
    title,
    link: anime.url ?? `https://myanimelist.net/anime/${anime.mal_id}`,
    properties: known([
      ["format", anime.type ?? undefined],
      ["studio", names(anime.studios?.map((studio) => studio.name) ?? [])],
      ["year", yearOf(year ?? undefined)],
      ["season", seasonOf(anime.season, year)],
      ["episodes", anime.episodes || undefined],
      ["mal", anime.mal_id],
    ]),
    cover: anime.images?.jpg?.large_image_url ?? anime.images?.jpg?.image_url ?? undefined,
    // Without the credit MyAnimeList puts at its end.
    description: anime.synopsis?.replace(/\s*\[Written by MAL Rewrite\]\s*$/i, "") || undefined,
  };
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const id = animeIn(url);
  if (id === null) return null;
  const found = await paced(() => getJson<{ data?: Anime }>(`${JIKAN}/anime/${id}/full`, signal), signal);
  return found?.data ? animeOf(found.data) : null;
}

const source: LibrarySource = {
  id: "myanimelist",
  name: "MyAnimeList",
  recognizes: (url) => animeIn(url) !== null,
  lookup,
};

export const myanimelist = (): Plugin => ({
  id: "myanimelist",
  name: "MyAnimeList",
  description: t("plugins.myanimelist.description"),
  icon: "tv-minimal-play",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
