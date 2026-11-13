import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type App, engine, mod, noErrors, openApp } from "./app";
import { answerFile, png, wav } from "./files";

/*
 * The podcast player: an episode played from the Feeds, the mini player's controls, its speed kept,
 * where it was stopped kept (switching episodes, while one's still coming, across a restart and the
 * app lock), played to the end or stopped near it, and played again after failing. The feed and
 * its audio are answered by the test (seconds of sound, as WAV).
 */

const PODCAST = "https://feeds.megaphone.fm/FSI1483080183";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** How each of the podcast's episodes' sound is answered: as it is, a few seconds late, or not at all. */
type Answer = (url: URL) => "ok" | "slow" | "fail";

async function subscribeToPodcast(app: App, { length = 3000, answer = (() => "ok") as Answer } = {}) {
  const page = app.page;
  const cors = { "access-control-allow-origin": "*" };
  await page.route((url) => url.href === PODCAST, (route) => route.fulfill({ body: readFileSync(new URL("./feeds/podcast.rss", import.meta.url), "utf8"), contentType: "application/rss+xml", headers: cors }));
  const audio = wav(length);
  await page.route(
    (url) => url.hostname === "traffic.megaphone.fm",
    async (route) => {
      const how = answer(new URL(route.request().url()));
      if (how === "fail") return route.fulfill({ status: 404, body: "", headers: cors });
      if (how === "slow") await new Promise((resolve) => setTimeout(resolve, 3000));
      return answerFile(route, audio, "audio/wav");
    },
  );
  await page.route((url) => url.hostname === "megaphone.imgix.net", (route) => route.fulfill({ body: png(4, 4, () => [200, 120, 60]), contentType: "image/png", headers: cors }));
  await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
  await page.locator(".note-list").getByRole("button", { name: "Subscribe to a Feed" }).first().click();
  const field = page.getByRole("textbox", { name: "Link to a feed, a site or a podcast on Apple Podcasts" });
  await field.fill(PODCAST);
  await field.press("Enter");
  await page.locator(".note-list [data-post]").nth(1).waitFor();
}

/** Presses Play (or Pause) on the nth episode in the list. */
const playRow = (app: App, n: number) =>
  app.page.locator(".note-list [data-post]").nth(n).locator("..").getByRole("button", { name: /^(Play|Pause) Episode$/ }).click();
/** The episodes' keys, as listed. */
const keys = (app: App) => app.page.evaluate(() => window.testing.feeds.posts(window.testing.feeds.subscriptions[0].url).map((row) => row.post.key));
const placeOf = (app: App, key: string) => app.page.evaluate((key) => window.testing.player.positions.get(key), key);
const playing = (app: App) => app.page.waitForFunction(() => window.testing.player.playing && window.testing.player.duration > 0);

test("an episode plays in the mini player, which pauses, skips and keeps its speed", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 12_000 });
  await playRow(app, 0);

  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.waitFor();
  expect(await mini.innerText()).toContain("1055: What the hell is going on with GitHub?");
  expect(await mini.innerText()).toContain("Syntax - Tasty Web Development Treats");
  await playing(app);
  // The system's controls know what's playing.
  expect(await page.evaluate(() => navigator.mediaSession?.metadata?.title)).toBe("1055: What the hell is going on with GitHub?");

  // Its speed, round the choices, and remembered.
  await mini.getByRole("button", { name: "Speed: 1×" }).click();
  await mini.getByRole("button", { name: "Speed: 1.25×" }).waitFor();
  expect(await page.evaluate(() => window.testing.prefs.playbackRate)).toBe(1.25);

  // The slider and the times follow it as it plays.
  const slider = mini.getByRole("slider", { name: "Position in the episode" });
  await page.waitForFunction(() => Number(document.querySelector("[role=slider]")?.getAttribute("aria-valuenow")) >= 2);
  expect(await mini.innerText()).toMatch(/0:0[2-9]/);

  // Paused, it keeps where it got to.
  await mini.getByRole("button", { name: "Pause" }).click();
  await page.waitForFunction(() => !window.testing.player.playing);
  const [first] = await keys(app);
  await page.waitForFunction((key) => !!window.testing.player.positions.get(key)?.at, first);
  expect(await slider.getAttribute("aria-valuetext")).toMatch(/^0:\d\d played, 0:\d\d left$/);

  // Back 15 seconds goes to the start; the slider's arrow keys go 5 seconds.
  await mini.getByRole("button", { name: "Back 15 seconds" }).click();
  expect(await page.evaluate(() => window.testing.player.time)).toBe(0);
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.testing.player.time === 5);
  await expect(slider.getAttribute("aria-valuenow")).resolves.toBe("5");

  await mini.getByRole("button", { name: "Stop and close the player" }).click();
  await mini.waitFor({ state: "detached" });
});

test("an episode played to its end is played, and starts again from the start", async () => {
  app = await openApp({ prefs: { playbackRate: 2 } });
  const page = app.page;
  await subscribeToPodcast(app);
  const row = page.locator(".note-list [data-post]").first();
  await playRow(app, 0);
  const [first] = await keys(app);
  await page.waitForFunction((key) => window.testing.player.positions.get(key)?.played, first, { timeout: 10_000 });
  await expect(row.innerText()).resolves.toContain("Played");
});

test("switching episodes keeps each one's place, even paused before its sound has come; and one chosen meanwhile starts at its own", async () => {
  let slow = false;
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 60_000, answer: (url) => (slow && url.pathname.includes("843") ? "slow" : "ok") });
  const [first, second] = await keys(app);
  await playRow(app, 1);
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(30));
  await page.evaluate(() => window.testing.player.pause());
  await page.waitForFunction((key) => window.testing.player.positions.get(key)?.at === 30, second);

  await playRow(app, 0);
  await page.waitForFunction(() => window.testing.player.playing && window.testing.player.episode?.title.startsWith("1055"));
  await page.evaluate(() => window.testing.player.seek(10));

  // Back to the second, its sound slow to come: it's at its place, and paused before it comes, stays there.
  slow = true;
  await playRow(app, 1);
  expect(await page.evaluate(() => window.testing.player.time)).toBe(30);
  await page.evaluate(() => window.testing.player.pause());
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.testing.player.loading)).toBe(false);
  expect((await placeOf(app, second))?.at).toBe(30);

  // The first chosen while the second is still coming starts where the first was.
  await playRow(app, 1);
  await page.waitForTimeout(150);
  await playRow(app, 0);
  await page.waitForFunction(() => window.testing.player.playing && window.testing.player.episode?.title.startsWith("1055"));
  const time = await page.evaluate(() => window.testing.player.time);
  expect(time).toBeGreaterThanOrEqual(10);
  expect(time).toBeLessThan(20);
  expect((await placeOf(app, first))?.at).toBeGreaterThanOrEqual(10);
});

test("an episode that couldn't be played is played when Play is pressed again", async () => {
  let fail = true;
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { answer: () => (fail ? "fail" : "ok") });
  await playRow(app, 0);
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("alert").getByText("This episode couldn’t be played. Play tries again.").waitFor();
  fail = false;
  await mini.getByRole("button", { name: "Play", exact: true }).click();
  await playing(app);
  expect(await mini.getByRole("alert").count()).toBe(0);
  app.errors.length = 0;
});

test("Mark as Played on the episode playing puts the player away, and it stays played", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 60_000 });
  const [first] = await keys(app);
  await playRow(app, 0);
  await page.waitForFunction(() => window.testing.player.playing && window.testing.player.time > 1);
  await page.locator(".note-list [data-post]").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark as Played" }).click();
  await page.getByRole("region", { name: "Podcast player" }).waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  expect(await placeOf(app, first)).toMatchObject({ at: 0, played: true });
});

test("the episode in the player is back after a restart, paused where it was, and plays on from there", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(30));
  await page.evaluate(() => window.testing.player.pause());
  const [first] = await keys(app);
  await page.waitForFunction((key) => window.testing.player.positions.get(key)?.at === 30, first);

  await page.reload();
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.waitFor();
  expect(await mini.innerText()).toContain("1055: What the hell is going on with GitHub?");
  expect(await mini.innerText()).toContain("0:30");
  expect(await page.evaluate(() => window.testing.player.playing)).toBe(false);
  await mini.getByRole("button", { name: "Play", exact: true }).click();
  await playing(app);
  expect(await page.evaluate(() => window.testing.player.time)).toBeGreaterThanOrEqual(30);
});

test("locking lines keeps where the episode playing got to, and it's in the player again once unlocked", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 60_000 });
  await page.evaluate(() => window.testing.lock.enable("a passphrase only tests know"));
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(20));
  // Played on past where it was last kept.
  await page.waitForFunction(() => window.testing.player.time >= 22);
  await Promise.all([page.waitForEvent("load"), page.evaluate(() => void window.testing.lock.lockNow())]);
  const field = page.getByRole("textbox", { name: "Passphrase" });
  await field.fill("a passphrase only tests know");
  await field.press("Enter");
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.waitFor();
  expect(await page.evaluate(() => window.testing.player.time)).toBeGreaterThanOrEqual(22);
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

test("playing an episode pauses a sound playing in a note, and the other way round", async () => {
  app = await openApp();
  // WebKit run by Playwright can't keep a file in IndexedDB, so a note's sound can't be attached there.
  if (engine() !== "chromium") return;
  const page = app.page;
  const audio = wav(20_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const clip = await page.evaluate((bytes) => window.testing.saveAttachment(new File([new Uint8Array(bytes)], "clip.wav", { type: "audio/wav" })), [...wav(20_000)]);
  await app.open(`---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n\n[clip](../attachments/${clip})\n`);
  const sound = page.locator(".editor-pane .cm-lp-audio");
  await sound.getByRole("button", { name: "Play" }).click();
  await sound.getByRole("button", { name: "Pause" }).waitFor();
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await sound.getByRole("button", { name: "Play" }).waitFor();
  await sound.getByRole("button", { name: "Play" }).click();
  await page.waitForFunction(() => !window.testing.player.playing);
});

test("an episode note stopped near its end is listened to", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(60_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const id = await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\nstatus: to listen\n---\n# Episode");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(56));
  await page.evaluate(() => window.testing.player.pause());
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.includes("status: listened"), id);
});

test("typing in an episode note as it ends keeps what's typed; ⌘Z in another note undoes typing there, not the listening", async () => {
  app = await openApp({ prefs: { playbackRate: 2 } });
  const page = app.page;
  const audio = wav(4000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const episode = await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\nstatus: to listen\n---\n# Episode\n\n");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await page.waitForFunction(() => window.testing.player.playing);
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  const words = "the quick brown fox jumps over the lazy dog";
  await page.keyboard.type(words, { delay: 60 });
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.includes("status: listened"), episode, { timeout: 10_000 });
  await page.waitForTimeout(300);
  expect(await app.text()).toContain(words);
  expect(await app.text()).toContain("status: listened");

  // Listened again, while typing in another note.
  await page.evaluate((id) => window.testing.notes.setText(id, (body) => body.replace("status: listened", "status: to listen")), episode);
  await page.evaluate(() => window.testing.player.seek(0));
  await page.evaluate(() => window.testing.player.toggle());
  await app.open("# Other\n\n");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.type("typed words");
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.includes("status: listened"), episode, { timeout: 10_000 });
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => !window.testing.text()?.includes("typed words"));
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, episode)).toContain("status: listened");
});
