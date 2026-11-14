import { afterEach, expect, test } from "bun:test";
import type { Frame, Page } from "playwright";
import { type App, mod, noErrors, openApp, toggle } from "./app";
import { answerFile, wav } from "./files";

/*
 * Spotify's and SoundCloud's players in a note: a card until played, nothing asked of the site
 * before, then the site's player, which lines and the podcast player take turns with. The sites'
 * players are stand-ins here, saying what theirs say (November 2026): nothing reaches the network.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const NOTE = "# Music\n\n[Never Gonna Give You Up](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=0123456789abcdef)\n\n[SoundCloud](https://soundcloud.com/forss/flickermood)\n";

/** Spotify's player: says it's ready, plays and pauses when told, saying so every time as Spotify's does. What it's told is `told`. */
const SPOTIFY = `<!doctype html><script>
  window.told = [];
  const say = (isPaused) => parent.postMessage({ type: "playback_update", payload: { isPaused, isBuffering: false, position: 0 } }, "*");
  // Pressed in the player itself.
  window.press = () => say(false);
  addEventListener("message", (event) => {
    told.push(event.data);
    if (event.data?.command === "play") {
      parent.postMessage({ type: "playback_update", payload: { isPaused: false, isBuffering: true } }, "*");
      say(false);
      say(false);
    }
    if (event.data?.command === "pause") say(true);
  });
  parent.postMessage({ type: "ready" }, "*");
</script>`;

/**
 * SoundCloud's player: says it's ready in JSON, as its Widget API does, and then, for the events
 * it's asked to, how far it's played as it plays, and when it pauses. `refuses` is a browser that
 * won't let it start by itself: it starts and pauses at once.
 */
const soundcloudPlayer = ({ refuses = false } = {}) => `<!doctype html><script>
  window.told = [];
  const asked = new Set();
  const say = (method, value = null) => asked.has(method) && parent.postMessage(JSON.stringify({ widgetId: "widget_1", method, value }), "*");
  addEventListener("message", (event) => {
    const { method, value } = JSON.parse(event.data);
    told.push(method === "addEventListener" ? method + " " + value : method);
    if (method === "addEventListener") asked.add(value);
    if (method === "play" && ${refuses}) {
      parent.postMessage(JSON.stringify({ widgetId: "widget_1", method: "play", value: {} }), "*");
      parent.postMessage(JSON.stringify({ widgetId: "widget_1", method: "pause", value: {} }), "*");
    } else if (method === "play") say("playProgress", { currentPosition: 250 });
    if (method === "pause") say("pause", {});
  });
  parent.postMessage(JSON.stringify({ widgetId: "widget_1", method: "ready", value: null }), "*");
</script>`;

/** Answers the sites' players with their stand-ins, `spotify` and `soundcloud` (as given). The addresses asked of either site. */
async function sites(page: Page, { spotify = SPOTIFY, soundcloud = soundcloudPlayer() } = {}) {
  const asked: string[] = [];
  await page.route(
    (url) => /(^|\.)(spotify|soundcloud)\.com$/.test(url.hostname),
    (route) => {
      const url = route.request().url();
      asked.push(url);
      return route.fulfill({ contentType: "text/html", body: url.startsWith("https://open.spotify.com/") ? spotify : soundcloud });
    },
  );
  return asked;
}

/** A site's player in the note, as an element and as its frame. */
async function player(page: Page, site: string): Promise<{ element: ReturnType<Page["locator"]>; frame: Frame }> {
  const element = page.locator(`iframe[title^="${site} player"]`);
  await element.waitFor();
  return { element, frame: (await (await element.elementHandle())!.contentFrame())! };
}

/** What a stand-in player was told, once it's been told `count` things. */
async function told(frame: Frame, count = 1) {
  await frame.waitForFunction((count) => (window as unknown as { told: unknown[] }).told.length >= count, count);
  return frame.evaluate(() => (window as unknown as { told: unknown[] }).told);
}

/** Pastes `text` where the cursor is in the open note, as the system's paste does. */
const paste = (page: Page, text: string) =>
  page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.querySelector(".editor-pane [data-pane-content='main'] .cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);

/** The block selected in the note, by its link, with the keyboard back in the note's text. */
const selectedIn = (page: Page) =>
  page.waitForFunction(() => document.activeElement?.classList.contains("cm-content") && document.querySelector<HTMLElement>(".cm-lp-embed-block.is-selected")?.dataset.src);

test("a Spotify or SoundCloud link on a line of its own is a card, and nothing's asked of the site until it's played", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await sites(page);
  await app.open(NOTE);
  const spotify = page.getByRole("group", { name: "Never Gonna Give You Up" });
  const soundcloud = page.getByRole("group", { name: "Track on SoundCloud" });
  await soundcloud.waitFor();
  expect(await spotify.innerText()).toContain("30-second previews without a Spotify login");
  expect(await soundcloud.innerText()).toContain("Loads SoundCloud’s player when you play it");
  expect(asked).toEqual([]);

  await spotify.getByRole("button", { name: "Play with Spotify" }).click();
  const { element, frame } = await player(page, "Spotify");
  // Without what Spotify adds to a shared link to say who shared it.
  expect(await element.getAttribute("src")).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
  expect(await element.getAttribute("title")).toBe("Spotify player: Never Gonna Give You Up");
  expect(await element.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  // Played from its card, it's told to play once it's ready.
  expect(await told(frame)).toEqual([{ command: "play" }]);
  expect(asked).toEqual(["https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"]);
  await soundcloud.getByRole("button", { name: "Play with SoundCloud" }).waitFor();
  // Its Open button opens the link without who shared it.
  await page.getByRole("button", { name: "Open on Spotify" }).waitFor();
});

test("↓ stops on a card and Enter plays it with the keyboard in the player; Tab or ⇧Tab out of it goes back to the note, and Enter plays it again", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page);
  await app.open("# Music\n\n[SoundCloud](https://soundcloud.com/forss/sets/soulhack)\n");
  await page.getByRole("group", { name: "Playlist on SoundCloud" }).waitFor();
  await page.evaluate(() => window.testing.place(0));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const { element, frame } = await player(page, "SoundCloud");
  const src = new URL((await element.getAttribute("src"))!);
  expect(src.origin + src.pathname).toBe("https://w.soundcloud.com/player/");
  expect(src.searchParams.get("url")).toBe("https://soundcloud.com/forss/sets/soulhack");
  // In the theme's accent.
  expect(src.searchParams.get("color")).toMatch(/^#[0-9a-f]{6}$/);
  await page.waitForFunction(() => document.activeElement?.classList.contains("cm-lp-site-frame"));
  // Asked to say when it plays, pauses and finishes, then to play.
  expect(await told(frame, 4)).toEqual(["addEventListener playProgress", "addEventListener pause", "addEventListener finish", "play"]);

  // ⇧Tab, out of the player's start, and Tab past its Open button at its end.
  await page.keyboard.press("Shift+Tab");
  expect(await selectedIn(page).then((handle) => handle.jsonValue())).toBe("https://soundcloud.com/forss/sets/soulhack");
  await page.keyboard.press("Enter");
  expect(await told(frame, 5)).toEqual(["addEventListener playProgress", "addEventListener pause", "addEventListener finish", "play", "play"]);
  await page.waitForFunction(() => document.activeElement?.classList.contains("cm-lp-site-frame"));
  // Past what's in the player, and its Open button.
  for (let presses = 0; presses < 4 && !(await page.evaluate(() => document.activeElement?.classList.contains("cm-content"))); presses++) await page.keyboard.press("Tab");
  await selectedIn(page);
  expect(await app.text()).toBe("# Music\n\n[SoundCloud](https://soundcloud.com/forss/sets/soulhack)\n");
});

test("a site's player and the podcast player take turns; one the browser wouldn't let start pauses nothing, nor does a message from elsewhere", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page, { soundcloud: soundcloudPlayer({ refuses: true }) });
  const audio = wav(20_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  await app.open(`---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n\n[Spotify](https://open.spotify.com/episode/0R6JJpgimzFfiGkdeFgimD)\n\n[SoundCloud](https://soundcloud.com/forss/flickermood)\n`);
  const episode = page.locator(".cm-content").getByRole("button", { name: /^(Play|Pause) Episode$/ });
  await episode.click();
  await page.waitForFunction(() => window.testing.player.playing);

  // SoundCloud, refused: it says it started and paused, but never played.
  await page.getByRole("group", { name: "Track on SoundCloud" }).getByRole("button", { name: "Play with SoundCloud" }).click();
  const soundcloud = await player(page, "SoundCloud");
  await told(soundcloud.frame, 4);
  // Nor is a message from the note's own page a player's.
  await page.evaluate(() => {
    window.postMessage({ type: "playback_update", payload: { isPaused: false, isBuffering: false } }, "*");
    window.postMessage(JSON.stringify({ method: "playProgress", value: {} }), "*");
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.testing.player.playing)).toBe(true);

  // Spotify, played: the podcast pauses, and playing it again pauses Spotify, once.
  await page.getByRole("group", { name: "Episode on Spotify" }).getByRole("button", { name: "Play with Spotify" }).click();
  await page.waitForFunction(() => !window.testing.player.playing);
  const spotify = await player(page, "Spotify");
  await episode.click();
  await page.waitForFunction(() => window.testing.player.playing);
  expect(await told(spotify.frame, 2)).toEqual([{ command: "play" }, { command: "pause" }]);
  // Pressed in Spotify's own player, it pauses the podcast again.
  await spotify.frame.evaluate(() => (window as unknown as { press: () => void }).press());
  await page.waitForFunction(() => !window.testing.player.playing);
});

test("two players take turns", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page);
  await app.open(NOTE);
  await page.getByRole("button", { name: "Play with Spotify" }).click();
  const spotify = await player(page, "Spotify");
  await told(spotify.frame);
  await page.getByRole("button", { name: "Play with SoundCloud" }).click();
  const soundcloud = await player(page, "SoundCloud");
  await told(soundcloud.frame, 4);
  expect(await told(spotify.frame, 2)).toEqual([{ command: "play" }, { command: "pause" }]);
  await spotify.frame.evaluate(() => (window as unknown as { press: () => void }).press());
  expect(await told(soundcloud.frame, 5)).toContain("pause");
});

test("a link pasted on an empty line is written without what was added to it for sharing, and ⌘Z puts back what was pasted", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page);
  await app.open("# Music\n\n");
  await page.evaluate(() => window.testing.place());
  await paste(page, "https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=0123456789abcdef");
  await page.getByRole("group", { name: "Track on Spotify" }).waitFor();
  expect(await app.text()).toBe("# Music\n\n[Spotify](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC)\n");
  await paste(page, "https://soundcloud.com/forss/flickermood?si=abc&utm_source=clipboard");
  await page.getByRole("group", { name: "Track on SoundCloud" }).waitFor();
  expect(await app.text()).toBe("# Music\n\n[Spotify](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC)\n[SoundCloud](https://soundcloud.com/forss/flickermood)\n");
  await page.keyboard.press(`${mod()}+z`);
  expect(await app.text()).toBe("# Music\n\n[Spotify](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC)\nhttps://soundcloud.com/forss/flickermood?si=abc&utm_source=clipboard");
});

test("a player that doesn't say it's ready (offline, or gone) says it couldn't be loaded, with Open", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page, { spotify: "<!doctype html><title>Gone</title>" });
  await app.open(NOTE);
  await page.getByRole("button", { name: "Play with Spotify" }).click();
  await page.getByText("Spotify’s player couldn’t be loaded.").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Open on Spotify" }).waitFor();
  expect(await page.locator('iframe[title^="Spotify player"]').count()).toBe(0);
});

test("with its plugin off, a link to Spotify is a link, and on again, a card", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page);
  await app.open(NOTE);
  await page.getByRole("group", { name: "Never Gonna Give You Up" }).waitFor();
  await toggle(await app.settings("All Plugins"), "Spotify", false);
  await app.closeSettings();
  await page.locator(".cm-content .cm-lp-link", { hasText: "Never Gonna Give You Up" }).waitFor();
  expect(await page.getByRole("group", { name: "Never Gonna Give You Up" }).count()).toBe(0);
  await page.getByRole("group", { name: "Track on SoundCloud" }).waitFor();
  await toggle(await app.settings("All Plugins"), "Spotify", true);
  await app.closeSettings();
  await page.getByRole("group", { name: "Never Gonna Give You Up" }).waitFor();
});
