import { afterEach, expect, test } from "bun:test";
import { type App, mod, noErrors, openApp } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

test("opened on a section in a narrow window, focus is on its title, and typing doesn't reach the note", async () => {
  app = await openApp({ width: 600 });
  await app.open("Some text");
  await app.page.evaluate(() => window.testing.place());
  await app.page.keyboard.press(`${mod()}+/`);
  const dialog = app.page.getByRole("dialog");
  await dialog.waitFor();
  await app.page.waitForFunction(() => document.activeElement?.id === "settings-section-title", null, { timeout: 2000 });
  await app.page.keyboard.type("more");
  expect(await app.text()).toBe("Some text");
  // Back to the list, focus is on the section it was on.
  await dialog.getByRole("button", { name: "All settings" }).click();
  await app.page.waitForFunction(() => document.activeElement?.id === "settings-nav-shortcuts");
});

test("plugins with settings have a page each under Plugins, reached from the list, and found by search", async () => {
  app = await openApp();
  const settings = await app.settings("All Plugins");
  const nav = settings.getByRole("navigation", { name: "Settings sections" });
  for (const name of ["Mascots", "Paper", "Keyboards", "Spreadsheets"]) await nav.getByRole("button", { name, exact: true }).waitFor();
  // Not under Appearance or Editor any more.
  expect(await nav.getByRole("button", { name: "Mascot", exact: true }).count()).toBe(0);
  await app.settings("Editor");
  expect(await settings.getByText("Play typing sounds").count()).toBe(0);

  await app.settings("All Plugins");
  await settings.getByRole("button", { name: "Spreadsheets Settings" }).click();
  await settings.getByRole("heading", { name: "Spreadsheets", level: 2 }).waitFor();
  await settings.getByRole("switch", { name: "Spreadsheets" }).waitFor();
  await settings.getByText("Column letters and row numbers").waitFor();

  const search = settings.getByRole("searchbox", { name: "Search settings" });
  await search.fill("talks");
  const found = settings.getByRole("list", { name: "Settings found" }).getByRole("button");
  await found.filter({ hasText: "Mascots" }).first().click();
  await settings.getByRole("heading", { name: "Mascots", level: 2 }).waitFor();
});

test("search finds a setting in any section, in its words or a choice's, and opens its section on it", async () => {
  app = await openApp();
  await app.open("Some text");
  const settings = await app.settings("General");
  const search = settings.getByRole("searchbox", { name: "Search settings" });
  // ⌘F reaches it from anywhere in Settings.
  await settings.getByRole("heading", { name: "General" }).click();
  await app.page.keyboard.press(`${mod()}+f`);
  await app.page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search settings");
  expect(await app.text()).toBe("Some text");

  await app.page.keyboard.type("underline");
  const found = settings.getByRole("list", { name: "Settings found" }).getByRole("button");
  await found.first().waitFor();
  expect(await found.filter({ hasText: "Cursor" }).count()).toBeGreaterThan(0);
  await found.filter({ hasText: /^Underline\s*Cursor$/ }).click();
  await settings.getByRole("heading", { name: "Cursor", level: 2 }).waitFor();
  // Focus on the setting's control, in its row.
  await app.page.waitForFunction(() => document.activeElement?.closest("[data-setting]")?.textContent?.includes("Shape"));

  // A word in any order, without its accents; nothing found says so; Esc empties the search, then closes Settings.
  await search.fill("color cursor");
  await found.first().waitFor();
  await search.fill("zzqx");
  await settings.getByText("Nothing in Settings matches “zzqx”.").first().waitFor();
  // Nor what it says only once something's done, which it couldn't lead to.
  for (const done of ["preset copied", "passphrase changed"]) {
    await search.fill(done);
    await settings.getByText(`Nothing in Settings matches “${done}”.`).first().waitFor();
  }
  await search.press("Escape");
  expect(await search.inputValue()).toBe("");
  await settings.getByRole("navigation", { name: "Settings sections" }).waitFor();
  await search.press("Escape");
  await settings.waitFor({ state: "hidden" });
});

test("spreadsheet notes are off at first, blocks in notes on; a spreadsheet note here turns them on, unless they were turned off", async () => {
  app = await openApp();
  const page = app.page;
  const on = (id: string) => page.evaluate((id) => window.testing.plugins.isOn(window.testing.plugins.get(id)!), id);
  expect(await on("spreadsheet")).toBe(true);
  expect(await on("spreadsheet-notes")).toBe(false);
  const settings = await app.settings("All Plugins");
  await settings.getByRole("switch", { name: "Spreadsheet Notes" }).waitFor();
  expect(await settings.getByRole("switch", { name: "Spreadsheet Notes" }).isChecked()).toBe(false);
  await app.closeSettings();

  // One comes (synced, imported): it opens as a spreadsheet.
  await app.open("# Budget\n\nItem,Cost\nTea,4\n", "spreadsheet");
  await page.waitForFunction(() => window.testing.plugins.isOn(window.testing.plugins.get("spreadsheet-notes")!));
  await page.locator(".editor-pane .cm-sheet").waitFor();

  // Turned off by choice, it stays off as more come.
  await page.evaluate(() => window.testing.plugins.setOn(window.testing.plugins.get("spreadsheet-notes")!, false));
  await app.open("# Another\n\nA\n1\n", "spreadsheet");
  await page.waitForTimeout(200);
  expect(await on("spreadsheet-notes")).toBe(false);
});
