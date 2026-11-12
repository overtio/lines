import { afterEach, expect, test } from "bun:test";
import { type App, choose, noErrors, openApp } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

test("new notes wait in the Inbox until filed, and go straight to Notes when Settings say", async () => {
  app = await openApp();
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const inbox = sidebar.getByRole("button", { name: /^Inbox/ });
  const newNote = async (title: string) => {
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await page.waitForFunction(() => window.testing.text() === "# ");
    await page.keyboard.type(title);
    await page.waitForFunction((title) => window.testing.text() === `# ${title}`, title);
  };
  await newNote("An idea");
  expect(await inbox.innerText()).toMatch(/Inbox\s+1/);

  await inbox.click();
  const row = page.locator(".note-list [data-id]");
  await row.filter({ hasText: "An idea" }).waitFor();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark as Filed" }).click();
  await page.getByText("Nothing to sort.").waitFor();
  // Still a note, among the rest.
  await sidebar.getByRole("button", { name: /^Notes/ }).click();
  await row.filter({ hasText: "An idea" }).waitFor();

  // Straight to Notes: the Inbox, empty, isn't in the sidebar.
  const settings = await app.settings("General");
  await choose(settings, "New notes go to", "Notes");
  await app.closeSettings();
  await newNote("Another");
  expect(await inbox.count()).toBe(0);
});
