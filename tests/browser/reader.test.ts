import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Request } from "playwright";
import { type App, mod, noErrors, openApp } from "./app";
import { answerPictures } from "./files";

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
  await sidebar.getByRole("button", { name: "Feeds, 2 unread" }).click();
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("Feeds");
  const blog = sidebar.getByRole("button", { name: "Svelte blog, 2 unread" });
  await blog.click();
  await expect(page.locator("#note-list-title").innerText()).resolves.toBe("Svelte blog");
  // Not listed again under Types.
  expect(await sidebar.getByRole("button", { name: /^Feed\b/ }).count()).toBe(0);

  await blog.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark All as Read" }).click();
  await sidebar.getByRole("button", { name: "Svelte blog", exact: true }).waitFor();
  await sidebar.getByRole("button", { name: "Feeds", exact: true }).waitFor();

  // Every note subscribing to it goes to the Trash: a copy of its note too.
  await page.evaluate((feed) => window.testing.notes.insert({ id: "copy", body: `---\ntype: feed\nfeed: ${feed}\n---\n# Svelte blog`, createdAt: 0, updatedAt: 0, pinned: false, trashed: false }), BLOG);
  await sidebar.getByRole("button", { name: "Svelte blog", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Unsubscribe" }).click();
  await sidebar.getByRole("button", { name: "Svelte blog", exact: true }).waitFor({ state: "detached" });
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.title === "Svelte blog").map((entry) => entry.note.trashed))).toEqual([true, true]);
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
    if (route.request().url() !== feed) sent.push(route.request().url());
    return route.fulfill({ body: rss, contentType: "application/rss+xml", headers: { "access-control-allow-origin": "*" } });
  });
  await openFeeds(app);
  await subscribe(app, feed);
  const rows = page.locator(".note-list [data-post]");
  const content = page.locator(".editor-pane .cm-content");

  await rows.first().click();
  await page.waitForFunction(() => document.querySelector(".editor-pane .cm-content")?.textContent?.includes("Open the report"));
  expect(await content.locator(".cm-lp-mention, .cm-lp-tag, .cm-lp-math, .katex").count()).toBe(0);
  expect(await content.evaluate((element) => [...element.querySelectorAll<HTMLElement>("[data-href]")].map((link) => link.dataset.href))).toEqual(["https://site.example/"]);

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
