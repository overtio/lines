import type { FeedRecord } from "./posts";

/*
 * The kinds of feeds the sidebar lists apart (Settings → Library → Feeds in the sidebar): RSS,
 * Atom and podcasts'. A podcast's feed is a podcast's whatever it's written in.
 */

export const FEED_GROUPS = ["rss", "atom", "podcast"] as const;
export type FeedGroup = (typeof FEED_GROUPS)[number];

/**
 * Which group a subscription's feed is in: Podcast Feeds if it's a podcast's (its note is one, or
 * its posts have sound), else by the format it was last read in, RSS 1.0 with RSS. One whose
 * format isn't known yet (kept from before lines knew it, or not fetched yet) is with RSS, the
 * format most feeds are in, until it's next fetched.
 */
export function groupOf(record: Pick<FeedRecord, "format" | "posts"> | undefined, noteType: string | undefined): FeedGroup {
  if (noteType === "podcast" || record?.posts.some((post) => post.audio)) return "podcast";
  return record?.format === "atom" ? "atom" : "rss";
}
