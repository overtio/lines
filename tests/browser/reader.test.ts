import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Request } from "playwright";
import { type App, noErrors, openApp } from "./app";

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

/** Answers the blog's feed with `body`, or "not modified" when asked with the ETag it had; the requests it was sent. */
async function serveBlog(app: App, body = fixture("blog.rss"), etag = '"one"') {
  const asked: Request[] = [];
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
