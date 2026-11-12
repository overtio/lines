import { afterEach, describe, expect, test } from "bun:test";
import { type App, choose, mod, noErrors, openApp, toggle } from "./app";
import { png } from "./files";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** How light a CSS color is, 0 to 1, by the page's own reading of it. */
const lightness = (page: App["page"], color: string) =>
  page.evaluate((color) => {
    const canvas = new OffscreenCanvas(1, 1).getContext("2d")!;
    canvas.fillStyle = color;
    canvas.fillRect(0, 0, 1, 1);
    const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }, color);

describe("paper", () => {
  test("a pattern is drawn behind a note, and a backdrop behind its page", async () => {
    app = await openApp();
    await app.open("Some text\n\nMore text");
    const settings = await app.settings("Paper");
    // Ruled lines are drawn under each line of text.
    await settings.getByRole("radio", { name: "Lines", exact: true }).click();
    expect(await app.root("paper-lines")).not.toBeNull();
    expect(await app.style(".editor-pane .cm-line", "background-image")).toContain("gradient");
    await settings.getByRole("radio", { name: "Dawn", exact: true }).click();
    await app.closeSettings();
    expect(await app.root("backdrop")).not.toBeNull();
    expect(await app.page.locator(".editor-pane").evaluate((pane) => getComputedStyle(pane, "::before").backgroundImage)).toContain("gradient");
  });

  test("Image, cancelled, leaves the backdrop as it was", async () => {
    app = await openApp({ prefs: { paperBackdrop: "dawn" } });
    const settings = await app.settings("Paper");
    const chooser = app.page.waitForEvent("filechooser");
    await settings.getByRole("radio", { name: "Image", exact: true }).click();
    await chooser;
    await app.page.waitForTimeout(100);
    expect(await settings.getByRole("radio", { name: "Image", exact: true }).getAttribute("aria-checked")).toBe("false");
    expect(await settings.getByRole("radio", { name: "Dawn", exact: true }).getAttribute("aria-checked")).toBe("true");
  });

  test("a picture as the backdrop is kept, and can be taken away", async () => {
    app = await openApp();
    const settings = await app.settings("Paper");
    const chooser = app.page.waitForEvent("filechooser");
    await settings.getByRole("radio", { name: "Image", exact: true }).click();
    await (await chooser).setFiles({ name: "sky.png", mimeType: "image/png", buffer: png(64, 40, (x, y) => [80 + x * 2, 120 + y, 220]) });
    await app.page.waitForFunction(() => document.documentElement.hasAttribute("data-backdrop"));
    expect(await app.root("backdrop")).not.toBeNull();
    await app.page.reload();
    await app.page.waitForFunction(() => window.testing?.notes.ready);
    await app.page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--backdrop-light").includes("blob:"), null, { timeout: 5000 });
    const again = await app.settings("Paper");
    await again.getByRole("button", { name: "Remove Image" }).click();
    await app.page.waitForFunction(() => !document.documentElement.hasAttribute("data-backdrop"));
  });

  test("a page color of its own starts as the page was, under Invert too", async () => {
    app = await openApp({ prefs: { paperBackdrop: "dawn", invert: true } });
    await app.open("Some text");
    const page = () => app.style(".editor-pane .cm-content", "--page-bg").then((color) => lightness(app.page, color));
    const before = await page();
    expect(before).toBeLessThan(0.1);
    const settings = await app.settings("Paper");
    await settings.getByRole("radiogroup", { name: "Color", exact: true }).last().getByRole("radio", { name: "Custom", exact: true }).click();
    expect(await app.page.evaluate(() => window.testing.prefs.pageColor)).toBe("custom");
    expect(await page()).toBeCloseTo(before, 2);
  });
});

test("Scroll bars off takes them away everywhere", async () => {
  app = await openApp();
  const settings = await app.settings("Layout");
  await toggle(settings, "Scroll bars", false);
  expect(await app.root("no-scrollbars")).not.toBeNull();
  expect(await app.style(".note-list", "scrollbar-width")).toBe("none");
});

test("Heading color: the accent colors every heading", async () => {
  app = await openApp();
  await app.open("# Title\n\nText");
  const settings = await app.settings("Typography");
  await choose(settings, "Heading color", "Accent");
  await app.closeSettings();
  const [heading, accent] = await app.page.evaluate(() => [getComputedStyle(document.querySelector(".editor-pane .cm-lp-h1")!).color, getComputedStyle(document.querySelector(".editor-pane .cm-content")!).getPropertyValue("--accent")]);
  expect(await lightness(app.page, heading)).toBeCloseTo(await lightness(app.page, accent), 2);
});

test("Fonts: IBM Plex Sans, Fira Sans and Agave come with lines, write notes in them, and go back to the system's with their plugin off", async () => {
  app = await openApp();
  await app.open("# Title\n\nText");
  const settings = await app.settings("Typography");
  const fonts = settings.getByRole("radiogroup", { name: "Font" });
  for (const [name, id] of [["IBM Plex Sans", "ibm-plex-sans"], ["Fira Sans", "fira-sans"], ["Agave", "agave"]]) {
    await fonts.getByRole("radio", { name }).click();
    expect(await app.root("font")).toBe(id);
    // Chrome quotes a name with spaces in it, WebKit doesn't.
    expect((await app.style(".editor-pane .cm-content", "font-family")).replaceAll('"', "")).toStartWith(`${name},`);
    // Its files are there, and load: regular and bold.
    const loaded = await app.page.evaluate(async (name) => (await Promise.all([`16px "${name}"`, `bold 16px "${name}"`].map((font) => document.fonts.load(font, "Aa")))).map((faces) => faces.length), name);
    expect(loaded.every((count) => count > 0)).toBe(true);
  }

  const plugins = await app.settings("All Plugins");
  await toggle(plugins, "Fonts", false);
  await app.settings("Typography");
  expect(await fonts.getByRole("radio").count()).toBe(4);
  expect(await app.style(".editor-pane .cm-content", "font-family")).toStartWith("-apple-system");
});

describe("on a phone, in French", () => {
  async function openFrench() {
    app = await openApp({ width: 375 });
    await app.page.evaluate(() => localStorage.setItem("lines.language", "fr"));
    await app.page.reload();
    await app.page.waitForFunction(() => window.testing?.notes.ready);
  }

  test("Settings fit: rows of choices, headings with buttons, and the shortcuts' keys", async () => {
    await openFrench();
    await app.page.keyboard.press(`${mod()}+/`);
    const dialog = app.page.getByRole("dialog");
    for (const section of ["shortcuts", "theme", "presets", "touches"]) {
      if (section !== "shortcuts") {
        await dialog.getByRole("button", { name: "Tous les réglages" }).click();
        await dialog.locator(`#settings-nav-${section}`).click();
      }
      const past = await dialog.locator("section[aria-labelledby=settings-section-title]").evaluate((section) => section.parentElement!.scrollWidth - section.parentElement!.clientWidth);
      expect(past, section).toBeLessThanOrEqual(0);
    }
  });

  test("a note's info fits", async () => {
    await openFrench();
    await app.open("Some text");
    await app.page.getByRole("button", { name: "Infos sur la note" }).click();
    const info = await app.page.getByRole("dialog", { name: "Infos sur la note" }).boundingBox();
    expect(info!.x).toBeGreaterThanOrEqual(0);
    expect(info!.x + info!.width).toBeLessThanOrEqual(375);
  });
});

describe("themes", () => {
  test("each of the new ones shows, light and dark", async () => {
    for (const scheme of ["light", "dark"] as const) {
      app = await openApp({ scheme });
      const settings = await app.settings("Theme");
      for (const name of ["Ink", "Indigo", "Plum", "Moss", "Amber", "Mono"]) {
        await settings.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name, exact: true }).click();
        expect(await app.root("theme")).toBe(name.toLowerCase());
        const bg = await app.style("body", "background-color");
        expect((await lightness(app.page, bg)) > 0.5).toBe(scheme === "light");
      }
      noErrors(app);
      if (scheme === "light") await app.close();
    }
  });

  test("a picture's colors make a theme, chosen at once", async () => {
    app = await openApp();
    const settings = await app.settings("Theme");
    await settings.getByRole("button", { name: "New" }).click();
    const chooser = app.page.waitForEvent("filechooser");
    await app.page.getByRole("menuitem", { name: "From a Picture" }).click();
    await (await chooser).setFiles({ name: "Sunset_over-sea.png", mimeType: "image/png", buffer: png(48, 32, (x, y) => (y < 14 ? [240, 140 - x, 60] : [40, 30 + x, 90])) });
    await settings.getByText("Sunset over sea", { exact: false }).first().waitFor();
    expect(await app.root("theme")).toStartWith("custom");
  });

  test("Wallhaven is the apps': on the web it says so, and New has no From Wallhaven", async () => {
    app = await openApp();
    const plugins = await app.settings("All Plugins");
    expect(await plugins.getByText("Needs the lines app: Wallhaven's site doesn't answer web pages.").isVisible()).toBe(true);
    const theme = await app.settings("Theme");
    await theme.getByRole("button", { name: "New" }).click();
    expect(await app.page.getByRole("menuitem", { name: "From Wallhaven" }).count()).toBe(0);
    await app.page.keyboard.press("Escape");
  });

  test("New → From a theme with colors for one scheme only copies that one", async () => {
    app = await openApp({ prefs: { theme: "neon" } });
    const settings = await app.settings("Theme");
    await settings.getByRole("button", { name: "New" }).click();
    await app.page.getByRole("menuitem", { name: /From Neon/ }).click();
    const theme = await app.page.evaluate(() => window.testing.plugins.theme(window.testing.prefs.theme));
    expect(theme.scheme).toBe("dark");
  });
});

describe("styles", () => {
  test("Classic squares the corners; Pixel's switch knob goes all the way across", async () => {
    app = await openApp();
    const settings = await app.settings("Presets");
    await settings.getByRole("radio", { name: /^Classic/ }).first().click();
    expect(await app.root("style")).toBe("classic");
    expect(await app.style(".ui-card", "border-top-left-radius")).toBe("0px");
    await settings.getByRole("radio", { name: /^Pixel/ }).first().click();
    const editor = await app.settings("Editor");
    await toggle(editor, "Copy what you select", true);
    const [track, knob] = await Promise.all([
      editor.getByRole("switch", { name: "Copy what you select" }).boundingBox(),
      editor.getByRole("switch", { name: "Copy what you select" }).locator(".ui-switch-thumb").boundingBox(),
    ]);
    expect(track!.x + track!.width - (knob!.x + knob!.width)).toBeLessThan(5);
  });

  test("a style's look outranks a theme's own, in dark as in light", async () => {
    for (const scheme of ["light", "dark"] as const) {
      app = await openApp({ scheme, prefs: { style: "neon", theme: "high-contrast" } });
      expect(await app.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--shadow-segment"))).toContain("0 0 10px");
      if (scheme === "light") await app.close();
    }
  });
});

describe("dark panes", () => {
  const panes = () =>
    app.page.evaluate(() =>
      [".sidebar", ".note-list", ".editor-pane"].map((selector) => {
        const pane = document.querySelector(selector)!.closest("[data-pane]") ?? document.querySelector(selector)!;
        return { scheme: (pane as HTMLElement).dataset.scheme ?? null, bg: getComputedStyle(pane).backgroundColor, text: getComputedStyle(pane).color };
      }),
    );

  test("Both: the sidebar and the note list dark, the note light", async () => {
    app = await openApp();
    const settings = await app.settings("Theme");
    await choose(settings, "Dark panes", "Both");
    await app.closeSettings();
    const [sidebar, list, note] = await panes();
    expect([sidebar.scheme, list.scheme, note.scheme]).toEqual(["dark", "dark", null]);
    for (const pane of [sidebar, list]) {
      expect(await lightness(app.page, pane.bg)).toBeLessThan(0.25);
      expect(await lightness(app.page, pane.text)).toBeGreaterThan(0.75);
    }
    expect(await lightness(app.page, note.bg)).toBeGreaterThan(0.9);
  });

  test("nothing to change in dark; dark again when Invert makes the window light", async () => {
    app = await openApp({ scheme: "dark", prefs: { darkPanes: "sidebar" } });
    expect((await panes())[0].scheme).toBeNull();
    await app.page.evaluate(() => (window.testing.prefs.invert = true));
    await app.page.waitForFunction(() => document.querySelector("[data-pane=sidebar]")?.getAttribute("data-scheme") === "dark");
    expect(await lightness(app.page, (await panes())[0].bg)).toBeLessThan(0.25);
  });

  test("Monochrome greys them too", async () => {
    app = await openApp({ prefs: { darkPanes: "both", monochrome: true } });
    const accent = await app.page.locator("[data-pane=sidebar]").evaluate((pane) => getComputedStyle(pane).getPropertyValue("--accent").trim());
    const [r, g, b] = accent.match(/[0-9a-f]{2}/gi)!.map((hex) => parseInt(hex, 16));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(4);
  });
});
