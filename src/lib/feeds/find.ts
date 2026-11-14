import { FetchError, fetchFeed, type Validators } from "./fetch";
import { isFeed, isPodcast, readFeed, type Feed } from "./parse";

/*
 * Finding the feed at a link: the feed itself, or a site's page, which says where its feed is or,
 * saying nothing, has it where sites usually keep theirs. A podcast's site, whose own feed is for
 * its posts, or which has none, links to its podcast's. (A podcast's page on Apple Podcasts names
 * its feed through its library source: feeds.svelte.ts.)
 */

export interface Found {
  /** The feed's address. */
  url: string;
  feed: Feed;
  validators: Validators;
}

export class NoFeed extends Error {}

/** Feeds a page may name, best first; plain JSON only when its address says it's a feed (JSON Feed 1.0's, not a site's API). */
const FEED_TYPES = ["application/rss+xml", "application/atom+xml", "application/rdf+xml", "application/feed+json", "application/xml", "text/xml", "application/json"];
/** How many of the feeds a page names are tried, and of those it links to for its podcast's. */
const TRIED = 3;
/** Where sites keep their feed by custom (WordPress, Ghost, Jekyll, Hugo, Next.js blogs…), best first. */
const USUAL = ["feed", "rss", "rss.xml", "feed.xml", "atom.xml", "index.xml", "atom", "feed.json"];

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

/** Links that look like a feed's own: `….xml`, `/feed`, `/feed.json`, `/feeds/json`, `/rss`, `feeds.…`, `?format=rss`. */
export function looksLikeFeed(url: URL) {
  return (
    /(?:\.(?:rss|atom|rdf|xml)|\/(?:feeds?|rss2?|atom)(?:\.\w+)?|\/feeds?\/json)\/?$/i.test(url.pathname) ||
    /^(?:feeds?|rss)\./i.test(url.hostname) ||
    /(?:^|&)(?:feed|format)=(?:rss|atom|feed)\b/i.test(url.search.slice(1))
  );
}

/** What a page has to find its site's feed by: the feeds it names (`<link rel="alternate">`), best first, and the links in it, each made whole and once. */
export function readSite(html: string, base: string): { named: string[]; links: URL[] } {
  const page = new DOMParser().parseFromString(html, "text/html");
  // A page's own <base> says where its relative links are from.
  const from = page.querySelector("base[href]")?.getAttribute("href");
  const whole = (href: string) => {
    try {
      const url = new URL(href, from ? new URL(from, base) : base);
      return url.protocol === "https:" || url.protocol === "http:" ? [url] : [];
    } catch {
      return [];
    }
  };
  const named = [...page.querySelectorAll("link[rel~='alternate'][href][type]")]
    .map((link) => ({ type: link.getAttribute("type")!.toLowerCase().split(";")[0].trim(), href: link.getAttribute("href")! }))
    .filter(({ type, href }) => FEED_TYPES.includes(type) && (type !== "application/json" || /feed/i.test(href.replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, ""))))
    .sort((a, b) => FEED_TYPES.indexOf(a.type) - FEED_TYPES.indexOf(b.type))
    .flatMap(({ href }) => whole(href).map(String));
  const links = [...page.querySelectorAll("a[href]")].flatMap((link) => whole(link.getAttribute("href")!));
  return { named: [...new Set(named)], links: [...new Map(links.map((url) => [url.href, url])).values()].filter((url) => !named.includes(url.href)) };
}

/** Where the site `page` is on usually keeps its feed, best first: in the page's folder (a blog's `/blog/feed`), then at its root. */
export function usualFeeds(page: string): string[] {
  const { origin, pathname } = new URL(page);
  // `/blog` and `/blog/` are a folder, `/blog/index.html` a page in one.
  const folder = /\.\w+$/.test(pathname) ? pathname.replace(/[^/]*$/, "") : pathname.replace(/\/?$/, "/");
  return [...new Set([folder, "/"])].flatMap((at) => USUAL.map((name) => `${origin}${at}${name}`));
}

/** The feed of a podcast's page elsewhere, as a library source finds it (Apple Podcasts'); null for a link none knows. */
export type PodcastAt = (link: string, signal?: AbortSignal) => Promise<string | null>;

/**
 * The feed at `link`; or of the site its page is on: the podcast's it links to, if the feed the page
 * names has no sound, then that feed, then one where sites usually keep theirs. Throws NoFeed if
 * there's none, FetchError if it can't be fetched.
 */
export async function findFeed(link: string, signal?: AbortSignal, podcastAt?: PodcastAt): Promise<Found> {
  const response = await fetchFeed(link, {}, signal);
  if (!response.changed) throw new NoFeed(link);
  // Its address as given, even if it was found further on: a redirect may be for now only.
  if (isFeed(response.text)) return { url: link, feed: readFeed(response.text, response.url), validators: response.validators };
  const page = readSite(response.text, response.url);
  const named = await firstFeed(page.named.slice(0, TRIED), signal);
  if (named && isPodcast(named.feed)) return named;
  const found =
    (await sitePodcast(page.links, response.url, signal, podcastAt)) ??
    named ??
    (await firstFeed(usualFeeds(response.url).filter((url) => !page.named.includes(url)), signal));
  if (found) return found;
  throw new NoFeed(link);
}

const siteOf = (link: string) => new URL(link).hostname.replace(/^www\./, "");

/**
 * The podcast a site's page links to that's the site's own (its feed says this is its site, so not
 * one a page only mentions): a link to its feed, or to its page elsewhere that a source finds the
 * feed of (Apple Podcasts).
 */
async function sitePodcast(links: URL[], page: string, signal?: AbortSignal, podcastAt?: PodcastAt): Promise<Found | null> {
  const site = siteOf(page);
  let tried = 0;
  for await (const url of linkedFeeds(links, signal, podcastAt)) {
    const found = await firstFeed([url], signal);
    if (found && isPodcast(found.feed) && found.feed.link && siteOf(found.feed.link) === site) return found;
    if (++tried === TRIED) break;
  }
  return null;
}

/** The feeds a page links to: links to a feed itself first, then those its links elsewhere name. */
async function* linkedFeeds(links: URL[], signal?: AbortSignal, podcastAt?: PodcastAt) {
  for (const url of links) if (looksLikeFeed(url)) yield url.href;
  for (const url of podcastAt ? links : []) {
    const feed = !looksLikeFeed(url) && (await podcastAt!(url.href, signal));
    if (feed) yield feed;
  }
}

/**
 * The first of `urls` that's a feed, asked one at a time: past those that aren't there, but giving
 * up on a site that asks to be left alone a while (429, 5xx) or doesn't answer.
 */
async function firstFeed(urls: string[], signal?: AbortSignal): Promise<Found | null> {
  for (const url of urls) {
    try {
      const feed = await fetchFeed(url, {}, signal);
      if (feed.changed && isFeed(feed.text)) return { url, feed: readFeed(feed.text, feed.url), validators: feed.validators };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!(error instanceof FetchError) || !error.status || error.status === 429 || error.status >= 500) return null;
    }
  }
  return null;
}
