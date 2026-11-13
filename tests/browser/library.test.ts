import { afterEach, expect, test } from "bun:test";
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

/** Answers YouTube for the page, as it would, once `ready` (at once, if it's not given); the requests it was sent. */
async function youtube(page: App["page"], ready?: Promise<unknown>) {
  const asked: string[] = [];
  await page.route("https://www.youtube.com/oembed**", async (route: Route) => {
    asked.push(route.request().url());
    await ready;
    await route.fulfill({ headers: CORS, json: { title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)", author_name: "Rick Astley" } });
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
  await page.getByRole("button", { name: "New in Library" }).click();
  await page.getByRole("menuitem", { name: "Video", exact: true }).click();
  await page.waitForFunction(() => window.testing.text() === "---\ntype: video\nstatus: to watch\n---\n# ");
  await page.evaluate(() => window.testing.place());
  await paste(page, LINK);
  await filled(page);
  expect(await app.text()).toContain(`\n---\n# ${TITLE}\n`);
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

  await toggle(await app.settings("Library"), "Look up links", false);
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
