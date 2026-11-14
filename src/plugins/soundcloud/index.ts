import { solid } from "../../lib/colors";
import { drawSitePlayer, type SitePlayer, webLink } from "../../lib/editor/sitePlayer";
import { fetchFeed, FetchError } from "../../lib/feeds/fetch";
import { feedItem } from "../../lib/feeds/item";
import { NotAFeed, readFeed } from "../../lib/feeds/parse";
import { t } from "../../lib/i18n/index.svelte";
import { decodeEntities } from "../../lib/library/page";
import { clock, isoSeconds, known } from "../../lib/library/text";
import { getJson, pageInApps } from "../../lib/library/web";
import type { Embed, LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * SoundCloud: a link to a track, a set (a playlist or an album) or someone's sounds there, on a
 * line of its own in a note, plays in SoundCloud's own player once it's played (sitePlayer.ts), in
 * the theme's accent. Tracks are looked up for the library through SoundCloud's oEmbed, which web
 * pages may ask too, their length from their page in the apps. In the apps, someone whose sounds
 * are a podcast (SoundCloud's feed of those they put in it has any) is that podcast: a link to them
 * subscribes, and lines' own player plays it. Only the link is sent.
 */

type Kind = "track" | "set" | "user";

/** The start of SoundCloud's own pages' addresses, which are no one's sounds. */
const SITE = new Set(["discover", "search", "stream", "feed", "you", "upload", "charts", "stations", "settings", "messages", "notifications", "people", "pages", "terms-of-use", "imprint", "mobile", "popular", "tags", "groups", "jobs", "press", "connect", "signin", "logout", "home", "explore", "pro", "creators", "apps", "tracks", "playlists"]);

/** The tabs of someone's page, which aren't tracks. */
const TABS = new Set(["likes", "tracks", "albums", "sets", "reposts", "followers", "following", "popular-tracks", "comments", "spotlight"]);

/**
 * What a link to SoundCloud is, and its address without what's added to it for sharing (`?si=…`).
 * A private track's or set's ends in its secret (`/s-…`), which plays it, and is kept.
 */
export function soundcloudIn(url: URL | null): { kind: Kind; page: string } | null {
  if (!url || !/^(?:www\.|m\.)?soundcloud\.com$/i.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const path = parts.length >= 3 && /^s-[A-Za-z0-9]{11}$/.test(parts.at(-1)!) ? parts.slice(0, -1) : parts;
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

/**
 * What SoundCloud's player says: that it's `ready`, and once asked, how far it's played as it plays,
 * and when it pauses or finishes. Not when it starts: a browser that won't let it play has it start
 * and pause at once.
 */
function read(message: unknown): ReturnType<SitePlayer["read"]> {
  const { method } = (message ?? {}) as { method?: string };
  if (method === "ready") return "ready";
  if (method === "playProgress") return "playing";
  return method === "pause" || method === "finish" ? "paused" : null;
}

/** Each kind's player's height, and its name. */
const KINDS: Record<Kind, { height: number; name: () => string }> = {
  track: { height: 166, name: () => t("plugins.soundcloud.track") },
  set: { height: 450, name: () => t("plugins.soundcloud.set") },
  user: { height: 450, name: () => t("plugins.soundcloud.user") },
};

const player: Embed = {
  id: "soundcloud",
  draws: ({ href, image }) => !image && !!soundcloudIn(webLink(href)),
  draw(dom, { href, label }, changed) {
    const { kind, page } = soundcloudIn(webLink(href))!;
    const { height, name } = KINDS[kind];
    // Its classic look, without comments, reposts or what it suggests after.
    const options = new URLSearchParams({ url: page, color: solid("var(--accent)"), visual: "false", show_comments: "false", show_reposts: "false", show_teaser: "false", hide_related: "true" });
    return drawSitePlayer(
      dom,
      {
        site: "SoundCloud",
        link: page,
        title: label,
        kind: name(),
        src: `https://w.soundcloud.com/player/?${options}`,
        height,
        origin: "https://w.soundcloud.com",
        read,
        listen: ["playProgress", "pause", "finish"].map((event) => say("addEventListener", event)),
        play: say("play"),
        pause: say("pause"),
      },
      changed,
    );
  },
  paste: (href) => {
    const found = soundcloudIn(webLink(href));
    return found && `[SoundCloud](${found.page})`;
  },
};

interface OEmbed {
  title?: string;
  author_name?: string;
  description?: string;
  thumbnail_url?: string;
  /** Its player's code, which says what it plays: `api.soundcloud.com/tracks/293`. */
  html?: string;
}

/** What SoundCloud's oEmbed says of a page, and what it is by its player's address: its kind (`tracks`, `users`) and id. */
async function embedOf(page: string, signal: AbortSignal) {
  const embed = await getJson<OEmbed>(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(page)}`, signal);
  const [, what, id] = /api\.soundcloud\.com%2F(tracks|playlists|users)%2F(\d+)/.exec(embed?.html ?? "") ?? [];
  return embed?.title && what ? { embed: embed as OEmbed & { title: string }, what, id } : null;
}

/**
 * Someone's sounds as a podcast (`page` being theirs): SoundCloud's feed of those they put in it,
 * if it has any. SoundCloud lets only the apps read it; to a web page it's as if there were none.
 */
async function podcastOf(page: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = await embedOf(page, signal);
  if (found?.what !== "users") return null;
  const url = `https://feeds.soundcloud.com/users/soundcloud:users:${found.id}/sounds.rss`;
  try {
    const fetched = await fetchFeed(url, {}, signal);
    const feed = fetched.changed ? readFeed(fetched.text, fetched.url) : null;
    return feed?.posts.length ? { ...feedItem(url, feed), link: page } : null;
  } catch (error) {
    // One that isn't there, isn't a feed, or isn't for web pages to read is no podcast; otherwise it couldn't be asked.
    const none = error instanceof NotAFeed || (error instanceof FetchError && (error.message === "blocked" || error.status === 404 || error.status === 410));
    if (!none) throw error;
    return null;
  }
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = soundcloudIn(url);
  // A set may be an album or a playlist, which only its page says.
  if (!found || found.kind === "set") return null;
  if (found.kind === "user") return podcastOf(found.page, signal);
  const track = await embedOf(found.page, signal);
  if (track?.what !== "tracks") return null;
  const { title, author_name: artist, thumbnail_url: cover, description } = track.embed;
  // Only its page says how long it is.
  const page = await pageInApps(found.page, signal);
  return {
    type: "song",
    // Its oEmbed's title says who it's by: `Flickermood by Forss`.
    title: artist && title.endsWith(` by ${artist}`) ? title.slice(0, -` by ${artist}`.length) : title,
    link: found.page,
    properties: known([
      ["artist", artist],
      ["duration", clock(isoSeconds(page?.meta.get("duration")))],
    ]),
    cover,
    description: description && decodeEntities(description),
  };
}

const source: LibrarySource = {
  id: "soundcloud",
  name: "SoundCloud",
  recognizes: (url) => soundcloudIn(url) !== null,
  key: (url) => {
    const found = soundcloudIn(url);
    return found && `soundcloud:${found.page.slice("https://soundcloud.com/".length).toLowerCase()}`;
  },
  lookup,
  async feed(url, signal) {
    const found = soundcloudIn(url);
    const podcast = found?.kind === "user" ? await podcastOf(found.page, signal) : null;
    return podcast?.properties.find(([key]) => key === "feed")?.[1] ?? null;
  },
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
