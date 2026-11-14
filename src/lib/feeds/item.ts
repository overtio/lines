import { known } from "../library/text";
import { isPublic } from "../library/web";
import type { LibraryItem } from "../plugins/types";
import { type Feed, isPodcast } from "./parse";

/**
 * A feed at `url` as the library keeps it: a podcast's (its posts have sound) or a site's, its artwork
 * its cover; a site's feed with none, its site's icon (a podcast's is its artwork or nothing).
 */
export function feedItem(url: string, feed: Omit<Feed, "posts"> & Parameters<typeof isPodcast>[0]): LibraryItem {
  const podcast = isPodcast(feed);
  return {
    type: podcast ? "podcast" : "feed",
    title: feed.title,
    link: feed.link,
    properties: known([
      ["author", feed.author],
      ["feed", url],
    ]),
    cover: feed.image,
    icon: podcast || feed.image ? undefined : feed.link && isPublic(feed.link) ? feed.link : new URL(url).origin,
    description: feed.description,
  };
}
