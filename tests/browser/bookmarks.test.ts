import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Route } from "playwright";
import { type App, noErrors, openApp } from "./app";

/*
 * Bookmarks from each browser, as lines reads them in the browser's own parser (trimmed copies of
 * what each writes, in bookmarks/), and imported as the Library's resources from Settings: what it
 * says it will do, doing it, undoing it, thousands at once, and looking one up afterwards.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** A small picture, for a video's. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAIAAABrW6giAAAAEElEQVR4nGPQiFoARwyUcgAZmhsx2Z6P+QAAAABJRU5ErkJggg==", "base64");
const fixture = (name: string) => readFileSync(new URL(`./bookmarks/${name}`, import.meta.url), "utf8");
const read = (name: string) => app.page.evaluate((text) => window.testing.reading.readBookmarks(text), fixture(name));
/** Each bookmark's title, folders and tags, to compare at a glance. */
const shapes = (bookmarks: { title: string; folders: string[]; tags: string[] }[] | null) => bookmarks?.map(({ title, folders, tags }) => [title, folders.join(" / "), tags.join(",")]);

describe("reading each browser's bookmarks", () => {
  test("Chrome, Edge, Brave, Opera, Vivaldi, Arc: folders under the bookmarks bar, dates in seconds, icons left out", async () => {
    app = await openApp();
    const found = await read("chrome.html");
    expect(shapes(found)).toEqual([
      ["MDN Web Docs", "Bookmarks bar", ""],
      ["The Rust Programming Language - The Rust Programming Language", "Bookmarks bar / Dev / Rust", ""],
      ["The Rust Book (again)", "Bookmarks bar / Dev / Rust", ""],
      ["A bookmarklet", "Bookmarks bar / Dev", ""],
      ["Svelte & SvelteKit · Docs", "Bookmarks bar / Dev", ""],
      ["Bookmark (digital) - Wikipedia", "Other bookmarks", ""],
      ["Settings", "Other bookmarks", ""],
    ]);
    expect(found![1].added).toBe(1700000400000);
  });

  test("Firefox: the menu's at the top, descriptions after bookmarks and folders, tags", async () => {
    app = await openApp();
    const found = await read("firefox.html");
    expect(shapes(found)).toEqual([
      ["Recently Bookmarked", "", ""],
      ["Firefox", "", "mozilla,Web Browsers"],
      ["The Food Lab | Serious Eats", "Recipes", "cooking"],
      ["GitHub", "Bookmarks Toolbar", ""],
      ["HTML 5.2", "Other Bookmarks", "reference,#spec,2024"],
    ]);
    expect(found![1].description).toBe("The browser that puts you first");
  });

  test("Safari: folders outside a list, no dates, the Reading List's descriptions", async () => {
    app = await openApp();
    const found = await read("safari.html");
    expect(shapes(found)).toEqual([
      ["Apple", "Favorites", ""],
      ["BBC News - Home", "Favorites / News", ""],
      ["Blog | WebKit", "", ""],
      ["A Long Read", "Reading List", ""],
    ]);
    expect(found!.every((bookmark) => bookmark.added === undefined)).toBe(true);
    expect(found![3].description).toBe("The first lines of it, as Safari keeps them for the Reading List.");
  });

  test("Pinboard, Raindrop and Pocket: their tags, descriptions, collections and lists", async () => {
    app = await openApp();
    expect(shapes(await read("pinboard.html"))).toEqual([
      ["Why does 0.1 + 0.2 = 0.30000000000000004?", "", "floating-point,programming"],
      ["An untagged one", "", ""],
    ]);
    expect(shapes(await read("raindrop.html"))).toEqual([
      ["Refactoring UI", "Design", "ui,typography"],
      ["example.net", "Unsorted", ""],
    ]);
    const pocket = await read("pocket.html");
    expect(shapes(pocket)).toEqual([
      ["Why I Am Not a Maker", "Unread", "essays,making"],
      ["https://example.com/no-tags", "Unread", ""],
      ["How to Work Hard", "Read Archive", ""],
    ]);
    expect(pocket![0].added).toBe(1600000000000);
  });
});

/** Chooses `files` in the file picker Settings → Library's Import Bookmarks… opens. */
async function chooseBookmarks(files: { name: string; text: string }[]) {
  const settings = await app.settings("Library");
  await settings.locator("input[type=file][accept*='.json']").setInputFiles(files.map(({ name, text }) => ({ name, mimeType: "text/html", buffer: Buffer.from(text) })));
  return settings;
}

const resources = () => app.page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "resource").map((entry) => entry.note));

test("imported from Settings → Library: what it will do, said first, then done, filed on their shelf, and undone", async () => {
  app = await openApp();
  const { page } = app;
  // MDN in the library already.
  const kept = await app.open("---\ntype: article\nlink: https://developer.mozilla.org/en-US/\n---\n# MDN");
  const settings = await chooseBookmarks([{ name: "bookmarks.html", text: fixture("chrome.html") }]);
  await settings.getByText("7 bookmarks in bookmarks.html").waitFor();
  expect(await settings.getByText(/left out$/).allInnerTexts()).toEqual([
    "1 is in the Library already, with the same link: left out",
    "1 repeat in the file: left out",
    "2 aren’t web pages (bookmarklets, a browser’s own pages): left out",
  ]);
  // Nothing written yet.
  expect(await resources()).toEqual([]);
  // Focus is on Import, to import with Enter.
  const start = settings.getByRole("button", { name: "Import 3 Resources" });
  expect(await start.evaluate((button) => button === document.activeElement)).toBe(true);
  await settings.getByRole("switch", { name: "Tag with their folders" }).click();
  await start.click();
  await settings.getByText("Imported 3 resources; 1 was already there").waitFor();

  const made = await resources();
  expect(made.length).toBe(3);
  const rust = made.find((note) => note.body.includes("# The Rust Programming Language"))!;
  expect(rust.body).toBe(
    [
      "---",
      "type: resource",
      "folder: Bookmarks bar / Dev / Rust",
      `added: ${await page.evaluate(() => {
        const date = new Date(1700000400000);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      })}`,
      "link: https://doc.rust-lang.org/book/",
      "---",
      "# The Rust Programming Language - The Rust Programming Language",
      "",
      "#bookmarks-bar/dev/rust",
      "",
    ].join("\n"),
  );
  // Dated when they were bookmarked, so the shelf lists them so; filed, not in the Inbox.
  expect([rust.createdAt, rust.updatedAt]).toEqual([1700000400000, 1700000400000]);
  expect(made.some((note) => note.inbox)).toBe(false);

  // Undone while it says what it did: they're gone, and nothing else.
  await settings.getByRole("button", { name: "Undo Import" }).click();
  await settings.getByText("Import undone: 3 resources removed").waitFor();
  expect(await resources()).toEqual([]);
  expect(await page.evaluate((id) => !!window.testing.notes.get(id), kept)).toBe(true);

  // Imported again, they're on their shelf, the latest bookmarked first.
  await chooseBookmarks([{ name: "bookmarks.html", text: fixture("chrome.html") }]);
  await settings.getByRole("button", { name: "Import 3 Resources" }).click();
  await settings.getByText("Imported 3 resources; 1 was already there").waitFor();
  await app.closeSettings();
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Resources/ }).click();
  expect(await page.locator(".note-list [data-id]").allInnerTexts()).toEqual([
    expect.stringMatching(/^Bookmark \(digital\) - Wikipedia\s+Other bookmarks/),
    expect.stringMatching(/^Svelte & SvelteKit · Docs\s+Bookmarks bar \/ Dev/),
    expect.stringMatching(/^The Rust Programming Language - The Rust Programming Language\s+Bookmarks bar \/ Dev \/ Rust/),
  ]);
});

test("Export and Import's Import Files… asks about a bookmarks file, and imports the rest as notes", async () => {
  app = await openApp();
  const settings = await app.settings("Export and Import");
  await settings.locator("input[type=file][multiple]").first().setInputFiles([
    { name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(fixture("firefox.html")) },
    { name: "Plans.md", mimeType: "text/markdown", buffer: Buffer.from("# Plans\n\nA note.") },
  ]);
  await settings.getByText("Imported 1 note").waitFor();
  await settings.getByText("5 bookmarks in bookmarks.html").waitFor();
  await settings.getByRole("button", { name: "Import 4 Resources" }).click();
  await settings.getByText("Imported 4 resources").waitFor();
  const firefox = (await resources()).find((note) => note.body.includes("# Firefox"))!;
  expect(firefox.body).toEndWith("# Firefox\n\nThe browser that puts you first\n\n#mozilla #web-browsers\n");
});

test("five thousand at once: the list and the sidebar keep up, and they're all there", async () => {
  app = await openApp();
  const { page } = app;
  const links = Array.from({ length: 5000 }, (_, i) => `<DT><A HREF="https://example.com/${i}" ADD_DATE="${1600000000 + i}" TAGS="t${i % 10}">Page ${i}</A>`);
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n<DT><H3>Many</H3>\n<DL><p>\n${links.join("\n")}\n</DL><p>\n</DL><p>\n`;
  const settings = await chooseBookmarks([{ name: "many.html", text: html }]);
  await settings.getByText("5,000 bookmarks in many.html").waitFor();
  const started = Date.now();
  await settings.getByRole("button", { name: "Import 5,000 Resources" }).click();
  // Its progress, as it goes.
  await settings.locator("progress").waitFor();
  await settings.getByText("Imported 5,000 resources").waitFor({ timeout: 60_000 });
  console.log(`Imported 5,000 bookmarks in ${Date.now() - started} ms`);
  expect((await resources()).length).toBe(5000);
  await app.closeSettings();
  const shelf = page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Resources/ });
  expect(await shelf.innerText()).toMatch(/Resources\s+5,?000/);
  await shelf.click();
  await page.locator(".note-list [data-id]").first().waitFor();
  expect(await page.locator(".note-list [data-id]").first().innerText()).toStartWith("Page 4999");
});

test("a resource is looked up when asked, from its row: what its link is, keeping its folder and tags", async () => {
  app = await openApp();
  const { page } = app;
  await page.route("https://www.youtube.com/oembed**", (route: Route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { title: "Rick Astley - Never Gonna Give You Up", author_name: "Rick Astley" } }),
  );
  await page.route("https://i.ytimg.com/**", (route: Route) => route.fulfill({ headers: { "access-control-allow-origin": "*", "content-type": "image/png" }, body: PNG }));
  const id = await app.open("---\ntype: resource\nfolder: Bookmarks bar / Music\nadded: 2023-11-14\nlink: https://youtu.be/dQw4w9WgXcQ\n---\n# Never Gonna\n\n#classics\n");
  await app.open("# Elsewhere");
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Resources/ }).click();
  await page.locator(".note-list [data-id]").filter({ hasText: "Never Gonna" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Look Up Details" }).click();
  await page.waitForFunction((id) => window.testing.notes.get(id)?.note.body.startsWith("---\ntype: video\n"), id);
  const body = await page.evaluate((id) => window.testing.notes.get(id)!.note.body, id);
  expect(body).toStartWith(
    "---\ntype: video\nchannel: Rick Astley\nfolder: Bookmarks bar / Music\nadded: 2023-11-14\nlink: https://www.youtube.com/watch?v=dQw4w9WgXcQ\nstatus: to watch\n---\n# Rick Astley - Never Gonna Give You Up\n",
  );
  expect(body).toEndWith("\n\n#classics\n");
});
