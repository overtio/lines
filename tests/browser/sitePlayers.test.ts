import { afterEach, expect, test } from "bun:test";
import type { Page } from "playwright";
import { type App, noErrors, openApp, toggle } from "./app";
import { answerFile, wav } from "./files";

/*
 * Spotify's and SoundCloud's players in a note: a card until played, nothing asked of the site
 * before, then the site's player, which lines and the podcast player take turns with. The sites'
 * players are stand-ins here, answering as theirs do (their messages, November 2026): nothing
 * reaches the network.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const NOTE = "# Music\n\n[Never Gonna Give You Up](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=0123456789abcdef)\n\n[SoundCloud](https://soundcloud.com/forss/flickermood)\n";

/**
 * Answers the sites' players with a page that says it's ready, as Spotify's does, and keeps what
 * lines tells it (`told`), saying it plays when told to. The addresses each site was asked for.
 */
async function sites(page: Page) {
  const asked: string[] = [];
  const stand = `<!doctype html><script>
    window.told = [];
    addEventListener("message", (event) => {
      told.push(event.data);
      if (event.data?.command === "play") parent.postMessage({ type: "playback_update", payload: { isPaused: false, position: 0 } }, "*");
      if (event.data?.command === "pause") parent.postMessage({ type: "playback_update", payload: { isPaused: true } }, "*");
    });
    parent.postMessage({ type: "ready" }, "*");
  </script>`;
  await page.route(
    (url) => /(^|\.)(spotify|soundcloud)\.com$/.test(url.hostname),
    (route) => {
      asked.push(route.request().url());
      return route.fulfill({ contentType: "text/html", body: stand });
    },
  );
  return asked;
}

test("a Spotify or SoundCloud link on a line of its own is a card, and nothing's asked of the site until it's played", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await sites(page);
  await app.open(NOTE);
  const spotify = page.getByRole("group", { name: "Never Gonna Give You Up" });
  const soundcloud = page.getByRole("group", { name: "Track on SoundCloud" });
  await soundcloud.waitFor();
  expect(await spotify.innerText()).toContain("Loads Spotify’s player when you play it");
  expect(asked).toEqual([]);

  await spotify.getByRole("button", { name: "Play with Spotify" }).click();
  const frame = page.locator("iframe.cm-lp-site-frame");
  await frame.waitFor();
  // Without what Spotify adds to a shared link to say who shared it.
  expect(await frame.getAttribute("src")).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
  expect(await frame.getAttribute("title")).toBe("Spotify player: Never Gonna Give You Up");
  expect(await frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  // Played from its card, it's told to play once it's ready.
  const player = page.frame({ url: /open\.spotify\.com\/embed/ })!;
  await player.waitForFunction(() => (window as unknown as { told: unknown[] }).told.length > 0);
  expect(await player.evaluate(() => (window as unknown as { told: unknown[] }).told)).toEqual([{ command: "play" }]);
  expect(asked).toEqual(["https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"]);
  // SoundCloud's still a card.
  await soundcloud.getByRole("button", { name: "Play with SoundCloud" }).waitFor();
});

test("↓ stops on a card and Enter plays it, with the keyboard in the player", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page);
  await app.open("# Music\n\n[SoundCloud](https://soundcloud.com/forss/sets/soulhack)\n");
  await page.getByRole("group", { name: "Playlist on SoundCloud" }).waitFor();
  await page.evaluate(() => window.testing.place(0));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const frame = page.locator("iframe.cm-lp-site-frame");
  await frame.waitFor();
  const src = new URL((await frame.getAttribute("src"))!);
  expect(src.origin + src.pathname).toBe("https://w.soundcloud.com/player/");
  expect(src.searchParams.get("url")).toBe("https://soundcloud.com/forss/sets/soulhack");
  // In the theme's accent.
  expect(src.searchParams.get("color")).toMatch(/^#[0-9a-f]{6}$/);
  await page.waitForFunction(() => document.activeElement?.classList.contains("cm-lp-site-frame"));
  expect(await app.text()).toBe("# Music\n\n[SoundCloud](https://soundcloud.com/forss/sets/soulhack)\n");
});

test("a site's player playing pauses the podcast player, and the podcast player playing pauses it", async () => {
  app = await openApp();
  const { page } = app;
  await sites(page);
  const audio = wav(20_000);
  await page.route((url) => url.hostname === "audio.example", (route) => answerFile(route, audio, "audio/wav"));
  await app.open(`---\ntype: episode\naudio: https://audio.example/e.wav\n---\n# Episode\n\n[Spotify](https://open.spotify.com/episode/0R6JJpgimzFfiGkdeFgimD)\n`);
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  await page.waitForFunction(() => window.testing.player.playing);
  await page.getByRole("group", { name: "Episode on Spotify" }).getByRole("button", { name: "Play with Spotify" }).click();
  await page.waitForFunction(() => !window.testing.player.playing);
  await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
  const player = page.frame({ url: /open\.spotify\.com\/embed/ })!;
  await player.waitForFunction(() => JSON.stringify((window as unknown as { told: unknown[] }).told).includes('"pause"'));
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
