import { solid } from "../../lib/colors";
import { drawSitePlayer, type SitePlayer, webLink } from "../../lib/editor/sitePlayer";
import { t } from "../../lib/i18n/index.svelte";
import { decodeEntities } from "../../lib/library/page";
import { clock, isoSeconds, known } from "../../lib/library/text";
import { getJson, getPage, request } from "../../lib/library/web";
import { isTauri } from "../../lib/platform";
import type { Embed, LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * SoundCloud: a link to a track, a set (a playlist or an album) or someone's sounds there, on a
 * line of its own in a note, plays in SoundCloud's own player once it's played (sitePlayer.ts), in
 * the theme's accent. Tracks are looked up for the library through SoundCloud's oEmbed, which web
 * pages may ask too, with their length from their page in the apps. In the apps, a link to someone
 * whose sounds are a podcast (SoundCloud's feed of those they put in it has any) is that podcast,
 * which Feeds subscribes to and lines' own player plays. Only the link is sent.
 */

type Kind = "track" | "set" | "user";

/** The start of SoundCloud's own pages' addresses, which are no one's sounds. */
const SITE = new Set(["discover", "search", "stream", "feed", "you", "upload", "charts", "stations", "settings", "messages", "notifications", "people", "pages", "terms-of-use", "imprint", "mobile", "popular", "tags", "groups", "jobs", "press", "connect", "signin", "logout", "home", "explore", "pro", "creators", "apps", "tracks", "playlists"]);

/** The tabs of someone's page, which aren't tracks. */
const TABS = new Set(["likes", "tracks", "albums", "sets", "reposts", "followers", "following", "popular-tracks", "comments", "spotlight"]);

/** What a link to SoundCloud is, and its address without what's added to it for sharing (`?si=…`); a private track's keeps its secret (`/s-…`). */
export function soundcloudIn(url: URL | null): { kind: Kind; page: string } | null {
  if (!url || !/^(?:www\.|m\.)?soundcloud\.com$/i.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const path = /^s-\w+$/.test(parts.at(-1) ?? "") ? parts.slice(0, -1) : parts;
  const [user, second] = path;
  if (!user || SITE.has(user.toLowerCase())) return null;
  let kind: Kind | null = null;
  if (path.length === 1) kind = "user";
  else if (path.length === 2 && !TABS.has(second)) kind = "track";
  else if (path.length === 3 && second === "sets") kind = "set";
  return kind && { kind, page: `https://soundcloud.com/${parts.join("/")}` };
}

/** A message to SoundCloud's player, as its Widget API writes them. */
const say = (method: string, value: string | null = null) => JSON.stringify({ method, value });

/** What SoundCloud's player says: that it's `ready`, and once asked, when it plays, pauses and finishes. */
function read(message: unknown): ReturnType<SitePlayer["read"]> {
  const { method } = (message ?? {}) as { method?: string };
  if (method === "ready") return "ready";
  if (method === "play") return "playing";
  return method === "pause" || method === "finish" ? "paused" : null;
}

const KINDS: Record<Kind, Pick<SitePlayer, "kind" | "height">> = {
  track: { kind: "track", height: 166 },
  set: { kind: "playlist", height: 450 },
  user: { kind: "artist", height: 450 },
};

const player: Embed = {
  id: "soundcloud",
  draws: ({ href, image }) => !image && !!soundcloudIn(webLink(href)),
  draw(dom, { href, label }, changed) {
    const { kind, page } = soundcloudIn(webLink(href))!;
    // Its classic look, without comments, reposts or what it suggests after.
    const options = new URLSearchParams({ url: page, color: solid("var(--accent)"), visual: "false", show_comments: "false", show_reposts: "false", show_teaser: "false", hide_related: "true" });
    const site = { site: "SoundCloud", title: label, ...KINDS[kind], src: `https://w.soundcloud.com/player/?${options}`, origin: "https://w.soundcloud.com" };
    const listen = ["play", "pause", "finish"].map((event) => say("addEventListener", event));
    return drawSitePlayer(dom, { ...site, read, listen, play: say("play"), pause: say("pause") }, changed);
  },
  paste: (href) => (soundcloudIn(webLink(href)) ? `[SoundCloud](${href})` : null),
};

interface OEmbed {
  title?: string;
  author_name?: string;
  description?: string;
  thumbnail_url?: string;
  /** Its player's code, which says what it plays: `api.soundcloud.com/tracks/293`. */
  html?: string;
}

/** Someone's sounds as a podcast: SoundCloud's feed of those they put in it, if it has any. */
async function podcastOf(embed: OEmbed, page: string, id: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const feed = `https://feeds.soundcloud.com/users/soundcloud:users:${id}/sounds.rss`;
  const response = await request(feed, signal);
  const channel = response.ok ? new DOMParser().parseFromString(await response.text(), "application/xml").querySelector("channel") : null;
  if (!channel?.querySelector("item")) return null;
  const own = (name: string) => [...channel.children].find((child) => child.localName === name)?.textContent?.trim() || undefined;
  return {
    type: "podcast",
    title: own("title") ?? embed.title!,
    link: page,
    properties: known([
      ["author", embed.author_name],
      ["feed", feed],
    ]),
    cover: embed.thumbnail_url,
    description: own("description"),
  };
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = soundcloudIn(url);
  // A set may be an album or a playlist, which its oEmbed doesn't say; and someone's sounds are a
  // podcast only if their feed, which only the apps can read, says so.
  if (!found || found.kind === "set" || (found.kind === "user" && !isTauri)) return null;
  const embed = await getJson<OEmbed>(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(found.page)}`, signal);
  const [, what, id] = /api\.soundcloud\.com%2F(tracks|users)%2F(\d+)/.exec(embed?.html ?? "") ?? [];
  if (!embed?.title || what !== (found.kind === "user" ? "users" : "tracks")) return null;
  if (what === "users") return podcastOf(embed, found.page, id, signal);
  const artist = embed.author_name;
  // In the apps, its length, which only its page says.
  const page = isTauri
    ? await getPage(found.page, signal).catch(() => {
        signal.throwIfAborted();
        return null;
      })
    : null;
  return {
    type: "song",
    // Its oEmbed's title says who it's by: `Flickermood by Forss`.
    title: artist && embed.title.endsWith(` by ${artist}`) ? embed.title.slice(0, -` by ${artist}`.length) : embed.title,
    link: found.page,
    properties: known([
      ["artist", artist],
      ["duration", clock(isoSeconds(page?.meta.get("duration")))],
    ]),
    cover: embed.thumbnail_url,
    description: embed.description && decodeEntities(embed.description),
  };
}

const source: LibrarySource = {
  id: "soundcloud",
  name: "SoundCloud",
  recognizes: (url) => soundcloudIn(url) !== null,
  lookup,
};

export const soundcloud = (): Plugin => ({
  id: "soundcloud",
  name: "SoundCloud",
  description: t("plugins.soundcloud.description"),
  icon: "cloud",
  enabledByDefault: true,
  contributes: {
    librarySources: [source],
    markdown: [{ embeds: [player] }],
  },
});
