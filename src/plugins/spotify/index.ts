import { drawSitePlayer, type SitePlayer, webLink } from "../../lib/editor/sitePlayer";
import { t } from "../../lib/i18n/index.svelte";
import type { Embed, Plugin } from "../../lib/plugins/types";

/*
 * Spotify: a link to a song, album, playlist, artist, podcast or episode there, on a line of its own
 * in a note, plays in Spotify's own player once it's played (sitePlayer.ts): 30 seconds of each
 * without a Spotify login. Its links aren't looked up for the library here, as Spotify's terms
 * don't let what it says be kept: MusicBrainz and Web Pages do that.
 */

type Kind = "track" | "album" | "playlist" | "artist" | "show" | "episode";

/** What a link to Spotify is, by its id: `open.spotify.com/track/…`, in a language (`intl-de/`) or its player's (`embed/`). */
export function spotifyIn(url: URL | null): { kind: Kind; id: string } | null {
  if (url?.hostname !== "open.spotify.com") return null;
  const match = /^\/(?:intl-[a-z]+\/)?(?:embed\/)?(track|album|playlist|artist|show|episode)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
  return match ? { kind: match[1] as Kind, id: match[2] } : null;
}

/** A link to Spotify as it plays, without what Spotify adds to say who shared it (`?si=`). */
export function spotifyLink(href: string): string | null {
  const found = spotifyIn(webLink(href));
  return found && `https://open.spotify.com/${found.kind}/${found.id}`;
}

/** Each kind's height, as Spotify's own embed code gives it, and its name. */
const KINDS: Record<Kind, { height: number; name: () => string }> = {
  track: { height: 152, name: () => t("plugins.spotify.track") },
  album: { height: 352, name: () => t("plugins.spotify.album") },
  playlist: { height: 352, name: () => t("plugins.spotify.playlist") },
  artist: { height: 352, name: () => t("plugins.spotify.artist") },
  show: { height: 232, name: () => t("plugins.spotify.podcast") },
  episode: { height: 232, name: () => t("plugins.spotify.episode") },
};

/**
 * What Spotify's player says: `{ type: "ready" }`, then `{ type: "playback_update", payload }` about
 * every second as it plays. It says it isn't paused while it waits for the sound too, even when the
 * browser then won't let it play, so that isn't playing yet.
 */
function read(message: unknown): ReturnType<SitePlayer["read"]> {
  const { type, payload } = (message ?? {}) as { type?: string; payload?: { isPaused?: boolean; isBuffering?: boolean } };
  if (type === "ready") return "ready";
  if (type !== "playback_update") return null;
  if (payload?.isPaused) return "paused";
  return payload?.isBuffering ? null : "playing";
}

const player: Embed = {
  id: "spotify",
  draws: ({ href, image }) => !image && !!spotifyIn(webLink(href)),
  draw(dom, { href, label }, changed) {
    const { kind, id } = spotifyIn(webLink(href))!;
    const { height, name } = KINDS[kind];
    return drawSitePlayer(
      dom,
      {
        site: "Spotify",
        link: `https://open.spotify.com/${kind}/${id}`,
        title: label,
        kind: name(),
        note: t("plugins.spotify.previews"),
        src: `https://open.spotify.com/embed/${kind}/${id}`,
        height,
        origin: "https://open.spotify.com",
        read,
        play: { command: "play" },
        pause: { command: "pause" },
      },
      changed,
    );
  },
  paste: (href) => {
    const link = spotifyLink(href);
    return link && `[Spotify](${link})`;
  },
};

export const spotify = (): Plugin => ({
  id: "spotify",
  name: "Spotify",
  description: t("plugins.spotify.description"),
  icon: "headphones",
  enabledByDefault: true,
  contributes: { markdown: [{ embeds: [player] }] },
});
