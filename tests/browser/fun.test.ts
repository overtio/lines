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
});

describe("mascot", () => {
  test("comes out, hidden from screen readers, and stays as it is while plugins are turned on and off", async () => {
    app = await openApp();
    await app.open("Some words to write beside");
    const settings = await app.settings("Mascot");
    await settings.getByRole("radio", { name: "Cat", exact: true }).click();
    const mascot = app.page.locator(".mascot");
    await mascot.waitFor({ state: "attached" });
    expect(await mascot.getAttribute("aria-hidden")).toBe("true");
    const before = await mascot.elementHandle();
    const plugins = await app.settings("Plugins");
    await toggle(plugins, "Changes", true);
    expect(await before!.evaluate((element) => element.isConnected)).toBe(true);
    await app.settings("Mascot");
    await settings.getByRole("radio", { name: "None", exact: true }).click();
    await mascot.waitFor({ state: "detached" });
  });
});

describe("typing sounds", () => {
  test("play as you type, with no errors, and a Mechvibes pack can be added", async () => {
    app = await openApp();
    const settings = await app.settings("Editor");
    await toggle(settings, "Play typing sounds", true);
    await settings.getByPlaceholder(/type/i).first().pressSequentially("asdf", { delay: 30 });
    await settings.getByRole("button", { name: "Add a Pack" }).click();
    const chooser = app.page.waitForEvent("filechooser");
    await app.page.getByRole("menuitem", { name: "From a .zip…" }).click();
    await (await chooser).setFiles({ name: "Clicky.zip", mimeType: "application/zip", buffer: soundPack("Clicky") });
    await settings.getByText("Clicky", { exact: true }).first().waitFor();
    await settings.getByPlaceholder(/type/i).first().pressSequentially("as ", { delay: 30 });
  });

  test("packs can still be added with the Keyboards plugin off", async () => {
    app = await openApp({ prefs: { typingSounds: true } });
    const plugins = await app.settings("Plugins");
    await toggle(plugins, "Keyboards", false);
    const settings = await app.settings("Editor");
    expect(await settings.getByRole("button", { name: "Add a Pack" }).isVisible()).toBe(true);
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
