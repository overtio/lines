import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type App, noErrors, openApp } from "./app";
import { answerFile, png, wav } from "./files";

/*
 * The podcast player: an episode played from the Feeds, the mini player's controls, its speed kept,
 * where it was stopped kept, and played to the end. The feed and its audio are answered by the
 * test (a few seconds of sound, as WAV).
 */

const PODCAST = "https://feeds.megaphone.fm/FSI1483080183";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

async function subscribeToPodcast(app: App) {
  const page = app.page;
  const cors = { "access-control-allow-origin": "*" };
  await page.route((url) => url.href === PODCAST, (route) => route.fulfill({ body: readFileSync(new URL("./feeds/podcast.rss", import.meta.url), "utf8"), contentType: "application/rss+xml", headers: cors }));
  const audio = wav(3000);
  await page.route((url) => url.hostname === "traffic.megaphone.fm", (route) => answerFile(route, audio, "audio/wav"));
  await page.route((url) => url.hostname === "megaphone.imgix.net", (route) => route.fulfill({ body: png(4, 4, () => [200, 120, 60]), contentType: "image/png", headers: cors }));
  await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
  await page.locator(".note-list").getByRole("button", { name: "Subscribe to a Feed" }).first().click();
  const field = page.getByRole("textbox", { name: "Link to a feed, a site or a podcast on Apple Podcasts" });
  await field.fill(PODCAST);
  await field.press("Enter");
  await page.locator(".note-list [data-post]").nth(1).waitFor();
}

test("an episode plays in the mini player, which pauses, skips and keeps its speed", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app);
  await page.locator(".note-list [data-post]").first().locator("..").getByRole("button", { name: "Play Episode" }).click();

  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.waitFor();
  expect(await mini.innerText()).toContain("1055: What the hell is going on with GitHub?");
  expect(await mini.innerText()).toContain("Syntax - Tasty Web Development Treats");
  await page.waitForFunction(() => window.testing.player.playing);
  // The system's controls know what's playing.
  expect(await page.evaluate(() => navigator.mediaSession?.metadata?.title)).toBe("1055: What the hell is going on with GitHub?");

  // Its speed, round the choices, and remembered.
  await mini.getByRole("button", { name: "Speed: 1×" }).click();
  await mini.getByRole("button", { name: "Speed: 1.25×" }).waitFor();
  expect(await page.evaluate(() => window.testing.prefs.playbackRate)).toBe(1.25);

  // Paused, it keeps where it got to.
  await mini.getByRole("button", { name: "Pause" }).click();
  await page.waitForFunction(() => !window.testing.player.playing);
  await page.waitForFunction(() => {
    const { player, feeds } = window.testing;
    return player.positions.has(feeds.posts(feeds.subscriptions[0].url)[0].post.key);
  });
  const slider = mini.getByRole("slider", { name: "Position in the episode" });
  expect(await slider.getAttribute("aria-valuetext")).toMatch(/^0:0\d played, 0:0\d left$/);

  // Back 15 seconds goes to the start; the slider moves it by keyboard.
  await mini.getByRole("button", { name: "Back 15 seconds" }).click();
  expect(await page.evaluate(() => window.testing.player.time)).toBe(0);
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.testing.player.time === 1);

  await mini.getByRole("button", { name: "Stop and close the player" }).click();
  await mini.waitFor({ state: "detached" });
});

test("an episode played to its end is played, and starts again from the start", async () => {
  app = await openApp({ prefs: { playbackRate: 2 } });
  const page = app.page;
  await subscribeToPodcast(app);
  const row = page.locator(".note-list [data-post]").first();
  await row.locator("..").getByRole("button", { name: "Play Episode" }).click();
  await page.waitForFunction(() => {
    const { player, feeds } = window.testing;
    const key = feeds.posts(feeds.subscriptions[0].url)[0].post.key;
    return player.positions.get(key)?.played;
  }, undefined, { timeout: 10_000 });
  await expect(row.innerText()).resolves.toContain("Played");
});

test("an episode note plays from the button after its audio, and is listened to once played to its end", async () => {
  app = await openApp({ prefs: { playbackRate: 2 } });
  const page = app.page;
  const audio = wav(2000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const id = await app.open("---\ntype: episode\npodcast: @[Syntax]\nduration: 0:02\naudio: https://audio.example/1055.wav\nstatus: to listen\n---\n# What the hell is going on with GitHub?");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.waitFor();
  expect(await mini.innerText()).toContain("Syntax");
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.includes("status: listened"), id, { timeout: 10_000 });
  // From its row's menu too.
  await page.locator(`.note-list [data-id="${id}"]`).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Play Episode" }).waitFor();
  await page.keyboard.press("Escape");
});
