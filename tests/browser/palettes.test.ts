import { afterEach, expect, test } from "bun:test";
import { type App, engine, noErrors, openApp } from "./app";

/*
 * Settings → Theme's palettes: lines' and yours, a palette of yours changed by pointer and keyboard,
 * made from pasted colors and shared, a theme of yours drawn in one, and deleting one a theme of
 * yours is drawn in.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** A palette of yours by id, as it's kept. */
const palette = (id: string) => app.page.evaluate((id) => window.testing.customThemes.palette(id), id);
/** The id of the palette of yours called `name`. */
const idOf = (name: string) => app.page.evaluate((name) => window.testing.customThemes.palettes.find((each) => each.name === name)!.id, name);
/** Waits for focus to be on what has this name (its label, or its text). */
const focusOn = (label: string) =>
  app.page.waitForFunction((label) => (document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim()) === label, label);

test("Palettes lists lines' and yours; the theme's shows its colors by name, and one made from the theme's colors has its name ready to type over", async () => {
  app = await openApp();
  const settings = await app.settings("Theme");
  const palettes = settings.getByRole("radiogroup", { name: "Palettes" });
  expect(await palettes.getByRole("radio", { name: "Lines Light", exact: true }).getAttribute("aria-checked")).toBe("true");
  expect(await palettes.getByRole("radio", { name: "Nord", exact: true }).count()).toBe(1);
  const shown = settings.getByRole("region", { name: "Lines Light", exact: true });
  expect(await shown.getByText("Teal", { exact: true }).isVisible()).toBe(true);
  expect(await shown.getByRole("textbox").count()).toBe(0);

  await settings.getByRole("button", { name: "New Palette" }).click();
  await app.page.getByRole("menuitem", { name: "From the Colors of Lines" }).click();
  await app.page.waitForFunction(() => (document.activeElement as HTMLInputElement | null)?.value === "New Palette");
  await app.page.keyboard.type("Sea");
  expect(await settings.getByRole("region", { name: "Sea", exact: true }).getByRole("textbox", { name: "Name", exact: true }).inputValue()).toBe("Sea");
  expect(await palettes.getByRole("radio", { name: "Sea", exact: true }).getAttribute("aria-checked")).toBe("true");
  const made = await palette(await idOf("Sea"));
  // The background, the sidebar's, the text, the muted text and the accent, each once.
  expect(made!.colors.map((entry) => entry.color)).toEqual(["#ffffff", "#eff4f3", "#162120", "#5b6a68", "#0e7a7e"]);
});

test("a palette of yours: a color changed and named, moved by keyboard, added and taken out", async () => {
  app = await openApp();
  const id = await app.page.evaluate(() =>
    window.testing.customThemes.addPalette({
      name: "Three",
      colors: [
        { id: "a", name: "Sand", color: "#e0c090" },
        { id: "b", color: "#0e7a7e" },
        { id: "c", color: "#2f7d32" },
      ],
    }),
  );
  const settings = await app.settings("Theme");
  await settings.getByRole("radiogroup", { name: "Palettes" }).getByRole("radio", { name: "Three", exact: true }).click();
  const editor = settings.getByRole("region", { name: "Three", exact: true });
  const colors = async () => (await palette(id))!.colors.map((entry) => entry.color);

  await editor.getByRole("textbox", { name: "Sand", exact: true }).fill("#d0b080");
  expect((await colors())[0]).toBe("#d0b080");
  // Unnamed, it's named from its look; a name typed is its own.
  const teal = editor.getByRole("textbox", { name: "Name of Teal", exact: true });
  expect(await teal.getAttribute("placeholder")).toBe("Teal");
  await teal.fill("Lagoon");
  expect((await palette(id))!.colors[1].name).toBe("Lagoon");

  // Moved by keyboard, focus stays on the button, or goes to the other at the end.
  await editor.getByRole("button", { name: "Move Lagoon up", exact: true }).focus();
  await app.page.keyboard.press("Enter");
  expect(await colors()).toEqual(["#0e7a7e", "#d0b080", "#2f7d32"]);
  await focusOn("Move Lagoon down");
  await app.page.keyboard.press("Space");
  await focusOn("Move Lagoon down");
  expect(await colors()).toEqual(["#d0b080", "#0e7a7e", "#2f7d32"]);

  await editor.getByRole("button", { name: "Add a Color", exact: true }).click();
  expect(await colors()).toHaveLength(4);
  const added = (await palette(id))!.colors[3];
  expect(await app.page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe(added.color);

  await editor.getByRole("button", { name: "Remove Sand", exact: true }).click();
  expect(await colors()).toEqual(["#0e7a7e", "#2f7d32", added.color]);
  expect(await settings.getByRole("radiogroup", { name: "Palettes" }).getByRole("radio", { name: "Three", exact: true }).count()).toBe(1);
});

test("pasted colors make a palette, shared as a file; a theme of yours drawn in it, and the palette deleted, has another chosen for it first", async () => {
  app = await openApp();
  const settings = await app.settings("Theme");
  await settings.getByRole("button", { name: "Import a Palette" }).click();
  await app.page.getByRole("menuitem", { name: "Paste a Palette or Colors" }).click();
  const field = settings.getByRole("textbox", { name: "Paste a Palette or Colors" });
  await focusOn("Paste a Palette or Colors");
  await field.evaluate((input) => {
    const data = new DataTransfer();
    data.setData("text/plain", "--bg: #fafafa;\n--text: rgb(20 30 40);\n--accent: #1060c0;");
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await settings.getByText("Added Pasted Colors.").waitFor();
  const pasted = await idOf("Pasted Colors");
  expect((await palette(pasted))!.colors.map((entry) => entry.color)).toEqual(["#fafafa", "#141e28", "#1060c0"]);

  if (engine() === "chromium") {
    await settings.getByRole("region", { name: "Pasted Colors", exact: true }).getByRole("button", { name: "Share Palette" }).click();
    await app.page.getByRole("menuitem", { name: "Copy Palette" }).click();
    const copied = JSON.parse(await app.page.evaluate(() => navigator.clipboard.readText()));
    expect(copied.name).toBe("Pasted Colors");
    expect(copied.colors).toHaveLength(3);
  }

  // A theme of yours from Lines, drawn in the pasted colors: each part in the nearest.
  await settings.getByRole("button", { name: "New", exact: true }).click();
  await app.page.getByRole("menuitem", { name: /From Lines/ }).click();
  await settings.getByRole("combobox", { name: "Palette for light", exact: true }).click();
  await app.page.getByRole("option", { name: "Pasted Colors", exact: true }).click();
  /** The light palette of the theme showing, and the color each of these parts of it is drawn in. */
  const drawn = (parts: string[]) =>
    app.page.evaluate((parts) => {
      const { customThemes, plugins, prefs } = window.testing;
      const theme = customThemes.get(prefs.theme)!;
      const light = typeof theme.palette === "string" ? theme.palette : theme.palette.light;
      return { light, colors: parts.map((part) => plugins.palette(light)!.colors.find((entry) => entry.id === theme.light![part])?.color) };
    }, parts);
  expect(await drawn(["bg", "text", "accent"])).toEqual({ light: pasted, colors: ["#fafafa", "#141e28", "#1060c0"] });
  expect(await app.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).toBe("#1060c0");

  // Deleting it asks, in the page, where the theme drawn in it goes.
  await settings.getByRole("radiogroup", { name: "Palettes" }).getByRole("radio", { name: "Pasted Colors", exact: true }).click();
  const editor = settings.getByRole("region", { name: "Pasted Colors", exact: true });
  await editor.getByRole("button", { name: "Delete Palette" }).click();
  await focusOn("Cancel");
  await editor.getByRole("combobox", { name: "Draw Lines Copy in" }).click();
  await app.page.getByRole("option", { name: "Lines Light", exact: true }).click();
  await editor.getByRole("button", { name: "Delete Palette" }).click();
  expect(await palette(pasted)).toBeUndefined();
  expect(await drawn(["bg", "text"])).toEqual({ light: "lines-light", colors: ["#ffffff", "#162120"] });
});

test("a theme of lines' shows what it's made of, unchanged, until Make a Copy makes one of yours", async () => {
  app = await openApp({ prefs: { theme: "nord" } });
  const settings = await app.settings("Theme");
  // The theme, then its palette, below with the others.
  const editor = settings.getByRole("region", { name: "Nord", exact: true }).first();
  expect(await editor.getByRole("textbox").count()).toBe(0);
  expect(await editor.getByRole("img", { name: /^Nord: Polar Night 1, / }).count()).toBeGreaterThan(0);
  expect(await settings.getByRole("button", { name: "Choose a color for Accent", exact: true }).count()).toBe(0);
  await editor.getByRole("button", { name: "Make a Copy" }).click();
  expect(await app.root("theme")).toStartWith("custom-");
  expect(await settings.getByRole("button", { name: "Choose a color for Accent", exact: true }).count()).toBe(1);
});

test("a part lines draws darker than its palette color, to read, says so", async () => {
  app = await openApp();
  await app.page.evaluate(() => {
    const { customThemes, plugins, prefs } = window.testing;
    const id = customThemes.copy(plugins.theme("lines").definition, (each) => plugins.palette(each), "Pale");
    customThemes.setColor(id, "light", "danger", "#ffc0c0");
    prefs.theme = id;
  });
  const settings = await app.settings("Theme");
  await settings.getByRole("button", { name: "More Colors" }).click();
  const status = settings.getByRole("region", { name: "Status", exact: true });
  expect(await status.getByText(/Drawn a little darker than .+, to read\./).count()).toBe(1);
});
