import { describe, expect, mock, test } from "bun:test";
import { readDate, readDuration } from "../../src/lib/feeds/dates";
import { isFeed, mend, type Post } from "../../src/lib/feeds/parse";
import { backoff, DAY, KEEP, merge, type KeptPost } from "../../src/lib/feeds/posts";
import { applyMarks, type FeedMarks, GONE_FOR, latestOf, marked, markKey, type Marks, mergeFeed, readShard, shardOf, stateOf, tidyFeed, withCleared, writeShard } from "../../src/lib/feeds/marks";
import { writeOpml } from "../../src/lib/feeds/opml";
import { Thread } from "../../src/lib/feeds/thread.svelte";
import type { DiscussionComment } from "../../src/lib/plugins/types";
import { drawable, isDrawing, pictureSize } from "../../src/lib/pictures";
import { storyId, storyPage } from "../../src/plugins/hacker-news/links";
import { ico, png } from "../browser/files";
import { stubApp } from "./stubs";

stubApp();
mock.module("../../src/lib/release", () => ({ VERSION: "0.0.0", REPO: "https://github.com/overtio/lines" }));
const { encodingOf, readAtMost } = await import("../../src/lib/feeds/fetch");
const { linkOf, looksLikeFeed, usualFeeds } = await import("../../src/lib/feeds/find");
const { formatAgo } = await import("../../src/lib/format");
const { iconsOf, iconToAsk } = await import("../../src/lib/library/icon");

/*
 * Feeds' logic that needs no page: dates and durations as feeds write them, keeping posts across
 * fetches, waiting after failures and reading no more than a feed's limit, links as pasted, OPML
 * written out, and a post's discussion: which links are Hacker News' stories, how long ago a
 * comment was written, and moving through a thread. Reading feeds and their HTML needs the
 * browser's parser, so tests/browser/feeds.test.ts covers that.
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
});

describe("keeping posts", () => {
  const post = (id: string, date?: number, html = `<p>${id}</p>`): Post => ({ id, title: id, html, base: "https://example.com/", excerpt: id, date });
  const kept = (id: string, date: number | undefined, read: boolean, version = "old"): KeptPost => ({ id, key: `key-${id}`, title: id, base: "https://example.com/", excerpt: id, date, version, read, seen: 0 });
  /** New posts' keys, in the order they're made. */
  const counting = () => {
    let made = 0;
    return () => `new-${made++}`;
  };

  test("new posts are unread under a key of their own, and those kept keep theirs and stay read", () => {
    const { posts, changed } = merge([kept("a", 1, true)], [post("b", 2), post("a", 1)], 100, counting());
    expect(posts.map(({ id, key, read }) => [id, key, read])).toEqual([
      ["b", "new-0", false],
      ["a", "key-a", true],
    ]);
    // a's content is stored again: it changed from what was kept.
    expect(changed.map((each) => each.key)).toEqual(["new-0", "key-a"]);
  });

  test("keys are random, saying nothing of the feed or the post", () => {
    const { posts } = merge([], [post("a"), post("a-too")], 0);
    expect(posts[0].key).toMatch(/^[\da-f]{8}-[\da-f]{4}-/);
    expect(posts[0].key).not.toBe(posts[1].key);
  });

  test("content is stored again only when it changed", () => {
    const first = merge([], [post("a", 1)], 100);
    const again = merge(first.posts, [post("a", 1)], 200);
    expect(again.changed).toEqual([]);
    expect(merge(first.posts, [post("a", 1, "<p>edited</p>")], 300).changed.map((each) => each.key)).toEqual([first.posts[0].key]);
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

  test("a dismissed post stays dismissed, and why", () => {
    const { posts } = merge([{ ...kept("a", 1, true), dismissed: "uninteresting" }], [post("b", 2), post("a", 1)], 100);
    expect(posts.map(({ id, dismissed }) => [id, dismissed])).toEqual([
      ["b", undefined],
      ["a", "uninteresting"],
    ]);
  });

  test("only the newest are kept, and the rest's content goes", () => {
    const many = Array.from({ length: KEEP + 5 }, (_, i) => post(`p${i}`, i));
    const { posts, dropped, changed } = merge([], many, 0, counting());
    expect(posts).toHaveLength(KEEP);
    expect(posts[0].id).toBe(`p${KEEP + 4}`);
    expect(dropped).toEqual(["new-4", "new-3", "new-2", "new-1", "new-0"]);
    expect(changed).toHaveLength(KEEP);
  });
});

describe("marks, what was done with posts, as devices sync them", () => {
  const kept = (id: string, read = false, date?: number): KeptPost => ({ id, key: `key-${id}`, title: id, base: "https://example.com/", excerpt: id, date, version: "v", read, seen: 0 });
  const FEED = "https://example.com/feed";

  test("a post's key, and its feed's file, are the same on every device", () => {
    expect(markKey("https://example.com/post/1")).toBe(markKey("https://example.com/post/1"));
    expect(markKey("https://example.com/post/1")).not.toBe(markKey("https://example.com/post/2"));
    expect(markKey("https://example.com/post/1")).toMatch(/^[0-9a-z]{4,12}$/);
    expect(shardOf(FEED)).toBe(shardOf(FEED));
    expect(shardOf(FEED)).toMatch(/^[0-9a-z]+\.json$/);
  });

  test("the latest mark says what a post is: dismissing reads it, restoring keeps it read, and unread after that is unread", () => {
    expect(stateOf({ read: 1 })).toEqual({ read: true });
    expect(stateOf({ read: 1, unread: 2 })).toEqual({ read: false });
    expect(stateOf({ unread: 1, done: 2 })).toEqual({ read: true, dismissed: "done" });
    expect(stateOf({ done: 1, uninteresting: 2 })).toEqual({ read: true, dismissed: "uninteresting" });
    expect(stateOf({ uninteresting: 1, restored: 2 })).toEqual({ read: true, dismissed: null });
    expect(stateOf({ uninteresting: 1, restored: 2, unread: 2 })).toEqual({ read: false, dismissed: null });
    expect(stateOf({ listed: 5 })).toEqual({});
  });

  test("a mark made here is later than anything marked in its feed, whatever this device's clock says", () => {
    expect(marked(undefined, ["read"], 0, 100)).toEqual({ read: 100, listed: 100 });
    // Another device, its clock ahead, dismissed a post at 500; restoring it here at 200 still wins.
    const mark = marked({ read: 100, done: 500 }, ["restored", "unread"], latestOf({ posts: { a: { read: 100, done: 500 } } }), 200);
    expect(mark).toMatchObject({ restored: 501, unread: 501 });
    expect(stateOf(mark)).toEqual({ read: false, dismissed: null });
    // And later than another post's mark, or a Dismiss All, made later still.
    expect(latestOf({ posts: { a: { read: 10 }, b: { done: 900, listed: 5000 } }, cleared: { before: 0, at: 950 } })).toBe(950);
  });

  test("two devices' marks merge field by field, the later winning, alike either way round; the later Dismiss All", () => {
    // Read on the phone, offline; dismissed later on the Mac; marked unread on the phone after that.
    const phone: FeedMarks = { posts: { a: { read: 10, unread: 30, listed: 40 }, b: { read: 5 } } };
    const mac: FeedMarks = { posts: { a: { done: 20, listed: 50 } }, cleared: { before: 1, at: 7 } };
    const merged = mergeFeed(phone, mac);
    expect(merged).toEqual({ posts: { a: { read: 10, unread: 30, done: 20, listed: 50 }, b: { read: 5 } }, cleared: { before: 1, at: 7 } });
    expect(mergeFeed(mac, phone)).toEqual(merged);
    expect(stateOf(merged.posts.a)).toEqual({ read: false, dismissed: "done" });
    // Nothing new: the same marks, so nothing is written or applied again.
    expect(mergeFeed(merged, mac)).toBe(merged);
    expect(mergeFeed(merged, { posts: { a: { done: 1 } }, cleared: { before: 9, at: 2 } })).toBe(merged);
    expect(mergeFeed(merged, { posts: {}, cleared: { before: 3, at: 8 } }).cleared).toEqual({ before: 3, at: 8 });
  });

  test("Dismiss All dismisses every post published before its watermark, but one marked since", () => {
    const cleared = { before: 1000, at: 2000 };
    expect(withCleared(undefined, 999, cleared)).toEqual({ done: 2000 });
    expect(withCleared(undefined, 1000, cleared)).toBeUndefined();
    expect(withCleared(undefined, undefined, cleared)).toBeUndefined();
    expect(stateOf(withCleared({ restored: 2500 }, 10, cleared)!)).toEqual({ read: true, dismissed: null });
    const posts = applyMarks([kept("old", false, 10), kept("new", false, 1500)], { posts: {}, cleared });
    expect(posts.map(({ id, dismissed }) => [id, dismissed])).toEqual([
      ["old", "done"],
      ["new", undefined],
    ]);
  });

  test("a mark is kept while its post is in its feed, however old; gone from it for a while, it's let go", () => {
    const now = 400 * DAY;
    const marks: FeedMarks = {
      posts: {
        listed: { done: DAY, listed: DAY },
        gone: { done: DAY, listed: now - GONE_FOR - 1 },
        lately: { read: DAY, listed: now - DAY },
        made: { uninteresting: now - DAY },
      },
      cleared: { before: 5, at: 6 },
    };
    const tidied = tidyFeed(marks, new Set(["listed"]), now);
    expect(Object.keys(tidied.posts).sort()).toEqual(["lately", "listed", "made"]);
    // Said to be listed now, as a week had gone by; the watermark stays.
    expect(tidied.posts.listed).toEqual({ done: DAY, listed: now });
    expect(tidied.cleared).toEqual({ before: 5, at: 6 });
    // Listed lately, and nothing gone: the same marks.
    const recent = { posts: { a: { read: 1, listed: now - DAY } } };
    expect(tidyFeed(recent, new Set(["a"]), now)).toBe(recent);
  });

  test("applied to the posts kept: each as its marks say, and those without as they were", () => {
    const posts = [kept("a"), kept("b", true), kept("c")];
    const applied = applyMarks(posts, { posts: { [markKey("a")]: { uninteresting: 5 }, [markKey("b")]: { unread: 5 }, [markKey("z")]: { read: 5 } } });
    expect(applied.map(({ id, read, dismissed }) => [id, read, dismissed])).toEqual([
      ["a", true, "uninteresting"],
      ["b", false, undefined],
      ["c", false, undefined],
    ]);
    expect(applied[2]).toBe(posts[2]);
    const marks = { posts: { [markKey("a")]: { uninteresting: 5, restored: 6 } } };
    const restored = applyMarks(applied, marks);
    expect(restored[0]).toEqual({ ...kept("a"), read: true });
    expect(applyMarks(restored, marks)).toBe(restored);
  });

  test("a feed's file reads back as written, posts in order; what isn't a mark is left out", () => {
    const marks: Marks = { [FEED]: { posts: { y: { read: 2 }, x: { done: 1, restored: 3, listed: 4 } }, cleared: { before: 1, at: 2 } } };
    const text = writeShard(marks);
    expect(readShard(text)).toEqual(marks);
    expect(Object.keys(JSON.parse(text).feeds[FEED].posts)).toEqual(["x", "y"]);
    expect(readShard(JSON.stringify({ feeds: { [FEED]: { posts: { a: { read: "soon", liked: 3, done: 2 }, b: { read: null }, c: 4 }, cleared: { at: 1 } } } }))).toEqual({ [FEED]: { posts: { a: { done: 2 } } } });
    expect(readShard("not json")).toEqual({});
  });

  test("a feed's file stays small: 200 posts read and dismissed", () => {
    const posts = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [markKey(`https://example.com/post/${i}`), { done: 1_794_000_000_000 + i, listed: 1_794_000_000_000 }]));
    expect(writeShard({ [FEED]: { posts } }).length).toBeLessThan(12_000);
  });
});

describe("fetching politely", () => {
  test("waits twice as long after each failure in a row, a day at most", () => {
    const hour = 3_600_000;
    expect([1, 2, 3, 4, 5].map((failures) => backoff(failures, hour) / hour)).toEqual([1, 2, 4, 8, 16]);
    expect([backoff(6, hour), backoff(60, hour)]).toEqual([DAY, DAY]);
  });

  test("stops reading a feed past the limit, however long it said it was", async () => {
    let pulled = 0;
    let stopped = false;
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        pulled++;
        controller.enqueue(new Uint8Array(1024));
      },
      cancel: () => {
        stopped = true;
      },
    });
    await expect(readAtMost(endless, 10_000)).rejects.toThrow("too big");
    expect(stopped).toBe(true);
    expect(pulled).toBeLessThan(15);
  });

  test("reads a feed within the limit whole", async () => {
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode("<rs"));
        controller.enqueue(new TextEncoder().encode("s/>"));
        controller.close();
      },
    });
    expect(new TextDecoder().decode(await readAtMost(body, 6))).toBe("<rss/>");
    expect(await readAtMost(null, 6)).toEqual(new Uint8Array());
  });
});

describe("telling a feed from a page", () => {
  test("by its first element, past a declaration, comments and a doctype", () => {
    expect(isFeed('\uFEFF<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE rss [<!ENTITY nbsp "&#160;">]>\n<rss version="2.0">')).toBe(true);
    expect(isFeed('<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">')).toBe(true);
    expect(isFeed("<!doctype html><html><link rel=alternate><rss>")).toBe(false);
    expect(isFeed("<!-- never closed <rss>")).toBe(false);
  });

  test("JSON Feed by its version, 1.0's and 1.1's; other JSON isn't one", () => {
    expect(isFeed('\uFEFF {"version": "https://jsonfeed.org/version/1.1", "title": "A blog", "items": []}')).toBe(true);
    expect(isFeed('{"items": [], "version": "https://jsonfeed.org/version/1"}')).toBe(true);
    expect(isFeed('{"version": "1.1", "items": []}')).toBe(false);
    expect(isFeed('[{"version": "https://jsonfeed.org/version/1.1"}]')).toBe(false);
    expect(isFeed('{"version": "https://jsonfeed.org/version/1.1", "items": [')).toBe(false);
  });

  test("at once, however what comes first was made", () => {
    const crafted = ["<?a?>".repeat(50_000), "<!---->".repeat(50_000), " ".repeat(5_000_000), "<?".repeat(100_000), "<!--".repeat(100_000), "<!DOCTYPE [".repeat(100_000)];
    const start = performance.now();
    for (const text of crafted) expect(isFeed(`${text}<html>`)).toBe(false);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("mending a feed that isn't quite XML", () => {
  test("outside CDATA and comments, which are kept as written", () => {
    expect(mend("<rss><title>Tom & Jerry\u0007</title><![CDATA[a & b]]><!-- c & d --></rss>")).toBe("<rss><title>Tom &amp; Jerry</title><![CDATA[a & b]]><!-- c & d --></rss>");
  });

  test("at once, however many comments are left open", () => {
    const crafted = [`<rss>${"<!--x".repeat(40_000)}</rss>`, `<rss>${"<![CDATA[a]]><!--b-->&c".repeat(40_000)}</rss>`];
    const start = performance.now();
    const [unclosed, many] = crafted.map(mend);
    expect(performance.now() - start).toBeLessThan(500);
    expect(unclosed).toBe(crafted[0]);
    expect(many).toBe(crafted[1].replaceAll("&c", "&amp;c"));
  });
});

describe("a site's icon", () => {
  type Link = { rel?: string; href: string; type?: string; sizes?: string };
  const page = (...links: Link[]) => ({ url: "https://example.com/", title: "", data: [], meta: new Map(), links: links.map((link) => ({ rel: "icon", type: "", title: "", sizes: "", ...link })) });

  test("the largest picture its page names (a phone's, which says no size, is 180 pixels), a drawing last, none not on the web at large", () => {
    const named = page(
      { href: "https://example.com/16.png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "https://example.com/touch.png" },
      { href: "https://example.com/mark.svg", type: "image/svg+xml" },
      { rel: "shortcut icon", href: "https://example.com/32.png", sizes: "32x32" },
      { rel: "stylesheet", href: "https://example.com/style.css" },
      { href: "http://example.com/plain.png", sizes: "64x64" },
    );
    expect(iconsOf(named)).toEqual(["https://example.com/touch.png", "https://example.com/32.png", "https://example.com/16.png", "https://example.com/mark.svg"]);
    expect(iconToAsk(named, "https://example.com/")).toBe("https://example.com/touch.png");
  });

  test("else the favicon.ico at the site's root, as Hacker News' Y is", () => {
    expect(iconToAsk(null, "https://news.ycombinator.com/news")).toBe("https://news.ycombinator.com/favicon.ico");
    expect(iconToAsk(page(), "https://example.com/blog/")).toBe("https://example.com/favicon.ico");
  });
});

describe("a picture's size, read from its file before it's drawn", () => {
  const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((char) => char.charCodeAt(0)) : part)));

  test("as PNG, GIF, JPEG, BMP, WebP and icon files say it", () => {
    expect(pictureSize(png(18, 12, () => [0, 0, 0]))).toEqual({ width: 18, height: 12 });
    expect(pictureSize(bytes("GIF89a", [0x40, 0x01, 0xf0, 0x00]))).toEqual({ width: 320, height: 240 });
    // A JPEG's start, a table (stepped over), then its frame's header.
    expect(pictureSize(bytes([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 8, 0x01, 0xe0, 0x02, 0x80, 3]))).toEqual({ width: 640, height: 480 });
    // A BMP drawn top down says its height less than nothing.
    expect(pictureSize(bytes("BM", Array(16).fill(0), [32, 0, 0, 0], [0xf0, 0xff, 0xff, 0xff]))).toEqual({ width: 32, height: 16 });
    expect(pictureSize(bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0, 0, 0, 0], [0x3f, 0x01, 0x00], [0xef, 0x00, 0x00]))).toEqual({ width: 320, height: 240 });
    // An icon file: by the PNG inside it, or where it holds another kind of picture, as its entry says (0 for 256).
    expect(pictureSize(ico(png(48, 48, () => [0, 0, 0]), 48))).toEqual({ width: 48, height: 48 });
    expect(pictureSize(bytes([0, 0, 1, 0, 1, 0], [0, 0, 0, 0, 1, 0, 32, 0], [0, 0, 0, 0], [22, 0, 0, 0]))).toEqual({ width: 256, height: 256 });
    expect(pictureSize(bytes("<html>"))).toBeNull();
  });

  test("one that says it's more than 8,192 pixels across isn't drawn, nor one whose size can't be told", () => {
    expect(drawable(png(16, 16, () => [0, 0, 0]))).toBe(true);
    expect(drawable(png(9000, 1, () => [0, 0, 0]))).toBe(false);
    expect(drawable(bytes("GIF89a", [0xff, 0xff, 0x01, 0x00]))).toBe(false);
    expect(drawable(bytes("not a picture"))).toBe(false);
  });

  test("a drawing (SVG) is told by its text, whatever it was said to be", () => {
    const text = (words: string) => new TextEncoder().encode(words);
    expect(isDrawing(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(true);
    expect(isDrawing(text('\uFEFF<?xml version="1.0"?>\n<!-- A mark -->\n<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(true);
    expect(isDrawing(text('<?xml version="1.0"?><rss version="2.0"/>'))).toBe(false);
    expect(isDrawing(text("<html><body>Not found</body></html>"))).toBe(false);
    expect(isDrawing(png(4, 4, () => [0, 0, 0]))).toBe(false);
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

  test("where a site usually keeps its feed: beside the page first, then at the root, on that site only", () => {
    const blog = usualFeeds("https://vercel.com/blog?ref=x#top");
    expect(blog.slice(0, 2)).toEqual(["https://vercel.com/blog/feed", "https://vercel.com/blog/rss"]);
    expect(blog).toContain("https://vercel.com/atom");
    expect(blog.indexOf("https://vercel.com/blog/index.xml")).toBeLessThan(blog.indexOf("https://vercel.com/feed"));
    expect(blog.every((url) => url.startsWith("https://vercel.com/"))).toBe(true);
    // A folder with or without its slash, and a page in one, are the same folder.
    expect(usualFeeds("https://example.com/news/")[0]).toBe("https://example.com/news/feed");
    expect(usualFeeds("https://example.com/news/index.html")[0]).toBe("https://example.com/news/feed");
    // A site's front page has only the root's, once each.
    const root = usualFeeds("https://example.com/");
    expect(root[0]).toBe("https://example.com/feed");
    expect(new Set(root).size).toBe(root.length);
    expect(root.length).toBe(blog.length / 2);
    // A JSON Feed's usual place, last.
    expect(root.at(-1)).toBe("https://example.com/feed.json");
    // And links that look like a JSON Feed's own (Daring Fireball's is /feeds/json).
    expect(["https://example.com/feed.json", "https://daringfireball.net/feeds/json", "https://example.com/feed/json", "https://example.com/api/data.json"].map((link) => looksLikeFeed(new URL(link)))).toEqual([true, true, true, false]);
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

describe("discussions", () => {
  test("Hacker News: only a story's comments page, over https, is read, by its id; its page is made from that alone", () => {
    const id = (link: string) => storyId(new URL(link));
    expect(id("https://news.ycombinator.com/item?id=50487185")).toBe("50487185");
    expect(id("https://news.ycombinator.com/item?id=50487185&p=2#50487190")).toBe("50487185");
    for (const link of [
      "http://news.ycombinator.com/item?id=1",
      "javascript://news.ycombinator.com/item?id=1",
      "https://news.ycombinator.com.evil.example/item?id=1",
      "https://news.ycombinator.com/item?id=abc",
      "https://news.ycombinator.com/item?id=1%0a",
      "https://news.ycombinator.com/user?id=pg",
      "https://lobste.rs/item?id=1",
    ])
      expect(id(link)).toBeNull();
    expect(storyPage("50487185")).toBe("https://news.ycombinator.com/item?id=50487185");
  });

  test("how long ago, in its largest whole unit, as a number", () => {
    const now = Date.UTC(2026, 10, 13, 12);
    const before = (seconds: number) => formatAgo(now - seconds * 1000, now);
    expect(before(12)).toBe("12 seconds ago");
    expect(before(3 * 3600 + 59 * 60)).toBe("3 hours ago");
    expect(before(86_400)).toBe("1 day ago");
    expect(before(13 * 86_400)).toBe("13 days ago");
    expect(before(45 * 86_400)).toBe("1 month ago");
    expect(before(800 * 86_400)).toBe("2 years ago");
    // A clock a little ahead of the site's isn't "in 3 seconds".
    expect(formatAgo(now + 3000, now)).toBe("0 seconds ago");
  });

  test("moving through a thread: each comment shown in turn, past those folded away, to what one answers and the last shown", () => {
    const comment = (id: string, ...replies: DiscussionComment[]): DiscussionComment => ({ id, author: id, text: [], replies });
    const thread = new Thread({ comments: [comment("a", comment("a1", comment("a1x")), comment("a2")), comment("b")] });
    const [a, a1, a1x, a2, b] = thread.all;
    const ids = (entry: { comment: DiscussionComment } | undefined) => entry?.comment.id;
    expect([a.size, a1.size, b.size, a1x.depth]).toEqual([3, 1, 0, 2]);
    expect([thread.next(a), thread.next(a1x), thread.next(a2), thread.next(b)].map(ids)).toEqual(["a1", "a2", "b", undefined]);
    expect([thread.previous(b), thread.previous(a2), thread.previous(a)].map(ids)).toEqual(["a2", "a1x", undefined]);
    a1.folded = true;
    expect([thread.next(a1), thread.previous(a2), ids(thread.shown(a1x))]).toEqual([a2, a1, "a1"]);
    a.folded = true;
    expect([thread.next(a), thread.previous(b), thread.shown(a1x)]).toEqual([b, a, a]);
    b.folded = true;
    expect(ids(thread.last())).toBe("b");
    a.folded = false;
    expect(ids(new Thread({ comments: [comment("a", comment("a1"))] }).last())).toBe("a1");
  });
});
