import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Request, Route } from "playwright";
import { type App, noErrors, openApp } from "./app";

/*
 * Moving from Readwise: Settings → Library's Readwise, with the token sent to Readwise and nowhere
 * else, what it found said before anything's written, the import (stopped, or failing partway too),
 * Undo, and importing again. Readwise answers from the unit tests' fixtures (shaped as its API
 * documents its answers), and covers are a small picture: nothing reaches the network.
 */

let app: App;
afterEach(async () => {
  // But the browser's own word on the answers a test gives as errors (a token not taken, a wait).
  noErrors({ ...app, errors: app.errors.filter((error) => !/\b(?:401|429)\b/.test(error)) });
  await app.close();
});

const fixture = (name: string) => readFileSync(new URL(`../unit/fixtures/readwise/${name}`, import.meta.url), "utf8");
const READER: Record<string, unknown> = JSON.parse(fixture("reader.json"));
const TOKEN = "test-token-123";
/** A small picture, for the covers. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAIAAABrW6giAAAAEElEQVR4nGPQiFoARwyUcgAZmhsx2Z6P+QAAAABJRU5ErkJggg==", "base64");
const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "retry-after" };

/**
 * Answers Readwise's API and the covers for the page, as they would: the export `exported` (the
 * fixture's, if not given), and Reader's lists. Every request that carried a token.
 */
async function readwise(page: App["page"], { exported, covers }: { exported?: () => unknown; covers?: (route: Route) => Promise<void> } = {}) {
  const authorized: string[] = [];
  page.on("request", (request: Request) => {
    if (request.headers().authorization) authorized.push(`${request.headers().authorization} ${new URL(request.url()).origin}`);
  });
  await page.route("https://readwise.io/api/v2/auth/", (route: Route) => route.fulfill({ headers: CORS, status: 204 }));
  await page.route("https://readwise.io/api/v2/export/**", (route: Route) => {
    const body = exported?.();
    if (typeof body === "number") return route.fulfill({ headers: { ...CORS, "retry-after": "1" }, status: body, json: {} });
    return route.fulfill({ headers: { ...CORS, "content-type": "application/json" }, body: body ? JSON.stringify(body) : fixture("export.json") });
  });
  await page.route("https://readwise.io/api/v3/list/**", (route: Route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("pageCursor");
    return route.fulfill({ headers: CORS, json: exported ? { results: [], nextPageCursor: null } : READER[`${url.searchParams.get("location")}${cursor ? `:${cursor}` : ""}`] });
  });
  for (const pictures of ["https://m.media-amazon.com/**", "https://example.com/images/**", "https://i.ytimg.com/**"]) {
    await page.route(pictures, covers ?? ((route: Route) => route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: PNG })));
  }
  return authorized;
}

const bodyOf = (page: App["page"], title: string) =>
  page.evaluate((title) => window.testing.notes.entries.find((entry) => entry.meta.title === title && !entry.note.trashed)?.note.body, title);
const noteOf = (page: App["page"], title: string) =>
  page.evaluate((title) => window.testing.notes.entries.find((entry) => entry.meta.title === title && !entry.note.trashed)?.note, title);
const focused = (page: App["page"]) => page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute("type"));

/** Settings → Library's Readwise group, with a token put in and Find pressed. */
async function find(token = TOKEN) {
  const settings = await app.settings("Library");
  const group = settings.getByRole("region", { name: "Readwise" });
  await group.getByLabel("Access token").fill(token);
  await group.getByRole("button", { name: "Find", exact: true }).click();
  return group;
}

/** An export of `count` sources, each with `highlights` highlights and nothing else. */
const many = (count: number, highlights = 1) => ({
  nextPageCursor: null,
  results: Array.from({ length: count }, (_, i) => ({
    user_book_id: 5000 + i,
    title: `Article ${i + 1}`,
    author: "Ada Example",
    category: "articles",
    source_url: `https://example.org/${i + 1}`,
    highlights: Array.from({ length: highlights }, (_, j) => ({ id: i * 100 + j, text: `Highlight ${j + 1} of article ${i + 1}.`, location: j + 1, location_type: "order" })),
  })),
});

const WALDEN = "---\ntype: book\nauthor: Henry David Thoreau\nstatus: read\n---\n# Walden\n\nMy own notes on it.\n";
const SUMMARY = [
  "Found 1 book, 3 articles, 1 episode, 1 video, and 1 paper, with 5 highlights.",
  "Adds 1 highlight to notes in lines already: Walden.",
  "1 supplemental book, Readwise’s suggestion, is left out.",
];

test("says what Readwise has before writing anything, imports it with its highlights, undoes it, and imports only what's new again", async () => {
  app = await openApp();
  const { page } = app;
  const authorized = await readwise(page);
  // In the library already, by its title and author: it's added to, not made again.
  const walden = await app.open(WALDEN);
  const waldenDate = (await noteOf(page, "Walden"))!.updatedAt;

  const group = await find();
  for (const line of SUMMARY) await group.getByText(line, { exact: true }).waitFor();
  // Nothing's written yet; Import has focus, and the token's gone from its field.
  expect(await bodyOf(page, "Moby-Dick")).toBeUndefined();
  expect(await focused(page)).toBe("Import");
  expect(await group.getByLabel("Access token").inputValue()).toBe("");

  await page.keyboard.press("Enter");
  // Closing Settings doesn't stop it, and it's there to undo when Settings opens again.
  await app.closeSettings();
  await app.settings("Library");
  await group.getByText("Added 7 notes. Added highlights to 1 note there already.").waitFor();
  expect(await focused(page)).toBe("Undo Import");
  // The token went to Readwise alone.
  expect(new Set(authorized)).toEqual(new Set([`Token ${TOKEN} https://readwise.io`]));

  const moby = (await bodyOf(page, "Moby-Dick"))!;
  expect(moby).toMatch(/^---\ntype: book\nauthor: Herman Melville\nreadwise: 1001\n---\n# Moby-Dick\n\n!\[Moby-Dick\|240\]\(\.\.\/attachments\/[0-9a-f]{32}\.[a-z]+\)\n\n#classics\n\nRead on the train/);
  expect(moby).toContain("## Highlights\n\n> Call me Ishmael.\n> — Location 12 · ");
  expect(moby).toContain("\n> — Location 2210 · ");
  // Where each has got to, from Reader, with Reader's id.
  expect(await bodyOf(page, "On Gardens")).toContain("\nreadwise: 1003\nreader: 01readerarticle\nlink: https://example.com/on-gardens\nstatus: reading\n");
  expect(await bodyOf(page, "Attention and Reading")).toContain("\nstatus: read\n");
  expect(await bodyOf(page, "Notes That Last")).toContain("\nreader: 01readernew\nlink: https://example.com/blog/notes-that-last\nstatus: to read\n");
  expect(await bodyOf(page, "Tweets From Example Person")).toStartWith("---\ntype: article\n");
  const appended = `${WALDEN}\n## Highlights\n\n> I went to the woods because I wished to live deliberately.\n>\n> I wanted to live deep and suck out all the marrow of life.\n> — Page 90 · `;
  expect(await bodyOf(page, "Walden")).toStartWith(appended);
  // Added to, it stays where it was in the list.
  expect((await noteOf(page, "Walden"))!.updatedAt).toBe(waldenDate);

  await group.getByRole("button", { name: "Undo Import" }).click();
  await group.getByText("Import undone: the 7 notes it added are in the Trash. The note it added to is as it was.").waitFor();
  expect(await bodyOf(page, "Moby-Dick")).toBeUndefined();
  expect(await bodyOf(page, "Walden")).toBe(WALDEN);
  expect(await page.evaluate((id) => window.testing.notes.get(id)?.note.updatedAt, walden)).toBe(waldenDate);

  // Again; then once more, when there's nothing new: no Import, and Cancel has focus.
  await find();
  await group.getByText(SUMMARY[0], { exact: true }).waitFor();
  await group.getByRole("button", { name: "Import", exact: true }).click();
  await group.getByText("Added 7 notes. Added highlights to 1 note there already.").waitFor();
  await find();
  await group.getByText("Everything in Readwise is in lines already.", { exact: true }).waitFor();
  expect(await group.getByText(/in lines already: /).count()).toBe(0);
  expect(await group.getByRole("button", { name: "Import", exact: true }).count()).toBe(0);
  expect(await focused(page)).toBe("Cancel");
  await page.keyboard.press("Enter");
  expect(await focused(page)).toBe("password");
});

test("a token Readwise doesn't take is said so, and nothing else is asked", async () => {
  app = await openApp();
  const { page } = app;
  const asked: string[] = [];
  await page.route("https://readwise.io/**", (route: Route) => {
    asked.push(new URL(route.request().url()).pathname);
    return route.fulfill({ headers: CORS, status: 401, json: { detail: "Invalid token." } });
  });
  const group = await find("wrong");
  await expect(group.getByRole("alert").textContent()).resolves.toBe("Readwise didn’t accept this token. Copy it again from Readwise.");
  expect(asked).toEqual(["/api/v2/auth/"]);
  // Back in the field, to correct it.
  expect(await focused(page)).toBe("password");
  expect(await group.getByLabel("Access token").inputValue()).toBe("wrong");
});

test("when Readwise says to wait, it waits and asks again", async () => {
  app = await openApp();
  let asked = 0;
  await readwise(app.page, { exported: () => (asked++ ? many(2) : 429) });
  const group = await find();
  await group.getByText(/^Readwise asked to wait; asking again in \d+ seconds…$/).waitFor();
  await group.getByText("Found 2 articles, with 2 highlights.", { exact: true }).waitFor();
  expect(asked).toBe(2);
});

test("stopped partway, what's written is kept, and Undo takes it back", async () => {
  app = await openApp();
  const { page } = app;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  // A cover that takes its time, so the import is still going.
  const covered = many(300);
  covered.results[260] = { ...covered.results[260], cover_image_url: "https://example.com/images/slow.png" } as never;
  await readwise(page, {
    exported: () => covered,
    covers: async (route) => {
      await held;
      await route.fulfill({ headers: { ...CORS, "content-type": "image/png" }, body: PNG });
    },
  });
  const group = await find();
  await group.getByRole("button", { name: "Import", exact: true }).click();
  await group.getByText(/^Importing… 250 of 300$/).waitFor();
  await group.getByRole("button", { name: "Stop" }).click();
  release();
  await group.getByText("Stopped: what was imported before is kept, and Undo takes it back.").waitFor();
  await group.getByText("Added 250 notes.").waitFor();
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "article").length)).toBe(250);
  await group.getByRole("button", { name: "Undo Import" }).click();
  await group.getByText("Import undone: the 250 notes it added are in the Trash.").waitFor();
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "article" && !entry.note.trashed).length)).toBe(0);
});

test("failing partway, it says so, and Undo takes back what it wrote, but a note changed since", async () => {
  app = await openApp();
  const { page } = app;
  await readwise(page, { exported: () => many(300) });
  // The second batch can't be stored.
  await page.evaluate(() => {
    const { notes } = window.testing;
    const insert = notes.insert.bind(notes);
    let calls = 0;
    notes.insert = (...added) => (calls++ ? Promise.reject(new Error("The disk is full")) : insert(...added));
  });
  const group = await find();
  await group.getByRole("button", { name: "Import", exact: true }).click();
  await group.getByText("Something went wrong partway, and it stopped. What was imported before is kept, and Undo takes it back.").waitFor();
  await group.getByText("Added 250 notes.").waitFor();
  // One of them written in since: it's yours, and stays.
  await page.evaluate(() => {
    const entry = window.testing.notes.entries.find((each) => each.meta.title === "Article 1")!;
    window.testing.notes.setText(entry.note.id, `${entry.note.body}\nMy thoughts.\n`);
  });
  await group.getByRole("button", { name: "Undo Import" }).click();
  await group.getByText("Import undone: the 249 notes it added are in the Trash.").waitFor();
  await group.getByText("1 you’ve changed since is kept.").waitFor();
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "article" && !entry.note.trashed).map((entry) => entry.meta.title))).toEqual(["Article 1"]);
  app.errors.splice(0, app.errors.length, ...app.errors.filter((error) => !error.includes("The disk is full")));
});

test("ten thousand highlights: the list keeps up, and they're all there", async () => {
  app = await openApp();
  const { page } = app;
  await readwise(page, { exported: () => many(1000, 10) });
  const group = await find();
  await group.getByText("Found 1,000 articles, with 10,000 highlights.", { exact: true }).waitFor({ timeout: 30_000 });
  const started = Date.now();
  await group.getByRole("button", { name: "Import", exact: true }).click();
  await group.getByText("Added 1,000 notes.").waitFor({ timeout: 60_000 });
  console.log(`Imported 1,000 notes with 10,000 highlights in ${Date.now() - started} ms`);
  const counts = await page.evaluate(() => {
    const articles = window.testing.notes.entries.filter((entry) => entry.meta.type === "article");
    return [articles.length, articles.reduce((sum, entry) => sum + (entry.note.body.match(/^> Highlight/gm)?.length ?? 0), 0)];
  });
  expect(counts).toEqual([1000, 10000]);
});
