import { afterEach, describe, expect, test } from "bun:test";
import { type App, choose, engine, mod, noErrors, openApp, toggle } from "./app";
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

  test("New → From a theme copies its palette as yours, which a color changed in the editor goes into, the theme's own kept", async () => {
    app = await openApp({ prefs: { theme: "nord" } });
    const settings = await app.settings("Theme");
    await settings.getByRole("button", { name: "New", exact: true }).click();
    await app.page.getByRole("menuitem", { name: /From Nord/ }).click();
    const field = settings.getByRole("textbox", { name: "Accent", exact: true });
    await field.fill("#c01060");
    await field.press("Enter");
    expect(await app.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).toBe("#c01060");
    const palettes = await app.page.evaluate(() => {
      const { customThemes, plugins, prefs } = window.testing;
      const colors = (id: string) => plugins.palette(id)!.colors.map((entry) => entry.color);
      const { palette } = customThemes.get(prefs.theme)!;
      return { copy: colors(typeof palette === "string" ? palette : palette.light), nord: colors("nord") };
    });
    expect(palettes.copy).toContain("#c01060");
    expect(palettes.nord).not.toContain("#c01060");
    expect(palettes.copy.length).toBeGreaterThanOrEqual(palettes.nord.length);
    noErrors(app);
  });

  test("a theme made for another app imports as a palette of its colors, and a theme drawn in it", async () => {
    app = await openApp();
    const settings = await app.settings("Theme");
    await settings.getByRole("button", { name: "Import", exact: true }).click();
    const chooser = app.page.waitForEvent("filechooser");
    await app.page.getByRole("menuitem", { name: "Choose a File" }).click();
    const colors = ["2b303b", "343d46", "4f5b66", "65737e", "a7adba", "c0c5ce", "dfe1e8", "eff1f5", "bf616a", "d08770", "ebcb8b", "a3be8c", "96b5b4", "8fa1b3", "b48ead", "ab7967"];
    const scheme = `system: "base16"\nname: "Ocean"\nauthor: "Chris Kempson"\nvariant: "dark"\npalette:\n${colors.map((color, i) => `  base0${i.toString(16).toUpperCase()}: "#${color}"`).join("\n")}\n`;
    await (await chooser).setFiles({ name: "ocean.yaml", mimeType: "text/yaml", buffer: Buffer.from(scheme) });
    await settings.getByText("Added Ocean.").waitFor();
    const shown = await app.page.evaluate(() => {
      const { customThemes, prefs } = window.testing;
      const theme = customThemes.get(prefs.theme)!;
      const palette = typeof theme.palette === "string" ? theme.palette : theme.palette.dark;
      return { colors: customThemes.palette(palette)!.colors.map((entry) => entry.color), accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() };
    });
    // Its blue for the accent, each color once.
    expect(shown.accent).toBe("#8fa1b3");
    expect(shown.colors).toContain("#8fa1b3");
    expect(new Set(shown.colors).size).toBe(shown.colors.length);
    noErrors(app);
  });

  test("a theme of yours kept before palettes is drawn in a palette of its colors, as it looked", async () => {
    app = await openApp();
    const old = { id: "custom-old1", name: "Old", light: { ...(await app.page.evaluate(() => window.testing.plugins.theme("lines").light)), accent: "oklch(55% 0.2 300)", "callout-info": "var(--accent)" } };
    await app.page.evaluate((old) => {
      localStorage.setItem("lines.themes", JSON.stringify([old]));
      window.testing.prefs.theme = old.id;
    }, old);
    await app.page.reload();
    await app.page.waitForFunction(() => window.testing?.notes.ready);
    const shown = await app.page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const { customThemes } = window.testing;
      return { theme: document.documentElement.dataset.theme, accent: root.getPropertyValue("--accent").trim(), info: root.getPropertyValue("--callout-info").trim(), palette: customThemes.palette("custom-old1")?.colors.length };
    });
    expect(shown.theme).toBe("custom-old1");
    // The color CSS read, as the browser draws it, and what was drawn as the accent still is.
    expect(shown.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(shown.info).toBe(shown.accent);
    expect(shown.palette).toBeGreaterThan(4);
    noErrors(app);
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

describe("the color picker", () => {
  /** Settings → Typography's own heading color, its picker open. */
  async function openPicker(headingCustomColor: string) {
    app = await openApp({ prefs: { headingColor: "custom", headingCustomColor } });
    await app.settings("Typography");
    await app.page.getByRole("button", { name: "Choose a color for Your color" }).click();
    const picker = app.page.getByRole("dialog", { name: "Choose a color for Your color" });
    await picker.waitFor();
    return picker;
  }
  const color = () => app.page.evaluate(() => window.testing.prefs.headingCustomColor);
  /** Waits for focus to be on what has this name, as it moves there a moment after a picker opens or closes. */
  const focusOn = (label: string) => app.page.waitForFunction((label) => document.activeElement?.getAttribute("aria-label") === label, label);

  test("a swatch opens the theme's colors; one chosen by click or arrow key is the color at once, and Esc goes back to the swatch", async () => {
    const picker = await openPicker("#3d7dd8");
    // Opening it changes nothing; the color isn't one of the theme's, so none is chosen.
    expect(await color()).toBe("#3d7dd8");
    const swatches = picker.getByRole("radiogroup", { name: "Theme colors" });
    expect((await swatches.getByRole("radio").evaluateAll((radios) => radios.map((radio) => radio.getAttribute("aria-label")))).slice(0, 4)).toEqual(["Accent", "Red", "Orange", "Yellow"]);
    expect(await swatches.getByRole("radio", { checked: true }).count()).toBe(0);
    await focusOn("Accent");

    await swatches.getByRole("radio", { name: "Red", exact: true }).click();
    expect(await color()).toBe("#d53c40");
    await app.page.keyboard.press("ArrowRight");
    expect(await color()).toBe("#c46800");
    expect(await swatches.getByRole("radio", { name: "Orange", exact: true }).getAttribute("aria-checked")).toBe("true");
    expect(await picker.getByRole("textbox", { name: "Your color" }).inputValue()).toBe("#c46800");

    // An eyedropper only where the browser has one (not WebKit); nothing to add to, as no palette is yours yet.
    const eyedropper = await app.page.evaluate(() => "EyeDropper" in window);
    expect(await picker.getByRole("button", { name: "Pick a color from the screen" }).count()).toBe(eyedropper ? 1 : 0);
    if (engine() === "webkit") expect(eyedropper).toBe(false);
    expect(await picker.getByRole("button", { name: "Add to palette" }).count()).toBe(0);

    await app.page.keyboard.press("Escape");
    await picker.waitFor({ state: "detached" });
    await focusOn("Choose a color for Your color");
    expect(await app.page.getByRole("dialog").getByRole("heading", { name: "Typography" }).isVisible()).toBe(true);
    // Enter opens it again, on the color chosen.
    await app.page.keyboard.press("Enter");
    await picker.waitFor();
    await focusOn("Orange");
  });

  test("the saturation and brightness area and the hue, dragged or keyed, change the color as they go; a color typed moves them", async () => {
    const picker = await openPicker("#336699");
    const area = picker.getByRole("slider", { name: "Saturation and brightness" });
    const hue = picker.getByRole("slider", { name: "Hue" });
    expect(await area.getAttribute("aria-valuetext")).toBe("Saturation 67%, brightness 60%, #336699");
    expect(await hue.getAttribute("aria-valuetext")).toBe("210°, #336699");

    await area.focus();
    await app.page.keyboard.press("ArrowUp");
    expect(await color()).toBe("#33679c");
    await app.page.keyboard.press("Shift+ArrowLeft");
    expect(await area.getAttribute("aria-valuetext")).toBe("Saturation 57%, brightness 61%, #436f9c");
    await hue.focus();
    await app.page.keyboard.press("Shift+ArrowRight");
    expect(await color()).toBe("#43609c");
    await app.page.keyboard.press("ArrowRight");
    expect(await hue.getAttribute("aria-valuetext")).toBe("221°, #435f9c");

    // Dragged past its corner, the area stops at its edge: the hue at its fullest, then black.
    const box = (await area.locator("..").boundingBox())!;
    await app.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await app.page.mouse.down();
    await app.page.mouse.move(box.x + box.width + 40, box.y - 40, { steps: 4 });
    expect(await color()).toBe("#0051ff");
    await app.page.mouse.move(box.x - 40, box.y + box.height + 40, { steps: 4 });
    expect(await color()).toBe("#000000");
    await app.page.mouse.up();
    await focusOn("Saturation and brightness");
    // Black has no hue, but the slider keeps the one it had.
    expect(await hue.getAttribute("aria-valuetext")).toBe("221°, #000000");

    const text = picker.getByRole("textbox", { name: "Your color" });
    await text.fill("rgb(0 128 0)");
    expect(await color()).toBe("rgb(0 128 0)");
    expect(await hue.getAttribute("aria-valuetext")).toBe("120°, #008000");
    expect(await area.getAttribute("aria-valuetext")).toBe("Saturation 100%, brightness 50%, #008000");
  });

  test("in your theme's editor, it offers the colors of the theme being changed", async () => {
    app = await openApp();
    const settings = await app.settings("Theme");
    await settings.getByRole("button", { name: "New" }).click();
    await app.page.getByRole("menuitem", { name: /From Lines/ }).click();
    await settings.getByRole("textbox", { name: "Accent", exact: true }).fill("#7c3aed");
    await settings.getByRole("button", { name: "Choose a color for Text", exact: true }).click();
    const picker = app.page.getByRole("dialog", { name: "Choose a color for Text" });
    await picker.getByRole("radio", { name: "Accent", exact: true }).click();
    // Drawn in the palette's color the accent is.
    const theme = await app.page.evaluate(() => window.testing.customThemes.get(window.testing.prefs.theme));
    expect(theme?.light?.text).toBe(theme?.light?.accent);
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

  test("Aero's shine stays above the text on its colored buttons, and goes with Increased contrast", async () => {
    for (const contrast of ["standard", "more"]) {
      app = await openApp({ prefs: { style: "aero", theme: "aero", contrast } });
      await app.page.evaluate(() => (window.testing.themeDrafts.picking = true));
      const done = app.page.getByRole("button", { name: "Done", exact: true });
      await done.evaluate((button) => Promise.all(button.closest(".ui-menu")!.getAnimations().map((animation) => animation.finished)));
      const picture = (await app.page.screenshot({ clip: (await done.boundingBox())! })).toString("base64");
      // The least contrast between the text and the button just before it, from the top of its capitals down.
      const least = await done.evaluate(async (button, picture) => {
        const range = document.createRange();
        range.selectNodeContents(button);
        const [own, text] = [button.getBoundingClientRect(), range.getBoundingClientRect()];
        const image = new Image();
        image.src = `data:image/png;base64,${picture}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
        canvas.drawImage(image, 0, 0);
        const luminance = ([r, g, b]: Iterable<number>) => {
          const linear = (value: number) => ((value /= 255) <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
        };
        const style = getComputedStyle(button);
        const ink = luminance(style.color.match(/[\d.]+/g)!.map(Number));
        const capitals = (text.top + text.bottom) / 2 - own.top - 0.35 * parseFloat(style.fontSize);
        let least = Infinity;
        for (let y = Math.ceil(capitals); y < text.bottom - own.top; y++) {
          const under = luminance(canvas.getImageData(Math.floor(text.left - own.left) - 2, y, 1, 1).data);
          least = Math.min(least, (Math.max(under, ink) + 0.05) / (Math.min(under, ink) + 0.05));
        }
        return least;
      }, picture);
      expect(least).toBeGreaterThanOrEqual(4.5);
      if (contrast === "more") expect(await done.evaluate((button) => getComputedStyle(button).backgroundImage)).toBe("none");
      else await app.close();
    }
  });

  test("a style's look outranks a theme's own, in dark as in light", async () => {
    for (const scheme of ["light", "dark"] as const) {
      app = await openApp({ scheme, prefs: { style: "neon", theme: "high-contrast" } });
      expect(await app.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--shadow-segment"))).toContain("0 0 10px");
      if (scheme === "light") await app.close();
    }
  });

  test("Void's hairlines under fields and around switches reach 3:1 with Increased contrast", async () => {
    app = await openApp({ prefs: { style: "void", theme: "void", contrast: "more" } });
    const settings = await app.settings("Editor");
    const ratio = await settings.locator('.ui-switch[data-state="unchecked"]').first().evaluate((element) => {
      const canvas = new OffscreenCanvas(1, 1).getContext("2d")!;
      /** How light a color is (WCAG's relative luminance), drawn over the dialog. */
      const luminance = (color: string) => {
        canvas.fillStyle = getComputedStyle(element.closest(".ui-dialog")!).backgroundColor;
        canvas.fillRect(0, 0, 1, 1);
        canvas.fillStyle = color;
        canvas.fillRect(0, 0, 1, 1);
        const [r, g, b] = [...canvas.getImageData(0, 0, 1, 1).data].map((value) => ((value /= 255) <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [line, background] = [luminance(getComputedStyle(element).borderTopColor), luminance("transparent")];
      return (Math.max(line, background) + 0.05) / (Math.min(line, background) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(3);
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
