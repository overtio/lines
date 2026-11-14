import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Request, Route } from "playwright";
import { type App, choose, engine, mod, noErrors, openApp } from "./app";
import { answerPictures, ico, png } from "./files";

/*
 * The Feeds reader: subscribing, a feed's posts in the list, reading one in the note's place,
 * read and unread, and fetching again only when the feed changed. Feeds are answered by the test
 * (feeds/), as a site that lets web pages read it would.
 */

const fixture = (name: string) => readFileSync(new URL(`./feeds/${name}`, import.meta.url), "utf8");
const BLOG = "https://site.example/feed.xml";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** Answers the blog's feed with `body`, or "not modified" when asked with the ETag it had, and its picture; the requests it was sent. */
async function serveBlog(app: App, body = fixture("blog.rss"), etag = '"one"') {
  const asked: Request[] = [];
  await answerPictures(app.page);
  await app.page.route(
    (url) => url.href === BLOG,
    (route) => {
      asked.push(route.request());
      const headers = { "access-control-allow-origin": "*", "access-control-expose-headers": "ETag", etag, "cache-control": "no-cache" };
      if (route.request().headers()["if-none-match"] === etag) return route.fulfill({ status: 304, headers });
      return route.fulfill({ body, contentType: "application/rss+xml", headers });
    },
  );
  return asked;
}

const openFeeds = (app: App, feed?: string) => app.page.evaluate((feed) => window.testing.notes.setFilter({ kind: "feeds", ...(feed && { feed }) }), feed);

async function subscribe(app: App, link: string) {
  const page = app.page;
  await page.locator(".note-list").getByRole("button", { name: "Subscribe to a Feed" }).first().click();
  const field = page.getByRole("textbox", { name: "Link to a feed, a site or a podcast on Apple Podcasts" });
  await field.fill(link);
  await field.press("Enter");
  await field.waitFor({ state: "detached" });
}

test("subscribing makes a note for the feed, and lists its posts, unread", async () => {
  app = await openApp();
  await serveBlog(app);
  await openFeeds(app);
  await app.page.getByText("No feeds yet.").waitFor();
  await subscribe(app, BLOG);

  const page = app.page;
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("Svelte blog");
  const rows = page.locator(".note-list [data-post]");
  await rows.first().waitFor();
  expect(await rows.count()).toBe(2);
  // Screen readers hear it's unread, where it's from and when.
  expect(await rows.first().innerText()).toContain("What’s new in Svelte: October 2026");
  expect(await rows.first().textContent()).toContain("unread");
  expect(await rows.first().locator("time").getAttribute("datetime")).toBe("2026-10-31T00:00:00.000Z");

  // The subscription is a note of the feed's, filed rather than in the Inbox.
  const note = await page.evaluate(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Svelte blog")?.note);
  expect(note?.body).toContain(`feed: ${BLOG}`);
  expect(note?.body).toContain("type: feed");
  expect(note?.inbox).toBeFalsy();

  // Subscribing again doesn't make another.
  await subscribe(app, BLOG);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.title === "Svelte blog").length)).toBe(1);
});

test("a post opens read-only in the note's place, marked read; Mark as Unread and the arrow keys", async () => {
  app = await openApp({ timezone: "UTC" });
  await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  const rows = page.locator(".note-list [data-post]");
  await rows.first().click();

  // Drawn as a note: its title, where it's from, and its HTML as Markdown, which can't be edited.
  const post = page.getByRole("textbox", { name: "Post: What’s new in Svelte: October 2026" });
  await post.waitFor();
  await expect(post.getAttribute("contenteditable")).resolves.toBe("false");
  await page.waitForFunction(() => document.querySelector(".editor-pane .cm-content")?.textContent?.includes("announcement post"));
  expect(await page.locator(".editor-pane .cm-post-byline").innerText()).toBe("Svelte blog · Dani Sandoval · October 31");
  expect(await rows.first().textContent()).not.toContain("unread");

  await page.getByRole("button", { name: "Mark as Unread" }).click();
  await expect(rows.first().textContent()).resolves.toContain("unread");

  // ↓ opens the next, and reads it.
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("textbox", { name: "Post: SvelteKit 3 is here" }).waitFor();
  await expect(rows.nth(1).textContent()).resolves.not.toContain("unread");
  await page.waitForFunction(() => document.activeElement?.closest("[data-post]") === document.querySelectorAll(".note-list [data-post]")[1]);
});

test("an aggregator's post (Hacker News'): its title links to it, the site it's of and its comments under it, and a click opens them", async () => {
  app = await openApp({ timezone: "UTC" });
  const page = app.page;
  const news = "https://news.example/rss";
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>Hacker News</title><link>https://news.example/</link><description>Links</description>
    <item><title>Lonewolf 0.3 – A standalone XMPP server written in Rust</title><link>https://www.lonewolf.example/blog/0.3</link><pubDate>Fri, 13 Nov 2026 17:55:28 +0000</pubDate>
    <comments>https://news.example/item?id=1</comments><description><![CDATA[<a href="https://news.example/item?id=1">Comments</a>]]></description></item></channel></rss>`;
  await page.route(news, (route) => route.fulfill({ body: feed, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" } }));
  await openFeeds(app);
  await subscribe(app, news);
  await page.locator(".note-list [data-post]").first().click();
  await page.getByRole("textbox", { name: "Post: Lonewolf 0.3 – A standalone XMPP server written in Rust" }).waitFor();
  const byline = page.locator(".editor-pane .cm-post-byline");
  await byline.waitFor();
  expect(await byline.innerText()).toBe("Hacker News · lonewolf.example · November 13 · Comments");
  // Its "Comments" is under its title, not again below. (What the page it links to says of itself is shown in the apps, which read pages.)
  expect((await page.locator(".editor-pane .cm-content").innerText()).match(/Comments/g)).toHaveLength(1);

  // A click on a link in what's only read opens it, whatever a click on a note's link does.
  await page.evaluate(() => {
    const opened: string[] = [];
    Object.assign(window, { opened, open: (url: string) => void opened.push(url) });
  });
  await page.locator(".editor-pane .cm-post-title .cm-lp-link").click();
  await byline.locator(".cm-lp-link", { hasText: "Comments" }).click();
  await byline.locator(".cm-lp-link", { hasText: "lonewolf.example" }).click();
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([
    "https://www.lonewolf.example/blog/0.3",
    "https://news.example/item?id=1",
    "https://www.lonewolf.example/blog/0.3",
  ]);
});

test("refreshing asks whether the feed changed, keeps what was read, and adds new posts unread", async () => {
  app = await openApp();
  const asked = await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  const rows = page.locator(".note-list [data-post]");
  await rows.first().click();
  await page.getByRole("textbox", { name: "Post: What’s new in Svelte: October 2026" }).waitFor();

  // Unchanged: the browser asks with the ETag it kept, and the site says so.
  await page.getByRole("button", { name: "Refresh Feed" }).click();
  await page.waitForFunction(() => !window.testing.feeds.fetching.size);
  expect(asked.length).toBe(2);

  // Changed: a new post at the top, unread; the one read stays read.
  await page.unroute((url) => url.href === BLOG);
  const newer = fixture("blog.rss").replace("<item>", "<item><title>Svelte 6</title><link>https://svelte.dev/blog/svelte-6</link><pubDate>Tue, 10 Nov 2026 00:00:00 GMT</pubDate><description>Soon.</description></item><item>");
  await serveBlog(app, newer, '"two"');
  await page.getByRole("button", { name: "Refresh Feed" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".note-list [data-post]").length === 3);
  expect(await rows.first().innerText()).toContain("Svelte 6");
  expect(await rows.first().textContent()).toContain("unread");
  expect(await rows.nth(1).textContent()).not.toContain("unread");
});

test("the Library's + is a menu of Add to Library and Subscribe to a Feed, which opens the Feeds and the box to subscribe", async () => {
  app = await openApp();
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Add to Library" }).click();
  await page.getByRole("menuitem", { name: "Add to Library" }).waitFor();
  await page.getByRole("menuitem", { name: "Subscribe to a Feed" }).click();
  await page.getByRole("textbox", { name: "Link to a feed, a site or a podcast on Apple Podcasts" }).waitFor();
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("Feeds");
});

test("Feeds in the Library: its row and each feed's, counting what's unread; a feed's menu marks it read, and unsubscribes", async () => {
  app = await openApp();
  await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("button", { name: "RSS Feeds, 2 unread" }).click();
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("RSS Feeds");
  const blog = sidebar.getByRole("button", { name: "Svelte blog, 2 unread" });
  await blog.click();
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("Svelte blog");
  // Not listed again under Types.
  expect(await sidebar.getByRole("button", { name: /^Feed\b/ }).count()).toBe(0);

  await blog.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark All as Read" }).click();
  await sidebar.getByRole("button", { name: "Svelte blog", exact: true }).waitFor();
  await sidebar.getByRole("button", { name: "RSS Feeds", exact: true }).waitFor();

  // Every note subscribing to it goes to the Trash: a copy of its note too.
  await page.evaluate((feed) => window.testing.notes.insert({ id: "copy", body: `---\ntype: feed\nfeed: ${feed}\n---\n# Svelte blog`, createdAt: 0, updatedAt: 0, pinned: false, trashed: false }), BLOG);
  await sidebar.getByRole("button", { name: "Svelte blog", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Unsubscribe" }).click();
  await sidebar.getByRole("button", { name: "Svelte blog", exact: true }).waitFor({ state: "detached" });
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.title === "Svelte blog").map((entry) => entry.note.trashed))).toEqual([true, true]);
});

/** Subscribes to each of these feeds (by address, its fixture in feeds/), answered by the test. */
async function subscribeAll(app: App, feeds: Record<string, string>) {
  await answerPictures(app.page);
  for (const [url, name] of Object.entries(feeds)) {
    const body = fixture(name);
    await app.page.route((asked) => asked.href === url, (route) => route.fulfill({ body, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" } }));
    await app.page.evaluate((url) => window.testing.feeds.subscribe(url), url);
  }
}

const KINDS = {
  [BLOG]: "blog.rss",
  "https://daringfireball.net/feeds/main": "blog.atom",
  "https://feeds.megaphone.fm/FSI1483080183": "podcast.rss",
  "https://rss.slashdot.org/Slashdot/slashdot": "slashdot.rdf",
};

test("feeds by kind: RSS (and RSS 1.0), Atom and podcasts' each a row, its feeds under it, its posts listed, read, folded, hidden and moved", async () => {
  // Nonsense where the setting is saved reads as By Kind.
  app = await openApp({ prefs: { feedsInSidebar: "sideways" } });
  await subscribeAll(app, KINDS);
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const rows = () => sidebar.locator("[data-reorder-key^='feeds:']").evaluateAll((all) => all.map((row) => row.getAttribute("aria-label") ?? row.textContent?.trim()));
  await sidebar.getByRole("button", { name: "Podcast Feeds, 2 unread" }).waitFor();
  expect(await rows()).toEqual(["RSS Feeds, 4 unread", "Atom Feeds, 2 unread", "Podcast Feeds, 2 unread"]);
  expect(await sidebar.getByRole("button", { name: /^Feeds\b/ }).count()).toBe(0);
  expect(await sidebar.getByRole("list", { name: "RSS Feeds" }).getByRole("button").evaluateAll((all) => all.map((row) => row.getAttribute("aria-label")))).toEqual(["Slashdot, 2 unread", "Svelte blog, 2 unread"]);

  // A kind's posts, and its menu marks only them read.
  await sidebar.getByRole("button", { name: "Atom Feeds, 2 unread" }).click();
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("Atom Feeds");
  expect(await page.locator(".note-list [data-post]").count()).toBe(2);
  await sidebar.getByRole("button", { name: "Atom Feeds, 2 unread" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark All as Read" }).click();
  await sidebar.getByRole("button", { name: "Atom Feeds", exact: true }).waitFor();
  expect(await rows()).toEqual(["RSS Feeds, 4 unread", "Atom Feeds", "Podcast Feeds, 2 unread"]);

  // Its feeds fold away, and stay folded.
  await sidebar.getByRole("button", { name: "Show the feeds in RSS Feeds" }).click();
  await sidebar.getByRole("button", { name: "Svelte blog, 2 unread" }).waitFor({ state: "detached" });
  await expect(sidebar.getByRole("button", { name: "Show the feeds in RSS Feeds" }).getAttribute("aria-expanded")).resolves.toBe("false");

  // Moved with ⌥↑, it goes with its feeds; hidden, it's back from Show Hidden.
  await sidebar.getByRole("button", { name: "Podcast Feeds, 2 unread" }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForFunction(() => document.querySelector("[data-reorder-key^='feeds:']")?.closest("li")?.nextElementSibling?.querySelector("[data-reorder-key]")?.getAttribute("data-reorder-key") === "feeds:podcast");
  expect(await rows()).toEqual(["RSS Feeds, 4 unread", "Podcast Feeds, 2 unread", "Atom Feeds"]);
  await sidebar.getByRole("button", { name: "Atom Feeds", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide" }).click();
  await sidebar.getByRole("button", { name: "Atom Feeds", exact: true }).waitFor({ state: "detached" });
  await sidebar.getByRole("button", { name: "RSS Feeds, 4 unread" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show Hidden" }).click();
  await page.getByRole("menuitem", { name: "Atom Feeds" }).click();
  await sidebar.getByRole("button", { name: "Atom Feeds", exact: true }).waitFor();
});

test("a feed kept from before its format was is with RSS (a podcast's with podcasts') until it's fetched", async () => {
  app = await openApp();
  const page = app.page;
  const atom = "https://daringfireball.net/feeds/main";
  const body = fixture("blog.atom");
  await page.route((url) => url.href === atom, (route) => route.fulfill({ body, contentType: "application/atom+xml", headers: { "access-control-allow-origin": "*" } }));
  await page.evaluate(
    async ({ atom, body }) => {
      const { feeds, notes, reading } = window.testing;
      const { format: _, ...unknown } = reading.readFeed(body, atom);
      await feeds.take(atom, unknown, {});
      await notes.insert({ id: "fireball", body: `---\ntype: feed\nfeed: ${atom}\n---\n# Daring Fireball`, createdAt: 0, updatedAt: 0, pinned: false, trashed: false });
      await notes.insert({ id: "show", body: "---\ntype: podcast\nfeed: https://podcast.example/feed\n---\n# A Show", createdAt: 0, updatedAt: 0, pinned: false, trashed: false });
    },
    { atom, body },
  );
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("list", { name: "RSS Feeds" }).getByRole("button", { name: /^Daring Fireball/ }).waitFor();
  await sidebar.getByRole("list", { name: "Podcast Feeds" }).getByRole("button", { name: /^A Show/ }).waitFor();
  await page.evaluate((atom) => window.testing.feeds.refresh([atom]), atom);
  await sidebar.getByRole("list", { name: "Atom Feeds" }).getByRole("button", { name: /^Daring Fireball/ }).waitFor();
  app.errors.length = 0;
});

test("Settings → Library → Feeds in the sidebar: Together is one Feeds row of every feed, By Kind a row each", async () => {
  app = await openApp();
  await subscribeAll(app, { [BLOG]: "blog.rss", "https://daringfireball.net/feeds/main": "blog.atom" });
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("button", { name: "Atom Feeds, 2 unread" }).waitFor();
  const dialog = await app.settings("Library");
  await choose(dialog, "Feeds in the sidebar", "Together");
  await sidebar.getByRole("button", { name: "Feeds, 4 unread" }).waitFor();
  expect(await sidebar.getByRole("button", { name: /^(RSS|Atom) Feeds/ }).count()).toBe(0);
  expect(await page.evaluate(() => window.testing.prefs.feedsInSidebar)).toBe("together");
  await choose(dialog, "Feeds in the sidebar", "By Kind");
  await sidebar.getByRole("button", { name: "RSS Feeds, 2 unread" }).waitFor();
  await app.closeSettings();
});

test("a feed with no picture of its own is made with its site's icon as its note's cover, each site asked once; a podcast's is its artwork or none; a cover taken out stays out", async () => {
  app = await openApp();
  const page = app.page;
  const asked: string[] = [];
  const answer = (body: string | Buffer, contentType: string) => (route: Route) => {
    asked.push(route.request().url());
    return route.fulfill({ body, contentType, headers: { "access-control-allow-origin": "*" } });
  };
  // Daring Fireball's page names a tab's icon and a phone's: the larger is kept. Hacker News' names its Y. A quiet blog's
  // names none, and its favicon.ico can't be had: Playwright doesn't let a test answer for one (it aborts every request for it).
  // A podcast's artwork can't be had either (nothing answers for it but the tests' empty catch-all), nor is its site asked.
  await page.route("https://daringfireball.net/", answer('<html><head><link rel="icon" href="/favicon-16.png" sizes="16x16"><link rel="apple-touch-icon" href="/apple-touch-icon.png"></head></html>', "text/html"));
  await page.route("https://daringfireball.net/apple-touch-icon.png", answer(png(180, 180, () => [74, 85, 104]), "image/png"));
  await page.route("https://daringfireball.net/favicon-16.png", answer(png(16, 16, () => [74, 85, 104]), "image/png"));
  await page.route("https://news.ycombinator.com/", answer('<html><head><link rel="icon" href="y18.ico"></head></html>', "text/html"));
  await page.route("https://news.ycombinator.com/y18.ico", answer(ico(png(18, 18, (x, y) => (x > 4 && x < 13 && y > 4 && y < 13 ? [255, 255, 255] : [255, 102, 0])), 18), "image/x-icon"));
  await page.route("https://quiet.example/", answer("<html><head><title>Quiet</title></head></html>", "text/html"));
  await page.route((url) => url.hostname === "syntax.fm", answer("", "text/html"));
  const PODCAST = "https://feeds.megaphone.fm/FSI1483080183";
  const feeds: Record<string, string> = {
    "https://daringfireball.net/feeds/main": fixture("blog.atom"),
    "https://news.ycombinator.com/rss": fixture("hn.rss"),
    "https://news.ycombinator.com/newest": fixture("hn.rss"),
    "https://quiet.example/feed.xml": '<rss version="2.0"><channel><title>Quiet</title><link>https://quiet.example/</link><item><title>Hello</title><guid>1</guid></item></channel></rss>',
    [PODCAST]: fixture("podcast.rss"),
  };
  for (const [url, body] of Object.entries(feeds)) await page.route(url, (route) => route.fulfill({ body, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" } }));

  // Found and drawn as a small PNG at its own size, up to 128 pixels, in every browser.
  const icon = (site: string) =>
    page.evaluate(async (site) => {
      const found = await window.testing.reading.siteIcon(site, new AbortController().signal);
      return found && { side: found.side, type: found.picture.type };
    }, site);
  expect(await icon("https://daringfireball.net/")).toEqual({ side: 128, type: "image/png" });
  expect(await icon("https://news.ycombinator.com/")).toEqual({ side: 18, type: "image/png" });
  expect(await icon("https://quiet.example/")).toBeUndefined();
  expect(asked.filter((url) => url.includes("favicon-16"))).toEqual([]);

  asked.length = 0;
  for (const url of Object.keys(feeds)) await page.evaluate((url) => window.testing.feeds.subscribe(url), url);
  const sidebar = page.getByRole("navigation", { name: "Library" });
  // The width its cover is shown at in the note of the subscription to `feed`, which has it as it's made.
  const cover = (feed: string) =>
    page.evaluate((feed) => {
      const { feeds, notes } = window.testing;
      return notes.get(feeds.notesOf(feed)[0])?.note.body.match(/!\[[^\]]*\|(\d+)\]\(\.\.\/attachments\/[0-9a-f]{32}\.png\)/)?.[1];
    }, feed);
  if (engine() === "chromium") {
    expect(await Promise.all(Object.keys(feeds).map(cover))).toEqual(["128", "18", "18", undefined, undefined]);
    await sidebar.getByRole("button", { name: /^Daring Fireball/ }).locator("img").waitFor();
    await sidebar.getByRole("button", { name: /^Hacker News/ }).first().locator("img").waitFor();
  }
  expect(await sidebar.getByRole("button", { name: /^Quiet/ }).locator("img").count()).toBe(0);
  expect(await sidebar.getByRole("button", { name: /^Syntax/ }).locator("img").count()).toBe(0);
  // Its page, then its icon: two requests to a site at most, Hacker News' once for both its feeds, and none to the podcast's.
  const sites = (urls: string[]) => urls.filter((url) => !(url in feeds));
  expect(sites(asked).length).toBeLessThanOrEqual(5);
  expect(asked.filter((url) => url.endsWith("/y18.ico"))).toHaveLength(1);
  expect(asked.filter((url) => url.includes("syntax.fm"))).toEqual([]);

  // Its picture taken out of a subscription's note isn't put back as the feeds are fetched again; nor is any site asked again.
  const HN = "https://news.ycombinator.com/rss";
  await page.evaluate((feed) => {
    const { feeds, notes } = window.testing;
    notes.setText(feeds.notesOf(feed)[0], (body) => body.replace(/!\[[^\]]*\]\(\.\.\/attachments\/[0-9a-f]{32}\.png\)\n*/, ""));
  }, HN);
  asked.length = 0;
  await page.evaluate(() => window.testing.feeds.refresh());
  await page.waitForFunction(() => !window.testing.feeds.fetching.size);
  await page.waitForTimeout(300);
  expect(sites(asked)).toEqual([]);
  expect(await cover(HN)).toBeUndefined();
});

test("Get Its Picture, in a subscription's menu, gives one without a picture its site's icon; a note locked meanwhile is left as it was", async () => {
  app = await openApp();
  const page = app.page;
  const FEED = "https://plain.example/feed.xml";
  const cors = { "access-control-allow-origin": "*" };
  // Its site names no icon as it's subscribed to (and its favicon.ico can't be had), then a black ring on nothing, whose answer waits.
  let named = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const ring = png(32, 32, (x, y) => (Math.abs(Math.hypot(x - 15.5, y - 15.5) - 11) < 3 ? [24, 23, 23, 255] : [0, 0, 0, 0]));
  await page.route("https://plain.example/", (route) =>
    route.fulfill({ body: named ? '<html><head><link rel="icon" href="/mark.png"></head></html>' : "<html></html>", contentType: "text/html", headers: cors }),
  );
  await page.route("https://plain.example/mark.png", async (route) => {
    await held;
    await route.fulfill({ body: ring, contentType: "image/png", headers: cors });
  });
  await page.route(FEED, (route) => route.fulfill({ body: fixture("plain.rss"), contentType: "application/rss+xml", headers: cors }));
  await page.evaluate((url) => window.testing.feeds.subscribe(url), FEED);
  const id = await page.evaluate((url) => window.testing.feeds.notesOf(url)[0], FEED);
  const body = () => page.evaluate((id) => window.testing.notes.get(id)?.note.body, id);
  const before = await body();
  expect(before).not.toContain("](../attachments/");

  const row = page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Plain Notes/ });
  const getPicture = page.getByRole("menuitem", { name: "Get Its Picture" });
  named = true;
  const asking = page.waitForRequest("https://plain.example/mark.png");
  await row.click({ button: "right" });
  await getPicture.click();
  await asking;
  await page.evaluate(async (id) => {
    const { noteKeys, notes } = window.testing;
    noteKeys.save({ key: (await noteKeys.create("a password")).key, touchId: false });
    notes.lock(id);
  }, id);
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.locked, id);
  release();
  await page.waitForResponse("https://plain.example/mark.png");
  await page.waitForTimeout(500);
  expect(await body()).toBe(before);

  // WebKit's test browser can't keep a picture (an attachment): what follows is Chromium's.
  if (engine() !== "chromium") return;
  await page.evaluate((id) => window.testing.notes.removeLock(id), id);
  await row.click({ button: "right" });
  await getPicture.click();
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.includes("](../attachments/"), id);
  // Its icon you can see through, black all over, is marked so: on a tile in a dark theme.
  await expect(row.locator("img").getAttribute("data-tone")).resolves.toBe("dark");
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open Its Note" }).waitFor();
  expect(await getPicture.count()).toBe(0);
  await page.keyboard.press("Escape");
});

test("Get Missing Pictures, in RSS Feeds' menu, gives each of its feeds without a picture its site's icon and says how many; not a podcast's", async () => {
  app = await openApp();
  const page = app.page;
  const cors = { "access-control-allow-origin": "*" };
  const asked: string[] = [];
  // Neither site names an icon as it's subscribed to; then one does. A podcast's artwork can't be had.
  let named = false;
  await page.route("https://plain.example/", (route) =>
    route.fulfill({ body: named ? '<html><head><link rel="icon" href="/mark.png"></head></html>' : "<html></html>", contentType: "text/html", headers: cors }),
  );
  await page.route("https://plain.example/mark.png", (route) => route.fulfill({ body: png(32, 32, () => [24, 23, 23]), contentType: "image/png", headers: cors }));
  await page.route("https://quiet.example/", (route) => route.fulfill({ body: "<html></html>", contentType: "text/html", headers: cors }));
  await page.route((url) => url.hostname === "syntax.fm", (route) => {
    asked.push(route.request().url());
    return route.fulfill({ body: "", contentType: "text/html", headers: cors });
  });
  const PODCAST = "https://feeds.megaphone.fm/FSI1483080183";
  const feeds: Record<string, string> = {
    "https://plain.example/feed.xml": fixture("plain.rss"),
    "https://quiet.example/feed.xml": '<rss version="2.0"><channel><title>Quiet</title><link>https://quiet.example/</link><item><title>Hello</title><guid>1</guid></item></channel></rss>',
    [PODCAST]: fixture("podcast.rss"),
  };
  for (const [url, body] of Object.entries(feeds)) {
    await page.route(url, (route) => route.fulfill({ body, contentType: "application/rss+xml", headers: cors }));
    await page.evaluate((url) => window.testing.feeds.subscribe(url), url);
  }
  // A podcast's picture is its artwork, left to its own menu.
  expect(await page.evaluate((urls) => window.testing.feeds.withoutPictures(urls), Object.keys(feeds))).toEqual(["https://plain.example/feed.xml", "https://quiet.example/feed.xml"]);

  named = true;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("button", { name: /^RSS Feeds/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Get Missing Pictures" }).click();
  // In WebKit's test browser, which can't keep a picture, none is found.
  const found = engine() === "chromium" ? "Found a picture for 1 feed" : "No pictures found";
  await page.waitForFunction((text) => document.querySelector("body > [aria-live=polite].sr-only")?.textContent === text, found);
  expect(asked).toEqual([]);
  if (engine() !== "chromium") return;
  await sidebar.getByRole("button", { name: /^Plain Notes/ }).locator("img").waitFor();
  expect(await page.evaluate((urls) => window.testing.feeds.withoutPictures(urls), Object.keys(feeds))).toEqual(["https://quiet.example/feed.xml"]);
});

test("a site's icon file (.ico) or drawing (.svg, whatever it's said to be) is kept as a PNG at its own size, a drawing at 128 pixels; one too big to draw isn't", async () => {
  app = await openApp();
  const drawn = await app.page.evaluate(
    async (files) => {
      const { iconPicture } = window.testing.reading;
      const bytes = (file: number[] | string) => (typeof file === "string" ? new TextEncoder().encode(file) : new Uint8Array(file));
      const found = await Promise.all(files.map((file) => iconPicture(bytes(file), 128)));
      return found.map((icon) => (icon ? [icon.side, icon.picture.type] : null));
    },
    [
      [...ico(png(32, 32, () => [255, 102, 0]), 32)],
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#f60"/></svg>',
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- A mark -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#f60"/></svg>',
      [...png(9000, 1, () => [0, 0, 0])],
      "not a picture",
    ],
  );
  expect(drawn).toEqual([[32, "image/png"], [128, "image/png"], [128, "image/png"], null, null]);
});

test("Save to Library keeps a post as an article, made as the Library makes notes, and then opens it", async () => {
  app = await openApp({ timezone: "UTC" });
  await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  await page.locator(".note-list").getByRole("button", { name: /^What’s new in Svelte/ }).click();
  await page.getByRole("button", { name: "Save to Library" }).click();
  await page.getByRole("button", { name: "Open in Library" }).click();
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: article\n"));
  expect(await app.text()).toStartWith(
    "---\ntype: article\nauthor: Dani Sandoval\nsite: Svelte blog\npublished: 2026-10-31\nlink: https://svelte.dev/blog/whats-new-in-svelte-october-2026\nstatus: to read\n---\n# What’s new in Svelte: October 2026\n\nSvelteKit 3 is here! Check out the announcement post for the highlights",
  );
});

test("a new note that's just a feed's link becomes a subscription, its posts kept from the one fetch", async () => {
  app = await openApp();
  const asked = await serveBlog(app);
  const page = app.page;
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "# ");
  await page.keyboard.press(`${mod()}+a`);
  await page.keyboard.press("Backspace");
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.querySelector(".editor-pane [data-pane-content='main'] .cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, BLOG);
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: feed\n"));
  expect(await app.text()).toStartWith(`---\ntype: feed\nfeed: ${BLOG}\nlink: https://svelte.dev/blog\n---\n# Svelte blog\n`);
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Svelte blog, 2 unread" }).waitFor();
  // Not fetched again as the subscription appeared.
  await page.waitForTimeout(2500);
  expect(asked.length).toBe(1);
});

test("searching finds posts by their words; Mark All as Read; trashing the note unsubscribes", async () => {
  app = await openApp();
  await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  const rows = page.locator(".note-list [data-post]");
  await rows.first().waitFor();

  await page.getByRole("searchbox", { name: "Search notes" }).fill("upgrading");
  await page.waitForFunction(() => document.querySelectorAll(".note-list [data-post]").length === 1);
  await page.getByRole("searchbox", { name: "Search notes" }).fill("");

  await page.evaluate(() => window.testing.feeds.readAll());
  await page.waitForFunction(() => !document.querySelector(".note-list")?.textContent?.includes("unread"));

  await page.evaluate(() => {
    const note = window.testing.notes.entries.find((entry) => entry.meta.title === "Svelte blog")!.note;
    window.testing.notes.trashMany([note.id]);
  });
  await openFeeds(app);
  await page.getByText("No feeds yet.").waitFor();
});

test("OPML in: each feed fetched for what it says, one that can't be kept as the file says; OPML out", async () => {
  app = await openApp();
  await serveBlog(app);
  const page = app.page;
  await page.route((url) => url.href === "https://gone.example/rss", (route) => route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" } }));
  const opml = `<?xml version="1.0"?><opml version="2.0"><body><outline text="Blogs">
    <outline type="rss" text="Svelte (from the file)" xmlUrl="${BLOG}"/>
    <outline type="rss" text="Gone" xmlUrl="https://gone.example/rss" htmlUrl="https://gone.example/"/>
  </outline></body></opml>`;
  expect(await page.evaluate((opml) => window.testing.feeds.importOpml(opml), opml)).toBe(2);
  const titles = await page.evaluate(() => window.testing.feeds.subscriptions.map(({ title }) => title));
  expect(titles).toEqual(["Gone", "Svelte blog"]);
  // Again, nothing new.
  expect(await page.evaluate((opml) => window.testing.feeds.importOpml(opml), opml)).toBe(0);

  const out = await page.evaluate(() => window.testing.feeds.exportOpml());
  expect(out).toContain('<outline type="rss" text="Gone" title="Gone" xmlUrl="https://gone.example/rss" htmlUrl="https://gone.example/"/>');
  expect(out).toContain(`<outline type="rss" text="Svelte blog" title="Svelte blog" xmlUrl="${BLOG}" htmlUrl="https://svelte.dev/blog"/>`);
  app.errors.length = 0;
});

test("a feed the site won't let the web app read says why, quietly", async () => {
  app = await openApp();
  await openFeeds(app);
  const page = app.page;
  await page.route((url) => url.href === "https://closed.example/feed", (route) => route.abort("failed"));
  await page.evaluate(() => window.testing.notes.insert({ id: "closed", body: "---\ntype: feed\nfeed: https://closed.example/feed\n---\n# Closed", createdAt: 0, updatedAt: 0, pinned: false, trashed: false }));
  await page.evaluate(() => window.testing.feeds.refresh());
  await page.getByText("On the web, lines can read only the feeds whose sites allow it.", { exact: false }).waitFor();
  await openFeeds(app, "https://closed.example/feed");
  await page.getByText("This feed’s site doesn’t let web pages read it. The desktop apps can.").waitFor();
  app.errors.length = 0;
});

/** What's kept of feeds on this device, as stored: each feed's record and each post's content. */
const stored = (app: App) =>
  app.page.evaluate(
    () =>
      new Promise<{ feeds: unknown[]; posts: unknown[] }>((resolve, reject) => {
        const request = indexedDB.open("lines-feeds");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const names = ["feeds", "posts"].filter((name) => db.objectStoreNames.contains(name));
          if (names.length < 2) return resolve({ feeds: [], posts: [] });
          const transaction = db.transaction(names);
          const feeds = transaction.objectStore("feeds").getAll();
          const posts = transaction.objectStore("posts").getAll();
          transaction.oncomplete = () => {
            db.close();
            resolve({ feeds: feeds.result, posts: posts.result });
          };
        };
      }),
  );

/** Resolves once what's stored is as `ready` says it should be (it's written a moment after it's kept). */
async function untilStored(app: App, ready: (kept: Awaited<ReturnType<typeof stored>>) => boolean) {
  for (let tries = 0; tries < 50; tries++) {
    if (ready(await stored(app))) return;
    await app.page.waitForTimeout(100);
  }
  throw new Error("not stored in time");
}

/** A feed of `count` posts, each with `size` characters of content, as the page reads it. */
const madeFeed = (app: App, url: string, count: number, size = 100, version = "") =>
  app.page.evaluate(
    ({ url, count, size, version }) => {
      const items = Array.from({ length: count }, (_, i) => `<item><title>Post ${i}</title><guid>${url}#${i}</guid><pubDate>${new Date(Date.UTC(2026, 10, 1) - i * 3_600_000).toUTCString()}</pubDate><description>${"x".repeat(size)} ${version}</description></item>`);
      return window.testing.reading.readFeed(`<rss version="2.0"><channel><title>Made</title>${items.join("")}</channel></rss>`, url);
    },
    { url, count, size, version },
  );

test("a post is only read: its links go to the web alone, its code never runs or sends, and nothing in it acts as lines' own", async () => {
  app = await openApp();
  const page = app.page;
  const feed = "https://crafted.example/feed.xml";
  const escape = (html: string) => html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const first = `<div>Read this<i><pre>[Open the report](file:///System/Applications/Calculator.app)\n@[Secret plans] #pwned $x^2$ [[New note]]</pre></i></div><p><a href="file:///etc/passwd">local</a> <a href="https://site.example/">web</a></p>`;
  const second = `<p>Try our API:</p><pre class="language-http">GET https://crafted.example/collect?k=1</pre><pre class="language-mermaid">graph TD; A--&gt;B</pre>`;
  const rss = `<rss version="2.0"><channel><title>Crafted</title>
    <item><title>One</title><guid>1</guid><pubDate>Tue, 10 Nov 2026 18:00:00 GMT</pubDate><description>${escape(first)}</description></item>
    <item><title>Two</title><guid>2</guid><pubDate>Mon, 09 Nov 2026 18:00:00 GMT</pubDate><description>${escape(second)}</description></item>
  </channel></rss>`;
  const sent: string[] = [];
  await page.route((url) => url.hostname === "crafted.example", (route) => {
    // Besides the feed, and its site's page, asked once for an icon for it.
    if (route.request().url() !== feed && route.request().url() !== "https://crafted.example/") sent.push(route.request().url());
    return route.fulfill({ body: rss, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" } });
  });
  await openFeeds(app);
  await subscribe(app, feed);
  const rows = page.locator(".note-list [data-post]");
  const content = page.locator(".editor-pane .cm-content");

  await rows.first().click();
  await page.waitForFunction(() => document.querySelector(".editor-pane .cm-content")?.textContent?.includes("Open the report"));
  expect(await content.locator(".cm-lp-mention, .cm-lp-tag, .cm-lp-math, .katex").count()).toBe(0);
  // Its title, a link to it (its guid read as its address), and its one link to the web.
  expect(await content.evaluate((element) => [...element.querySelectorAll<HTMLElement>("[data-href]")].map((link) => link.dataset.href))).toEqual([
    "https://crafted.example/1",
    "https://site.example/",
  ]);

  await rows.nth(1).click();
  await page.waitForFunction(() => document.querySelector(".editor-pane .cm-content")?.textContent?.includes("Try our API"));
  await page.waitForTimeout(500);
  // Shown as code: no Send, no diagram.
  expect(await page.locator(".editor-pane").getByRole("button", { name: "Send" }).count()).toBe(0);
  expect(await page.locator(".editor-pane svg[id^='mermaid'], .editor-pane .cm-rendered").count()).toBe(0);
  await expect(content.innerText()).resolves.toContain("GET https://crafted.example/collect?k=1");
  expect(sent).toEqual([]);
});

test("a post whose content can't be read from this device says so", async () => {
  app = await openApp();
  await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  await page.evaluate(() => (window.testing.feeds.content = () => Promise.reject(new Error("gone"))));
  await page.locator(".note-list [data-post]").first().click();
  await page.getByRole("alert").getByText("This post couldn’t be read from this device.").waitFor();
  app.errors.length = 0;
});

test("a post read while its feed is being kept stays read", async () => {
  app = await openApp();
  const page = app.page;
  const url = "https://race.example/feed.xml";
  await page.evaluate(({ url, feed }) => window.testing.feeds.take(url, feed, {}), { url, feed: await madeFeed(app, url, 100, 20_000, "one") });
  const kept = await page.evaluate(
    async ({ url, feed }) => {
      const { feeds } = window.testing;
      const posts = feeds.records.get(url)!.posts;
      const delays = [0, 2, 5, 10, 20, 40, 80, 160, 320];
      const taking = feeds.take(url, feed, {});
      await Promise.all(delays.map((ms, i) => new Promise<void>((resolve) => setTimeout(() => resolve(feeds.setRead(url, [posts[i].id])), ms))));
      await taking;
      return delays.map((_, i) => feeds.records.get(url)!.posts.find((post) => post.id === posts[i].id)!.read);
    },
    { url, feed: await madeFeed(app, url, 100, 20_000, "two") },
  );
  expect(kept.every(Boolean)).toBe(true);
});

test("Save to Library pressed again while it saves makes one note", async () => {
  app = await openApp();
  const page = app.page;
  const url = "https://twice.example/feed.xml";
  const made = await page.evaluate(async ({ url, feed }) => {
    const { feeds, notes } = window.testing;
    await feeds.take(url, feed, {});
    const row = feeds.posts(url)[0];
    const saving = [feeds.save(row), feeds.save(row)];
    const busy = feeds.saving.has(row.post.key);
    const ids = await Promise.all(saving);
    return { busy, ids: new Set(ids).size, notes: notes.entries.filter((entry) => entry.note.body.includes(`link: ${url}#0`)).length };
  }, { url, feed: await madeFeed(app, url, 1) });
  expect(made).toEqual({ busy: true, ids: 1, notes: 1 });
});

test("with the app lock on, what's kept of feeds is encrypted; Erase This Device takes it all", async () => {
  app = await openApp();
  await serveBlog(app);
  await openFeeds(app);
  await subscribe(app, BLOG);
  const page = app.page;
  // A feed being kept as the lock goes on is encrypted too.
  const big = "https://big.example/feed.xml";
  const feed = await madeFeed(app, big, 100, 20_000, "plain words");
  await page.evaluate(async ({ big, feed }) => {
    const { feeds, lock } = window.testing;
    const taking = feeds.take(big, feed, {});
    await lock.enable("a passphrase only tests know");
    await taking;
  }, { big, feed });
  const kept = await stored(app);
  expect([kept.feeds.length, kept.posts.length]).toEqual([2, 102]);
  const text = JSON.stringify(kept);
  for (const plain of ["Svelte", "site.example", "svelte.dev", "announcement", "big.example", "plain words"]) expect(text).not.toContain(plain);

  await Promise.all([page.waitForEvent("load"), page.evaluate(() => void window.testing.lock.lockNow())]);
  await page.getByRole("button", { name: "Forgot your passphrase?" }).click();
  await page.getByRole("button", { name: "Erase this device…" }).click();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Erase", exact: true }).click()]);
  await page.waitForFunction(() => window.testing?.notes.ready);
  expect(await stored(app)).toEqual({ feeds: [], posts: [] });
});

test("at start, what's kept of a feed no note subscribes to goes", async () => {
  app = await openApp();
  await serveBlog(app);
  const page = app.page;
  const orphan = "https://orphan.example/feed.xml";
  await page.evaluate(({ orphan, feed }) => window.testing.feeds.take(orphan, feed, {}), { orphan, feed: await madeFeed(app, orphan, 3, 100, "left behind") });
  await openFeeds(app);
  await subscribe(app, BLOG);
  await untilStored(app, (kept) => kept.feeds.length === 2 && kept.posts.length === 5);

  await page.reload();
  await page.waitForFunction(() => window.testing?.feeds.loaded);
  const kept = await stored(app);
  expect([kept.feeds.length, kept.posts.length]).toEqual([1, 2]);
  expect(JSON.stringify(kept)).not.toContain("left behind");
  expect(await page.evaluate(() => [...window.testing.feeds.records.keys()])).toEqual([BLOG]);
});

/** Answers the feeds `answer` knows, slowly, counting how many are asked at once, in all and of one site. */
async function answerSlowly(app: App, answer: (url: string) => { status?: number; body?: string; headers?: Record<string, string> } | null) {
  const counts = { asked: [] as string[], atOnce: 0, mostAtOnce: 0, mostOfOneSite: 0 };
  const ofSite = new Map<string, number>();
  await app.page.route(
    (url) => !!answer(url.href),
    async (route) => {
      const url = route.request().url();
      const site = new URL(url).host;
      counts.asked.push(url);
      counts.mostAtOnce = Math.max(counts.mostAtOnce, ++counts.atOnce);
      ofSite.set(site, (ofSite.get(site) ?? 0) + 1);
      counts.mostOfOneSite = Math.max(counts.mostOfOneSite, ofSite.get(site)!);
      await new Promise((resolve) => setTimeout(resolve, 150));
      counts.atOnce--;
      ofSite.set(site, ofSite.get(site)! - 1);
      const { status = 200, body = "", headers = {} } = answer(url)!;
      return route.fulfill({ status, body, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "Retry-After", ...headers } });
    },
  );
  return counts;
}

test("feeds are fetched a few at a time, never two of one site at once", async () => {
  app = await openApp();
  const page = app.page;
  const urls = ["a", "b", "c", "d"].flatMap((site) => [1, 2].map((n) => `https://${site}.example/${n}.xml`));
  const counts = await answerSlowly(app, (url) => (urls.includes(url) ? { body: `<rss version="2.0"><channel><title>${url}</title></channel></rss>` } : null));
  await page.evaluate((urls) => window.testing.feeds.refresh(urls), urls);
  await page.waitForFunction((count) => window.testing.feeds.records.size === count && !window.testing.feeds.fetching.size, urls.length);
  expect([counts.asked.length, counts.mostAtOnce, counts.mostOfOneSite]).toEqual([8, 3, 1]);
});

test("a feed that said to wait, that keeps failing, or that's gone isn't asked again until it's time; ⟳ asks anyway", async () => {
  app = await openApp();
  const page = app.page;
  const [busy, broken, gone] = ["https://busy.example/feed", "https://broken.example/feed", "https://gone.example/feed"];
  const answers: Record<string, { status: number; headers?: Record<string, string> }> = {
    // Years: it's asked again within a day.
    [busy]: { status: 429, headers: { "retry-after": "999999999" } },
    [broken]: { status: 500 },
    [gone]: { status: 410 },
  };
  const counts = await answerSlowly(app, (url) => answers[url] ?? null);
  await page.evaluate((urls) => {
    for (const [i, url] of urls.entries()) void window.testing.notes.insert({ id: `feed-${i}`, body: `---\ntype: feed\nfeed: ${url}\n---\n# Feed ${i}`, createdAt: 0, updatedAt: 0, pinned: false, trashed: false });
  }, Object.keys(answers));
  // Each fetched once its note has settled.
  await page.waitForFunction((count) => [...window.testing.feeds.records.values()].filter((record) => record.error).length === count, 3);
  const records = () =>
    page.evaluate(() => Object.fromEntries([...window.testing.feeds.records.values()].map(({ url, error, failures, gone, retryAt, checked }) => [url, { error, failures, gone, wait: (retryAt ?? 0) - checked! }])));
  const minutes = (count: number) => count * 60_000;
  expect(await records()).toEqual({
    [busy]: { error: "HTTP 429", failures: 1, gone: false, wait: minutes(24 * 60) },
    [broken]: { error: "HTTP 500", failures: 1, gone: false, wait: minutes(30) },
    [gone]: { error: "HTTP 410", failures: 1, gone: true, wait: minutes(30) },
  });

  // Not due, then: none is asked.
  counts.asked.length = 0;
  await page.evaluate(() => window.testing.feeds.refreshDue(0));
  await page.waitForTimeout(400);
  expect(counts.asked).toEqual([]);

  // ⟳ asks anyway; failing again, it waits twice as long.
  await page.evaluate((urls) => window.testing.feeds.refresh(urls), [broken, gone]);
  await page.waitForFunction(() => !window.testing.feeds.fetching.size);
  expect([...counts.asked].sort()).toEqual([broken, gone]);
  expect((await records())[broken]).toEqual({ error: "HTTP 500", failures: 2, gone: false, wait: minutes(60) });
  await openFeeds(app, gone);
  await page.getByText("The feed is gone for good, its site says.", { exact: false }).waitFor();
  app.errors.length = 0;
});

test("OPML in fetches its feeds in turn, as refreshing does, keeping why one couldn't be and when to ask again", async () => {
  app = await openApp();
  const page = app.page;
  const urls = ["a", "b", "c"].map((name) => `https://busy.example/${name}.xml`);
  const counts = await answerSlowly(app, (url) => (urls.includes(url) ? { status: 429, headers: { "retry-after": "3600" } } : null));
  const opml = `<?xml version="1.0"?><opml version="2.0"><body>${urls.map((url, i) => `<outline text="Feed ${i}" xmlUrl="${url}"/>`).join("")}</body></opml>`;
  const before = Date.now();
  expect(await page.evaluate((opml) => window.testing.feeds.importOpml(opml), opml)).toBe(3);
  expect([counts.asked.length, counts.mostOfOneSite]).toEqual([3, 1]);
  const records = await page.evaluate(() => [...window.testing.feeds.records.values()].map(({ error, retryAt }) => ({ error, retryAt: retryAt! })));
  expect(records.map(({ error }) => error)).toEqual(["HTTP 429", "HTTP 429", "HTTP 429"]);
  for (const { retryAt } of records) expect(retryAt - before).toBeGreaterThanOrEqual(3_600_000);
  expect(await page.evaluate(() => window.testing.feeds.subscriptions.map(({ title }) => title))).toEqual(["Feed 0", "Feed 1", "Feed 2"]);
  app.errors.length = 0;
});
