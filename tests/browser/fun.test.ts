import { afterEach, describe, expect, test } from "bun:test";
import { type App, choose, noErrors, openApp, toggle } from "./app";
import { soundPack } from "./files";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

describe("cursor", () => {
  test("a block cursor is as wide as the character it's on", async () => {
    app = await openApp();
    await app.open("Wide Ws here");
    const settings = await app.settings("Cursor");
    await choose(settings, "Shape", "Block");
    await app.closeSettings();
    expect(await app.root("caret-shape")).toBe("block");
    await app.page.evaluate(() => window.testing.place(5));
    const width = await app.page.locator(".editor-pane .cm-cursor-primary").evaluate((cursor) => cursor.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(6);
  });

  test("an underline cursor before hidden markup is as wide as the character drawn after it", async () => {
    app = await openApp({ prefs: { caretShape: "underline", markdownMode: "hidden" } });
    await app.open("Write in **Markdown** here");
    // Just before the hidden `**`: as wide as the M drawn after it, once the cursor's drawn there.
    await app.page.evaluate(() => window.testing.place(9));
    await app.page.waitForFunction(() => {
      const cursor = document.querySelector(".editor-pane .cm-cursor-primary")?.getBoundingClientRect();
      const bold = [...document.querySelectorAll(".editor-pane .cm-line *")].find((element) => element.textContent === "Markdown")?.firstChild;
      if (!cursor || !bold) return false;
      const range = document.createRange();
      range.setStart(bold, 0);
      range.setEnd(bold, 1);
      // WebKit's measures of the two differ by about half a pixel.
      return Math.abs(cursor.width - range.getBoundingClientRect().width) < 1;
    });
  });

  test("an underline cursor at the end of a heading is as wide as its last letter, and thicker", async () => {
    app = await openApp({ prefs: { caretShape: "underline" } });
    await app.open("# Hello\n\nText");
    await app.page.evaluate(() => window.testing.place(7));
    await app.page.waitForFunction(() => {
      const cursor = document.querySelector(".editor-pane .cm-cursor-primary")?.getBoundingClientRect();
      // The heading's last letter, the "o" of its text.
      const walker = document.createTreeWalker(document.querySelector(".editor-pane .cm-line")!, NodeFilter.SHOW_TEXT);
      let text: Node | null = null;
      while (walker.nextNode()) if (walker.currentNode.textContent?.endsWith("Hello")) text = walker.currentNode;
      if (!cursor || !text) return false;
      const range = document.createRange();
      range.setStart(text, text.textContent!.length - 1);
      range.setEnd(text, text.textContent!.length);
      return Math.abs(cursor.width - range.getBoundingClientRect().width) < 0.5 && cursor.height >= 3;
    });
  });

  test("an underline cursor on an empty line, or after a space at a line's end, is as wide as a letter", async () => {
    app = await openApp({ prefs: { caretShape: "underline" } });
    await app.open("Words \n\nnnn");
    /** The cursor's width at `pos`, once it's drawn there. */
    const widthAt = async (pos: number) => {
      await app.page.evaluate((pos) => window.testing.place(pos), pos);
      await app.page.waitForTimeout(100);
      return app.page.locator(".editor-pane .cm-cursor-primary").evaluate((cursor) => cursor.getBoundingClientRect().width);
    };
    const letter = await widthAt(8);
    expect(letter).toBeGreaterThan(6);
    // Measured from the type, which WebKit lays out half a pixel apart.
    expect(Math.abs((await widthAt(6)) - letter)).toBeLessThan(1);
    expect(Math.abs((await widthAt(7)) - letter)).toBeLessThan(1);
  });

  test("Width Even keeps an underline a letter wide, over an i or a space too; shown only for Block and Underline", async () => {
    app = await openApp();
    await app.open("nil wide");
    const settings = await app.settings("Cursor");
    expect(await settings.getByRole("radiogroup", { name: "Width" }).count()).toBe(0);
    await choose(settings, "Shape", "Underline");
    await choose(settings, "Width", "Even");
    await app.closeSettings();
    expect(await app.root("caret-width")).toBe("even");
    const widthAt = async (pos: number) => {
      await app.page.evaluate((pos) => window.testing.place(pos), pos);
      await app.page.waitForTimeout(100);
      return app.page.locator(".editor-pane .cm-cursor-primary").evaluate((cursor) => cursor.getBoundingClientRect().width);
    };
    const [n, i, space] = [await widthAt(0), await widthAt(1), await widthAt(3)];
    expect(n).toBeGreaterThan(6);
    expect(Math.abs(i - n)).toBeLessThan(1);
    expect(Math.abs(space - n)).toBeLessThan(1);
  });

  test("a pointer of its own, but the text cursor over notes and fields", async () => {
    app = await openApp();
    await app.open("Text");
    const settings = await app.settings("Cursor");
    await choose(settings, "Pointer", "Retro");
    await app.closeSettings();
    expect(await app.root("pointer")).toBe("retro");
    expect(await app.style("body", "cursor")).toContain("url(");
    expect(await app.style(".editor-pane .cm-content", "cursor")).toBe("text");
  });

  test("Dot is in the accent shown, as your own theme's changes, and with the system's Increase Contrast", async () => {
    app = await openApp({ prefs: { pointerStyle: "dot", theme: "ember" } });
    /** The dot's color, and the accent. */
    const colors = () =>
      app.page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return [decodeURIComponent(root.getPropertyValue("--pointer-arrow")).match(/fill="([^"]+)"/)![1], root.getPropertyValue("--accent").trim()];
      });
    const [before] = await colors();
    await app.page.emulateMedia({ contrast: "more" });
    await app.page.waitForFunction(() => document.documentElement.dataset.contrast === "more");
    const [dot, accent] = await colors();
    expect(dot).not.toBe(before);
    expect(dot).toBe(accent);
    const settings = await app.settings("Theme");
    await settings.getByRole("button", { name: "New", exact: true }).click();
    await app.page.getByRole("menuitem").first().click();
    const field = settings.getByRole("textbox", { name: "Accent", exact: true });
    await field.fill("#c01060");
    await field.press("Enter");
    const [edited, shown] = await colors();
    expect(edited).not.toBe(dot);
    expect(edited).toBe(shown);
  });
});

describe("mascot", () => {
  test("comes out, hidden from screen readers, and stays as it is while plugins are turned on and off", async () => {
    app = await openApp();
    await app.open("Some words to write beside");
    const settings = await app.settings("Mascots");
    await settings.getByRole("radio", { name: "Cat", exact: true }).click();
    const mascot = app.page.locator(".mascot");
    await mascot.waitFor({ state: "attached" });
    expect(await mascot.getAttribute("aria-hidden")).toBe("true");
    const before = await mascot.elementHandle();
    const plugins = await app.settings("All Plugins");
    await toggle(plugins, "Changes", true);
    expect(await before!.evaluate((element) => element.isConnected)).toBe(true);
    await app.settings("Mascots");
    await settings.getByRole("radio", { name: "None", exact: true }).click();
    await mascot.waitFor({ state: "detached" });
  });
});

describe("typing sounds", () => {
  test("play as you type, with no errors, and a Mechvibes pack can be added", async () => {
    app = await openApp();
    const settings = await app.settings("Keyboards");
    await toggle(settings, "Play typing sounds", true);
    await settings.getByPlaceholder(/type/i).first().pressSequentially("asdf", { delay: 30 });
    await settings.getByRole("button", { name: "Add a Pack" }).click();
    const chooser = app.page.waitForEvent("filechooser");
    await app.page.getByRole("menuitem", { name: "From a .zip" }).click();
    await (await chooser).setFiles({ name: "Clicky.zip", mimeType: "application/zip", buffer: soundPack("Clicky") });
    await settings.getByText("Clicky", { exact: true }).first().waitFor();
    await settings.getByPlaceholder(/type/i).first().pressSequentially("as ", { delay: 30 });
  });

  test("on the Keyboards plugin's own page, which while it's off says so, with its switch", async () => {
    app = await openApp({ prefs: { typingSounds: true } });
    const settings = await app.settings("Keyboards");
    await toggle(settings, "Keyboards", false);
    await settings.getByText("Turn Keyboards on to change its settings.").waitFor();
    expect(await settings.getByRole("button", { name: "Add a Pack" }).count()).toBe(0);
    await toggle(settings, "Keyboards", true);
    await settings.getByRole("button", { name: "Add a Pack" }).waitFor();
  });
});

describe("typing practice", () => {
  const drill = () => app.page.getByRole("group", { name: "Typing practice" });
  const passage = "The quick fox.\nfunction go() {\n  return 1;\n}";

  test("typed over, with mistakes counted and fixed, it says how it went", async () => {
    app = await openApp();
    await app.page.evaluate(() => addEventListener("lines:done", () => ((window as { cheered?: boolean }).cheered = true)));
    await app.open(`Practice\n\n\`\`\`typing\n${passage}\n\`\`\`\n`);
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.press("ArrowUp");
    await app.page.keyboard.type("The quick fix", { delay: 40 });
    await app.page.keyboard.press("Backspace");
    await app.page.keyboard.press("Backspace");
    await app.page.keyboard.type("ox.", { delay: 40 });
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.type("function go() {", { delay: 40 });
    await app.page.keyboard.press("Enter");
    // The indent is typed for it.
    await app.page.keyboard.type("return 1;", { delay: 40 });
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.type("}", { delay: 40 });
    await drill().getByText("words a minute").waitFor();
    const result = await drill().innerText();
    expect(result).toContain("1 mistake");
    expect(result).toContain("A new best");
    expect(await app.page.evaluate(() => (window as { cheered?: boolean }).cheered)).toBe(true);
    // The note is as it was.
    expect(await app.text()).toContain(passage);
    await app.page.keyboard.press("Enter");
    expect(await drill().innerText()).not.toContain("words a minute");
    await app.page.keyboard.press("Escape");
    expect(await app.page.evaluate(() => document.activeElement?.classList.contains("cm-content"))).toBe(true);
  });

  test("a long passage is a few elements, not one for each character", async () => {
    app = await openApp();
    const long = "Lorem ipsum dolor sit amet. ".repeat(80).trim();
    await app.open(`\`\`\`typing\n${long}\n\`\`\`\n`);
    await drill().waitFor();
    expect(await drill().locator("p[aria-hidden] span").count()).toBeLessThan(5);
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.press("ArrowUp");
    await app.page.keyboard.type("Lorem ipsxm", { delay: 20 });
    expect(await drill().locator("p[aria-hidden] span").count()).toBeLessThan(8);
  });
});
