import { drawSitePlayer, type SitePlayer, webLink } from "../../lib/editor/sitePlayer";
import { readAtMost } from "../../lib/feeds/fetch";
import { t } from "../../lib/i18n/index.svelte";
import { clock, dayOf, isoSeconds, known } from "../../lib/library/text";
import { getJson, LookupError, pageInApps, request } from "../../lib/library/web";
import type { Embed, LibraryItem, LibraryKind, LibrarySource, Plugin } from "../../lib/plugins/types";
import { type Channel, channelAsFeed, channelFeed, channelPage, channelPath, feedChannel, readChannelPage } from "./channel";

/*
 * YouTube: its videos, from YouTube's oEmbed (their title, channel and picture), which web pages may
 * ask too; and in the apps, from a video's page, when it came out, how long it is and what it's
 * about. Its channels (channel.ts), from their pages, which only the apps can read (YouTube doesn't
 * let web pages): a channel is a library note that subscribes to its feed, its videos read from its
 * page while the feed can't be had. A link to a video on a line of its own plays in YouTube's player,
 * from youtube-nocookie.com, once it's played. Only the links are sent.
 */

/** The video a link to YouTube is, by its id: `watch?v=`, youtu.be, Shorts, live and embedded videos. */
export function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(?:www|m)\./, "");
  let id: string | null | undefined;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(url.pathname)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

interface OEmbed {
  title?: string;
  author_name?: string;
  author_url?: string;
}

/** The most of a channel's page that's read: its data is in its first megabyte or two. */
const PAGE_BYTES = 5_000_000;

const CHANNEL: LibraryKind = {
  type: "channel",
  name: t("plugins.youtube.channel"),
  label: t("plugins.youtube.channels"),
  icon: "tv-minimal-play",
  properties: ["feed"],
  subtitle: [],
};

/** The video's largest picture without black bars: its full-size one, which older videos lack, or else a small one. */
async function thumbnail(id: string, signal: AbortSignal) {
  const large = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  const response = await request(large, signal, { method: "HEAD" }).catch(() => null);
  return response?.ok ? large : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** What oEmbed says of a video; null for one that isn't there (or isn't public). */
const oEmbedOf = (id: string, signal: AbortSignal) =>
  getJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, signal);

/** A channel's page (`path`, channel.ts' channelPath) as it reads; null where there's no such channel. Rejects where it can't be read (on the web). */
async function channelAt(path: string, signal: AbortSignal): Promise<Channel | null> {
  // In English, which is how its dates ("3 days ago") are read.
  const response = await request(channelPage(path), signal, { headers: { accept: "text/html", "accept-language": "en" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new LookupError(`www.youtube.com answered ${response.status}`);
  const html = new TextDecoder().decode(await readAtMost(response.body, PAGE_BYTES));
  return readChannelPage(html, response.url || channelPage(path));
}

/** A channel as the library keeps it: a note subscribing to its feed, its picture its cover. */
const channelItem = (channel: Channel): LibraryItem => ({
  type: "channel",
  title: channel.title,
  link: channel.link,
  properties: [["feed", channelFeed(channel.id)]],
  cover: channel.picture,
  description: channel.description,
});

/** The channel a link is to, or a video's: by the link to it oEmbed gives. */
async function channelOf(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const id = feedChannel(url);
  let path = id ? `channel/${id}` : channelPath(url);
  const video = path ? null : youtubeId(url);
  if (video) {
    const author = webLink((await oEmbedOf(video, signal))?.author_url ?? null);
    path = author && channelPath(author);
  }
  const channel = path ? await channelAt(path, signal) : null;
  return channel && channelItem(channel);
}

const source: LibrarySource = {
  id: "youtube",
  name: "YouTube",
  recognizes: (url) => youtubeId(url) !== null || channelPath(url) !== null || feedChannel(url) !== null,
  async lookup(url, signal) {
    const id = youtubeId(url);
    if (!id) return channelOf(url, signal);
    const embed = await oEmbedOf(id, signal);
    if (!embed?.title) return null;
    const link = `https://www.youtube.com/watch?v=${id}`;
    const page = await pageInApps(link, signal);
    const meta = page?.meta;
    const author = webLink(embed.author_url ?? null);
    const channel = author && channelPath(author);
    return {
      type: "video",
      title: embed.title,
      link,
      properties: known([
        ["channel", embed.author_name],
        ["published", dayOf(meta?.get("uploaddate") ?? meta?.get("datepublished"))],
        ["duration", clock(isoSeconds(meta?.get("duration")))],
      ]),
      // Its channel's page, as the channel's note has it: that note mentioned, or else the page linked to.
      ...(channel && { linked: { channel: `https://www.youtube.com/${channel}` } }),
      cover: meta?.get("og:image") ?? (await thumbnail(id, signal)),
      description: meta?.get("og:description"),
    };
  },
  subscription: channelOf,
  async feedInstead(feed, signal) {
    const id = feedChannel(feed);
    if (!id) return null;
    const channel = await channelAt(`channel/${id}`, signal);
    if (!channel) throw new LookupError("YouTube has no such channel");
    return channelAsFeed(channel);
  },
};

/**
 * What YouTube's player says, once it's spoken to (`greet`): that it's ready, then how it's playing,
 * by its state's number (1 playing, 2 paused, 0 ended).
 */
function read(message: unknown): ReturnType<SitePlayer["read"]> {
  const { event, info } = (message ?? {}) as { event?: string; info?: unknown };
  if (event === "onReady") return "ready";
  const state = event === "onStateChange" ? info : event === "infoDelivery" ? (info as { playerState?: number } | null)?.playerState : undefined;
  return state === 1 ? "playing" : state === 2 || state === 0 ? "paused" : null;
}

/** A message to YouTube's player, as its own page's script writes them. */
const say = (fields: Record<string, unknown>) => JSON.stringify({ ...fields, id: 1, channel: "widget" });

const player: Embed = {
  id: "youtube",
  draws: ({ href, image }) => {
    const url = !image && webLink(href);
    return !!url && youtubeId(url) !== null;
  },
  draw(dom, { href, label }, changed) {
    const id = youtubeId(webLink(href)!)!;
    return drawSitePlayer(
      dom,
      {
        site: "YouTube",
        link: `https://www.youtube.com/watch?v=${id}`,
        title: label,
        kind: t("plugins.youtube.video"),
        poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        // Without its cookies; it plays at once, as it's loaded by being played.
        src: `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(location.origin)}`,
        ratio: 16 / 9,
        origin: "https://www.youtube-nocookie.com",
        // It plays only for a page that says where it is.
        referrer: "strict-origin-when-cross-origin",
        read,
        greet: say({ event: "listening" }),
        listen: [say({ event: "command", func: "addEventListener", args: ["onStateChange"] })],
        play: say({ event: "command", func: "playVideo", args: [] }),
        pause: say({ event: "command", func: "pauseVideo", args: [] }),
      },
      changed,
    );
  },
};

export const youtube = (): Plugin => ({
  id: "youtube",
  name: "YouTube",
  description: t("plugins.youtube.description"),
  icon: "square-play",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { libraryKinds: [CHANNEL], librarySources: [source], markdown: [{ embeds: [player] }] },
});
