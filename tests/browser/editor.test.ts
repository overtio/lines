import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, choose, engine, mod, noErrors, openApp, toggle } from "./app";

let app: App;
beforeEach(async () => {
  app = await openApp();
});
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** The text line `n` (from 1) shows, as drawn. */
const shown = (n: number) => app.page.locator(".editor-pane .cm-line").nth(n - 1).innerText();

describe("Show Markdown", () => {
  const NOTE = "# Title\n\nSome **bold** text\n\nThe last line";

  test("Live shows the marks the cursor is on; Hidden never; Visible and Source always", async () => {
    await app.open(NOTE);
    // In the last line, or in "bold".
    const markedOn = async (line: number) => {
      await app.page.evaluate((line) => window.testing.place(line === 3 ? window.testing.editor()!.state.doc.toString().indexOf("bold") + 2 : window.testing.editor()!.state.doc.length), line);
      return (await shown(3)).includes("**");
    };
    expect([await markedOn(5), await markedOn(3)]).toEqual([false, true]);
    for (const [mode, label] of [["visible", "Visible"], ["source", "Source"], ["hidden", "Hidden"]] as const) {
      const settings = await app.settings("Editor");
      await choose(settings, "Show Markdown", label);
      await app.closeSettings();
      const marks = [await markedOn(5), await markedOn(3)];
      expect(marks, mode).toEqual(mode === "hidden" ? [false, false] : [true, true]);
    }
    // Hidden, the text is still as written.
    expect(await app.text()).toBe(NOTE);
  });

  test("Hidden: arrows and Backspace step over the hidden marks", async () => {
    await app.page.evaluate(() => (window.testing.prefs.markdownMode = "hidden"));
    await app.open("**bold**");
    await app.page.evaluate(() => window.testing.place(8));
    await app.page.keyboard.press("Backspace");
    expect(await app.text()).toBe("**bol**");
    await app.page.keyboard.press("Home");
    await app.page.keyboard.press("ArrowRight");
    await app.page.keyboard.type("x");
    expect(await app.text()).toBe("**bxol**");
  });
});

test("Drag to move lines, off, shows no grip", async () => {
  await app.open("One\n\nTwo");
  const line = app.page.locator(".editor-pane .cm-line").first();
  await line.hover();
  await expect(app.page.locator(".cm-drag-handle").first().isVisible()).resolves.toBe(true);
  const settings = await app.settings("Editor");
  await toggle(settings, "Drag to move lines", false);
  await app.closeSettings();
  await line.hover();
  expect(await app.page.locator(".cm-drag-handle:visible").count()).toBe(0);
});

test("Check spelling turns the browser's spell checking off and on", async () => {
  await app.open("Speling");
  expect(await app.page.locator(".editor-pane .cm-content").getAttribute("spellcheck")).toBe("true");
  const settings = await app.settings("Editor");
  await toggle(settings, "Check spelling", false);
  expect(await app.page.locator(".editor-pane .cm-content").getAttribute("spellcheck")).toBe("false");
});

describe("line marks", () => {
  const marks = () => app.page.locator(".editor-pane .cm-marker").evaluateAll((bars) => bars.map((bar) => bar.getAttribute("title")));

  test("a mark written at a line's end is a bar beside it, its comment hidden but while it's edited", async () => {
    await app.open("Ready <!-- mark green: check -->\nPlain\nNot ready <!-- mark red -->");
    await app.page.evaluate(() => window.testing.place(window.testing.editor()!.state.doc.line(2).from));
    expect(await marks()).toEqual(["check", null]);
    expect((await shown(1)).trim()).toBe("Ready");
    await app.page.evaluate(() => window.testing.place(3));
    expect(await shown(1)).toContain("<!-- mark green: check -->");
  });

  test("they move with the text as it changes, and go with their comment", async () => {
    await app.open("a\nb <!-- mark -->\nc");
    await app.page.evaluate(() => window.testing.place(0));
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.type("new line");
    const bar = await app.page.locator(".editor-pane .cm-marker").boundingBox();
    const line = await app.page.locator(".editor-pane .cm-line").nth(2).boundingBox();
    expect(Math.abs(bar!.y - line!.y)).toBeLessThan(4);
    // Taking the comment out takes the mark away.
    await app.page.evaluate(() => {
      const view = window.testing.editor()!;
      const at = view.state.doc.toString().indexOf(" <!--");
      view.dispatch({ changes: { from: at, to: view.state.doc.line(3).to } });
    });
    await app.page.waitForFunction(() => !document.querySelector(".editor-pane .cm-marker"), null, { timeout: 2000 });
  });

  test("one in code isn't a mark, also once a code block is opened above it", async () => {
    await app.open("Intro\n\nline <!-- mark -->\n\nEnd");
    expect(await marks()).toHaveLength(1);
    await app.page.evaluate(() => {
      const view = window.testing.editor()!;
      view.dispatch({ changes: [{ from: 0, insert: "```\n" }, { from: view.state.doc.length, insert: "\n```" }] });
    });
    await app.page.waitForFunction(() => !document.querySelector(".editor-pane .cm-marker"), null, { timeout: 2000 });
  });

  test("⇧⌘M marks the cursor's line, and again takes it off", async () => {
    await app.open("Some line");
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    expect(await app.text()).toBe("Some line <!-- mark -->");
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    expect(await app.text()).toBe("Some line");
  });
});

test("a page break is drawn as one, and the note's page splits at it over a backdrop", async () => {
  await app.open("Page one\n\n<!-- pagebreak -->\n\nPage two");
  await app.page.evaluate(() => window.testing.place());
  expect(await app.page.locator(".editor-pane .cm-page-break").count()).toBe(1);
  await app.page.evaluate(() => (window.testing.prefs.paperBackdrop = "dawn"));
  await app.page.waitForFunction(() => document.querySelectorAll(".cm-page-card").length === 2, null, { timeout: 5000 });
});

test("Copy what you select copies a selection made with the pointer, not with keys", async () => {
  if (engine() !== "chromium") return;
  await app.page.evaluate(() => (window.testing.prefs.copyOnSelect = true));
  await app.open("Copy these words please");
  await app.page.evaluate(() => navigator.clipboard.writeText("before"));
  const line = app.page.locator(".editor-pane .cm-line").first();
  await app.page.evaluate(() => window.testing.place());
  await app.page.keyboard.press("Shift+Home");
  expect(await app.page.evaluate(() => navigator.clipboard.readText())).toBe("before");
  await line.dblclick({ position: { x: 10, y: 8 } });
  await app.page.waitForTimeout(100);
  expect(await app.page.evaluate(() => navigator.clipboard.readText())).toBe("Copy");
});

test("a code note has line numbers, a fixed-width font and its language's highlighting", async () => {
  await app.open('def greet(name):\n    return f"Hello, {name}"\n', "code-python");
  expect(await app.page.locator(".editor-pane .cm-lineNumbers .cm-gutterElement").filter({ hasText: /^2$/ }).count()).toBe(1);
  expect(await app.style(".editor-pane .cm-content", "font-family")).toMatch(/mono|Menlo|Consolas|Courier/i);
  await app.page.waitForFunction(() => document.querySelectorAll(".editor-pane .cm-line span[class]").length > 2, null, { timeout: 5000 });
});

describe("a code block in a list item or a quote", () => {
  const NOTES = ["- Item\n\n  ```\n  one\n    two\n  ```", "> ```\n> one\n>   two\n> ```"];

  test("Copy copies every line of its code, without the item's indent or the >", async () => {
    if (engine() !== "chromium") return;
    for (const note of NOTES) {
      await app.open(note);
      await app.page.evaluate(() => navigator.clipboard.writeText("before"));
      await app.page.locator(".editor-pane .cm-lp-code-copy").dispatchEvent("click");
      await app.page.waitForFunction(async () => (await navigator.clipboard.readText()) !== "before");
      expect(await app.page.evaluate(() => navigator.clipboard.readText())).toBe("one\n  two");
    }
  });

  test("Format tidies all of it and keeps it in the item or the quote", async () => {
    const cases = [
      ['- Item\n\n  ```json\n  {"a": 1,\n  "b": 2}\n  ```\n\nAfter', '- Item\n\n  ```json\n  {\n    "a": 1,\n    "b": 2\n  }\n  ```\n\nAfter'],
      ['> ```json\n> {"a": 1,\n> "b": 2}\n> ```\n\nAfter', '> ```json\n> {\n>   "a": 1,\n>   "b": 2\n> }\n> ```\n\nAfter'],
    ];
    for (const [note, formatted] of cases) {
      await app.open(note);
      await app.page.locator(".editor-pane .cm-lp-code-format").dispatchEvent("click");
      await app.page.waitForFunction((note) => window.testing.text() !== note, note, { timeout: 2000 });
      expect(await app.text()).toBe(formatted);
    }
  });

  test("prints with every line", async () => {
    for (const note of NOTES) {
      await app.open(note);
      await app.page.evaluate(() => window.testing.place(0));
      await app.page.keyboard.press(`${mod()}+P`);
      const code = app.page.getByRole("dialog").locator("pre.doc-code").first();
      await code.waitFor();
      expect(await code.innerText()).toBe("one\n  two");
      await app.page.keyboard.press("Escape");
      await app.page.getByRole("dialog").waitFor({ state: "hidden" });
    }
  });
});

describe("fixed", () => {
  test("⌘⇧M marks only where a mark follows text: not a code fence, a table's row or the properties", async () => {
    const note = "---\ntype: book\n---\n# Plan\n\n```\ncode\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nText";
    await app.open(note);
    await app.page.evaluate(() => {
      const view = window.testing.editor()!;
      view.focus();
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    });
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    const marked = (await app.text())!.split("\n").filter((line) => line.includes("<!-- mark -->"));
    expect(marked).toEqual(["# Plan <!-- mark -->", "Text <!-- mark -->"]);
    // And again, taken off.
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    expect(await app.text()).toBe(note);
  });

  test("⌘⇧M after a triple click marks that line, not the next too", async () => {
    await app.open("One\nTwo\nThree");
    await app.page.locator(".editor-pane .cm-line").first().click({ clickCount: 3 });
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    expect(await app.text()).toBe("One <!-- mark -->\nTwo\nThree");
  });

  test("a mark on the title line isn't part of the note's title", async () => {
    await app.open("# Plan <!-- mark green: due -->\n\nText");
    await app.page.waitForTimeout(300);
    expect(await app.page.locator(".note-list [data-id]").first().innerText()).toStartWith("Plan\n");
  });

  test("the line before a page break looks as any line does", async () => {
    await app.open("Before the break\n<!-- pagebreak -->\nAfter");
    await app.page.evaluate(() => window.testing.place());
    expect(await app.style(".editor-pane .cm-line", "color")).toBe(await app.style(".editor-pane .cm-content", "color"));
  });

  test("Changes marks what's changed since opening: kept when Settings change, gone on opening again", async () => {
    const plugins = await app.settings("Plugins");
    await toggle(plugins, "Changes", true);
    await app.closeSettings();
    const first = await app.open("One\nTwo");
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.type(" more");
    await app.page.waitForFunction(() => document.querySelector(".editor-pane .cm-marker"));
    await app.page.evaluate(() => (window.testing.prefs.markdownMode = "visible"));
    await app.page.waitForTimeout(100);
    expect(await app.page.locator(".editor-pane .cm-marker").count()).toBeGreaterThan(0);
    await app.open("Other");
    await app.page.evaluate((id) => window.testing.notes.select(id), first);
    await app.page.waitForFunction(() => window.testing.text() === "One\nTwo more");
    await app.page.waitForFunction(() => !document.querySelector(".editor-pane .cm-marker"), null, { timeout: 2000 });
  });

  test("Copy what you select doesn't copy a selection made with keys, at a click after it", async () => {
    if (engine() !== "chromium") return;
    await app.page.evaluate(() => (window.testing.prefs.copyOnSelect = true));
    await app.open("Some words here\n\nAnd more");
    await app.page.evaluate(() => navigator.clipboard.writeText("before"));
    await app.page.evaluate(() => window.testing.place(4));
    await app.page.keyboard.press("Shift+End");
    await app.page.locator(".editor-pane .cm-line").last().click();
    expect(await app.page.evaluate(() => navigator.clipboard.readText())).toBe("before");
  });

  test("a Python note downloads as .py", async () => {
    expect(await app.page.evaluate(() => window.testing.plugins.language("code-python").extensions[0])).toBe("py");
  });
});
