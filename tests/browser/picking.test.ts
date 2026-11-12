import { afterEach, expect, test } from "bun:test";
import { type App, noErrors, openApp, toggle } from "./app";

/*
 * Picking colors (Settings → Theme → Change colors by right-clicking): right-clicking a part opens
 * the theme's colors it's drawn in, rather than its menu; a change shows at once, and waits in
 * Settings to be saved as a theme of your own, or discarded.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const rootColor = (name: string) => app.page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim(), name);

async function startPicking() {
  const settings = await app.settings("Theme");
  await toggle(settings, "Change colors by right-clicking", true);
  await app.closeSettings();
  await app.page.getByRole("status").getByText("Right-click anything to change its color").waitFor();
}

test("right-clicking the sidebar changes its color, which shows at once and saves as a theme of your own", async () => {
  app = await openApp();
  await startPicking();

  await app.page.locator('[data-pane="sidebar"]').click({ button: "right", position: { x: 120, y: 600 } });
  const panel = app.page.getByRole("dialog", { name: "Colors here, in Lines" });
  const field = panel.getByRole("textbox", { name: "Sidebar", exact: true });
  await field.fill("#336699");
  expect(await rootColor("bg-sidebar")).toBe("#336699");
  await app.page.getByRole("status").getByText("1 color changed, not saved").waitFor();
  await app.page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });

  const settings = await app.settings("Theme");
  await settings.getByText("1 color changed in Lines").waitFor();
  await settings.getByRole("button", { name: "Save as New Theme" }).click();
  const saved = await app.page.evaluate(() => {
    const { customThemes, prefs, themeDrafts } = window.testing;
    return { theme: customThemes.get(prefs.theme), changed: themeDrafts.count("lines") };
  });
  expect(saved.theme?.name).toBe("Lines Copy");
  expect(saved.theme?.light?.["bg-sidebar"]).toBe("#336699");
  expect(saved.changed).toBe(0);
  expect(await rootColor("bg-sidebar")).toBe("#336699");
});

test("a color's picker opens over the colors here, which stay open while it's used; Esc closes one, then the other", async () => {
  app = await openApp();
  await startPicking();

  await app.page.locator('[data-pane="sidebar"]').click({ button: "right", position: { x: 120, y: 600 } });
  const panel = app.page.getByRole("dialog", { name: "Colors here, in Lines" });
  await panel.getByRole("button", { name: "Choose a color for Sidebar", exact: true }).click();
  const picker = app.page.getByRole("dialog", { name: "Choose a color for Sidebar" });
  await picker.getByRole("radio", { name: "Accent", exact: true }).click();
  expect(await rootColor("bg-sidebar")).toBe("#0e7a7e");
  // Clicking and dragging in it is inside the colors here too.
  const area = (await picker.getByRole("slider", { name: "Saturation and brightness" }).locator("..").boundingBox())!;
  await app.page.mouse.click(area.x + 4, area.y + 4);
  expect(await rootColor("bg-sidebar")).not.toBe("#0e7a7e");
  expect(await panel.isVisible()).toBe(true);

  await app.page.keyboard.press("Escape");
  await picker.waitFor({ state: "detached" });
  expect(await panel.isVisible()).toBe(true);
  await app.page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Choose a color for Sidebar");
  await app.page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
});

test("a note's row keeps its menu for after; while picking, its colors open, and discarding puts the theme back", async () => {
  app = await openApp();
  await app.open("# Groceries\n\nMilk");
  const before = await rootColor("text");
  await startPicking();

  await app.page.locator(".ui-note-row").first().getByText("Groceries").click({ button: "right" });
  const panel = app.page.getByRole("dialog", { name: "Colors here, in Lines" });
  // The chosen row's color is behind its title, and the list behind that.
  expect(await panel.locator("label").allTextContents()).toEqual(["Text", "Pressed", "Note list"]);
  expect(await app.page.getByRole("menu").count()).toBe(0);
  await panel.getByRole("textbox", { name: "Text", exact: true }).fill("rgb(200 0 0)");
  expect(await rootColor("text")).toBe("rgb(200 0 0)");
  await app.page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });

  const settings = await app.settings("Theme");
  await settings.getByRole("button", { name: "Discard Changes" }).click();
  await settings.getByRole("button", { name: "Discard Changes" }).click();
  await settings.getByText("1 color changed in Lines").waitFor({ state: "detached" });
  expect(await rootColor("text")).toBe(before);

  // Turned off, right-clicking opens the row's menu again.
  await toggle(settings, "Change colors by right-clicking", false);
  await app.closeSettings();
  await app.page.locator(".ui-note-row").first().click({ button: "right" });
  await app.page.getByRole("menu").waitFor();
});
