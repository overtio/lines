import { FetchError, fetchFeed, type Validators } from "./fetch";
import { isFeed, readFeed, type Feed } from "./parse";

/*
 * Finding the feed at a link: the feed itself, or a site's page, which says where its feed is or,
 * saying nothing, has it where sites usually keep theirs. (A podcast's page on Apple Podcasts names
 * its feed through its library source: feeds.svelte.ts.)
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
/** Where sites keep their feed by custom (WordPress, Ghost, Jekyll, Hugo, Next.js blogs…), best first. */
const USUAL = ["feed", "rss", "rss.xml", "feed.xml", "atom.xml", "index.xml", "atom"];

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

/** Where the site `page` is on usually keeps its feed, best first: in the page's folder (a blog's `/blog/feed`), then at its root. */
export function usualFeeds(page: string): string[] {
  const { origin, pathname } = new URL(page);
  // `/blog` and `/blog/` are a folder, `/blog/index.html` a page in one.
  const folder = /\.\w+$/.test(pathname) ? pathname.replace(/[^/]*$/, "") : pathname.replace(/\/?$/, "/");
  return [...new Set([folder, "/"])].flatMap((at) => USUAL.map((name) => `${origin}${at}${name}`));
}

/** The feed at `link`, that its page names, or where its site would usually keep it; throws NoFeed if there's none, FetchError if it can't be fetched. */
export async function findFeed(link: string, signal?: AbortSignal): Promise<Found> {
  const response = await fetchFeed(link, {}, signal);
  if (!response.changed) throw new NoFeed(link);
  // Its address as given, even if it was found further on: a redirect may be for now only.
  if (isFeed(response.text)) return { url: link, feed: readFeed(response.text, response.url), validators: response.validators };
  const named = feedsNamedIn(response.text, response.url).slice(0, TRIED);
  const found = (await firstFeed(named, signal)) ?? (await firstFeed(usualFeeds(response.url).filter((url) => !named.includes(url)), signal));
  if (found) return found;
  throw new NoFeed(link);
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
