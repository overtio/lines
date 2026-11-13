import { describe, expect, mock, test } from "bun:test";
import { readDate, readDuration } from "../../src/lib/feeds/dates";
import { isFeed, mend, type Post } from "../../src/lib/feeds/parse";
import { backoff, DAY, KEEP, merge, type KeptPost } from "../../src/lib/feeds/posts";
import { writeOpml } from "../../src/lib/feeds/opml";
import { stubApp } from "./stubs";

stubApp();
mock.module("../../src/lib/release", () => ({ VERSION: "0.0.0", REPO: "https://github.com/overtio/lines" }));
const { encodingOf, readAtMost } = await import("../../src/lib/feeds/fetch");
const { linkOf, usualFeeds } = await import("../../src/lib/feeds/find");

/*
 * Feeds' logic that needs no page: dates and durations as feeds write them, keeping posts across
 * fetches, waiting after failures and reading no more than a feed's limit, links as pasted, OPML
 * written out. Reading feeds and their HTML needs the browser's
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

  test("only the newest are kept, and the rest's content goes", () => {
    const many = Array.from({ length: KEEP + 5 }, (_, i) => post(`p${i}`, i));
    const { posts, dropped, changed } = merge([], many, 0, counting());
    expect(posts).toHaveLength(KEEP);
    expect(posts[0].id).toBe(`p${KEEP + 4}`);
    expect(dropped).toEqual(["new-4", "new-3", "new-2", "new-1", "new-0"]);
    expect(changed).toHaveLength(KEEP);
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
