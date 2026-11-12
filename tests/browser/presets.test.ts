import { afterEach, expect, test } from "bun:test";
import { type App, noErrors, openApp } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const presetsGroup = (settings: Awaited<ReturnType<App["settings"]>>) => settings.getByRole("radiogroup", { name: "Presets" });

test("a preset brings its whole look, theme, shapes, cursor and pointer, and Undo goes back to the look before the first one tried; light or dark and text size stay", async () => {
  app = await openApp({ prefs: { textSize: 19, appearance: "dark" } });
  const settings = await app.settings("Presets");
  await presetsGroup(settings).getByRole("radio", { name: /^Pixel/ }).click();
  expect(await app.root("style")).toBe("pixel");
  expect(await app.root("caret-shape")).toBe("block");
  expect(await app.root("pointer")).toBe("retro");
  expect(await app.page.evaluate(() => [window.testing.prefs.theme, window.testing.prefs.textSize, window.testing.prefs.appearance])).toEqual(["pixel", 19, "dark"]);

  await presetsGroup(settings).getByRole("radio", { name: /^Void/ }).click();
  expect(await app.root("style")).toBe("void");
  await settings.getByRole("button", { name: "Undo" }).click();
  expect(await app.root("style")).toBe("lines");
  expect(await app.root("caret-shape")).toBe("bar");
  expect(await app.page.evaluate(() => window.testing.prefs.theme)).toBe("lines");
});

test("the look saved as a preset of yours shows as changed once it is, updates, and its file brings it, with its own theme, to someone else", async () => {
  app = await openApp({ prefs: { caretShape: "underline" } });
  const settings = await app.settings("Presets");
  // A theme of your own, which the preset's file takes along.
  await app.page.evaluate(() => {
    const { customThemes, plugins, prefs } = window.testing;
    const lines = plugins.theme("lines");
    prefs.theme = customThemes.add({ name: "Moss", light: { ...lines.light, accent: "#2f7d32" }, dark: { ...lines.dark, accent: "#7fd683" } });
  });
  await settings.getByRole("button", { name: "Save as Preset" }).click();
  const name = settings.getByRole("textbox", { name: "Name" });
  await expect(name.evaluate((field) => field === document.activeElement)).resolves.toBe(true);
  await app.page.keyboard.type("Mossy");
  await presetsGroup(settings).getByRole("radio", { name: /^Mossy/, checked: true }).waitFor();

  // Changed: it says so, and Update keeps the change in it.
  await app.page.evaluate(() => (window.testing.prefs.caretShape = "block"));
  await settings.getByText("Changed since you chose Mossy.").waitFor();
  await settings.getByRole("button", { name: "Update Preset" }).click();
  await settings.getByText("Changed since you chose Mossy.").waitFor({ state: "detached" });

  const file = await app.page.evaluate(() => {
    const { presets, writePresetFile } = window.testing;
    return writePresetFile(presets.chosen!);
  });
  expect(JSON.parse(file)).toMatchObject({ name: "Mossy", settings: { caretShape: "block" }, theme: { name: "Moss" } });

  // Someone else, without the theme, imports it: the theme comes too, and the look with it.
  await app.closeSettings();
  await app.close();
  app = await openApp();
  const theirs = await app.settings("Presets");
  await theirs.locator("input[type=file][accept*=json]").setInputFiles({ name: "Mossy.lines-preset.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await theirs.getByText("Added Mossy.").waitFor();
  expect(await app.root("caret-shape")).toBe("block");
  expect(
    await app.page.evaluate(() => {
      const { customThemes, prefs } = window.testing;
      return customThemes.get(prefs.theme)?.name;
    }),
  ).toBe("Moss");
  await presetsGroup(theirs).getByRole("radio", { name: /^Mossy/, checked: true }).waitFor();
});

test("Puddle brings its colors, ink lines around cards and what's chosen, and no shadows, light and dark", async () => {
  for (const scheme of ["light", "dark"] as const) {
    app = await openApp({ scheme });
    const settings = await app.settings("Presets");
    await presetsGroup(settings).getByRole("radio", { name: /^Puddle/ }).click();
    expect(await app.root("style")).toBe("puddle");
    expect(await app.page.evaluate(() => window.testing.prefs.theme)).toBe("puddle");
    const card = await app.page.evaluate(() => {
      const style = getComputedStyle(document.querySelector(".ui-card")!);
      return { width: style.borderTopWidth, color: style.borderTopColor, shadow: style.boxShadow, ink: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() };
    });
    // 1.5px, which a screen at 1x draws as 1.
    expect(parseFloat(card.width)).toBeGreaterThanOrEqual(1);
    expect(card.shadow).toBe("none");
    expect(card.ink).toBe(scheme === "light" ? "#14181a" : "#f6f3e6");
    await app.close();
  }
  app = await openApp();
});

test("Lightbulb brings its colors, bold ink lines with a hard shadow, and a sparking cursor, light and dark", async () => {
  for (const scheme of ["light", "dark"] as const) {
    app = await openApp({ scheme });
    const settings = await app.settings("Presets");
    await presetsGroup(settings).getByRole("radio", { name: /^Lightbulb/ }).click();
    expect(await app.root("style")).toBe("lightbulb");
    expect(await app.root("caret-shape")).toBe("thick");
    expect(await app.page.evaluate(() => [window.testing.prefs.theme, window.testing.prefs.caretEffect])).toEqual(["lightbulb", "sparks"]);
    const card = await app.page.evaluate(() => {
      const style = getComputedStyle(document.querySelector(".ui-card")!);
      const root = getComputedStyle(document.documentElement);
      const shadow = root.getPropertyValue("--shadow-menu").trim();
      return { width: style.borderTopWidth, shadow, ink: root.getPropertyValue("--ink").trim(), sidebar: root.getPropertyValue("--bg-sidebar").trim() };
    });
    expect(card.width).toBe("2px");
    expect(card.shadow).toBe(`4px 4px 0 ${card.ink}`);
    expect(card.ink).toBe(scheme === "light" ? "#000000" : "#fad61d");
    if (scheme === "light") expect(card.sidebar).toBe("#fad61d");
    await app.close();
  }
  app = await openApp();
});
