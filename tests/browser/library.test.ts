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
  // Its picture, as wide as a video's shows, kept with it once it's written. WebKit here can't store
  // pictures: there it's taken out of the note again, rather than left one that can't be shown.
  expect(text.slice(text.indexOf(`# ${TITLE}\n`))).toMatch(/^# .*\n\n!\[.*\|400\]\(\.\.\/attachments\/([0-9a-f]{32}\.jpg)\)\n$/);
  if (engine() === "chromium") {
    const name = /attachments\/([0-9a-f]{32}\.jpg)/.exec(text)![1];
    await page.waitForFunction(async (name) => (await window.testing.attachmentNames()).includes(name), name);
  } else {
    await page.waitForFunction((title) => window.testing.text()?.endsWith(`# ${title}\n`), TITLE);
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
  expect(await kinds.getByRole("radio").allInnerTexts()).toEqual(["Books", "Movies", "Shows", "Music", "Podcasts"]);
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

/** A video note there is already, as a link made it; its id. */
const videoThere = (page: App["page"], more = "") =>
  page.evaluate(
    async (more) => {
      const now = Date.now() - 60_000;
      const id = crypto.randomUUID();
      const body = `---\ntype: video\nchannel: Rick Astley\nlink: https://www.youtube.com/watch?v=dQw4w9WgXcQ\nstatus: to watch\n${more}---\n# Never Gonna Give You Up\n`;
      await window.testing.notes.insert({ id, body, createdAt: now, updatedAt: now, pinned: false, trashed: false });
      return id;
    },
    more,
  );
const bodyOf = (page: App["page"], id: string) => page.evaluate((id) => window.testing.notes.get(id)?.note.body, id);
const videos = (page: App["page"]) => page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "video").length);

test("a link to what the Library has, pasted into a new note, opens that note, counted, and the new one goes to the Trash", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  const there = await videoThere(page);
  const date = await page.evaluate((id) => window.testing.notes.get(id)!.note.updatedAt, there);
  // The same video, written another way.
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "# ");
  const made = await page.evaluate(() => window.testing.notes.selectedId);
  await paste(page, "https://youtu.be/dQw4w9WgXcQ?si=shared");
  await page.waitForFunction((there) => window.testing.notes.selectedId === there, there);
  // Said, quietly, at the end of the note open; the new note, that was only the link, in the Trash.
  expect(await page.locator(".cm-library-lookup").innerText()).toBe("Already in your Library");
  expect(await page.evaluate((made) => window.testing.notes.get(made!)?.note.trashed, made)).toBe(true);
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 2\n"), there);
  // Counted as any edit is, so it syncs as one (kept as of then, it would lose to an edit elsewhere).
  expect(await page.evaluate((id) => window.testing.notes.get(id)!.note.updatedAt, there)).toBeGreaterThan(date);
  expect(await videos(page)).toBe(1);
  // Typed straight away, it's at the end of its title: its properties as they were, on its shelf still.
  await page.keyboard.type("xyz");
  await page.waitForFunction(() => window.testing.text()?.includes("\n# Never Gonna Give You Upxyz\n"));
  expect(await app.text()).toStartWith("---\ntype: video\n");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");

  // Again, then with counting off in Settings → Library: opened, not counted.
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await paste(page, LINK);
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 3\n"), there);
  await toggle(await app.settings("Library"), "Count adding again", false);
  await app.closeSettings();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await paste(page, LINK);
  await page.waitForFunction((there) => window.testing.notes.selectedId === there, there);
  await page.waitForTimeout(300);
  expect(await bodyOf(page, there)).toContain("\ntimes added: 3\n");
  expect(await videos(page)).toBe(1);
});

test("an IMDb link pasted twice is one note: the second opens the first", async () => {
  app = await openApp();
  const { page } = app;
  const answer = (pattern: string, json: unknown) => page.route(pattern, (route: Route) => route.fulfill({ headers: CORS, json }));
  await answer("https://www.wikidata.org/w/api.php?action=query**", { query: { search: [{ title: "Q64584978" }] } });
  await answer("https://www.wikidata.org/w/api.php?action=wbgetentities**", {
    entities: {
      Q64584978: {
        labels: { en: { value: "Emily in Paris" } },
        sitelinks: { enwiki: { title: "Emily in Paris" } },
        claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q5398426" } } } }], P345: [{ mainsnak: { datavalue: { value: "tt8962124" } } }] },
      },
    },
  });
  await answer("https://en.wikipedia.org/api/rest_v1/page/summary/**", { wikibase_item: "Q64584978", extract: "An American comedy-drama series." });
  await answer("https://en.wikipedia.org/w/api.php?**", { query: { pages: { "1": { title: "Emily in Paris", pageimage: "Emily_in_Paris_logo.svg" } } } });
  for (const link of ["https://www.imdb.com/title/tt8962124", "https://m.imdb.com/title/tt8962124/?ref_=fn_al_tt_1"]) {
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await page.waitForFunction(() => window.testing.text() === "# ");
    await paste(page, link);
    await page.waitForFunction(() => window.testing.text()?.includes("# Emily in Paris"));
  }
  const shows = await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "show").map((entry) => entry.note.body));
  expect(shows).toHaveLength(1);
  // Its page's picture is a logo: no cover, rather than one that can't be shown.
  expect(shows[0]).not.toContain("](../attachments/");
  expect(shows[0]).toContain("\ntimes added: 2\n");
});

test("Add to Library and a link's menu open or mention what the Library has, counted, and make nothing", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  const there = await videoThere(page);
  const picker = await addToLibrary(page);
  await picker.getByRole("searchbox").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share");
  await picker.getByRole("option", { name: /^Rick Astley - Never Gonna Give You Up/ }).click();
  await page.waitForFunction((there) => window.testing.notes.selectedId === there, there);
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 2\n"), there);
  // Opened with the keyboard at the end of its title, not before its properties.
  await page.keyboard.type("xyz");
  await page.waitForFunction(() => window.testing.text()?.includes("\n# Never Gonna Give You Upxyz\n"));
  expect(await app.text()).toStartWith("---\ntype: video\n");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");

  await app.open(`# Plans\n\nWatch ${LINK} tonight`);
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  await page.waitForFunction(() => window.testing.text() === "# Plans\n\nWatch @[Never Gonna Give You Up] tonight");
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 3\n"), there);
  expect(await videos(page)).toBe(1);
});

test("a cover that can't be shown is its kind's icon on its shelf, and mended when what it is is added again", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  // A cover kept before lines knew better: not a picture.
  const broken = await page.evaluate(async () => window.testing.saveAttachment(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/jpeg" })).catch(() => "0123456789abcdef0123456789abcdef.jpg"));
  const there = await videoThere(page, "");
  await page.evaluate(
    ([id, name]) => window.testing.notes.setText(id, (body) => `${body}\n![Never Gonna Give You Up|400](../attachments/${name})\n`),
    [there, broken] as const,
  );
  await app.open("# Elsewhere");
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Videos/ }).click();
  const row = page.locator(".note-list [data-id]").filter({ hasText: "Never Gonna Give You Up" });
  await row.locator(".ui-cover svg").waitFor();
  expect(await row.locator(".ui-cover img").count()).toBe(0);

  await page.getByRole("button", { name: "New note", exact: true }).click();
  await paste(page, LINK);
  if (engine() === "chromium") {
    await page.waitForFunction(([id, name]) => !window.testing.notes.get(id)?.note.body.includes(name), [there, broken] as const);
    // A picture now, kept.
    expect(await bodyOf(page, there)).toMatch(/\n!\[Never Gonna Give You Up\|400\]\(\.\.\/attachments\/[0-9a-f]{32}\.jpg\)\n/);
    // And shown on its shelf at once.
    await row.locator(".ui-cover img").waitFor();
  } else {
    // WebKit here can't store the broken one, so it's one not on this device yet: left for it to arrive.
    await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 2\n"), there);
    expect(await bodyOf(page, there)).toContain(`](../attachments/${broken})`);
  }
});

test("a see-through cover stays see-through, and a drawing (an SVG) isn't kept as one", async () => {
  app = await openApp();
  const { page } = app;
  await page.route("https://www.youtube.com/oembed**", (route: Route) => route.fulfill({ headers: CORS, json: { title: "A logo", author_name: "Someone" } }));
  // A 2×2 PNG, half of it clear.
  const clear = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP4z8DA8B+EYAwANN0F+8lEt70AAAAASUVORK5CYII=", "base64");
  await page.route("https://i.ytimg.com/vi/dQw4w9WgXcQ/**", (route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: clear }));
  await page.route("https://i.ytimg.com/vi/aaaaaaaaaaa/**", (route: Route) =>
    route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: "<svg xmlns='http://www.w3.org/2000/svg'><circle r='4'/></svg>" }),
  );
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await page.waitForFunction(() => window.testing.text()?.includes("# A logo"));
  if (engine() === "chromium") await page.waitForFunction(() => /\]\(\.\.\/attachments\/[0-9a-f]{32}\.png\)/.test(window.testing.text() ?? ""));
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, "https://youtu.be/aaaaaaaaaaa");
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: video\n"));
  expect(await app.text()).not.toContain("](../attachments/");
});

test("a cover sent as any file (as storage hosts send them) is kept, told a picture by its bytes", async () => {
  app = await openApp();
  const { page } = app;
  await page.route("https://www.youtube.com/oembed**", (route: Route) => route.fulfill({ headers: CORS, json: { title: "Stored elsewhere", author_name: "Someone" } }));
  await page.route("https://i.ytimg.com/**", (route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "application/octet-stream" }, body: PNG }));
  await app.open("");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await page.waitForFunction(() => window.testing.text()?.includes("# Stored elsewhere"));
  // WebKit here can't store pictures, so it's taken out again there.
  if (engine() === "chromium") await page.waitForFunction(() => /\]\(\.\.\/attachments\/[0-9a-f]{32}\.jpg\)/.test(window.testing.text() ?? ""));
});

test("a post is saved already when the Library has a note of its link, however that was added", async () => {
  app = await openApp();
  const { page } = app;
  const id = await app.open("---\ntype: article\nlink: https://example.com/2026/a-post/\n---\n# A Post");
  const saved = (post: { link?: string; audio?: { url: string } }) =>
    page.evaluate((post) => window.testing.feeds.savedNote({ feed: "https://example.com/feed.xml", post } as never)?.note.id ?? null, post);
  expect(await saved({ link: "https://www.example.com/2026/a-post?utm_source=rss" })).toBe(id);
  expect(await saved({ link: "https://example.com/2026/another-post/" })).toBeNull();
});

test("found already after you've moved on: the note that was only the link goes, where you are; a note of long ago is left, with Open, uncounted", async () => {
  app = await openApp();
  const { page } = app;
  let answer!: () => void;
  await youtube(page, new Promise<void>((resolve) => (answer = resolve)));
  const there = await videoThere(page);
  // A new note for the link, left for another while it's looked up.
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "# ");
  const made = (await page.evaluate(() => window.testing.notes.selectedId))!;
  await paste(page, LINK);
  await page.locator(".cm-library-lookup").waitFor();
  const elsewhere = await app.open("# Elsewhere\n\n");
  await page.evaluate(() => window.testing.place());
  await page.keyboard.type("Typing");
  answer();
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 2\n"), there);
  await page.keyboard.type(" on");
  // Still here, still typing here; the note that was only the link in the Trash.
  expect(await page.evaluate(() => window.testing.notes.selectedId)).toBe(elsewhere);
  expect(await app.text()).toBe("# Elsewhere\n\nTyping on");
  expect(await page.evaluate((made) => window.testing.notes.get(made)?.note.trashed, made)).toBe(true);

  // A note of long ago, its whole text made a link to it by hand: left as it is, not in the Trash, nor counted.
  const old = await page.evaluate(async () => {
    const id = crypto.randomUUID();
    await window.testing.notes.insert({ id, body: "# Plans", createdAt: 0, updatedAt: 0, pinned: true, trashed: false });
    return id;
  });
  await page.evaluate((id) => window.testing.notes.select(id), old);
  await page.waitForFunction(() => window.testing.text() === "# Plans");
  await page.evaluate(() => window.testing.place());
  await page.keyboard.press(`${mod()}+a`);
  await paste(page, LINK);
  await page.waitForFunction(() => /Already in your Library/.test(document.querySelector(".cm-library-lookup")?.textContent ?? ""));
  await page.waitForFunction(([id, link]) => window.testing.notes.get(id)?.note.body === link, [old, LINK] as const);
  expect(await page.evaluate((id) => window.testing.notes.get(id)!.note, old)).toMatchObject({ trashed: false, pinned: true });
  expect(await page.evaluate(() => window.testing.notes.selectedId)).toBe(old);
  expect(await bodyOf(page, there)).toContain("\ntimes added: 2\n");
  // Open opens it, the keyboard at the end of its title.
  expect(await page.locator(".cm-library-lookup").innerText()).toMatch(/^Already in your Library\s*Open$/);
  await page.locator(".cm-library-open").click();
  await page.waitForFunction((there) => window.testing.notes.selectedId === there, there);
  await page.keyboard.type("!");
  await page.waitForFunction(() => window.testing.text()?.includes("\n# Never Gonna Give You Up!\n"));
});

test("a show found by searching that the Library has from IMDb is opened, not made again; typed into meanwhile, it's kept, offering to merge what was typed", async () => {
  app = await openApp();
  const { page } = app;
  const entity = {
    labels: { en: { value: "Emily in Paris" } },
    descriptions: { en: { value: "American comedy-drama series" } },
    sitelinks: { enwiki: { title: "Emily in Paris" } },
    claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q5398426" } } } }], P345: [{ mainsnak: { datavalue: { value: "tt8962124" } } }] },
  };
  const answer = (asked: (url: URL) => boolean, json: unknown) => page.route(asked, (route: Route) => route.fulfill({ headers: CORS, json }));
  const wikidata = (url: URL) => url.hostname === "www.wikidata.org";
  await answer((url) => wikidata(url) && url.searchParams.get("list") === "search", { query: { search: [{ title: "Q64584978" }] } });
  await answer((url) => wikidata(url) && url.searchParams.get("action") === "wbgetentities", { entities: { Q64584978: entity } });
  await answer((url) => url.href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/"), { wikibase_item: "Q64584978", extract: "An American comedy-drama series." });
  await answer((url) => url.href.startsWith("https://en.wikipedia.org/w/api.php?"), { query: { pages: { "1": { title: "Emily in Paris" } } } });
  const there = await page.evaluate(async () => {
    const id = crypto.randomUUID();
    const body = "---\ntype: show\nlink: https://www.imdb.com/title/tt8962124/\nstatus: to watch\n---\n# Emily in Paris\n";
    await window.testing.notes.insert({ id, body, createdAt: 0, updatedAt: 0, pinned: false, trashed: false });
    return id;
  });
  const picker = await addToLibrary(page);
  await picker.getByRole("radio", { name: "Shows" }).click();
  await picker.getByRole("searchbox").fill("emily");
  await picker.getByRole("option", { name: /^Emily in Paris/ }).click();
  await page.waitForFunction((there) => window.testing.notes.selectedId === there, there);
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 2\n"), there);
  const shows = () => page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "show" && !entry.note.trashed).length);
  expect(await shows()).toBe(1);
  // Typed straight away, at the end of its title.
  await page.keyboard.type("xyz");
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ntype: show\n") && window.testing.text()?.includes("\n# Emily in Parisxyz\n"));
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");

  // Chosen again, a line typed into the note made for it before it's found to be there already.
  let found!: () => void;
  const later = new Promise<void>((resolve) => (found = resolve));
  await page.route(
    (url) => url.hostname === "www.wikidata.org" && url.searchParams.get("props") === "claims|labels|sitelinks",
    async (route: Route) => {
      await later;
      await route.fulfill({ headers: CORS, json: { entities: { Q64584978: entity } } });
    },
  );
  const again = await addToLibrary(page);
  await again.getByRole("radio", { name: "Shows" }).click();
  await again.getByRole("searchbox").fill("emily");
  await again.getByRole("option", { name: /^Emily in Paris/ }).click();
  await page.waitForFunction((there) => window.testing.notes.selectedId !== there && window.testing.text()?.startsWith("---\ntype: show\n"), there);
  const made = (await page.evaluate(() => window.testing.notes.selectedId))!;
  await page.keyboard.press("Enter");
  await page.keyboard.type("Recommended by Sam");
  found();
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 3\n"), there);
  // Kept, as typed, saying so; going on typing, it still does.
  await page.keyboard.type(".");
  expect(await page.locator(".cm-library-lookup").innerText()).toMatch(/^Already in your Library\s*Open\s*Merge$/);
  expect(await app.text()).toContain("\nRecommended by Sam.");
  expect(await page.evaluate(() => window.testing.notes.selectedId)).toBe(made);
  expect(await shows()).toBe(2);
  // Merged: what was typed is the one there's, opened; the note made for it in the Trash.
  await page.getByRole("button", { name: "Move what you wrote to the note in your Library" }).click();
  await page.waitForFunction((there) => window.testing.notes.selectedId === there, there);
  expect(await bodyOf(page, there)).toEndWith("# Emily in Paris\n\nRecommended by Sam.\n");
  expect(await page.evaluate((made) => window.testing.notes.get(made)?.note.trashed, made)).toBe(true);
  expect(await shows()).toBe(1);
});

test("a cover that's still to arrive from another device is left as it is when what it is is added again", async () => {
  app = await openApp();
  const { page } = app;
  await youtube(page);
  const missing = "0123456789abcdef0123456789abcdef.jpg";
  const there = await videoThere(page);
  await page.evaluate(([id, name]) => window.testing.notes.setText(id, (body) => `${body}\n![Never Gonna Give You Up|400](../attachments/${name})\n`), [there, missing] as const);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await paste(page, LINK);
  await page.waitForFunction((there) => window.testing.notes.get(there)?.note.body.includes("\ntimes added: 2\n"), there);
  await page.waitForTimeout(500);
  expect(await bodyOf(page, there)).toContain(`](../attachments/${missing})`);
});

test("a feed's episodes sharing their show's link are each saved by their sound, not taken for the show or each other", async () => {
  app = await openApp();
  const { page } = app;
  // The show's note subscribes to its feed, which is fetched.
  await page.route("https://show.example/feed.xml", (route: Route) => route.fulfill({ headers: CORS, contentType: "application/rss+xml", body: "<rss><channel><title>The Show</title></channel></rss>" }));
  const [podcast, first] = await page.evaluate(async () => {
    const insert = async (body: string) => {
      const id = crypto.randomUUID();
      await window.testing.notes.insert({ id, body, createdAt: 0, updatedAt: 0, pinned: false, trashed: false });
      return id;
    };
    return [
      await insert("---\ntype: podcast\nfeed: https://show.example/feed.xml\nlink: https://show.example/\n---\n# The Show"),
      await insert("---\ntype: episode\npodcast: @[The Show]\naudio: https://cdn.example/1.mp3\nlink: https://show.example/\n---\n# Episode 1"),
    ];
  });
  const saved = (audio: string) =>
    page.evaluate((audio) => window.testing.feeds.savedNote({ feed: "https://show.example/feed.xml", post: { link: "https://show.example/", audio: { url: audio } } } as never)?.note.id ?? null, audio);
  expect(await saved("https://cdn.example/1.mp3")).toBe(first);
  expect(await saved("https://cdn.example/2.mp3")).toBeNull();
  expect(podcast).not.toBe(first);
});

/** A product's home page, saying only its title and what it is: what the Library knows nothing more of. Served as a site that lets pages read it. */
const HOME = "https://intent.example/";
const homePage = (page: App["page"]) =>
  page.route(
    (url) => url.hostname.endsWith("intent.example"),
    (route: Route) =>
      route.fulfill({
        headers: { ...CORS, "content-type": "text/html; charset=utf-8" },
        body: '<!doctype html><html><head><title>Intent — plan your day</title><meta property="og:title" content="Intent"><meta property="og:description" content="Plan your day with #intent."><link rel="icon" href="/icon.png"></head><body><h1>Intent</h1></body></html>',
      }),
  );
const today = (page: App["page"]) =>
  page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
const resourceText = (day: string, more = "") =>
  `---\ntype: resource\nsite: intent.example\nadded: ${day}\nlink: ${HOME}\nstatus: to read\n${more}---\n# Intent\n\nPlan your day with \\#intent.\n`;

test("a page nothing can say more of, added on purpose, is kept as a resource to read; again, it's opened", async () => {
  app = await openApp();
  const { page } = app;
  await homePage(page);
  const picker = await addToLibrary(page);
  await picker.getByRole("searchbox").fill(HOME);
  await picker.getByRole("option", { name: /^Intent/ }).click();
  const day = await today(page);
  await page.waitForFunction((text) => window.testing.text() === text, resourceText(day));
  expect(await page.locator("#note-list-title").innerText()).toBe("Resources");
  expect(await page.locator(".note-list [data-id]").first().innerText()).toMatch(/^Intent\s+intent\.example\s+To Read/);

  // Added again, from the same dialog: that note, counted.
  const again = await addToLibrary(page);
  await again.getByRole("searchbox").fill("https://www.intent.example/?utm_source=newsletter");
  await again.getByRole("option", { name: /^Intent/ }).click();
  await page.waitForFunction((text) => window.testing.text() === text, resourceText(day, "times added: 2\n"));
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "resource").length)).toBe(1);
});

test("a link in a note to a page nothing can say more of, added from its menu, is a resource mentioned in its place", async () => {
  app = await openApp();
  const { page } = app;
  await homePage(page);
  await app.open(`# Tools\n\nTry ${HOME} for planning`);
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  await page.waitForFunction(() => window.testing.text() === "# Tools\n\nTry @Intent for planning");
  const made = await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "resource").map((entry) => entry.note.body));
  expect(made).toEqual([resourceText(await today(page))]);
});

test("a note that's only a link to such a page stays as it is: nothing is guessed", async () => {
  app = await openApp();
  const { page } = app;
  await homePage(page);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "# ");
  await paste(page, HOME);
  await page.waitForTimeout(1500);
  expect(await app.text()).toBe(`# ${HOME}`);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "resource").length)).toBe(0);
});

test("a page that can't be reached, added on purpose, says so, and nothing is made", async () => {
  app = await openApp();
  const { page } = app;
  await page.route((url) => url.hostname === "down.example", (route: Route) => route.abort("failed"));
  const link = "https://down.example/";
  await app.open(`# Tools\n\nTry ${link} for planning`);
  await page.locator(".cm-content .cm-lp-link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  await page.waitForFunction(() => document.querySelector(".cm-library-lookup")?.textContent === "Couldn’t look this link up");
  expect(await app.text()).toBe(`# Tools\n\nTry ${link} for planning`);

  const picker = await addToLibrary(page);
  await picker.getByRole("searchbox").fill(link);
  await picker.getByRole("button", { name: "Try Again" }).waitFor();
  expect(await picker.getByRole("option").count()).toBe(0);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "resource").length)).toBe(0);
  // The search's failure, logged as it is offline.
  app.errors.length = 0;
});
