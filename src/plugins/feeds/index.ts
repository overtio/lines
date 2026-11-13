import { FEED_SOURCE, feedItem, feeds } from "../../lib/feeds/feeds.svelte";
import { fetchFeed } from "../../lib/feeds/fetch";
import { findFeed, NoFeed } from "../../lib/feeds/find";
import { isFeed, readFeed } from "../../lib/feeds/parse";
import { t } from "../../lib/i18n/index.svelte";
import { episodePlay } from "../../lib/player/notePlay";
import { plugins } from "../../lib/plugins/registry.svelte";
import type { LibraryKind, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * Feeds (docs/library.md#feeds): a site's or a podcast's feed subscribed to, as a note with a
 * `feed:` property, its posts read in the Library's Feeds (lib/feeds). A site's subscription is a
 * `feed` (a podcast's is a `podcast`, on its shelf), listed under Feeds rather than a shelf of its
 * own. And a note that's just a link to a feed becomes a subscription, as any link becomes what it is,
 * and so does one to a site's page that isn't anything else the library keeps (a blog's front page).
 */

const FEED: LibraryKind = {
  type: "feed",
  name: t("feeds.feed"),
  label: t("feeds.title"),
  icon: "rss",
  properties: ["author", "feed"],
  subtitle: ["author"],
  shelf: false,
};

/** Links that look like a feed's, which are fetched to see: `….xml`, `/feed`, `/rss`, `feeds.…`, `?format=rss`. */
function looksLikeFeed(url: URL) {
  return (
    /(?:\.(?:rss|atom|rdf|xml)|\/(?:feeds?|rss2?|atom)(?:\.\w+)?)\/?$/i.test(url.pathname) ||
    /^(?:feeds?|rss)\./i.test(url.hostname) ||
    /(?:^|&)(?:feed|format)=(?:rss|atom|feed)\b/i.test(url.search.slice(1))
  );
}

const source: LibrarySource = {
  id: FEED_SOURCE,
  name: t("feeds.title"),
  recognizes: looksLikeFeed,
  async lookup(url, signal) {
    const response = await fetchFeed(url.href, {}, signal);
    if (!response.changed || !isFeed(response.text)) return null;
    const feed = readFeed(response.text, response.url);
    // Kept now, so the subscription's posts are there with its note, without fetching it again.
    await feeds.take(url.href, feed, response.validators);
    return feedItem(url.href, feed);
  },
};

/**
 * A page no other source took for something (a blog's, a site's front page): the feed it names, or
 * one where sites usually keep theirs. Asked last, and only while pages are read (Web Pages).
 */
const site: LibrarySource = {
  id: "feeds-site",
  name: t("feeds.title"),
  general: true,
  recognizes: (url) => (url.protocol === "https:" || url.protocol === "http:") && plugins.librarySources.some((each) => each.id === "web-pages"),
  async lookup(url, signal) {
    try {
      const found = await findFeed(url.href, signal);
      await feeds.take(found.url, found.feed, found.validators);
      return feedItem(found.url, found.feed);
    } catch (error) {
      if (error instanceof NoFeed) return null;
      throw error;
    }
  },
};

export const feedsPlugin = (): Plugin => ({
  id: "feeds",
  name: t("feeds.title"),
  description: t("plugins.feeds.description"),
  icon: "rss",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { libraryKinds: [FEED], librarySources: [source, site], markdown: [{ editor: episodePlay }] },
});
