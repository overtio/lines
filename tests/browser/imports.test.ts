import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zip } from "../../src/lib/zip";
import { type App, engine, noErrors, openApp } from "./app";

/*
 * Notes from another app, imported from Settings → Export and Import: an Obsidian vault (the unit
 * tests' fixture, tests/unit/fixtures/obsidian/Vault) chosen as a folder, what importing it would do
 * said first, then done with its pictures and files, undone into the Trash, and imported again
 * adding only what isn't there; ten thousand notes at once, stopped partway; and Bear's backup
 * (tests/unit/fixtures/bear/Backup, zipped as Bear zips it).
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const VAULT = fileURLToPath(new URL("../unit/fixtures/obsidian/Vault", import.meta.url));

/** Chooses `folder` as the vault to import, in Settings → Export and Import. */
async function chooseVault(folder: string) {
  const settings = await app.settings("Export and Import");
  const group = settings.getByRole("region", { name: "From Obsidian" });
  await group.locator("input[webkitdirectory]").setInputFiles(folder);
  return group;
}

/** The notes imported from Obsidian, by their path in the vault. */
const imported = () =>
  app.page.evaluate(() =>
    Object.fromEntries(window.testing.notes.entries.filter(({ note }) => note.source?.app === "obsidian").map(({ note }) => [note.source!.id, note])),
  );

/** Bear's backup of the unit tests' notes, as a .bear2bk file is: a ZIP of a TextBundle for each. */
function bearBackup() {
  const root = fileURLToPath(new URL("../unit/fixtures/bear/Backup", import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
  const data = zip(walk(root).map((path) => ({ name: relative(root, path), data: new Uint8Array(readFileSync(path)), modified: new Date(2024, 10, 14) })));
  return { name: "Bear Notes 2024-11-14.bear2bk", mimeType: "application/octet-stream", buffer: Buffer.from(data) };
}

test("an Obsidian vault: what importing it would do, said first; then its notes, pictures and files; undone into the Trash, and imported again only once", async () => {
  // On disk, so WebKit keeps the attachments.
  app = await openApp({ onDisk: true });
  const { page } = app;
  // Playwright's WebKit leaves a chosen folder's hidden files out: Obsidian's settings (its bookmarks) and its trash.
  const hidden = engine() !== "webkit";
  const count = hidden ? 6 : 5;
  const group = await chooseVault(VAULT);
  await group.getByText(`${count} notes, 2 attachments, and 3 folders in Vault.`).waitFor();
  expect(await group.getByText(/kept as text/).allInnerTexts()).toEqual([
    "1 link to a heading in its own note, kept as text: [[#Further reading]] (Welcome)",
    "1 block id, kept as text, as lines doesn’t link to a line: ^37066d (Welcome)",
    "1 task with a status lines doesn’t have, kept as text: [/] (Welcome)",
  ]);
  await group.getByText(/^2 files no note shows, left out: /).waitFor();
  // Nothing written yet, and Import is where focus is.
  expect(Object.keys(await imported())).toEqual([]);
  const start = group.getByRole("button", { name: `Import ${count} Notes` });
  expect(await start.evaluate((button) => button === document.activeElement)).toBe(true);
  await start.click();
  await group.getByText(`Imported ${count} notes.`).waitFor();
  // What didn't come across as it was is said again.
  await group.getByText("1 note shown in another, made a link to it, as lines doesn’t show one note in another: ![[Ideas]] (Welcome)").waitFor();

  const notes = await imported();
  expect(Object.keys(notes).sort()).toEqual([...(hidden ? [".trash/Old idea.md"] : []), "Daily/2026-11-14.md", "Ideas.md", "Projects/Acme/Plan.md", "Projects/Plan.md", "Welcome.md"]);
  const picture = /!\[\|300\]\(\.\.\/attachments\/([0-9a-f]{32}\.png)\)\n\[Report 2026\.pdf\]\(\.\.\/attachments\/([0-9a-f]{32}\.pdf)\)/.exec(notes["Welcome.md"].body);
  expect(picture).not.toBeNull();
  expect(await page.evaluate(() => window.testing.attachmentNames())).toEqual(expect.arrayContaining([picture![1], picture![2]]));
  expect(notes["Welcome.md"].body).toEndWith("\n\n#inbox #project/active\n");
  expect(notes["Projects/Acme/Plan.md"].body).toEndWith("\n\n#projects/acme\n");
  if (hidden) expect([notes["Ideas.md"].pinned, notes["Projects/Plan.md"].pinned, notes[".trash/Old idea.md"].trashed]).toEqual([true, true, true]);

  // A link from the vault still finds a note renamed in lines, by the name it had in Obsidian; a note of lines' own doesn't.
  await page.evaluate((id) => window.testing.notes.setText(id, "# Someday\n\n- A garden #someday\n"), notes["Ideas.md"].id);
  const finds = (from?: string) => page.evaluate((from) => window.testing.notes.find("Ideas", from ? window.testing.notes.get(from)?.note : undefined)?.meta.title, from);
  expect([await finds(notes["Welcome.md"].id), await finds()]).toEqual(["Someday", undefined]);

  // Undone: the notes it made are in the Trash, but the one changed since.
  await group.getByRole("button", { name: "Undo Import" }).click();
  await group.getByText("Import undone: 4 notes moved to the Trash.").waitFor();
  await group.getByText("1 you’ve changed since is kept.").waitFor();
  const undone = await imported();
  expect(Object.entries(undone).filter(([, note]) => !note.trashed).map(([path]) => path)).toEqual(["Ideas.md"]);

  // Imported again, it brings back only what isn't here (the one from Obsidian's trash is, in lines'); and once more, nothing.
  await chooseVault(VAULT);
  await group.getByText("4 notes, 2 attachments, and 3 folders in Vault.").waitFor();
  // Which, by name, and why.
  await group.getByText(hidden ? /^2 are in lines already, from importing it before, and left out: / : "1 is in lines already, from importing it before, and left out: Ideas").waitFor();
  await group.getByRole("button", { name: "Import 4 Notes" }).click();
  await group.getByText("Imported 4 notes.").waitFor();
  await chooseVault(VAULT);
  await group.getByText("Everything in Vault is in lines already.").waitFor();
  expect(await group.getByRole("button", { name: /^Import/ }).count()).toBe(0);
  // The last import's Undo stays, under what this one would do.
  await group.getByRole("button", { name: "Undo Import" }).waitFor();
  // Said to be another vault of the same name, all of it would be imported.
  await group.getByRole("switch", { name: "The same as “Vault”, imported before" }).click();
  await group.getByRole("button", { name: `Import ${count} Notes` }).waitFor();
  await app.closeSettings();

  // Its folders are tags in the sidebar.
  await page.locator('.sidebar [data-tag="projects"]').waitFor();
});

test("ten thousand notes: the import says how it's going, with Settings closed and opened again too, can be stopped, and what it wrote undone", async () => {
  app = await openApp();
  const folder = mkdtempSync(join(tmpdir(), "lines-vault-"));
  try {
    const vault = join(folder, "Many");
    for (let i = 0; i < 100; i++) {
      mkdirSync(join(vault, `Folder ${i}`), { recursive: true });
      for (let j = 0; j < 100; j++) writeFileSync(join(vault, `Folder ${i}`, `Note ${i * 100 + j}.md`), `Text of note ${i * 100 + j}, linking [[Note ${(i * 100 + j + 1) % 10000}]].\n`);
    }
    const started = Date.now();
    const group = await chooseVault(vault);
    await group.getByText("10,000 notes and 100 folders in Many.").waitFor({ timeout: 60_000 });
    console.log(`Read 10,000 notes in ${Date.now() - started} ms`);
    await group.getByRole("button", { name: "Import 10,000 Notes" }).click();
    await app.page.waitForFunction(() => window.testing.notes.entries.length >= 250);
    // Settings closed meanwhile, it goes on, and says so when it's opened again.
    await app.closeSettings();
    const reopened = (await app.settings("Export and Import")).getByRole("region", { name: "From Obsidian" });
    await reopened.locator("progress").waitFor();
    await reopened.getByRole("button", { name: "Stop" }).click();
    await group.getByText("Stopped: what was imported before is kept, and Undo takes it back.").waitFor();
    const written = Object.keys(await imported()).length;
    expect(written).toBeGreaterThan(0);
    expect(written).toBeLessThan(10_000);
    await group.getByRole("button", { name: "Undo Import" }).click();
    await group.getByText(`Import undone: ${written.toLocaleString("en")} notes moved to the Trash.`).waitFor();

    // Again, all of them this time.
    const again = Date.now();
    await chooseVault(vault);
    await group.getByRole("button", { name: "Import 10,000 Notes" }).click();
    await group.getByText("Imported 10,000 notes.").waitFor({ timeout: 120_000 });
    console.log(`Imported 10,000 notes in ${Date.now() - again} ms`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}, 240_000);

test("Bear's backup: its notes with their tags, pictures, pins, archive and trash; then nothing new to import", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const settings = await app.settings("Export and Import");
  const group = settings.getByRole("region", { name: "From Bear" });
  await group.locator("input[accept*='.bear2bk']").setInputFiles(bearBackup());
  await group.getByText("5 notes and 2 attachments in Bear Notes 2024-11-14.").waitFor();
  await group.getByText("1 locked note, which can’t be read (unlock it in Bear to bring it), left out: Secret").waitFor();
  await group.getByText("1 tag of several words, written with dashes, as lines’ tags have no spaces: #big ideas# → #big-ideas (Welcome)").waitFor();
  // No folders in Bear: nothing to tag them with.
  expect(await group.getByRole("switch").count()).toBe(0);
  await group.getByRole("button", { name: "Import 5 Notes" }).click();
  await group.getByText("Imported 5 notes.").waitFor();

  const notes = await page.evaluate(() =>
    Object.fromEntries(window.testing.notes.entries.filter(({ note }) => note.source?.app === "bear").map(({ note, meta }) => [meta.title, note])),
  );
  expect(Object.keys(notes).sort()).toEqual(["Gone", "Ideas", "Old plans", "Pancakes", "Welcome"]);
  expect(notes.Welcome.body).toMatch(/\n!\[\|320\]\(\.\.\/attachments\/[0-9a-f]{32}\.png\)\n/);
  expect(notes.Welcome.body).toContain("See [[Ideas]], [[Ideas#Later|later ideas]] and [[Pancakes|the recipe]].");
  expect([notes.Ideas.pinned, notes.Gone.trashed, notes["Old plans"].body]).toEqual([true, true, "# Old plans\n\nDone with these.\n\n#archived\n"]);
  expect(notes.Welcome.createdAt).toBe(Date.UTC(2024, 1, 1, 9, 30));
  await page.locator('.sidebar [data-tag="big-ideas"]').waitFor();

  await group.locator("input[accept*='.bear2bk']").setInputFiles(bearBackup());
  await group.getByText("Everything in Bear Notes 2024-11-14 is in lines already.").waitFor();
});

test("a Logseq graph: its pages and journals, outlines as lists and prose as paragraphs, references as text; then nothing new", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const settings = await app.settings("Export and Import");
  const group = settings.getByRole("region", { name: "From Logseq" });
  const graph = fileURLToPath(new URL("../unit/fixtures/logseq/Graph", import.meta.url));
  await group.locator("input[webkitdirectory]").setInputFiles(graph);
  await group.getByText("5 notes, 1 attachment, and 3 folders in Graph.").waitFor();
  await group.getByText(/^2 empty pages, left out \(Logseq makes some itself\): /).waitFor();
  await group.getByRole("button", { name: "Import 5 Notes" }).click();
  await group.getByText("Imported 5 notes.").waitFor();
  const notes = await page.evaluate(() =>
    Object.fromEntries(window.testing.notes.entries.filter(({ note }) => note.source?.app === "logseq").map(({ note, meta }) => [meta.title, note])),
  );
  expect(Object.keys(notes).sort()).toEqual(["Essay", "Nov 14th, 2024", "Projects/Acme", "Recipes/Pancakes", "Welcome"]);
  expect(notes.Essay.body).toStartWith("# Essay\n\nThis is the first paragraph of an essay");
  expect(notes.Welcome.body).toContain("\n- As I said: Planned: 100 ([[Projects/Acme]])\n");
  expect(notes.Welcome.body).toMatch(/\n- !\[photo\.png\|320\]\(\.\.\/attachments\/[0-9a-f]{32}\.png\)\n/);
  expect([notes.Welcome.pinned, notes["Projects/Acme"].pinned]).toEqual([true, true]);
  await page.locator('.sidebar [data-tag="journals"]').waitFor();

  await group.locator("input[webkitdirectory]").setInputFiles(graph);
  await group.getByText("Everything in Graph is in lines already.").waitFor();
});

test("Notion's export, a ZIP of ZIPs: its pages, a database as a table of its rows, each a note of its type; then nothing new", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const root = fileURLToPath(new URL("../unit/fixtures/notion/Export", import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
  const part = zip(walk(root).map((path) => ({ name: relative(root, path), data: new Uint8Array(readFileSync(path)), modified: new Date(2024, 10, 14) })));
  const exported = { name: "Export-0a1b.zip", mimeType: "application/zip", buffer: Buffer.from(zip([{ name: "Export-0a1b-Part-1.zip", data: part, modified: new Date(2024, 10, 14) }])) };
  const settings = await app.settings("Export and Import");
  const group = settings.getByRole("region", { name: "From Notion" });
  await group.locator("input[accept='.zip']").setInputFiles(exported);
  await group.getByText("5 notes, 2 attachments, and 1 folder in Export-0a1b.").waitFor();
  await group.getByRole("button", { name: "Import 5 Notes" }).click();
  await group.getByText("Imported 5 notes.").waitFor();
  const notes = await page.evaluate(() =>
    Object.fromEntries(window.testing.notes.entries.filter(({ note }) => note.source?.app === "notion").map(({ note, meta }) => [meta.title, { body: note.body, type: meta.type }])),
  );
  expect(Object.keys(notes).sort()).toEqual(["Dune", "Home", "Plans", "Reading List", "Walden"]);
  expect([notes.Dune.type, notes.Walden.type]).toEqual(["reading list", "reading list"]);
  expect(notes.Home.body).toContain("See [[Plans]] and the [[Reading List]].");
  expect(notes.Home.body).toMatch(/\n!\[photo\]\(\.\.\/attachments\/[0-9a-f]{32}\.png\)\n/);
  await app.closeSettings();
  // The database's note is a table of its rows.
  await app.page.evaluate(() => window.testing.notes.select(window.testing.notes.entries.find((entry) => entry.meta.title === "Reading List")!.note.id));
  await page.locator(".cm-content").getByText("Frank Herbert").waitFor();

  await (await app.settings("Export and Import")).getByRole("region", { name: "From Notion" }).locator("input[accept='.zip']").setInputFiles(exported);
  await group.getByText("Everything in Export-0a1b is in lines already.").waitFor();
});
