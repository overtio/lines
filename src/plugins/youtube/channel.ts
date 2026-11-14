import { readDuration } from "../../lib/feeds/dates";
import type { Feed, Post } from "../../lib/feeds/parse";
import { readPage } from "../../lib/library/page";

/*
 * YouTube's channels: the links to one, its feed, and its page (its Videos tab) read as text, nothing
 * of it run: what it says of itself, and the videos it lists, for when its feed can't be had
 * (YouTube's go missing for hours or days). The page's data (`ytInitialData`) is YouTube's own and
 * changes as YouTube likes, so it's read defensively: a page that doesn't read as one should is no
 * channel and no feed, never one of guesses.
 */

const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;

const SECOND = 1000;
const DAY = 86_400 * SECOND;
/** "3 days ago" as YouTube writes it, in English (its pages are asked for in English), short or long: `9d ago`, `2 weeks ago`. */
const AGO = /(\d+)\s*([a-z]+)\s+ago\b/i;
/** Each unit's length, by how its word starts: `mo` before `m`. */
const UNITS: [RegExp, number][] = [
  [/^mo/, 30 * DAY],
  [/^(?:mi|m$)/, 60 * SECOND],
  [/^s/, SECOND],
  [/^h/, 3600 * SECOND],
  [/^d/, DAY],
  [/^w/, 7 * DAY],
  [/^y/, 365 * DAY],
];

const onYouTube = (url: URL) => /^(?:(?:www|m)\.)?youtube\.com$/.test(url.hostname);

/**
 * The channel a link to YouTube is, as the path to its page: `@handle`, `channel/UC…`, `c/name` or
 * `user/name`, whichever of its tabs the link is to (`/videos`, `/featured`…). Null for any other.
 */
export function channelPath(url: URL): string | null {
  if (!onYouTube(url)) return null;
  const path = /^\/(@[^/]+|channel\/UC[\w-]{22}|c\/[^/]+|user\/[^/]+)(?:\/[\w-]+)?\/?$/.exec(url.pathname)?.[1];
  return path ?? null;
}

/** A channel's feed, by its id: its 15 newest videos, Shorts among them. */
export const channelFeed = (id: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;

/** The channel whose feed `url` is, by its id; null for any other address. */
export function feedChannel(url: URL): string | null {
  const id = onYouTube(url) && url.pathname === "/feeds/videos.xml" ? url.searchParams.get("channel_id") : null;
  return id && CHANNEL_ID.test(id) ? id : null;
}

/** The page of a channel's videos, by its path (channelPath). */
export const channelPage = (path: string) => `https://www.youtube.com/${path}/videos`;

export interface Channel {
  /** Its id, `UC…`. */
  id: string;
  title: string;
  /** Its page, by its handle (`https://www.youtube.com/@veritasium`), as YouTube links to it from its videos; else by its id. */
  link: string;
  description?: string;
  /** Its picture (avatar). */
  picture?: string;
  /** The videos its page lists, newest first. */
  videos: ListedVideo[];
}

export interface ListedVideo {
  id: string;
  title: string;
  /** When it came out, as near as "3 days ago" says. */
  date?: number;
  /** In seconds. */
  duration?: number;
}

/** When "3 days ago" (or `9d ago`) was, from `now`; undefined for words it doesn't read. */
export function agoDate(text: string, now: number): number | undefined {
  const match = AGO.exec(text);
  const unit = match && UNITS.find(([starts]) => starts.test(match[2].toLowerCase()))?.[1];
  return unit ? now - Number(match[1]) * unit : undefined;
}

/** The page's own data (`var ytInitialData = {…};`), or null where it has none that reads. */
function initialData(html: string): Record<string, unknown> | null {
  const start = /ytInitialData"?\]?\s*=\s*\{/.exec(html);
  if (!start) return null;
  const from = start.index + start[0].length - 1;
  const end = html.indexOf(";</script>", from);
  try {
    const data: unknown = JSON.parse(html.slice(from, end < 0 ? undefined : end));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json | undefined => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined);
const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
/** A text as YouTube's data writes one: `{ content }`, `{ simpleText }` or `{ runs: [{ text }] }`. */
const words = (value: unknown): string | undefined => {
  const said = object(value);
  if (!said) return text(value);
  const runs = Array.isArray(said.runs) ? said.runs.map((run) => object(run)?.text ?? "").join("") : undefined;
  return text(said.content) ?? text(said.simpleText) ?? text(runs);
};

/** Every object under `root`, depth first, each once: where YouTube puts its lists moves, so they're looked for anywhere. */
function* objects(root: unknown): Generator<Json> {
  const stack: unknown[] = [root];
  while (stack.length) {
    const value = stack.pop();
    if (Array.isArray(value)) stack.push(...[...value].reverse());
    else if (value && typeof value === "object") {
      yield value as Json;
      stack.push(...Object.values(value).reverse());
    }
  }
}

/** A video as one of the two ways YouTube's lists have written one says it: a `lockupViewModel`, or a `videoRenderer` before it. */
function listedVideo(holder: Json, now: number): ListedVideo | null {
  const lockup = object(holder.lockupViewModel);
  if (lockup) {
    const id = text(lockup.contentId);
    if (!id || !VIDEO_ID.test(id) || lockup.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return null;
    const metadata = object(object(lockup.metadata)?.lockupMetadataViewModel);
    const title = words(metadata?.title);
    const said = [...objects(metadata?.metadata)].map((part) => words(part.text)).filter((each) => each !== undefined);
    const badges = [...objects(lockup.contentImage)].map((part) => text(object(part.thumbnailBadgeViewModel)?.text)).filter((each) => each !== undefined);
    const ago = said.find((each) => AGO.test(each));
    return title ? { id, title, date: ago ? agoDate(ago, now) : undefined, duration: badges.map(readDuration).find(Boolean) } : null;
  }
  const renderer = object(holder.videoRenderer);
  const id = text(renderer?.videoId);
  const title = words(renderer?.title);
  if (!renderer || !id || !VIDEO_ID.test(id) || !title) return null;
  const ago = words(renderer.publishedTimeText);
  return { id, title, date: ago ? agoDate(ago, now) : undefined, duration: readDuration(words(renderer.lengthText)) };
}

/**
 * What a channel's page (`html`, from `url`) says of it: its id, name, link, description and
 * picture, from its tags and its data, and the videos it lists. Throws where it isn't a channel's
 * page that reads as one does: one of another kind, or one YouTube changed.
 */
export function readChannelPage(html: string, url: string, now = Date.now()): Channel {
  const page = readPage(html, url);
  const data = initialData(html);
  const about = object(object(data?.metadata)?.channelMetadataRenderer);
  const canonical = page.links.find((link) => link.rel === "canonical")?.href;
  const id = [page.meta.get("identifier"), text(about?.externalId), canonical && /\/channel\/(UC[\w-]{22})/.exec(canonical)?.[1]].find((each) => each && CHANNEL_ID.test(each));
  const title = text(about?.title) ?? text(page.meta.get("og:title"));
  if (!id || !title) throw new Error("not a channel's page, or not one as YouTube writes them");
  const handle = /\/(@[^/?#]+)/.exec(text(about?.vanityChannelUrl) ?? "")?.[1];
  const videos = new Map<string, ListedVideo>();
  for (const holder of objects(data)) {
    const video = listedVideo(holder, now);
    if (video && !videos.has(video.id)) videos.set(video.id, video);
  }
  return {
    id,
    title,
    link: `https://www.youtube.com/${handle ?? `channel/${id}`}`,
    description: text(about?.description) ?? text(page.meta.get("og:description")),
    picture: text(page.meta.get("og:image")),
    videos: [...videos.values()],
  };
}

/** A channel's page as its feed would be, its videos' dates a guess (`approximate`): what's read when the feed can't be. */
export function channelAsFeed(channel: Channel): Feed {
  if (!channel.videos.length) throw new Error("the channel's page lists no videos");
  const posts = channel.videos.map(({ id, title, date, duration }): Post => {
    const link = `https://www.youtube.com/watch?v=${id}`;
    // Its id as YouTube's feed gives it, so the two are one post.
    return { id: `yt:video:${id}`, title, link, author: channel.title, date, approximate: true, html: "", base: link, excerpt: "", image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration };
  });
  return { title: channel.title, format: "atom", link: channel.link, description: channel.description, image: channel.picture, posts };
}
