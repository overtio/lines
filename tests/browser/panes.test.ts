import { afterEach, expect, test } from "bun:test";
import { type App, mod, noErrors, openApp } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** The pane focus is in, if any. */
const focused = () =>
  app.page.evaluate(() => {
    const pane = document.activeElement?.closest("[data-pane], .editor-pane");
    return pane ? (pane.getAttribute("data-pane") ?? "editor") : null;
  });

test("F6 goes only through the panes showing: past a hidden sidebar, and nowhere in focus mode", async () => {
  app = await openApp();
  await app.open("Some text");
  await app.page.keyboard.press(`${mod()}+\\`);
  // Once the sidebar has slid away.
  await app.page.waitForFunction(() => getComputedStyle(document.querySelector("[data-pane=sidebar]")!).visibility === "hidden");
  await app.page.evaluate(() => window.testing.place());
  const visited = [];
  for (const key of ["F6", "F6", "Shift+F6"]) {
    await app.page.keyboard.press(key);
    visited.push(await focused());
  }
  expect(visited).toEqual(["list", "editor", "list"]);
  await app.page.keyboard.press(`${mod()}+Shift+\\`);
  await app.page.waitForFunction(() => getComputedStyle(document.querySelector("[data-pane=list]")!).visibility === "hidden");
  await app.page.evaluate(() => window.testing.place());
  await app.page.keyboard.press("F6");
  expect(await focused()).toBe("editor");
});

test("the sidebar drawer closed by a click beside it gives focus back to what had it", async () => {
  app = await openApp({ width: 850 });
  await app.open("Some text");
  const drawer = async (open: () => Promise<void>) => {
    await open();
    await app.page.waitForFunction(() => document.querySelector("[data-pane=sidebar]")?.contains(document.activeElement));
    await app.page.getByRole("button", { name: "Close sidebar" }).click({ position: { x: 700, y: 400 } });
  };
  await drawer(async () => {
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.press(`${mod()}+\\`);
  });
  await app.page.waitForFunction(() => document.activeElement?.classList.contains("cm-content"), null, { timeout: 2000 });
  // Opened by a click, on the button that opens it (which in Safari a click doesn't focus).
  await drawer(() => app.page.locator(".sidebar-toggle").first().click());
  await app.page.waitForFunction(() => document.activeElement?.classList.contains("sidebar-toggle"), null, { timeout: 2000 });
});
