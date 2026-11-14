import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Route } from "playwright";
import { type App, engine, mod, noErrors, openApp, toggle } from "./app";

/*
 * The library: a note that's just a link filled in with what it is, its shelf in the sidebar, and
 * where an item's got to. YouTube's oEmbed and pictures are answered here, from trimmed copies of what
 * they answered (November 2026): nothing reaches the network.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const LINK = "https://youtu.be/dQw4w9WgXcQ";
/** A small picture, for the video's. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAIAAABrW6giAAAAEElEQVR4nGPQiFoARwyUcgAZmhsx2Z6P+QAAAABJRU5ErkJggg==", "base64");
const CORS = { "access-control-allow-origin": "*" };

/**
 * Answers YouTube for the page, as it would, once `ready` (at once, if it's not given), with `title`;
 * or not at all, `fail`ing. The requests it was sent.
 */
async function youtube(page: App["page"], ready?: Promise<unknown>, { title = "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)", fail = false } = {}) {
  const asked: string[] = [];
  await page.route("https://www.youtube.com/oembed**", async (route: Route) => {
    asked.push(route.request().url());
    await ready;
    // Failing as an answer that can't be read does, without the browser saying so.
    if (fail) return route.fulfill({ headers: CORS, contentType: "application/json", body: "{" });
    await route.fulfill({ headers: CORS, json: { title, author_name: "Rick Astley" } });
  });
  await page.route("https://i.ytimg.com/**", (route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: PNG }));
  return asked;
}

/** Pastes `text` where the cursor is in the open note, as the system's paste does. */
const paste = (page: App["page"], text: string) =>
  page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.querySelector(".editor-pane [data-pane-content='main'] .cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);

/** Opens Add to Library from the Library's + (a menu of it and Subscribe to a Feed, with the Feeds plugin on). */
const addToLibrary = async (page: App["page"]) => {
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Add to Library" }).click();
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  return page.getByRole("dialog", { name: "Add to Library" });
};

const TITLE = "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)";
const filled = (page: App["page"]) => page.waitForFunction(() => window.testing.text()?.includes("\nchannel: Rick Astley\n"));

test("a link pasted into a new note is filled in at once, filed, and one ⌘Z puts it back", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await youtube(page);
  // Pasted after the `# ` it starts with, as it's made.
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "# ");
  await paste(page, LINK);
  await filled(page);
  const text = (await app.text())!;
  expect(text).toStartWith(`---\ntype: video\nchannel: Rick Astley\nlink: https://www.youtube.com/watch?v=dQw4w9WgXcQ\nstatus: to watch\n---\n# ${TITLE}\n`);
  // Its picture, as wide as a video's shows, kept with it once it's written. (WebKit here can't store pictures.)
  expect(text.slice(text.indexOf(`# ${TITLE}\n`))).toMatch(/^# .*\n\n!\[.*\|400\]\(\.\.\/attachments\/([0-9a-f]{32}\.jpg)\)\n$/);
  if (engine() === "chromium") {
    const name = /attachments\/([0-9a-f]{32}\.jpg)/.exec(text)![1];
    await page.waitForFunction(async (name) => (await window.testing.attachmentNames()).includes(name), name);
  }
  // Only the link was sent.
  expect(asked).toEqual([`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}`]);
  // Out of the Inbox, on its shelf in the Library.
  const id = await page.evaluate(() => window.testing.notes.selectedId!);
  await page.waitForFunction((id) => !window.testing.notes.get(id)?.note.inbox, id);
  const sidebar = page.getByRole("navigation", { name: "Library" });
  expect(await sidebar.getByRole("button", { name: /^Videos/ }).innerText()).toMatch(/Videos\s+1/);

  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction((link) => window.testing.text() === `# ${link}`, LINK);
  // Put back, it isn't looked up again, nor as it's written on: its link is the same.
  await page.evaluate(() => window.testing.place());
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  expect(await app.text()).toStartWith(`# ${LINK}\n`);
  expect(asked.length).toBe(1);
});

test("a link pasted into a note started on a shelf, its type and status, is filled in too", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  const picker = await addToLibrary(page);
  await picker.getByRole("radio", { name: "Movies" }).click();
  await picker.getByRole("button", { name: "Blank" }).click();
  await page.waitForFunction(() => window.testing.text() === "---\ntype: movie\nstatus: to watch\n---\n# ");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await filled(page);
  expect(await app.text()).toContain(`\n---\n# ${TITLE}\n`);
});

test("a link to someone on SoundCloud whose sounds are a podcast is that podcast, subscribed to, by SoundCloud's feed of them", async () => {
  app = await openApp();
  const { page } = app;
  const FEED = "https://feeds.soundcloud.com/users/soundcloud:users:20789805/sounds.rss";
  // Trimmed from what SoundCloud answered (November 2026).
  const html = '<iframe width="100%" height="450" src="https://w.soundcloud.com/player/?visual=true&url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F20789805&show_artwork=true"></iframe>';
  await page.route("https://soundcloud.com/oembed**", (route: Route) => route.fulfill({ headers: CORS, json: { title: "BaderB", author_name: "BaderB", html } }));
  await page.route(FEED, (route: Route) => route.fulfill({ headers: CORS, contentType: "application/rss+xml", body: readFileSync(new URL("./feeds/soundcloud.rss", import.meta.url), "utf8") }));
  await page.route("https://i1.sndcdn.com/**", (route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: PNG }));
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "# ");
  await paste(page, "https://soundcloud.com/bader_b");
  await page.waitForFunction(() => window.testing.text()?.includes("\nfeed: "));
  expect(await app.text()).toStartWith(`---\ntype: podcast\nauthor: BaderB\nfeed: ${FEED}\nlink: https://soundcloud.com/bader_b\n---\n# Melodic Techno Mix\n`);
  await page.waitForFunction((feed) => !!window.testing.feeds.subscription(feed), FEED);
});

test("a link typed is looked up once it's stayed a moment, and not filled in if it changes meanwhile", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  const asked = await youtube(page, new Promise<void>((resolve) => (answer = resolve)));
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await page.keyboard.type(LINK, { delay: 20 });
  // The note says it's looking, quietly, after the link.
  const looking = page.locator(".cm-library-lookup");
  await looking.waitFor();
  expect(await looking.innerText()).toBe("Looking up…");
  expect(asked.length).toBe(1);
  await page.keyboard.type(" and more");
  answer();
  await looking.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  expect(await app.text()).toBe(`${LINK} and more`);

  // Typed again and left alone, it's filled in.
  await page.keyboard.press(`${mod()}+a`);
  await page.keyboard.type(LINK);
  await filled(page);
});

test("a note left while it's looked up is filled in as it's stored, and ⌘Z in the note open is that note's", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  await youtube(page, new Promise<void>((resolve) => (answer = resolve)));
  const id = await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await page.locator(".cm-library-lookup").waitFor();
  await app.open("# Elsewhere\n\n");
  await page.evaluate(() => window.testing.place());
  await page.keyboard.type("Some words");
  answer();
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.startsWith("---\ntype: video\n"), id);
  // ⌘Z takes back what was typed here, not the other note's filling in.
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.text() === "# Elsewhere\n\n");
  await page.waitForTimeout(300);
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, id)).toStartWith("---\ntype: video\n");
});

test("a note locked while it's looked up isn't filled in", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  await youtube(page, new Promise<void>((resolve) => (answer = resolve)));
  const id = await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  const looking = page.locator(".cm-library-lookup");
  await looking.waitFor();
  await page.evaluate(async (id) => {
    const { noteKeys, notes } = window.testing;
    noteKeys.save({ key: (await noteKeys.create("a password")).key, touchId: false });
    notes.lock(id);
  }, id);
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.locked, id);
  answer();
  await looking.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.body, id)).toBe(LINK);
});

test("notes that are just a link aren't looked up as they open or as they're written on, nor with lookups off", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await youtube(page);
  // Its link the same as it was, a line written under it.
  await app.open(LINK);
  await page.evaluate(() => window.testing.place());
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  expect(asked).toEqual([]);

  const settings = await app.settings("Library");
  // On the web, only the sources that work there are named, each once: not Web Pages, nor Feeds' own for a site's page, which reads it.
  await expect(settings.getByText("In the browser, only", { exact: false }).innerText()).resolves.toBe(
    "In the browser, only YouTube, Open Library, Wikidata, MusicBrainz, SoundCloud, Apple Podcasts, and Feeds can be asked: other sites don’t let web pages read them. The lines app reads any page.",
  );
  await toggle(settings, "Look up links", false);
  await app.closeSettings();
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await page.waitForTimeout(1500);
  expect(await app.text()).toBe(LINK);
  expect(asked).toEqual([]);

  // Turned on in Settings → Library, the next link pasted is.
  await toggle(await app.settings("Library"), "Look up links", true);
  await app.closeSettings();
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await filled(page);
  expect(asked.length).toBe(1);
});

test("a shelf lists its items with what they're by and where they've got to, which their menu sets", async () => {
  app = await openApp();
  const { page } = app;
  await app.open("---\ntype: book\nauthor: Frank Herbert\nyear: 1965\nstatus: to read\n---\n# Dune\n\nOn Arrakis.");
  await app.open("---\ntype: person\n---\n# Ada");
  const sidebar = page.getByRole("navigation", { name: "Library" });
  // Books in the Library, not again under Types, which has Person.
  await sidebar.getByRole("button", { name: /^Books/ }).click();
  expect(await sidebar.locator("#sidebar-types-list").innerText()).not.toContain("Book");
  expect(await sidebar.locator("#sidebar-types-list").innerText()).toContain("Person");
  const row = page.locator(".note-list [data-id]").filter({ hasText: "Dune" });
  expect(await page.locator("#note-list-title").innerText()).toBe("Books");
  expect(await row.innerText()).toMatch(/Dune\s+Frank Herbert · 1965\s+To Read/);

  const status = () => page.evaluate(() => /\nstatus: (.*)\n/.exec(window.testing.notes.visible[0].note.body)?.[1]);
  const date = () => page.evaluate(() => window.testing.notes.visible[0].note.updatedAt);
  const before = await date();
  await row.click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Reading" }).click();
  await page.waitForFunction(() => window.testing.notes.visible[0].note.body.includes("\nstatus: reading\n"));
  expect(await row.innerText()).toContain("Reading");
  // It keeps its date, so its place in the list.
  expect(await date()).toBe(before);
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.notes.visible[0].note.body.includes("\nstatus: to read\n"));
  expect(await status()).toBe("to read");
});

/** Answers Open Library for the page, as it answered for Dune (trimmed); the requests it was sent. */
async function openLibrary(page: App["page"]) {
  const asked: string[] = [];
  const answer = (json: unknown) => (route: Route) => {
    asked.push(route.request().url());
    return route.fulfill({ headers: CORS, json });
  };
  await page.route("https://openlibrary.org/search.json**", answer({ docs: [{ key: "/works/OL893414W", title: "Dune", author_name: ["Frank Herbert"], first_publish_year: 1965, cover_i: 11481354 }] }));
  await page.route(
    "https://openlibrary.org/works/OL893414W.json",
    answer({ title: "Dune", description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.", authors: [{ author: { key: "/authors/OL79034A" } }], covers: [11481354] }),
  );
  await page.route("https://openlibrary.org/authors/OL79034A.json", answer({ name: "Frank Herbert" }));
  await page.route("https://covers.openlibrary.org/**", (route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: PNG }));
  return asked;
}

test("Add to Library searches the kind chosen, and what's chosen is a note on its shelf, filled in from its page", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await openLibrary(page);
  const picker = await addToLibrary(page);
  // What can be searched from a web page: not papers (arXiv answers the apps only).
  const kinds = picker.getByRole("radiogroup", { name: "What to search for" });
  expect(await kinds.getByRole("radio").allInnerTexts()).toEqual(["Books", "Movies", "Shows", "Anime", "Music", "Podcasts"]);
  await page.keyboard.type("dune");
  await picker.getByRole("option", { name: /^Dune, Frank Herbert · 1965/ }).waitFor();
  // Only what was typed is sent.
  expect(new URL(asked[0]).searchParams.get("q")).toBe("dune");
  await page.keyboard.press("Enter");
  await picker.waitFor({ state: "hidden" });
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: book\nauthor: Frank Herbert\nyear: 1965\nlink: https://openlibrary.org/works/OL893414W\nstatus: to read\n---\n# Dune"));
  // Then the rest, from its page: what it's about.
  await page.waitForFunction(() => window.testing.text()?.includes("Set on the desert planet Arrakis"));
  expect(await page.locator("#note-list-title").innerText()).toBe("Books");
  expect(await page.evaluate(() => window.testing.notes.selected?.note.inbox)).toBeFalsy();

  // Chosen again, the note there is of it is opened, not another made.
  const id = await page.evaluate(() => window.testing.notes.selectedId);
  await app.open("# Elsewhere");
  const once = await addToLibrary(page);
  await page.keyboard.type("dune");
  await once.getByRole("option", { name: /^Dune, Frank Herbert · 1965/ }).waitFor();
  await page.keyboard.press("Enter");
  await page.waitForFunction((id) => window.testing.notes.selectedId === id, id);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "book").length)).toBe(1);

  // Blank: a note of the kind chosen, to fill in, filed on its shelf.
  const again = await addToLibrary(page);
  await again.getByRole("radio", { name: "Movies" }).click();
  await again.getByRole("button", { name: "Blank" }).click();
  await page.waitForFunction(() => window.testing.text() === "---\ntype: movie\nstatus: to watch\n---\n# ");
  expect(await page.locator("#note-list-title").innerText()).toBe("Movies");
  expect(await page.evaluate(() => window.testing.notes.selected?.note.inbox)).toBeFalsy();
});

test("anime: searched for on AniList, and a link to MyAnimeList pasted into a new note, each a note on Anime with its ids", async () => {
  app = await openApp();
  const { page } = app;
  // Trimmed from AniList's and Jikan's answers (November 2026).
  const sent: string[] = [];
  await page.route("https://graphql.anilist.co/", async (route: Route) => {
    sent.push(route.request().postData() ?? "");
    const media = {
      id: 154587,
      idMal: 52991,
      format: "TV",
      episodes: 28,
      season: "FALL",
      seasonYear: 2023,
      title: { romaji: "Sousou no Frieren", english: "Frieren: Beyond Journey's End" },
      coverImage: { extraLarge: "https://s4.anilist.co/large.png", medium: "https://s4.anilist.co/medium.png" },
      siteUrl: "https://anilist.co/anime/154587",
      studios: { nodes: [{ name: "MADHOUSE" }] },
      description: "The adventure is over but life goes on for an elf mage.",
    };
    await route.fulfill({ headers: CORS, json: { data: route.request().postData()?.includes("Page(") ? { Page: { media: [media] } } : { Media: media } } });
  });
  await page.route("https://s4.anilist.co/**", (route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: PNG }));
  await page.route("https://api.jikan.moe/v4/anime/5114/full", (route: Route) =>
    route.fulfill({
      headers: CORS,
      json: { data: { mal_id: 5114, url: "https://myanimelist.net/anime/5114/Fullmetal_Alchemist__Brotherhood", titles: [{ type: "Default", title: "Fullmetal Alchemist: Brotherhood" }], type: "TV", episodes: 64, season: "spring", year: 2009, studios: [{ name: "Bones" }], synopsis: "Two brothers search for the Philosopher's Stone." } },
    }),
  );

  const picker = await addToLibrary(page);
  await picker.getByRole("radio", { name: "Anime" }).click();
  await picker.getByRole("searchbox").fill("frieren");
  await picker.getByRole("option", { name: /^Frieren: Beyond Journey's End, MADHOUSE · 2023/ }).waitFor();
  // Only what was typed is sent.
  expect(JSON.parse(sent.at(-1)!).variables).toEqual({ search: "frieren" });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    window.testing.text()?.startsWith("---\ntype: anime\nformat: TV\nstudio: MADHOUSE\nyear: 2023\nseason: Fall 2023\nepisodes: 28\nanilist: 154587\nmal: 52991\nlink: https://anilist.co/anime/154587\nstatus: to watch\n---\n# Frieren: Beyond Journey's End"),
  );
  await page.waitForFunction(() => window.testing.text()?.includes("life goes on for an elf mage"));
  expect(await page.locator("#note-list-title").innerText()).toBe("Anime");

  // Its menu on its shelf has the statuses anime lists have.
  await page.locator(".note-list [data-id]").filter({ hasText: "Frieren" }).click({ button: "right" });
  expect(await page.getByRole("menuitemcheckbox").allInnerTexts()).toEqual(["To Watch", "Watching", "Watched", "On Hold", "Dropped"]);
  await page.keyboard.press("Escape");

  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, "https://myanimelist.net/anime/5114/Fullmetal_Alchemist__Brotherhood");
  await page.waitForFunction(() => window.testing.text()?.includes("\nmal: 5114\n"));
  expect(await app.text()).toStartWith("---\ntype: anime\nformat: TV\nstudio: Bones\nyear: 2009\nseason: Spring 2009\nepisodes: 64\nmal: 5114\n");
});

test("Add to Library is as tall as what it shows", async () => {
  app = await openApp();
  const picker = await addToLibrary(app.page);
  await picker.getByRole("status").waitFor();
  // The field, the hint and Blank, with no room left empty under them.
  expect((await picker.boundingBox())!.height).toBeLessThan(200);
});

test("a link pasted into Add to Library is looked up", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  const picker = await addToLibrary(page);
  await picker.getByRole("searchbox").fill(LINK);
  await picker.getByRole("option", { name: /^Rick Astley - Never Gonna Give You Up/ }).click();
  await filled(page);
  expect(await page.locator("#note-list-title").innerText()).toBe("Videos");
});

test("a link in a note, added to the library from its menu, becomes a mention of its note; one ⌘Z puts the link back", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  const before = `Watch ${LINK} tonight`;
  await app.open(`# Plans\n\n${before}`);
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  const menu = page.getByRole("menu");
  expect(await menu.getByRole("menuitem").allInnerTexts()).toEqual(["Open Link", "Copy Link", "Add to Library"]);
  await menu.getByRole("menuitem", { name: "Add to Library" }).click();
  const title = "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)";
  await page.waitForFunction((title) => window.testing.text() === `# Plans\n\nWatch @[${title}] tonight`, title);
  const made = await page.evaluate((title) => window.testing.notes.entries.filter((entry) => entry.meta.title === title).map((entry) => entry.meta.type), title);
  expect(made).toEqual(["video"]);
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction((before) => window.testing.text() === `# Plans\n\n${before}`, before);

  // Again: the note it made already is the one mentioned, not another.
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  await page.waitForFunction((title) => window.testing.text() === `# Plans\n\nWatch @[${title}] tonight`, title);
  expect(await page.evaluate((title) => window.testing.notes.entries.filter((entry) => entry.meta.title === title).length, title)).toBe(1);
});

test("a link added from its menu while its note is closed is mentioned there, where it was, and as the note made is titled", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  // Written by the site with spaces and a `#` the note's title reads without and as text.
  await youtube(page, new Promise<void>((resolve) => (answer = resolve)), { title: "Never  Gonna Give You Up #shorts" });
  // The same address earlier, as the start of another link.
  const id = await app.open(`# Plans\n\nFrom 0:42: ${LINK}?t=42\n\nWatch ${LINK} tonight`);
  await page.locator(".cm-content .cm-lp-link").nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  await page.locator(".cm-library-lookup").waitFor();
  await app.open("# Elsewhere");
  answer();
  const mention = "@[Never Gonna Give You Up \\#shorts]";
  await page.waitForFunction(([id, text]) => window.testing.notes.get(id)?.note.body === text, [id, `# Plans\n\nFrom 0:42: ${LINK}?t=42\n\nWatch ${mention} tonight`] as const);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.title === "Never Gonna Give You Up #shorts").length)).toBe(1);
  // ⌘Z is still the open note's.
  expect(await app.text()).toBe("# Elsewhere");
});

test("a link's lookup shows where it's got to in its note, left and come back to, and then goes", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  await youtube(page, new Promise<void>((resolve) => (answer = resolve)), { fail: true });
  const text = `# Plans\n\nWatch ${LINK} tonight`;
  const id = await app.open(text);
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  const shown = page.locator(".cm-library-lookup");
  await shown.waitFor();
  const elsewhere = await app.open("# Elsewhere");
  await page.evaluate((id) => window.testing.notes.select(id), id);
  await page.waitForFunction((text) => window.testing.text() === text, text);
  expect(await shown.innerText()).toBe("Looking up…");

  await page.evaluate((id) => window.testing.notes.select(id), elsewhere);
  answer();
  await page.waitForTimeout(4500);
  await page.evaluate((id) => window.testing.notes.select(id), id);
  await page.waitForFunction((text) => window.testing.text() === text, text);
  await page.waitForTimeout(300);
  expect(await shown.count()).toBe(0);
});

test("a link changed while it's looked up isn't added", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  await youtube(page, new Promise<void>((resolve) => (answer = resolve)));
  await app.open(`# Plans\n\nWatch ${LINK} tonight`);
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  const shown = page.locator(".cm-library-lookup");
  await shown.waitFor();
  // Typed after it, it's still the link; typed into it, it isn't.
  await page.evaluate((at) => window.testing.place(at), `# Plans\n\nWatch ${LINK}`.length);
  await page.keyboard.type("!");
  expect(await shown.count()).toBe(1);
  await page.evaluate((at) => window.testing.place(at), `# Plans\n\nWatch ${LINK}`.length - 2);
  await page.keyboard.type("x");
  await shown.waitFor({ state: "detached" });
  answer();
  await page.waitForTimeout(500);
  expect(await app.text()).toBe(`# Plans\n\nWatch ${LINK.slice(0, -2)}x${LINK.slice(-2)}! tonight`);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "video").length)).toBe(0);
});
