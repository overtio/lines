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
    const id = customThemes.copy(plugins.theme("lines").definition, (each) => plugins.palette(each), "Moss");
    customThemes.setColor(id, "light", "accent", "#2f7d32");
    customThemes.setColor(id, "dark", "accent", "#7fd683");
    prefs.theme = id;
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

test("a font installed on this device is part of the look: a preset of yours keeps it, and lines' own goes back to lines' font", async () => {
  app = await openApp({ prefs: { installedFont: "Zz Some Font" } });
  const settings = await app.settings("Presets");
  await settings.getByRole("button", { name: "Save as Preset" }).click();
  const mine = presetsGroup(settings).getByRole("radio", { name: /^My Lines/ });
  await presetsGroup(settings).getByRole("radio", { name: /^My Lines/, checked: true }).waitFor();
  const font = () => app.page.evaluate(() => [window.testing.prefs.font, window.testing.prefs.installedFont]);
  await presetsGroup(settings).getByRole("radio", { name: /^Lines/ }).click();
  expect(await font()).toEqual(["system", ""]);
  await mine.click();
  expect(await font()).toEqual(["system", "Zz Some Font"]);
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

test("Constructivist's focus ring on the chosen note follows its wedge's slant, inside it", async () => {
  app = await openApp({ prefs: { style: "constructivist", theme: "constructivist" } });
  const id = await app.open("A note");
  // Esc in the search puts focus on the open note's row, by the keyboard, so its ring shows.
  const search = app.page.getByRole("searchbox", { name: "Search notes" });
  await search.fill("a");
  await search.press("Escape");
  await app.page.waitForFunction((id) => document.activeElement?.getAttribute("data-id") === id, id);
  const row = app.page.locator(`.ui-note-row[data-id="${id}"]`);
  const picture = (await app.page.screenshot({ clip: (await row.boundingBox())! })).toString("base64");
  // Near its bottom, where the slant cuts furthest in, the ring's light line shows just inside it,
  // short of the 14px the slant takes off (where the list shows past the wedge).
  const ringed = await row.evaluate(async (_, picture) => {
    const image = new Image();
    image.src = `data:image/png;base64,${picture}`;
    await image.decode();
    const canvas = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
    canvas.drawImage(image, 0, 0);
    const strip = canvas.getImageData(image.width - 30, image.height - 8, 16, 1).data;
    return Array.from({ length: 16 }, (_, x) => strip.slice(x * 4, x * 4 + 3)).some((pixel) => pixel.every((value) => value > 200));
  }, picture);
  expect(ringed).toBe(true);
});
