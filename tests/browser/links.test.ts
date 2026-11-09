import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, engine, mod, noErrors, openApp } from "./app";

let app: App;
beforeEach(async () => {
  app = await openApp();
});
afterEach(async () => {
  noErrors(app);
  await app.close();
});

describe("links to folders and files on this computer", () => {
  test("are drawn with a folder's or a file's icon, their path shown on pointing at them", async () => {
    await app.open("Work in [Projects](file:///Users/me/My%20Projects/) and [the plan](file:///Users/me/plan.txt).\n\nEnd");
    await app.page.evaluate(() => window.testing.place());
    const icons = app.page.locator(".editor-pane .cm-lp-local-icon");
    expect(await icons.count()).toBe(2);
    expect(await icons.allInnerTexts()).toEqual(["Folder", "File"]);
    const link = app.page.locator(".editor-pane .cm-lp-link").first();
    expect(await link.innerText()).toBe("Projects");
    expect(await link.getAttribute("title")).toBe("/Users/me/My Projects");
  });

  test("in LaTeX notes too", async () => {
    await app.open("\\href{file:///Users/me/Projects/}{Projects}\n\nEnd", "latex");
    await app.page.evaluate(() => window.testing.place());
    expect(await app.page.locator(".editor-pane .cm-lp-local-icon").count()).toBe(1);
  });

  test("on the web, following one copies its path, as a page can't open it", async () => {
    if (engine() !== "chromium") return;
    await app.open("[Projects](file:///Users/me/My%20Projects/)\n\nEnd");
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.down(mod());
    await app.page.locator(".editor-pane .cm-lp-link").first().click();
    await app.page.keyboard.up(mod());
    await app.page.waitForFunction(async () => (await navigator.clipboard.readText()) === "/Users/me/My Projects", null, { timeout: 2000 });
  });

  test("/folder is offered only where there's a folder picker (the Mac app)", async () => {
    await app.open("");
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.type("/folder");
    await app.page.waitForTimeout(200);
    expect(await app.page.getByRole("option", { name: /Folder link/ }).count()).toBe(0);
  });
});
