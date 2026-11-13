import { drawSitePlayer, type SitePlayer, webLink } from "../../lib/editor/sitePlayer";
import { t } from "../../lib/i18n/index.svelte";
import type { Page } from "../../lib/library/page";
import { clock, known } from "../../lib/library/text";
import { getJson, getPage } from "../../lib/library/web";
import { isTauri } from "../../lib/platform";
import type { Embed, LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";
import { itemOfPage } from "../web-pages/read";

/*
 * Spotify: a link to a song, album, playlist, artist, podcast or episode there, on a line of its
 * own in a note, plays in Spotify's own player once it's played (sitePlayer.ts): without a Spotify
 * account, or where Spotify's protected audio can't play (Safari, and the apps' web views), 30
 * seconds of each song. Songs, albums, podcasts and episodes are looked up for the library: in the
 * apps from their page, which says nearly all there is; on the web from Spotify's oEmbed, which says
 * only a title and a cover. Only the link is sent, without what Spotify adds to say who shared it.
 */

type Kind = "track" | "album" | "playlist" | "artist" | "show" | "episode";

/** What a link to Spotify is, by its id: `open.spotify.com/track/…`, in a language (`intl-de/`) or its player's (`embed/`). */
export function spotifyIn(url: URL | null): { kind: Kind; id: string } | null {
  if (url?.hostname !== "open.spotify.com") return null;
  const match = /^\/(?:intl-[a-z]+\/)?(?:embed\/)?(track|album|playlist|artist|show|episode)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
  return match ? { kind: match[1] as Kind, id: match[2] } : null;
}

/** Each kind's player, the height Spotify's own embed code gives it. */
const PLAYERS: Record<Kind, Pick<SitePlayer, "kind" | "height">> = {
  track: { kind: "track", height: 152 },
  album: { kind: "album", height: 352 },
  playlist: { kind: "playlist", height: 352 },
  artist: { kind: "artist", height: 352 },
  show: { kind: "podcast", height: 232 },
  episode: { kind: "episode", height: 232 },
};

/** What Spotify's player says: `{ type: "ready" }`, then `{ type: "playback_update", payload: { isPaused } }` as it plays. */
function read(message: unknown): ReturnType<SitePlayer["read"]> {
  const { type, payload } = (message ?? {}) as { type?: string; payload?: { isPaused?: boolean } };
  if (type === "ready") return "ready";
  if (type === "playback_update") return payload?.isPaused ? "paused" : "playing";
  return null;
}

const player: Embed = {
  id: "spotify",
  draws: ({ href, image }) => !image && !!spotifyIn(webLink(href)),
  draw(dom, { href, label }, changed) {
    const { kind, id } = spotifyIn(webLink(href))!;
    const site = { site: "Spotify", title: label, ...PLAYERS[kind], src: `https://open.spotify.com/embed/${kind}/${id}`, origin: "https://open.spotify.com" };
    return drawSitePlayer(dom, { ...site, read, play: { command: "play" }, pause: { command: "pause" } }, changed);
  },
  paste: (href) => (spotifyIn(webLink(href)) ? `[Spotify](${href})` : null),
};

/** The library's kinds, by what Spotify calls them; playlists and artists aren't kept. */
const TYPES: Partial<Record<Kind, string>> = { track: "song", album: "album", show: "podcast", episode: "episode" };

/** Spotify's words before what a podcast or episode is about: "Listen to this episode from The Daily on Spotify." */
const LISTEN = /^Listen to (?:this episode from )?.+? on Spotify\.\s*/;

/**
 * What a Spotify page says it is (as Web Pages reads it), with what that misses: an episode's
 * podcast and length, and what a podcast or episode is about without Spotify's words before it. A
 * song's or album's description is only Spotify's own (`Listen to … on Spotify. Song · …`).
 */
export function spotifyItem(page: Page, type: string): LibraryItem | null {
  const item = itemOfPage(page);
  if (item?.type !== type) return null;
  const description = type === "podcast" || type === "episode" ? item.description?.replace(LISTEN, "") : undefined;
  if (type !== "episode") return { ...item, description };
  const found = new Map(item.properties);
  return {
    ...item,
    properties: known([
      // Its page names its podcast only as `The Daily · Episode`.
      ["podcast", found.get("podcast") ?? page.meta.get("og:description")?.split(" · ")[0]],
      ["published", found.get("published")],
      ["duration", found.get("duration") ?? clock(Number(page.meta.get("music:duration")))],
    ]),
    description,
  };
}

interface OEmbed {
  title?: string;
  thumbnail_url?: string;
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = spotifyIn(url);
  const type = found && TYPES[found.kind];
  if (!type) return null;
  const link = `https://open.spotify.com/${found.kind}/${found.id}`;
  if (isTauri) {
    const page = await getPage(link, signal);
    return page && spotifyItem(page, type);
  }
  // On the web only oEmbed answers, which names a podcast after its latest episode.
  if (type === "podcast") return null;
  const embed = await getJson<OEmbed>(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`, signal);
  return embed?.title ? { type, title: embed.title, link, properties: [], cover: embed.thumbnail_url } : null;
}

const source: LibrarySource = {
  id: "spotify",
  name: "Spotify",
  recognizes: (url) => {
    const found = spotifyIn(url);
    return !!found && found.kind in TYPES;
  },
  lookup,
};

export const spotify = (): Plugin => ({
  id: "spotify",
  name: "Spotify",
  description: t("plugins.spotify.description"),
  icon: "headphones",
  enabledByDefault: true,
  contributes: {
    librarySources: [source],
    markdown: [{ embeds: [player] }],
  },
});
