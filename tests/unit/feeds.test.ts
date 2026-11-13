import { describe, expect, mock, test } from "bun:test";
import { clock, readDate, readDuration } from "../../src/lib/feeds/dates";
import { KEEP, merge, type Fetched, type KeptPost } from "../../src/lib/feeds/posts";
import { writeOpml } from "../../src/lib/feeds/opml";
import { stubApp } from "./stubs";

stubApp();
mock.module("../../src/lib/release", () => ({ VERSION: "0.0.0", REPO: "https://github.com/overtio/lines" }));
const { encodingOf } = await import("../../src/lib/feeds/fetch");
const { applePodcastId, linkOf } = await import("../../src/lib/feeds/find");

/*
 * Feeds' logic that needs no page: dates and durations as feeds write them, keeping posts across
 * fetches, links as pasted, OPML written out. Reading feeds and their HTML needs the browser's
 * parser, so tests/browser/feeds.test.ts covers that.
 */

describe("dates", () => {
  const utc = (text: string) => new Date(readDate(text)!).toISOString();

  test("reads RSS's dates, and Atom's", () => {
    expect(utc("Wed, 11 Nov 2026 12:00:00 -0000")).toBe("2026-11-11T12:00:00.000Z");
    expect(utc("Wed, 11 Nov 2026 12:00:00 +0100")).toBe("2026-11-11T11:00:00.000Z");
    expect(utc("2026-11-12T21:32:07Z")).toBe("2026-11-12T21:32:07.000Z");
    expect(utc("2026-11-12T21:32:07-05:00")).toBe("2026-11-13T02:32:07.000Z");
  });

  test("reads the dates feeds get a little wrong", () => {
    // A zone by name, a day name that's wrong or missing, a two-digit year, a one-digit hour, a full month.
    expect(utc("Thu, 11 Nov 2026 09:30:00 PST")).toBe("2026-11-11T17:30:00.000Z");
    expect(utc("11 Nov 26 9:05 GMT")).toBe("2026-11-11T09:05:00.000Z");
    expect(utc("Mi, 11 November 2026 12:00:00 +01:00")).toBe("2026-11-11T11:00:00.000Z");
    expect(utc("Wed, 11 Nov 2026")).toBe("2026-11-11T00:00:00.000Z");
  });

  test("leaves what isn't a date", () => {
    expect(readDate("")).toBeUndefined();
    expect(readDate("soon")).toBeUndefined();
    expect(readDate(undefined)).toBeUndefined();
  });

  test("reads podcasts' durations, in seconds", () => {
    expect([readDuration("1882"), readDuration("31:22"), readDuration("1:02:03"), readDuration("45:00.5")]).toEqual([1882, 1882, 3723, 2701]);
    expect([readDuration(""), readDuration("half an hour"), readDuration("0")]).toEqual([undefined, undefined, undefined]);
  });

  test("shows a length as a player does", () => {
    expect([clock(0), clock(65), clock(3723), clock(-3)]).toEqual(["0:00", "1:05", "1:02:03", "0:00"]);
  });
});

describe("keeping posts", () => {
  const post = (id: string, date?: number, html = `<p>${id}</p>`): Fetched => ({ id, key: `key-${id}`, title: id, html, base: "https://example.com/", excerpt: id, date });
  const kept = (id: string, date: number | undefined, read: boolean, version = "old"): KeptPost => ({ id, key: `key-${id}`, title: id, base: "https://example.com/", excerpt: id, date, version, read, seen: 0 });

  test("new posts are unread, and those read stay read", () => {
    const { posts, changed } = merge([kept("a", 1, true)], [post("b", 2), post("a", 1)], 100);
    expect(posts.map(({ id, read }) => [id, read])).toEqual([
      ["b", false],
      ["a", true],
    ]);
    // a's content is stored again: it changed from what was kept.
    expect(changed.map((each) => each.id)).toEqual(["b", "a"]);
  });

  test("content is stored again only when it changed", () => {
    const first = merge([], [post("a", 1)], 100);
    const again = merge(first.posts, [post("a", 1)], 200);
    expect(again.changed).toEqual([]);
    expect(merge(first.posts, [post("a", 1, "<p>edited</p>")], 300).changed.map((each) => each.id)).toEqual(["a"]);
  });

  test("posts a feed no longer lists are kept, newest first", () => {
    const { posts } = merge([kept("old", 1, true), kept("older", 0, false)], [post("new", 5)], 100);
    expect(posts.map((each) => each.id)).toEqual(["new", "old", "older"]);
  });

  test("posts without a date keep the feed's order, below those seen before", () => {
    const first = merge([], [post("x"), post("y")], 1000);
    expect(first.posts.map((each) => each.id)).toEqual(["x", "y"]);
    const second = merge(first.posts, [post("z"), post("x"), post("y")], 2000);
    expect(second.posts.map((each) => each.id)).toEqual(["z", "x", "y"]);
  });

  test("only the newest are kept, and the rest's content goes", () => {
    const many = Array.from({ length: KEEP + 5 }, (_, i) => post(`p${i}`, i));
    const { posts, dropped, changed } = merge([], many, 0);
    expect(posts).toHaveLength(KEEP);
    expect(posts[0].id).toBe(`p${KEEP + 4}`);
    expect(dropped).toEqual(["key-p4", "key-p3", "key-p2", "key-p1", "key-p0"]);
    expect(changed).toHaveLength(KEEP);
  });
});

describe("links", () => {
  test("takes a feed's link as pasted", () => {
    expect(linkOf("  https://example.com/feed.xml ")).toBe("https://example.com/feed.xml");
    expect(linkOf("<https://example.com/feed>")).toBe("https://example.com/feed");
    expect(linkOf("feed://example.com/rss")).toBe("https://example.com/rss");
    expect(linkOf("feed:https://example.com/rss")).toBe("https://example.com/rss");
    expect(linkOf("example.com/blog")).toBe("https://example.com/blog");
    expect([linkOf("not a link"), linkOf("javascript:alert(1)"), linkOf("")]).toEqual([null, null, null]);
  });

  test("finds a podcast's id in its Apple Podcasts link, an episode's too", () => {
    expect(applePodcastId("https://podcasts.apple.com/us/podcast/syntax-tasty-web-development-treats/id1253186678")).toBe("1253186678");
    expect(applePodcastId("https://podcasts.apple.com/gb/podcast/some-episode/id1253186678?i=1000700000000")).toBe("1253186678");
    expect(applePodcastId("https://itunes.apple.com/us/podcast/id1253186678")).toBe("1253186678");
    expect(applePodcastId("https://example.com/podcast/id1253186678")).toBeNull();
  });

  test("decodes a feed as it says it's encoded", () => {
    const latin1 = new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><rss/>');
    expect(encodingOf(latin1, "text/xml; charset=utf-8")).toBe("windows-1252");
    expect(encodingOf(new TextEncoder().encode("<rss/>"), "application/rss+xml; charset=windows-1251")).toBe("windows-1251");
    expect(encodingOf(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c]), "text/xml; charset=latin1")).toBe("utf-8");
    expect(encodingOf(new TextEncoder().encode('<?xml encoding="nonsense"?>'), "")).toBe("utf-8");
  });
});

test("writes OPML that other readers take, with titles and links escaped", () => {
  const opml = writeOpml(
    "lines",
    [
      { url: "https://example.com/feed?a=1&b=2", title: 'Tom & Jerry "Live"', site: "https://example.com/" },
      { url: "https://podcast.example/rss", title: "<Podcast>" },
    ],
    new Date(Date.UTC(2026, 10, 12)),
  );
  expect(opml).toContain('<outline type="rss" text="Tom &amp; Jerry &quot;Live&quot;" title="Tom &amp; Jerry &quot;Live&quot;" xmlUrl="https://example.com/feed?a=1&amp;b=2" htmlUrl="https://example.com/"/>');
  expect(opml).toContain('<outline type="rss" text="&lt;Podcast&gt;" title="&lt;Podcast&gt;" xmlUrl="https://podcast.example/rss"/>');
  expect(opml).toContain("<dateCreated>Thu, 12 Nov 2026 00:00:00 GMT</dateCreated>");
  expect(opml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">')).toBe(true);
});
