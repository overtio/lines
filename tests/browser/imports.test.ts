import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type App, engine, noErrors, openApp } from "./app";

/*
 * Notes from another app, imported from Settings → Export and Import: an Obsidian vault (the unit
 * tests' fixture, tests/unit/fixtures/obsidian/Vault) chosen as a folder, what importing it would do
 * said first, then done with its pictures and files, undone into the Trash, and imported again
 * adding only what isn't there; and ten thousand notes at once, stopped partway.
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
