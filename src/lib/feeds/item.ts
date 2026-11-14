import { known } from "../library/text";
import type { LibraryItem } from "../plugins/types";
import { type Feed, isPodcast } from "./parse";

/** A feed at `url` as the library keeps it: a podcast's (its posts have sound) or a site's, its artwork its cover. */
export function feedItem(url: string, feed: Feed): LibraryItem {
  return {
    type: isPodcast(feed) ? "podcast" : "feed",
    title: feed.title,
    link: feed.link,
    properties: known([
      ["author", feed.author],
      ["feed", url],
    ]),
    cover: feed.image,
    description: feed.description,
  };
}
