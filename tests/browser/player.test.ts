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
  // The note open takes it up as it's written from outside.
  await page.waitForFunction(() => window.testing.text()?.includes("status: listened"));
  expect(await app.text()).toContain(words);

  // Listened again, while typing in another note. Played again from Play, as someone would: WebKit
  // plays only from a click, and without one it sometimes didn't, and nothing was listened to.
  await page.evaluate((id) => window.testing.notes.setText(id, (body) => body.replace("status: listened", "status: to listen")), episode);
  await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => window.testing.player.playing);
  await app.open("# Other\n\n");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.type("typed words");
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.includes("status: listened"), episode, { timeout: 10_000 });
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => !window.testing.text()?.includes("typed words"));
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, episode)).toContain("status: listened");
});

/*
 * Notes while listening: Take Notes, times written in notes and played from, and the player's keys.
 */

/** The player's keys where the page runs: ⌃⌘ and arrows on a Mac (WebKit says it's one on Linux too), Ctrl+Alt with P , . and S elsewhere. */
async function playerKeys(app: App) {
  const mac = await app.page.evaluate(() => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  const chord = mac ? "Control+Meta" : "Control+Alt";
  return { toggle: `${chord}+p`, back: `${chord}+${mac ? "ArrowLeft" : ","}`, forward: `${chord}+${mac ? "ArrowRight" : "."}`, time: `${chord}+${mac ? "t" : "s"}` };
}
const at = (app: App) => app.page.evaluate(() => Math.round(window.testing.player.time));

test("Take Notes saves the episode playing, opens its note at the end on a line with the time, and the time plays it from there", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(12));
  await page.evaluate(() => window.testing.player.pause());

  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Take Notes" }).click();
  await page.waitForFunction(() => window.testing.text()?.endsWith("- [0:12] "));
  expect(await app.text()).toContain("type: episode");
  // Saved as a note, which the player keeps the episode's place by now.
  const note = await page.evaluate(() => window.testing.notes.selectedId!);
  expect(await page.evaluate(() => window.testing.player.episode?.from)).toEqual({ note });
  await page.keyboard.type("GitHub's outages");
  expect(await app.text()).toMatch(/\n\n- \[0:12\] GitHub's outages$/);

  // Pressed again further on: the next item, which ⌘Z takes back.
  await page.evaluate(() => window.testing.player.seek(31));
  await mini.getByRole("button", { name: "Take Notes" }).click();
  await page.waitForFunction(() => window.testing.text()?.endsWith("- [0:12] GitHub's outages\n- [0:31] "));
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.text()?.endsWith("- [0:12] GitHub's outages"));

  // Away from the cursor, the time is a chip that plays the episode from there.
  await page.keyboard.press(`${mod()}+Home`);
  await page.locator(".cm-content").getByRole("button", { name: "Play from 0:12" }).click();
  await playing(app);
  expect(await at(app)).toBeGreaterThanOrEqual(12);
  expect(await at(app)).toBeLessThan(16);
});

test("the time's key writes the time in any note as a link to the sound, and ⌥↵ on it plays it from there", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 90_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(65));
  await page.evaluate(() => window.testing.player.pause());
  const audio = await page.evaluate(() => window.testing.player.episode!.audio);
  const keys = await playerKeys(app);

  await app.open("# Listening\n\nAbout outages");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press(keys.time);
  expect(await app.text()).toBe(`# Listening\n\nAbout outages [1:05](${audio}#t=65) `);

  // ⌥↵ with the cursor on it plays from there: the same episode, its post's.
  await page.evaluate(() => window.testing.player.seek(0));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Alt+Enter");
  await playing(app);
  expect(await at(app)).toBeGreaterThanOrEqual(65);
  expect(await page.evaluate(() => "feed" in window.testing.player.episode!.from)).toBe(true);
  // Away from the cursor, a chip.
  await page.keyboard.press(`${mod()}+Home`);
  await page.locator(".cm-content").getByRole("button", { name: "Play from 1:05" }).waitFor();
});

/**
 * The podcast's episode's transcript and chapters (feeds/), as the feed names them: answered, or not
 * read at all (`readable: false`), as a page sees a site that doesn't let it read them (Playwright's
 * own answers pass the browser's check, so that's how one that doesn't is told from one that does).
 */
async function serveTranscript(app: App, { readable = true } = {}) {
  const served: Record<string, [string, string]> = {
    "/1055/transcript.vtt": ["transcript.vtt", "text/vtt"],
    "/1055/chapters.json": ["chapters.json", "application/json"],
  };
  const headers = { "access-control-allow-origin": "*" };
  await app.page.route(
    (url) => url.hostname === "syntax.fm",
    (route) => {
      if (!readable) return route.abort("accessdenied");
      const file = served[new URL(route.request().url()).pathname];
      return file
        ? route.fulfill({ body: readFileSync(new URL(`./feeds/${file[0]}`, import.meta.url), "utf8"), contentType: file[1], headers })
        : route.fulfill({ status: 404, body: "", headers });
    },
  );
}

/** What screen readers were last told (a11y.ts's live region), once it's `text`. */
const spoken = (app: App, text: string) => app.page.waitForFunction((text) => document.querySelector("body > [aria-live=polite].sr-only")?.textContent === text, text);

test("an episode's transcript follows it as it plays, plays from a line, and quotes the line playing into the note open", async () => {
  app = await openApp();
  const page = app.page;
  await serveTranscript(app);
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(10));

  const mini = page.getByRole("region", { name: "Podcast player" });
  const toggle = mini.getByRole("button", { name: "Transcript" });
  await toggle.click();
  expect(await toggle.getAttribute("aria-expanded")).toBe("true");
  const lines = mini.getByRole("list", { name: "Transcript" });
  // Its sentences put together, each with who says it, its chapters between them, the one playing marked.
  await lines.getByRole("button", { name: /So what do you do/ }).waitFor();
  const texts = await lines.getByRole("button").allInnerTexts();
  expect(texts.map((text) => text.replace(/\s+/g, " "))).toEqual([
    // A chapter is said to be one.
    "Chapter 0:00 Welcome to Syntax!",
    "0:00 · Scott Welcome to Syntax.",
    "0:03 · Wes Today we're asking what is going on with GitHub.",
    "Chapter 0:09 The traffic changed shape",
    "0:09 · Kyle The short answer is that the traffic changed shape.",
    "0:15 · Kyle Agents open far more pull requests than people do.",
    "0:21 · Scott So what do you do about it?",
  ]);
  expect(await lines.locator("[aria-current=true]").innerText()).toContain("The short answer");
  expect(await mini.innerText()).toContain("The traffic changed shape");

  // A line plays from where it starts; ↓ moves to the next.
  await lines.getByRole("button", { name: /Agents open/ }).click();
  await playing(app);
  expect(await at(app)).toBeGreaterThanOrEqual(15);
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => document.activeElement?.textContent)).toContain("So what do you do");
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(16));

  // Quote puts the line playing in the note open, after the cursor's line, with its time as a link.
  await app.open("# Notes\n\nOn agents");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await mini.getByRole("button", { name: "Quote in Note" }).click();
  const audio = await page.evaluate(() => window.testing.player.episode!.audio);
  await page.waitForFunction(() => window.testing.text()?.includes("> ["));
  expect(await app.text()).toBe(`# Notes\n\nOn agents\n\n> [0:15](${audio}#t=15) Agents open far more pull requests than people do. — Kyle\n\n`);
});

test("the player's keys play, pause and skip from inside a note's text", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 120_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(60));
  await app.open("# Notes\n\n");
  await page.locator(".cm-content").click();
  const keys = await playerKeys(app);

  await page.keyboard.press(keys.toggle);
  await page.waitForFunction(() => !window.testing.player.playing);
  await page.evaluate(() => window.testing.player.seek(60));
  await page.keyboard.press(keys.back);
  expect(await at(app)).toBe(45);
  await page.keyboard.press(keys.forward);
  await page.keyboard.press(keys.forward);
  expect(await at(app)).toBe(105);
  await page.keyboard.press(keys.toggle);
  await playing(app);
  // Nothing was typed, and ⌃⌘P isn't ⌘P's PDF preview.
  expect(await app.text()).toBe("# Notes\n\n");
  expect(await page.getByRole("dialog").count()).toBe(0);

  // Held down, play and pause is pressed once.
  const [modifiers, key] = [keys.toggle.split("+").slice(0, -1), "p"];
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  await page.keyboard.down(key);
  await page.keyboard.down(key);
  await page.keyboard.down(key);
  await page.keyboard.up(key);
  for (const modifier of modifiers) await page.keyboard.up(modifier);
  await page.waitForFunction(() => !window.testing.player.playing);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.testing.player.playing)).toBe(false);
});

test("writing the time with nothing in the player says so, after the cursor and to screen readers, and writes nothing; a /time typed goes", async () => {
  app = await openApp();
  const page = app.page;
  const NOTHING = "Nothing’s playing: play an episode to write the time it’s at.";
  const notice = page.locator(".cm-content .cm-time-notice");
  await app.open("# Notes\n\n");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press((await playerKeys(app)).time);
  await spoken(app, NOTHING);
  expect(await notice.innerText()).toBe(NOTHING);
  expect(await app.text()).toBe("# Notes\n\n");
  // Typing on, it goes.
  await page.keyboard.type("Notes");
  await notice.waitFor({ state: "detached" });

  await page.keyboard.type(" /time");
  await page.locator(".cm-tooltip-autocomplete").getByText("Time in the Episode").waitFor();
  await page.keyboard.press("Enter");
  await notice.waitFor();
  expect(await app.text()).toBe("# Notes\n\nNotes ");
  // And on its own, a while later.
  await notice.waitFor({ state: "detached", timeout: 6000 });
});

test("Enter writes no time where a list's item only looks like one, in code, math, HTML or the properties, nor while another episode is in the player", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(60_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const body = [
    "---",
    "type: episode",
    "audio: https://audio.example/e.wav",
    "---",
    "# Episode",
    "",
    "```",
    "- [0:00] code",
    "```",
    "",
    "$$",
    "- [0:00] math",
    "$$",
    "",
    "<div>",
    "- [0:00] html",
    "</div>",
    "",
    "- [0:00] First",
  ].join("\n");
  await app.open(body);
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(42));
  for (const line of ["- [0:00] code", "- [0:00] math", "- [0:00] html"]) {
    await page.evaluate((line) => {
      const view = window.testing.editor()!;
      const at = view.state.doc.toString().indexOf(line) + line.length;
      view.focus();
      view.dispatch({ selection: { anchor: at } });
    }, line);
    await page.keyboard.press("Enter");
    expect(await app.text()).not.toContain("[0:42]");
    await page.keyboard.press(`${mod()}+z`);
  }
  await page.waitForFunction((body) => window.testing.text() === body, body);

  // Another episode's note, with this one in the player: Markdown's own Enter.
  await app.open("---\ntype: episode\naudio: https://audio.example/other.wav\n---\n# Other\n\n- [0:00] First");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:00] First\n- ");
});

test("Enter writes no time for an episode paused before lines opened, until it plays again", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(60_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const id = await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n\n- [0:00] First");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(30));
  await page.evaluate(() => window.testing.player.pause());
  await page.waitForFunction((id) => window.testing.player.positions.get(id)?.at === 30, id);

  await page.reload();
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.waitFor();
  await page.evaluate((id) => window.testing.notes.show(id), id);
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:00] First\n- ");

  await mini.getByRole("button", { name: "Play", exact: true }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(45));
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.text()?.endsWith("- [0:00] First"));
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:00] First\n- [0:45] ");
});

test("only times of sound files on the web are chips, a time's link plays from its #t=, and `[3:16]` in an ordinary note stays text", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(20_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  await app.open(
    "# Mixed\n\nJohn [3:16]. [1:00](https://audio.example/e.wav#t=5), [0:05](javascript:alert(1)#t=5), [0:06](file:///Users/me/e.mp3#t=6), [0:07](https://syntax.fm/1055#t=7)\n",
  );
  const chips = page.locator(".cm-content .cm-time");
  await chips.first().waitFor();
  expect(await chips.count()).toBe(1);
  expect(await page.locator(".cm-content").innerText()).toContain("John [3:16].");
  await page.locator(".cm-content").getByRole("button", { name: "Play from 1:00" }).click();
  await playing(app);
  // Where the link says, not its text.
  expect(await at(app)).toBeLessThan(10);
});

test("a time linking another sound plays it alone: it's not the note's, which it neither opens, takes notes in, nor marks listened", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(2000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const mine = await app.open("---\ntype: episode\naudio: https://audio.example/mine.wav\nstatus: to listen\n---\n# Mine\n\n[0:01](https://audio.example/other.wav#t=1)\n");
  await page.locator(".cm-content").getByRole("button", { name: "Play from 0:01" }).click();
  await playing(app);
  expect(await page.evaluate(() => window.testing.player.episode!.from)).toEqual({ sound: "https://audio.example/other.wav" });
  const mini = page.getByRole("region", { name: "Podcast player" });
  expect(await mini.getByRole("button", { name: "Take Notes" }).count()).toBe(0);
  expect(await mini.getByRole("button", { name: "Show the episode" }).count()).toBe(0);
  expect(await mini.innerText()).toContain("other");
  // Played to its end: Mine isn't listened to.
  await page.waitForFunction(() => !window.testing.player.playing && window.testing.player.positions.get("https://audio.example/other.wav")?.played);
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, mine)).toContain("status: to listen");
});

test("in the episode's note as it plays, Enter after a time's item starts the next with its time; an empty one ends the list; not elsewhere, nor turned off", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(60_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n\n- [0:00] First");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(42));
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press(`${mod()}+End`);

  // The next item, with the time it's at; screen readers hear it; one ⌘Z takes it back.
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:00] First\n- [0:42] ");
  await spoken(app, "At 0:42");
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.text()?.endsWith("- [0:00] First"));
  await page.keyboard.press("Enter");
  // Right after typing too, the episode on a little.
  await page.keyboard.type("Second");
  await page.evaluate(() => window.testing.player.seek(50));
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:42] Second\n- [0:50] ");
  // Nothing written after its time: Enter ends the list.
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:42] Second\n");
  await page.keyboard.type("After the list");
  await page.keyboard.press(`${mod()}+Home`);
  await editor.getByRole("button", { name: "Play from 0:42" }).first().waitFor();

  // Turned off, Enter goes on with the list as it does with any.
  const settings = await app.settings("Library");
  await settings.getByRole("switch", { name: "Time new notes while listening" }).click();
  await app.closeSettings();
  expect(await page.evaluate(() => window.testing.prefs.timeNotes)).toBe(false);
  await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n\n- [0:00] First");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press("Enter");
  expect(await app.text()).toEndWith("- [0:00] First\n- ");
  await page.evaluate(() => (window.testing.prefs.timeNotes = true));

  // Nor in a note that isn't the episode's.
  await app.open("# Other\n\n- [0:00] First");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.press("Enter");
  expect(await app.text()).toBe("# Other\n\n- [0:00] First\n- ");
});

test("Take Notes on an episode whose note is in the Trash writes nothing, and says so", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(20_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const body = "---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n";
  const id = await app.open(body);
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate((id) => window.testing.notes.trash(id), id);
  await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Take Notes" }).click();
  await spoken(app, "The episode’s note is in the Trash.");
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, id)).toBe(body);
});

test("Take Notes with the episode's note open beside writes in it in the main pane, and focus is in its text", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(20_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  const id = await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await app.open("# Elsewhere\n");
  await page.evaluate((id) => window.testing.panes.open(id, "right"), id);
  await page.locator(`[data-pane-content="${id}"] .cm-content`).waitFor();
  await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Take Notes" }).click();
  await page.waitForFunction((id) => /\n- \[0:0\d\] $/.test(window.testing.notes.get(id)?.note.body ?? ""), id);
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-pane-content="main"] .cm-content'))).toBe(true);
  await page.keyboard.type("typed");
  await page.waitForFunction((id) => /\n- \[0:0\d\] typed$/.test(window.testing.notes.get(id)?.note.body ?? ""), id);
});

test("Take Notes doesn't take the cursor from someone typing while the episode is saved; it says its note is ready", async () => {
  app = await openApp();
  const page = app.page;
  await subscribeToPodcast(app, { length: 60_000 });
  // The episode's artwork, which saving it downloads, comes slowly.
  await page.route(
    (url) => url.hostname === "megaphone.imgix.net",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return route.fulfill({ body: png(4, 4, () => [200, 120, 60]), contentType: "image/png", headers: { "access-control-allow-origin": "*" } });
    },
  );
  await playRow(app, 0);
  await playing(app);
  const elsewhere = await app.open("# Elsewhere\n\n");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  const take = page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Take Notes" });
  await take.click();
  // Busy meanwhile.
  expect(await take.getAttribute("aria-busy")).toBe("true");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod()}+End`);
  await page.keyboard.type("still here");
  await spoken(app, "The episode’s note is ready: Take Notes again to write in it.");
  expect(await page.evaluate(() => window.testing.notes.selectedId)).toBe(elsewhere);
  expect(await app.text()).toBe("# Elsewhere\n\nstill here");
});

test("a quote with no note open goes at the end of the episode's note, which keeps its transcript and chapters, its properties as they were", async () => {
  app = await openApp();
  const page = app.page;
  await serveTranscript(app);
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(16));
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Transcript" }).click();
  await mini.getByRole("button", { name: "Quote in Note" }).click();
  await page.waitForFunction(() => window.testing.text()?.includes("> [0:15]"));
  const text = (await app.text())!;
  expect(text).toStartWith("---\ntype: episode\n");
  expect(text).toContain("\ntranscript: https://syntax.fm/1055/transcript.vtt\nchapters: https://syntax.fm/1055/chapters.json\n");
  expect(text).toEndWith("\n\n> [0:15] Agents open far more pull requests than people do. — Kyle\n\n");
});

test("a quote while a LaTeX note is open goes into the episode's note, never into the LaTeX", async () => {
  app = await openApp();
  const page = app.page;
  await serveTranscript(app);
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(16));
  const latex = "\\section{Notes}\n\nOn agents\n";
  const id = await app.open(latex, "latex");
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Transcript" }).click();
  await mini.getByRole("button", { name: "Quote in Note" }).click();
  await page.waitForFunction(() => window.testing.text()?.includes("> [0:15]"));
  expect(await app.text()).toContain("type: episode");
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, id)).toBe(latex);
});

test("an episode note keeps its transcript once its feed lets it go; its first line takes Tab before it plays; a missing one says so", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(30_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  await serveTranscript(app);
  await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\ntranscript: https://syntax.fm/1055/transcript.vtt\n---\n# Episode\n");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.pause());
  await page.evaluate(() => window.testing.player.seek(0));
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Transcript" }).click();
  const lines = mini.getByRole("list", { name: "Transcript" });
  await lines.getByRole("button", { name: /Welcome to Syntax/ }).waitFor();
  // Nothing's playing at 0:00 (the first line starts at 0:00.5), and the first line takes Tab.
  expect(await lines.locator("[aria-current]").count()).toBe(0);
  expect(await lines.locator('[tabindex="0"]').innerText()).toContain("Welcome to Syntax.");

  // One that's gone from its site says so.
  await app.open("---\ntype: episode\naudio: https://audio.example/f.wav\ntranscript: https://syntax.fm/1056/transcript.vtt\n---\n# Another\n");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await mini.getByText("The transcript isn’t on its site any more.").waitFor();
  // The browser's word on what wasn't there.
  expect(app.errors.filter((error) => !error.includes("404"))).toEqual([]);
  app.errors.length = 0;
});

test("on the web, a transcript whose site doesn't let pages read it says so", async () => {
  app = await openApp();
  const page = app.page;
  await serveTranscript(app, { readable: false });
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Transcript" }).click();
  await mini.getByText("The transcript’s site doesn’t let web pages read it; the apps can.").waitFor();
  app.errors.length = 0;
});

test("with the Feeds plugin off, the player has no Take Notes nor transcript", async () => {
  app = await openApp();
  const page = app.page;
  await serveTranscript(app);
  await subscribeToPodcast(app, { length: 60_000 });
  await playRow(app, 0);
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Transcript" }).waitFor();
  await page.evaluate(() => window.testing.plugins.setOn(window.testing.plugins.get("feeds")!, false));
  await mini.getByRole("button", { name: "Take Notes" }).waitFor({ state: "detached" });
  expect(await mini.getByRole("button", { name: "Transcript" }).count()).toBe(0);
});

test("sought far ahead while it plays, an episode waits for its sound, then plays on and says so", async () => {
  app = await openApp();
  const page = app.page;
  const audio = wav(120_000);
  await page.route(
    (url) => url.hostname === "audio.example",
    async (route) => {
      // Its second half comes late, so the player waits for it.
      const from = Number(/^bytes=(\d+)-/.exec(route.request().headers().range ?? "")?.[1] ?? 0);
      if (from > audio.length / 2) await new Promise((resolve) => setTimeout(resolve, 1500));
      return answerFile(route, audio, "audio/wav");
    },
  );
  await app.open("---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n");
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await playing(app);
  await page.evaluate(() => window.testing.player.seek(100));
  await page.waitForFunction(() => window.testing.player.playing && !window.testing.player.loading && window.testing.player.time > 100.5, null, { timeout: 15_000 });
  await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Pause" }).waitFor();
});

test("the tests make no sound: a sound starting is muted, and Web Audio reaches the speakers through a gain of 0", async () => {
  app = await openApp();
  const heard = await app.page.evaluate(async () => {
    const audio = new Audio();
    void audio.play().catch(() => {});
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gains: number[] = [];
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    // What the oscillator is joined to, on its way to the speakers.
    const joined = connect.call(oscillator, context.destination) as AudioNode;
    if (joined instanceof GainNode) gains.push(joined.gain.value);
    await context.close();
    return { muted: audio.muted, gains };
  });
  expect(heard).toEqual({ muted: true, gains: [0] });
});
