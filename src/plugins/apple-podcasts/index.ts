import { t } from "../../lib/i18n/index.svelte";
import { clock, dayOf, known } from "../../lib/library/text";
import { getJson, request } from "../../lib/library/web";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * Apple Podcasts: a podcast by a link to it there, found through Apple's iTunes Search API, which
 * gives its feed too, and an episode by a link to it (one of the podcast's latest). Only the ids in
 * the link are sent. Apple's API answers web pages too; most podcasts' feeds, read for what a podcast
 * is about, only the apps.
 */

const API = "https://itunes.apple.com/lookup";

/** The podcast a link to Apple Podcasts is, its store's country, and the episode, if it's one's. */
export function podcastIn(url: URL): { id: string; country?: string; episode?: string } | null {
  if (!/^(?:podcasts|itunes)\.apple\.com$/i.test(url.hostname)) return null;
  const match = /^\/(?:([a-z]{2})\/)?podcast\/(?:[^/]+\/)?id(\d+)/i.exec(url.pathname);
  if (!match) return null;
  const episode = url.searchParams.get("i");
  return { id: match[2], ...(match[1] && { country: match[1].toLowerCase() }), ...(episode && /^\d+$/.test(episode) && { episode }) };
}

/** A podcast or an episode, as the iTunes Search API gives it. */
interface Result {
  kind?: string;
  trackId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  artworkUrl600?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  episodeUrl?: string;
  description?: string;
  shortDescription?: string;
}

/** A link to Apple Podcasts without what Apple adds for its own counting (`uo=4`). */
function clean(link: string | undefined) {
  if (!link) return undefined;
  const url = new URL(link);
  url.searchParams.delete("uo");
  return url.href;
}

/** What a podcast is about, as its feed says; nothing where the feed can't be read (on the web, most). */
async function aboutOf(feed: string, signal: AbortSignal): Promise<string | undefined> {
  try {
    const response = await request(feed, signal);
    if (!response.ok) return undefined;
    const channel = new DOMParser().parseFromString(await response.text(), "application/xml").querySelector("channel");
    const own = [...(channel?.children ?? [])].find((child) => child.localName === "description" || child.localName === "summary");
    return own?.textContent?.trim() || undefined;
  } catch {
    signal.throwIfAborted();
    return undefined;
  }
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = podcastIn(url);
  if (!found) return null;
  const params = new URLSearchParams({ id: found.id, ...(found.country && { country: found.country }), ...(found.episode && { entity: "podcastEpisode", limit: "200" }) });
  const answer = await getJson<{ results?: Result[] }>(`${API}?${params}`, signal);
  const results = answer?.results ?? [];
  const podcast = results.find((result) => result.kind === "podcast");
  if (found.episode) {
    const episode = results.find((result) => String(result.trackId) === found.episode);
    if (!episode?.trackName) return null;
    return {
      type: "episode",
      title: episode.trackName,
      link: clean(episode.trackViewUrl) ?? url.href,
      properties: known([
        ["podcast", episode.collectionName],
        ["published", dayOf(episode.releaseDate)],
        ["duration", clock(episode.trackTimeMillis && episode.trackTimeMillis / 1000)],
        ["audio", episode.episodeUrl],
      ]),
      cover: episode.artworkUrl600 ?? podcast?.artworkUrl600,
      description: episode.description ?? episode.shortDescription,
    };
  }
  if (!podcast?.collectionName) return null;
  return {
    type: "podcast",
    title: podcast.collectionName,
    link: clean(podcast.collectionViewUrl) ?? url.href,
    properties: known([
      ["author", podcast.artistName],
      ["feed", podcast.feedUrl],
    ]),
    cover: podcast.artworkUrl600,
    description: podcast.feedUrl ? await aboutOf(podcast.feedUrl, signal) : undefined,
  };
}

/** Podcasts `text` names, as Apple's directory finds them, each with its feed. */
async function search(_type: string, text: string, signal: AbortSignal): Promise<LibraryItem[]> {
  const params = new URLSearchParams({ term: text, media: "podcast", entity: "podcast", limit: "20" });
  const answer = await getJson<{ results?: (Result & { artworkUrl100?: string })[] }>(`https://itunes.apple.com/search?${params}`, signal);
  return (answer?.results ?? []).flatMap((podcast) =>
    podcast.collectionName
      ? [
          {
            type: "podcast",
            title: podcast.collectionName,
            link: clean(podcast.collectionViewUrl),
            properties: known([
              ["author", podcast.artistName],
              ["feed", podcast.feedUrl],
            ]),
            cover: podcast.artworkUrl100,
          },
        ]
      : [],
  );
}

const source: LibrarySource = {
  id: "apple-podcasts",
  name: "Apple Podcasts",
  recognizes: (url) => podcastIn(url) !== null,
  key: (url) => {
    const found = podcastIn(url);
    return found && `apple-podcasts:${found.id}${found.episode ? `/${found.episode}` : ""}`;
  },
  lookup,
  searches: ["podcast"],
  search,
  feed: async (url, signal) => (await lookup(url, signal))?.properties.find(([key]) => key === "feed")?.[1] ?? null,
};

export const applePodcasts = (): Plugin => ({
  id: "apple-podcasts",
  name: "Apple Podcasts",
  description: t("plugins.applePodcasts.description"),
  icon: "podcast",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
