import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Page, Route } from "playwright";
import { type App, engine, noErrors, openApp } from "./app";
import { answerPictures, png } from "./files";

/*
 * YouTube's channels: a channel's link subscribed to, as a note of its own in Channels and its
 * videos under Video Feeds; read from its page while its feed is missing; a video's post playing
 * in place; a video saved, its channel mentioned. YouTube is answered by the test, as the apps read
 * it (a trimmed copy of a channel's page, its feed, a stand-in player): nothing reaches the network.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const fixture = (name: string) => readFileSync(new URL(`./feeds/${name}`, import.meta.url), "utf8");
const CORS = { "access-control-allow-origin": "*" };
const ID = "UCtidepoolscience0000001";
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${ID}`;
const HANDLE = "https://www.youtube.com/@tidepools";

/**
 * Answers YouTube as the apps read it: the channel's page (by handle and by id), its feed (`feed`,
 * a status for a missing one), its picture, oEmbed for its videos, and a stand-in player. The
 * addresses asked of it.
 */
async function serveYouTube(page: Page, { feed = fixture("youtube.atom") as string | number, channel = fixture("youtube-channel.html") } = {}) {
  const asked: string[] = [];
  const answers = { feed, channel };
  await answerPictures(page);
  await page.route(
    (url) => /(^|\.)(youtube|youtube-nocookie|googleusercontent)\.com$/.test(url.hostname),
    (route: Route) => {
      const url = new URL(route.request().url());
      asked.push(url.href);
      if (url.hostname === "yt3.googleusercontent.com") return route.fulfill({ headers: CORS, contentType: "image/png", body: png(64, 64, () => [40, 120, 140]) });
      if (url.hostname === "www.youtube-nocookie.com") return route.fulfill({ contentType: "text/html", body: PLAYER });
      if (url.pathname === "/oembed") {
        const id = new URL(url.searchParams.get("url")!).searchParams.get("v");
        return route.fulfill({ headers: CORS, json: { title: id === "tidepool003" ? "How hermit crabs trade shells" : "Anemones at low tide", author_name: "Tide Pool Science", author_url: HANDLE } });
      }
      if (url.href === FEED) {
        const { feed } = answers;
        return typeof feed === "number" ? route.fulfill({ status: feed, headers: CORS, body: "" }) : route.fulfill({ headers: CORS, contentType: "application/atom+xml", body: feed });
      }
      if (url.pathname.endsWith("/videos")) return route.fulfill({ headers: CORS, contentType: "text/html", body: answers.channel });
      return route.fulfill({ status: 404, headers: CORS, body: "" });
    },
  );
  return { asked, answers };
}

/**
 * YouTube's player: says nothing until it's spoken to (`listening`), then that it's ready; plays and
 * pauses when told, saying so, as its IFrame API's messages do (November 2026). What it's told is `told`.
 */
const PLAYER = `<!doctype html><script>
  window.told = [];
  const say = (fields) => parent.postMessage(JSON.stringify({ ...fields, id: 1, channel: "widget" }), "*");
  addEventListener("message", (event) => {
    const { event: kind, func, args } = JSON.parse(event.data);
    if (kind === "listening") {
      if (!told.includes("listening")) {
        told.push("listening");
        say({ event: "initialDelivery", info: { playerState: -1 } });
        say({ event: "onReady" });
      }
      return;
    }
    told.push([func, ...(args ?? [])].join(" "));
    if (func === "playVideo") {
      say({ event: "infoDelivery", info: { playerState: 3 } });
      say({ event: "onStateChange", info: 1 });
    }
    if (func === "pauseVideo") say({ event: "onStateChange", info: 2 });
  });
</script>`;

/** Pastes `text` where the cursor is in the open note, as the system's paste does: how a note that's just a link is made. */
const paste = (page: Page, text: string) =>
  page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.querySelector(".editor-pane [data-pane-content='main'] .cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);

const subscribe = (page: Page, link: string) => page.evaluate((link) => window.testing.feeds.subscribe(link), link);
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Library" });
const bodyOf = (page: Page, feed: string) => page.evaluate((feed) => window.testing.notes.get(window.testing.feeds.notesOf(feed)[0])?.note.body, feed);

test("a channel's link subscribed to is a note in Channels, its picture its cover, and its videos are under Video Feeds, a Short among them", async () => {
  app = await openApp();
  const { page } = app;
  const { asked } = await serveYouTube(page);
  expect(await subscribe(page, "https://www.youtube.com/@tidepools/featured")).toBe(FEED);
  const body = await bodyOf(page, FEED);
  expect(body).toStartWith(`---\ntype: channel\nfeed: ${FEED}\nlink: ${HANDLE}\n---\n# Tide Pool Science\n`);
  expect(body).toContain("Small worlds between the tides");
  if (engine() === "chromium") expect(body).toMatch(/!\[Tide Pool Science\|240\]\(\.\.\/attachments\/[0-9a-f]{32}\.jpg\)/);
  // Its page once, in English, then its feed once.
  expect(asked.filter((url) => !url.includes("googleusercontent"))).toEqual(["https://www.youtube.com/@tidepools/videos", FEED]);

  await sidebar(page).getByRole("button", { name: "Video Feeds, 3 unread" }).waitFor();
  await sidebar(page).getByRole("button", { name: "Tide Pool Science, 3 unread" }).waitFor();
  await sidebar(page).getByRole("button", { name: /^Channels/ }).waitFor();
  const posts = await page.evaluate((feed) => window.testing.feeds.posts(feed).map(({ post }) => [post.title, post.link, post.image, post.excerpt.slice(0, 33)]), FEED);
  expect(posts).toEqual([
    ["A crab in ten seconds", "https://www.youtube.com/shorts/tidepoolsh1", "https://i3.ytimg.com/vi/tidepoolsh1/hqdefault.jpg", "One crab, one shell, ten seconds."],
    ["How hermit crabs trade shells", "https://www.youtube.com/watch?v=tidepool003", "https://i2.ytimg.com/vi/tidepool003/hqdefault.jpg", "When a bigger shell turns up, the"],
    ["Anemones at low tide", "https://www.youtube.com/watch?v=tidepool002", "https://i1.ytimg.com/vi/tidepool002/hqdefault.jpg", "They close when the water goes, a"],
  ]);
  // Subscribed to again, by a video of its: the same channel, nothing more made.
  expect(await subscribe(page, "https://youtu.be/tidepool002")).toBe(FEED);
  expect(await page.evaluate((feed) => window.testing.feeds.notesOf(feed).length, FEED)).toBe(1);
});

test("a note that's just a channel's link becomes the channel, subscribed to", async () => {
  app = await openApp();
  const { page } = app;
  await serveYouTube(page);
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, `https://www.youtube.com/channel/${ID}/videos`);
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: channel\n"));
  expect(await app.text()).toStartWith(`---\ntype: channel\nfeed: ${FEED}\nlink: ${HANDLE}\n---\n# Tide Pool Science\n`);
  await sidebar(page).getByRole("button", { name: "Tide Pool Science, 3 unread" }).waitFor();
});

test("a video's post shows its picture and what it says, and plays in place, YouTube's player loaded only once it's played", async () => {
  app = await openApp();
  const { page } = app;
  const { asked } = await serveYouTube(page);
  await subscribe(page, HANDLE);
  await page.evaluate((feed) => window.testing.notes.setFilter({ kind: "feeds", feed }), FEED);
  await page.locator(".note-list").getByRole("button", { name: /^How hermit crabs trade shells/ }).click();
  const card = page.getByRole("group", { name: "How hermit crabs trade shells" });
  await card.waitFor();
  expect(await card.locator("img").getAttribute("src")).toBe("https://i.ytimg.com/vi/tidepool003/hqdefault.jpg");
  await page.locator(".cm-content").getByText("Filmed at Point Lobos over three low tides.").waitFor();
  expect(asked.filter((url) => url.includes("youtube-nocookie"))).toEqual([]);

  await card.getByRole("button", { name: "Play with YouTube" }).click();
  const element = page.locator('iframe[title^="YouTube player"]');
  await element.waitFor();
  const src = new URL((await element.getAttribute("src"))!);
  expect(src.origin + src.pathname).toBe("https://www.youtube-nocookie.com/embed/tidepool003");
  expect(src.searchParams.get("enablejsapi")).toBe("1");
  expect(await element.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
  const frame = (await (await element.elementHandle())!.contentFrame())!;
  // Spoken to until it answers, then asked to say how it plays, and played.
  await frame.waitForFunction(() => (window as unknown as { told?: string[] }).told?.includes("playVideo"));
  expect(await frame.evaluate(() => (window as unknown as { told: string[] }).told)).toEqual(["listening", "addEventListener onStateChange", "playVideo"]);
});

test("a channel whose feed is missing is read from its page, its videos' dates a guess until the feed's back, which puts them right; a page changed past reading guesses nothing", async () => {
  app = await openApp({ timezone: "UTC" });
  const { page } = app;
  const { answers } = await serveYouTube(page, { feed: 404 });
  expect(await subscribe(page, HANDLE)).toBe(FEED);
  const posts = () => page.evaluate((feed) => window.testing.feeds.posts(feed).map(({ post }) => ({ title: post.title, date: post.date, approximate: post.approximate })), FEED);
  const guessed = await posts();
  expect(guessed.map(({ title }) => title)).toEqual(["How hermit crabs trade shells", "Anemones at low tide", "Why the sea comes back twice a day"]);
  expect(guessed.every(({ approximate, date }) => approximate && date)).toBe(true);
  await sidebar(page).getByRole("button", { name: "Tide Pool Science, 3 unread" }).waitFor();

  // Fetched again with the feed missing still: its guesses stay as they were, not moved on by "2 days ago" a day later.
  await page.evaluate(() => window.testing.feeds.refresh());
  await page.waitForFunction(() => !window.testing.feeds.fetching.size);
  expect((await posts()).map(({ date }) => date)).toEqual(guessed.map(({ date }) => date));

  // The feed back: its dates, and its Short; those it no longer lists kept.
  answers.feed = fixture("youtube.atom");
  await page.evaluate(() => window.testing.feeds.refresh());
  await page.waitForFunction(() => !window.testing.feeds.fetching.size);
  const exact = await posts();
  expect(exact.find(({ title }) => title === "How hermit crabs trade shells")?.date).toBe(Date.UTC(2026, 10, 12, 15, 30));
  expect(exact.map(({ title }) => title)).toContain("A crab in ten seconds");
  expect(exact.find(({ title }) => title === "Why the sea comes back twice a day")?.approximate).toBe(true);

  // Missing again, and its page changed past reading: the feed couldn't be fetched, and nothing's guessed or lost.
  answers.feed = 404;
  answers.channel = fixture("youtube-channel.html").replace(/"lockupViewModel"/g, '"somethingNew"');
  await page.evaluate(() => window.testing.feeds.refresh());
  await page.waitForFunction(() => !window.testing.feeds.fetching.size);
  expect(await page.evaluate((feed) => window.testing.feeds.records.get(feed)?.error, FEED)).toBe("HTTP 404");
  expect((await posts()).length).toBe(exact.length);
  app.errors.length = 0;
});

test("a video saved from a channel's post mentions the channel's note; a video's link note links to its channel's page while the Library hasn't it", async () => {
  app = await openApp({ timezone: "UTC" });
  const { page } = app;
  await serveYouTube(page);
  await subscribe(page, HANDLE);
  await page.evaluate((feed) => window.testing.notes.setFilter({ kind: "feeds", feed }), FEED);
  await page.locator(".note-list").getByRole("button", { name: /^How hermit crabs trade shells/ }).click();
  await page.getByRole("button", { name: "Save to Library" }).click();
  await page.getByRole("button", { name: "Open in Library" }).click();
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: video\n"));
  expect(await app.text()).toStartWith("---\ntype: video\nchannel: @[Tide Pool Science]\nlink: https://www.youtube.com/watch?v=tidepool003\nstatus: to watch\n---\n# How hermit crabs trade shells\n");
  // Its row says the channel's name.
  await sidebar(page).getByRole("button", { name: /^Videos/ }).click();
  await page.locator(".note-list").getByText("Tide Pool Science", { exact: true }).waitFor();

  // The channel's note in the Trash: a video's link becomes a note linking to the channel's page, not mentioning a note that isn't there.
  await page.evaluate((feed) => window.testing.notes.trashMany(window.testing.feeds.notesOf(feed)), FEED);
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, "https://www.youtube.com/watch?v=tidepool002");
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: video\n"));
  expect(await app.text()).toStartWith("---\ntype: video\nchannel: [Tide Pool Science](https://www.youtube.com/@tidepools)\n");
});

test("on the web, where YouTube doesn't let pages read it, subscribing to a channel says so", async () => {
  app = await openApp();
  const { page } = app;
  // As a web page asking YouTube fails: it gives no leave to read it (CORS), which a test's answer can't withhold.
  await page.route((url) => url.hostname === "www.youtube.com", (route: Route) => route.abort("failed"));
  await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
  await page.locator(".note-list").getByRole("button", { name: "Subscribe to a Feed" }).first().click();
  const field = page.getByRole("textbox", { name: "Link to a feed, a site or a podcast on Apple Podcasts" });
  await field.fill(HANDLE);
  await field.press("Enter");
  await page.getByText("This feed’s site doesn’t let web pages read it. The desktop apps can.").waitFor();
  expect(await page.evaluate(() => window.testing.feeds.subscriptions.length)).toBe(0);
  app.errors.length = 0;
});
