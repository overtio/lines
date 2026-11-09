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
