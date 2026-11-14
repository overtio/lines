import { describe, expect, test } from "bun:test";
import { groupOf } from "../../src/lib/feeds/groups";
import type { FeedRecord, KeptPost } from "../../src/lib/feeds/posts";

/*
 * Which row of the Library's feeds a subscription is listed in, by kind. (The setting that lists
 * them together is read with the rest of the preferences, in a page: tests/browser/reader.test.ts.)
 */

const post = (audio?: string): KeptPost => ({ id: "1", key: "k", title: "A post", base: "https://example.com/", excerpt: "", version: "v", read: false, seen: 0, ...(audio && { audio: { url: audio, type: "audio/mpeg" } }) });
const record = (format: FeedRecord["format"], posts: KeptPost[] = [post()]) => ({ format, posts });

describe("feeds by kind", () => {
  test("RSS 2.0 and RSS 1.0 are RSS, Atom is Atom, JSON Feed is JSON", () => {
    expect([groupOf(record("rss"), "feed"), groupOf(record("rdf"), "feed"), groupOf(record("atom"), "feed"), groupOf(record("json"), "feed")]).toEqual(["rss", "rss", "atom", "json"]);
  });

  test("a podcast's feed is a podcast's whatever it's written in: its posts have sound, or its note is a podcast's", () => {
    expect([groupOf(record("rss", [post("https://example.com/1.mp3")]), "feed"), groupOf(record("atom", [post("https://example.com/1.mp3")]), "feed")]).toEqual(["podcast", "podcast"]);
    expect(groupOf(record("atom", []), "podcast")).toBe("podcast");
  });

  test("one kept from before its format was, or not fetched yet, is with RSS, or with podcasts if its note is one", () => {
    expect([groupOf(record(undefined), "feed"), groupOf(undefined, "feed"), groupOf(undefined, undefined)]).toEqual(["rss", "rss", "rss"]);
    expect(groupOf(undefined, "podcast")).toBe("podcast");
  });
});
