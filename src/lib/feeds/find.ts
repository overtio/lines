import { webFetch } from "../platform";
import { fetchFeed, FetchError, type Validators } from "./fetch";
import { isFeed, readFeed, type Feed } from "./parse";

/*
 * Finding the feed someone means to subscribe to, from what they paste: the feed's own link, a
 * site's (whose pages say where its feed is), or a podcast's page on Apple Podcasts (whose feed
 * Apple's iTunes lookup gives, asked with nothing but the podcast's id).
 */

export interface Found {
  /** The feed's address. */
  url: string;
  feed: Feed;
  validators: Validators;
}

export class NoFeed extends Error {}

/** Feeds a page may name, best first. */
const FEED_TYPES = ["application/rss+xml", "application/atom+xml", "application/rdf+xml", "application/xml", "text/xml"];
/** How many of the feeds a page names are tried. */
const TRIED = 3;

/** A link as typed: `feed:` taken off, `https://` put on a bare `example.com/feed`. Null if it isn't one. */
export function linkOf(input: string): string | null {
  let text = input.trim().replace(/^<(.*)>$/, "$1");
  text = text.replace(/^feed:(?:\/\/)?(?=https?:)/i, "").replace(/^feed:\/\//i, "https://");
  if (!/^https?:\/\//i.test(text)) {
    if (!/^[\w-]+(\.[\w-]+)+(?::\d+)?(?:[/?#]\S*)?$/.test(text)) return null;
    text = `https://${text}`;
  }
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** A podcast's id on Apple Podcasts, from a link to it (or to one of its episodes). */
export function applePodcastId(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (!/^(?:podcasts|itunes)\.apple\.com$/.test(hostname)) return null;
    return /\/id(\d+)/.exec(pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The feed of a podcast on Apple Podcasts, as Apple's lookup gives it. */
async function appleFeed(id: string, signal?: AbortSignal): Promise<string> {
  const fetch = await webFetch();
  const response = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=podcast`, { signal });
  if (!response.ok) throw new FetchError(`HTTP ${response.status}`, response.status);
  const { results } = (await response.json()) as { results?: { feedUrl?: string }[] };
  const feed = results?.find((result) => result.feedUrl)?.feedUrl;
  if (!feed) throw new NoFeed(id);
  return feed;
}

/** The feeds a page names (`<link rel="alternate" type="application/rss+xml">`), made whole, best first. */
export function feedsNamedIn(html: string, base: string): string[] {
  const page = new DOMParser().parseFromString(html, "text/html");
  const links = [...page.querySelectorAll("link[rel~='alternate'][href][type]")]
    .map((link) => ({ type: link.getAttribute("type")!.toLowerCase().split(";")[0].trim(), href: link.getAttribute("href")! }))
    .filter(({ type }) => FEED_TYPES.includes(type))
    .sort((a, b) => FEED_TYPES.indexOf(a.type) - FEED_TYPES.indexOf(b.type));
  // A page's own <base> says where its relative links are from.
  const from = page.querySelector("base[href]")?.getAttribute("href");
  const urls = links.flatMap(({ href }) => {
    try {
      return [new URL(href, from ? new URL(from, base) : base).href];
    } catch {
      return [];
    }
  });
  return [...new Set(urls)];
}

/** The feed `input` means; throws NoFeed if it can't be found, FetchError if it can't be fetched. */
export async function findFeed(input: string, signal?: AbortSignal): Promise<Found> {
  let url = linkOf(input);
  if (!url) throw new NoFeed(input);
  const apple = applePodcastId(url);
  if (apple) url = await appleFeed(apple, signal);
  const response = await fetchFeed(url, {}, signal);
  if (!response.changed) throw new NoFeed(url);
  // Its address as given, even if it was found further on: a redirect may be for now only.
  if (isFeed(response.text)) return { url, feed: readFeed(response.text, response.url), validators: response.validators };
  for (const named of feedsNamedIn(response.text, response.url).slice(0, TRIED)) {
    try {
      const feed = await fetchFeed(named, {}, signal);
      if (feed.changed && isFeed(feed.text)) return { url: named, feed: readFeed(feed.text, feed.url), validators: feed.validators };
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  throw new NoFeed(url);
}
