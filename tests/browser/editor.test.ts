import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Page } from "playwright";
import { type App, choose, clickMod, engine, mod, noErrors, openApp, toggle } from "./app";
import { png } from "./files";

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

test("⌘F shows the match it's on where Markdown is drawn: in a table, a link's address, a diagram's code, a mark, LaTeX", async () => {
  const notes = [
    ["Intro\n\n| a | b |\n| - | - |\n| needle | 2 |\n\nEnd", "needle"],
    ["Intro [text](https://needle.com) end", "needle"],
    ["Intro\n\n```mermaid\ngraph TD\n  needle --> b\n```\n\nEnd", "needle"],
    ["Intro **bold** end", "**"],
    ["Intro \\href{https://needle.com}{text} end", "needle", "latex"],
  ];
  for (const [note, query, format] of notes) {
    await app.open(note, format);
    await app.page.evaluate(() => window.testing.place(0));
    await app.page.keyboard.press(`${mod()}+F`);
    await app.page.keyboard.type(query);
    await app.page.keyboard.press("Enter");
    const match = app.page.locator(".editor-pane .cm-searchMatch-selected");
    await match.waitFor({ timeout: 2000 });
    expect(await match.innerText()).toBe(query);
    await app.page.keyboard.press("Escape");
  }
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

test("a line dragged by its grip to below another has its grip by it where it went, even moved over while it slides there", async () => {
  await app.open("One\nTwo\n\nThree");
  const page = app.page;
  const lines = page.locator(".editor-pane .cm-line");
  await lines.first().hover();
  const handle = page.locator(".editor-pane .cm-drag-handle");
  const grip = (await handle.boundingBox())!;
  const below = (await lines.filter({ hasText: "Three" }).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, below.y + below.height + 4, { steps: 10 });
  await page.mouse.up();
  // Over the moved line as it slides.
  const target = { x: below.x + 20, y: below.y + below.height / 2 };
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(target.x + i, target.y + 1);
    await page.waitForTimeout(30);
  }
  await page.waitForFunction(() => window.testing.text()?.trimEnd().endsWith("One"));
  const moved = lines.filter({ hasText: /^One$/ });
  await page.waitForFunction(() => !document.querySelector(".editor-pane .cm-line")?.getAnimations().length);
  await handle.waitFor({ state: "visible" });
  const [at, line] = [(await handle.boundingBox())!, (await moved.boundingBox())!];
  expect(Math.abs(at.y + at.height / 2 - (line.y + line.height / 2))).toBeLessThan(6);
});

test("a line dragged from the top to below a list stays apart from it, leaving no blank line at the top", async () => {
  await app.open("Text\n\n- a\n  - b\n  - c");
  const page = app.page;
  const lines = page.locator(".editor-pane .cm-line");
  await lines.first().hover();
  const grip = (await page.locator(".editor-pane .cm-drag-handle").boundingBox())!;
  const last = (await lines.last().boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, last.y + last.height - 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => window.testing.text()?.endsWith("Text"));
  expect(await app.text()).toBe("- a\n  - b\n  - c\n\nText");
});

test("a file dragged over a note shows a line where it'd go, above or below the line it's over, and goes there; not in code", async () => {
  await app.open("First paragraph\n\nSecond paragraph\n\n```\ncode\n```");
  const page = app.page;
  /** Drags a picture over (and, with `drop`, onto) the line reading `text`, at `fy` of its height; where the drop line shows (on screen), if it does. */
  const drag = (text: string, fy: number, drop = false) =>
    page.evaluate(
      ({ text, fy, drop }) => {
        const line = [...document.querySelectorAll<HTMLElement>(".editor-pane .cm-line")].find((each) => each.textContent === text)!;
        const box = line.getBoundingClientRect();
        const data = new DataTransfer();
        // A real picture, one pixel, which WebKit reads as one.
        const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0));
        data.items.add(new File([png], "dot.png", { type: "image/png" }));
        const at = { clientX: box.left + 20, clientY: box.top + box.height * fy, bubbles: true, cancelable: true, dataTransfer: data };
        line.dispatchEvent(new DragEvent("dragover", at));
        const indicator = document.querySelector<HTMLElement>(".editor-pane .cm-drop-indicator")!;
        const shown = indicator.hidden ? null : indicator.getBoundingClientRect().top;
        if (drop) line.dispatchEvent(new DragEvent("drop", at));
        return shown;
      },
      { text, fy, drop },
    );

  const [first, second] = await Promise.all(["First paragraph", "Second paragraph"].map(async (text) => (await page.locator(".editor-pane .cm-line").filter({ hasText: text }).boundingBox())!));
  // The lower half of the first line: a line between it and the second.
  const below = (await drag("First paragraph", 0.8))!;
  expect(below).toBeGreaterThan(first.y + first.height - 1);
  expect(below).toBeLessThan(second.y);
  // Not into code, where it can't go: no line.
  expect(await drag("code", 0.5)).toBeNull();
  // The upper half of the second: above it, and dropped, it goes there. (WebKit here can't save the
  // dropped picture, so the drop's checked in Chromium.)
  const dropping = engine() === "chromium";
  const above = (await drag("Second paragraph", 0.2, dropping))!;
  expect(above).toBeGreaterThan(first.y + first.height - 1);
  expect(above).toBeLessThan(second.y);
  if (dropping) await page.waitForFunction(() => /^First paragraph\n\n!\[[^\]]*\]\([^)]+\)\nSecond paragraph/.test(window.testing.text() ?? ""));
});

test("list items pasted on an empty item take its place at its level, not a list inside it; on an empty line, at its indentation", async () => {
  /** Pastes `text` into a note reading `body`, its cursor at the end; the note after. */
  const paste = async (body: string, text: string) => {
    await app.open(body);
    await app.page.evaluate(() => window.testing.place());
    await app.page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      document.querySelector(".editor-pane [data-pane-content='main'] .cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, text);
    return app.text();
  };
  // Copied from a level down, the next line from the top: both at the empty item's level.
  expect(await paste("- Support\n- Find\n- ", "  - Add setting\n- Have a setting\n")).toBe("- Support\n- Find\n- Add setting\n- Have a setting");
  // On a nested empty item: there, with what was nested under it still under it.
  expect(await paste("- A\n  - ", "- x\n  - y")).toBe("- A\n  - x\n    - y");
  // A to-do pasted on a bullet keeps its box.
  expect(await paste("- A\n- ", "- [ ] Call")).toBe("- A\n- [ ] Call");
  // On an empty line, from its start.
  expect(await paste("Text\n\n", "    - x\n      - y")).toBe("Text\n\n- x\n  - y");
  // In a line with text, as pasted.
  expect(await paste("- Keep ", "- x")).toBe("- Keep - x");
});

test("with Markdown hidden, a spreadsheet selected whole by its grip stays a grid, tinted as selected; with it live, its CSV shows", async () => {
  const body = "Before\n\n```csv\nType,Amount\nFed,100\n```\n\nAfter";
  const page = app.page;
  /** Clicks the grip of the block drawn in place of the CSV, selecting all of it. */
  const select = async () => {
    const grid = page.locator(".editor-pane .cm-content > [contenteditable=false]").first();
    await grid.hover();
    const handle = page.locator(".editor-pane .cm-drag-handle");
    await handle.waitFor({ state: "visible" });
    await handle.click();
    return grid;
  };
  await page.evaluate(() => (window.testing.prefs.markdownMode = "hidden"));
  await app.open(body);
  await select();
  await page.waitForFunction(() => !window.testing.editor()!.state.selection.main.empty);
  await page.waitForFunction(() => document.querySelector(".editor-pane .cm-block-selected"));
  expect(await page.locator(".editor-pane .cm-line").filter({ hasText: "Type,Amount" }).count()).toBe(0);

  await page.evaluate(() => (window.testing.prefs.markdownMode = "live"));
  await app.open(body);
  await select();
  await page.locator(".editor-pane .cm-line").filter({ hasText: "Type,Amount" }).waitFor();
});

test("with Markdown hidden, a click beside a spreadsheet or table selects it whole, drawn and tinted, rather than opening its Markdown", async () => {
  await app.page.evaluate(() => (window.testing.prefs.markdownMode = "hidden"));
  const page = app.page;
  const raw = () => page.locator(".editor-pane .cm-line").filter({ hasText: /Type,Amount|\|---/ }).count();
  const selected = () => page.evaluate(() => { const { main } = window.testing.editor()!.state.selection; return [main.from, main.to]; });

  await app.open("Before\n\n```csv\nType,Amount\nFed,100\n```\n\nAfter");
  const sheet = (await page.locator(".editor-pane .cm-content > .cm-sheet").boundingBox())!;
  await page.mouse.click(sheet.x + sheet.width - 30, sheet.y + sheet.height / 2);
  await page.locator(".editor-pane .cm-block-selected").waitFor();
  expect(await selected()).toEqual([8, 38]);
  expect(await raw()).toBe(0);

  // Beside a table narrower than the note: its row's room, not a cell.
  await app.open("Before\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nAfter");
  await page.evaluate(() => {
    window.testing.place(0);
    document.querySelector(".editor-pane .cm-lp-table-wrap")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  });
  await page.locator(".editor-pane .cm-block-selected").waitFor();
  expect(await raw()).toBe(0);
});

test("a click into a note that isn't focused keeps it where it was, though focusing it scrolls; the wheel after it still scrolls", async () => {
  await app.open("# Long\n\n" + Array.from({ length: 120 }, (_, i) => `Line ${i} of the note.`).join("\n\n"));
  const page = app.page;
  const result = await page.evaluate(async () => {
    const view = window.testing.editor()!;
    const scroller = view.scrollDOM;
    view.contentDOM.blur();
    // Scrolled down the way the editor scrolls itself, to a line, so it draws the lines there (setting
    // scrollTop, it can take a while to).
    const { scrollIntoView } = view.constructor as unknown as { scrollIntoView: (pos: number, options: { y: "start" }) => never };
    view.dispatch({ effects: scrollIntoView(view.state.doc.line(120).from, { y: "start" }) });
    const below = () => [...view.contentDOM.querySelectorAll<HTMLElement>(".cm-line")].find((each) => each.getBoundingClientRect().top > scroller.getBoundingClientRect().top + 100);
    for (let frames = 0; (scroller.scrollTop < 1000 || !below()) && frames < 60; frames++) await new Promise(requestAnimationFrame);
    const scrolled = scroller.scrollTop;
    const line = below();
    if (!line) {
      const tops = [...view.contentDOM.querySelectorAll<HTMLElement>(".cm-line")].map((each) => Math.round(each.getBoundingClientRect().top));
      const box = scroller.getBoundingClientRect();
      return { missing: { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, box: [box.top, box.height], viewport: view.viewport, lines: tops.length, first: tops[0], last: tops.at(-1) } };
    }
    // As WebKit does in the Mac app: focusing the editor scrolls it, to where its cursor last was.
    const jump = () => (scroller.scrollTop = 200);
    view.contentDOM.addEventListener("focus", jump, { once: true });
    const box = line.getBoundingClientRect();
    line.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: box.left + 10, clientY: box.top + 5 }));
    line.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: box.left + 10, clientY: box.top + 5 }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const kept = scroller.scrollTop;
    // The person's own scroll, after: it stays.
    await new Promise((resolve) => setTimeout(resolve, 300));
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
    scroller.scrollTop = 900;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { kept, scrolled, focused: view.hasFocus, after: scroller.scrollTop, cursor: view.state.selection.main.empty, line: view.state.doc.lineAt(view.state.selection.main.head).text, clicked: line.textContent };
  });
  if ("missing" in result) throw new Error(`No line drawn below the top after scrolling: ${JSON.stringify(result.missing)}`);
  expect(result.focused).toBe(true);
  // A cursor where it was clicked, not a selection from where the press was before the jump.
  expect(result.cursor).toBe(true);
  expect(result.line).toBe(result.clicked);
  // Where it was, but for the editor measuring its lines again (a few pixels), not where focusing jumped it.
  expect(result.scrolled).toBeGreaterThan(1000);
  expect(Math.abs(result.kept - result.scrolled)).toBeLessThan(40);
  expect(result.after).toBe(900);
});

describe("a note opened again", () => {
  // Scroll bars that take room, as on a Mac with a mouse, or with Show scroll bars: Always.
  const shownScrollBars = "* { scrollbar-width: auto !important; scrollbar-color: auto !important } ::-webkit-scrollbar { width: 15px }";
  /** An attachment that isn't on this device. */
  const missing = (n: number, ext = "png") => `../attachments/${String(n).padStart(32, "0")}.${ext}`;

  /**
   * Opens note `id`, from another: where its line `text` is, the text's left edge, what shows in its
   * pictures' place and how many files' cards it has, as the switch itself draws it (before anything
   * it waits for, as looking attachments up or loading pictures, can come in), and once its pictures
   * have loaded and its attachments been looked for.
   */
  const reopen = (id: string, text: string) =>
    app.page.evaluate(
      async ([id, text]) => {
        const content = () => window.testing.editor()!.contentDOM;
        const where = () => ({
          top: [...content().querySelectorAll(".cm-line")].find((each) => each.textContent === text)?.getBoundingClientRect().top,
          left: content().getBoundingClientRect().left,
          placeholders: [...content().querySelectorAll(".cm-lp-image-missing")].map((each) => each.textContent),
          cards: content().querySelectorAll(".cm-lp-file").length,
        });
        const body = window.testing.notes.get(id)!.note.body;
        window.testing.notes.select(id);
        for (let i = 0; i < 100 && window.testing.editor()!.state.doc.toString() !== body; i++) await Promise.resolve();
        // And what the editor draws once it has measured, as it does before the frame: done now, so
        // nothing the switch waits for comes in first.
        (window.testing.editor() as unknown as { measure(): void }).measure();
        const first = where();
        await window.testing.until(
          () => [...content().querySelectorAll("img")].every((img) => img.complete) && [...content().querySelectorAll(".cm-lp-file-meta")].every((meta) => meta.textContent),
        );
        await new Promise(requestAnimationFrame);
        return { first, settled: where() };
      },
      [id, text] as const,
    );

  test("its text is where it stays from the first frame: not pushed down as its pictures and sounds come in, nor sideways by a scroll bar", async () => {
    const page = app.page;
    await page.addStyleTag({ content: shownScrollBars });
    // A picture from the web, slow to come.
    const still = png(240, 160, (x, y) => [x, y, 160]);
    await page.route("https://pictures.example/still.png", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ body: still, contentType: "image/png" });
    });
    // And one on this device, where it can be kept: WebKit run by Playwright can't keep a file in IndexedDB.
    const kept =
      engine() === "chromium" ? await page.evaluate((bytes) => window.testing.saveAttachment(new File([new Uint8Array(bytes)], "kept.png", { type: "image/png" })), [...still]) : null;
    const pictured = await app.open(
      `---\ntype: show\nyear: 2020\n---\n# Pictured\n\n![Cover|240](${missing(1)})\n\n![Still](https://pictures.example/still.png)\n\n${kept ? `![Kept](../attachments/${kept})\n\n` : ""}[Song.mp3](${missing(2, "mp3")})\n\nThe text under them.`,
    );
    await page.locator(".editor-pane .cm-lp-image-missing", { hasText: "on this device" }).waitFor();
    await page.locator(".editor-pane .cm-lp-file", { hasText: "on this device" }).waitFor();
    await page.waitForFunction((count) => [...document.querySelectorAll<HTMLImageElement>(".editor-pane img.cm-lp-image")].filter((img) => img.complete).length === count, kept ? 2 : 1);
    // Room under the text so the note scrolls by less than the cover's placeholder is tall: without it, no scroll bar.
    await page.evaluate(() => {
      const { scrollDOM, contentDOM } = window.testing.editor()!;
      const end = contentDOM.lastElementChild!.getBoundingClientRect().bottom - scrollDOM.getBoundingClientRect().top + scrollDOM.scrollTop;
      document.querySelector<HTMLElement>(".editor-pane")!.style.setProperty("--editor-pad-bottom", `${scrollDOM.clientHeight + 30 - end}px`);
    });
    await app.open("# Another note");
    const { first, settled } = await reopen(pictured, "The text under them.");
    expect(first.top).toBeDefined();
    expect(first.top).toBe(settled.top);
    expect(first.left).toBe(settled.left);
    // The cover says it isn't here from the start, and the sound is its card.
    expect(first.placeholders).toEqual(settled.placeholders);
    expect(settled.placeholders).toEqual([expect.stringContaining("on this device")]);
    expect(first.cards).toBe(1);
  });

  test("pictures it doesn't show yet are counted at the height they were drawn at", async () => {
    const page = app.page;
    const many = await app.open(`# Many\n\n${Array.from({ length: 60 }, () => `![Cover](${missing(1)})`).join("\n")}\n\nThe end.`);
    await page.locator(".editor-pane .cm-lp-image-missing", { hasText: "on this device" }).first().waitFor();
    // Measured, the frame after.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await app.open("# Another note");
    // How tall the note is taken to be in the frame it's drawn in, with most of its pictures out of sight…
    await reopen(many, "The end.");
    const estimated = await page.evaluate(() => window.testing.editor()!.lineBlockAt(window.testing.editor()!.state.doc.length).bottom);
    // …and how tall it is with them all drawn, in a window tall enough.
    await page.setViewportSize({ width: 1280, height: 9000 });
    await page.waitForFunction(() => document.querySelectorAll(".editor-pane .cm-lp-image-block").length === 60);
    const drawn = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      return window.testing.editor()!.lineBlockAt(window.testing.editor()!.state.doc.length).bottom;
    });
    // Within what CodeMirror's guesses at its lines of text are out by; at 200 px a picture, they'd be thousands.
    expect(Math.abs(estimated - drawn)).toBeLessThan(20);
  });

  // WebKit keeps room only for its own scroll bars, not ones styled as these are; Chromium keeps it
  // even for its hidden ones, as Playwright has them.
  test("a note's text has the same left edge whether it scrolls or not; Settings' previews, which don't scroll, keep no room for a scroll bar", async () => {
    if (engine() !== "chromium") return;
    const page = app.page;
    await page.addStyleTag({ content: shownScrollBars });
    const edge = () =>
      page.evaluate(() => {
        const { scrollDOM, contentDOM } = window.testing.editor()!;
        return { left: contentDOM.getBoundingClientRect().left, room: scrollDOM.offsetWidth - scrollDOM.clientWidth };
      });
    await app.open("# Short\n\nA line.");
    const short = await edge();
    await app.open(`# Long\n\n${"A paragraph of the note.\n\n".repeat(80)}`);
    const long = await edge();
    expect(short.room).toBeGreaterThan(0);
    expect(long.left).toBe(short.left);
    const preview = (await app.settings("Typography")).locator(".cm-scroller").first();
    expect(await preview.evaluate((scroller: HTMLElement) => scroller.offsetWidth - scroller.clientWidth)).toBe(0);
  });
});

// Not on Linux, where Chrome takes a press in selected text as the start of dragging that text, as it
// does in any page; lines leaves that to the browser.
test.skipIf(process.platform === "linux")("a drag that starts in text already selected selects from where it started to where it ends, smoothly", async () => {
  await app.open("One two three four five six seven eight nine ten eleven twelve");
  const page = app.page;
  const line = (await page.locator(".editor-pane .cm-line").first().boundingBox())!;
  const y = line.y + line.height / 2;
  // Select a stretch by dragging, then drag again from inside it, leftward.
  await page.mouse.move(line.x + 300, y);
  await page.mouse.down();
  await page.mouse.move(line.x + 150, y, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(line.x + 220, y);
  await page.mouse.down();
  const heads: number[] = [];
  for (const x of [200, 160, 120, 80, 40]) {
    await page.mouse.move(line.x + x, y, { steps: 3 });
    heads.push(await page.evaluate(() => window.testing.editor()!.state.selection.main.head));
  }
  await page.mouse.up();
  const { anchor, head } = await page.evaluate(() => {
    const { main } = window.testing.editor()!.state.selection;
    return { anchor: main.anchor, head: main.head };
  });
  // The end follows the pointer leftward, never jumping back; the start stays put.
  expect(heads).toEqual([...heads].sort((a, b) => b - a));
  expect(head).toBeLessThan(anchor);
  expect(anchor - head).toBeGreaterThan(10);
});

test("a note's properties have no grip, and a line dragged above them lands just below them", async () => {
  await app.open("---\ntype: event\ndate: 2026-11-12\n---\n\n# Boo\n\nText");
  const page = app.page;
  const handle = page.locator(".editor-pane .cm-drag-handle");
  const property = page.locator(".editor-pane .cm-line").filter({ hasText: "2026-11-12" }).first();
  await property.hover();
  await page.waitForTimeout(100);
  expect(await handle.isVisible()).toBe(false);

  const text = page.locator(".editor-pane .cm-line").filter({ hasText: /^Text$/ });
  await text.hover();
  await handle.waitFor({ state: "visible" });
  const grip = (await handle.boundingBox())!;
  const top = (await page.locator(".editor-pane .cm-line").first().boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, top.y - 20, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => window.testing.text() !== "---\ntype: event\ndate: 2026-11-12\n---\n\n# Boo\n\nText");
  expect(await app.text()).toStartWith("---\ntype: event\ndate: 2026-11-12\n---\n");
  expect((await app.text())!.indexOf("Text")).toBeLessThan((await app.text())!.indexOf("# Boo"));
});

test("a list's marker typed alone stays text until its space, so -h never shows a bullet on the way; Enter's empty item still has one", async () => {
  await app.open("Text\n\n");
  const page = app.page;
  const bullets = () => page.locator(".editor-pane .cm-lp-bullet, .editor-pane .cm-lp-list-marker").count();
  await page.evaluate(() => window.testing.place());
  for (const key of ["-", "h"]) {
    await page.keyboard.type(key);
    expect(await bullets()).toBe(0);
  }
  expect(await app.text()).toBe("Text\n\n-h");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- one");
  await page.waitForFunction(() => document.querySelectorAll(".editor-pane .cm-lp-bullet, .editor-pane .cm-lp-list-marker").length === 1);
  // Enter on the item: a new empty one, its bullet showing.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll(".editor-pane .cm-lp-bullet, .editor-pane .cm-lp-list-marker").length === 2);
});

test("a # at a heading's end shows, as the note list shows it, Markdown hidden or live, the cursor elsewhere or on it", async () => {
  for (const mode of ["live", "hidden"] as const) {
    await app.page.evaluate((mode) => (window.testing.prefs.markdownMode = mode), mode);
    await app.open("# Test Delet #\n\nText");
    const title = app.page.locator(".editor-pane .cm-line").first();
    await app.page.evaluate(() => window.testing.place());
    await app.page.waitForFunction(() => document.querySelector(".editor-pane .cm-line")?.textContent?.trim() === "Test Delet #");
    await app.page.evaluate(() => window.testing.place(14));
    expect((await title.textContent())?.endsWith("Delet #")).toBe(true);
  }
});

test("## typed at the start of an H1's text makes it an H2, never a tag on the way, # back an H1; ⌘Z leaves them as typed; not in code", async () => {
  await app.open("# Boo\n\nText\n\n```python\n# x\n```");
  await app.page.evaluate(() => window.testing.place(2));
  // On the way, `# #Boo` is still the H1, with `#Boo` its text: not a tag, shown or listed.
  await app.page.keyboard.type("#");
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("# #Boo\n"));
  const first = app.page.locator(".editor-pane .cm-line").first();
  expect(await first.getAttribute("class")).toContain("cm-lp-h1");
  expect(await first.locator(".cm-lp-tag").count()).toBe(0);
  expect(await app.page.evaluate(() => window.testing.notes.selected?.meta.tags)).toEqual([]);
  await app.page.keyboard.type("# ");
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("## Boo\n"));
  await app.page.keyboard.type("# ");
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("# Boo\n"));
  await app.page.keyboard.press(`${mod()}+z`);
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("## # Boo\n"));
  // A comment in code stays as typed.
  const comment = await app.page.evaluate(() => window.testing.text()!.indexOf("# x") + 2);
  await app.page.evaluate((pos) => window.testing.place(pos), comment);
  await app.page.keyboard.type("## ");
  await app.page.waitForFunction(() => window.testing.text()?.includes("# ## x"));
});

test("--- under text is a divider and the text no heading, unless Underlined headings is on: then all its lines are, not while the dashes are typed", async () => {
  await app.open("# Lines\n\nCalm space.\nBuilt in Boston.\n");
  await app.page.evaluate(() => window.testing.place());
  await app.page.keyboard.type("---");
  await app.page.evaluate(() => window.testing.place(0));
  await app.page.locator(".editor-pane .cm-lp-hr").waitFor();
  expect(await app.page.locator(".editor-pane .cm-line.cm-lp-h2").count()).toBe(0);
  expect(await app.page.evaluate(() => window.testing.text())).toBe("# Lines\n\nCalm space.\nBuilt in Boston.\n---");

  const settings = await app.settings("Editor");
  await toggle(settings, "Underlined headings", true);
  await app.closeSettings();
  await app.page.waitForFunction(() => document.querySelectorAll(".editor-pane .cm-line.cm-lp-h2").length === 2);
  expect(await app.page.locator(".editor-pane .cm-lp-hr").count()).toBe(0);
  // On its underline, being typed, the text isn't a heading yet.
  await app.page.evaluate(() => window.testing.place());
  await app.page.waitForFunction(() => document.querySelectorAll(".editor-pane .cm-line.cm-lp-h2").length === 0);
});

test("with Markdown hidden, the cursor on a divider is as tall as text, not hidden in its line", async () => {
  await app.page.evaluate(() => (window.testing.prefs.markdownMode = "hidden"));
  await app.open("Above\n\n---\n\nBelow");
  await app.page.evaluate(() => window.testing.place(10));
  await app.page.locator(".editor-pane .cm-lp-hr").waitFor();
  const height = await app.page.evaluate(() => document.querySelector(".editor-pane .cm-cursor")!.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(15);
});

test("a divider chosen by its grip looks chosen, with Markdown hidden, and has no toolbar for text", async () => {
  await app.page.evaluate(() => (window.testing.prefs.markdownMode = "hidden"));
  await app.open("Above\n\n---\n\nBelow");
  await app.page.evaluate(() => window.testing.place(0));
  const divider = app.page.locator(".editor-pane .cm-lp-hr");
  await divider.hover();
  await app.page.locator(".editor-pane .cm-drag-handle").click();
  await app.page.locator(".editor-pane .cm-line.cm-block-selected .cm-lp-hr").waitFor();
  expect(await app.page.evaluate(() => window.testing.editor()!.state.selection.main.toJSON())).toEqual({ anchor: 7, head: 10 });
  expect(await app.page.getByRole("toolbar").count()).toBe(0);
});

test("> typed over selected text quotes its lines, keeping them selected; ⌘Z takes it back; in code it types over", async () => {
  await app.open("Title\n\nOne line\n\nand another\n\n```\ncode\n```");
  await app.page.evaluate(() => {
    const view = window.testing.editor()!;
    view.focus();
    view.dispatch({ selection: { anchor: 11, head: 25 } });
  });
  await app.page.keyboard.type(">");
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("Title\n\n> One line\n>\n> and another\n"));
  expect(await app.page.evaluate(() => window.testing.editor()!.state.sliceDoc(window.testing.editor()!.state.selection.main.from, window.testing.editor()!.state.selection.main.to))).toBe("line\n>\n> and anot");
  await app.page.keyboard.press(`${mod()}+z`);
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("Title\n\nOne line\n\nand another\n"));

  const code = await app.page.evaluate(() => window.testing.text()!.indexOf("code"));
  await app.page.evaluate((from) => window.testing.editor()!.dispatch({ selection: { anchor: from, head: from + 4 } }), code);
  await app.page.keyboard.type(">");
  await app.page.waitForFunction(() => window.testing.text()?.includes("```\n>\n```"));
});

test("a slash command after a line's text makes it that block, leaving no space behind; a quoted line stays in its quote", async () => {
  const cases = [
    ["item", "/todo", "- [ ] item‸"],
    ["> item", "/todo", "> - [ ] item‸"],
    ["> item", "/heading", "> # item‸"],
    ["> item", "/quote", "> item‸"],
    ["- item", "/numbered", "1. item‸"],
  ];
  for (const [note, command, after] of cases) {
    await app.open(note);
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.type(` ${command}`);
    await app.page.locator(".cm-tooltip-autocomplete").waitFor();
    await app.page.keyboard.press("Enter");
    const head = await app.page.evaluate(() => window.testing.editor()!.state.selection.main.head);
    const text = (await app.text())!;
    expect(text.slice(0, head) + "‸" + text.slice(head)).toBe(after);
  }
});

test("a #tag being typed offers the tags there are, the ones starting with it first; Enter writes the whole tag; not for a lone # or in code", async () => {
  await app.open("One #ideas and #work/meetings");
  await app.open("Two #ideas #idle");
  await app.open("Three\n\n`code`\n");
  await app.page.evaluate(() => window.testing.place(5));
  await app.page.keyboard.type(" #");
  // A lone # waits for a letter.
  expect(await app.page.getByRole("option").count()).toBe(0);
  await app.page.keyboard.type("id");
  await app.page.getByRole("option").first().waitFor();
  expect(await app.page.getByRole("option").allTextContents()).toEqual(["ideas2", "idle1"]);
  await app.page.keyboard.type("e");
  await app.page.getByRole("option", { name: /idle/ }).waitFor({ state: "detached" });
  await app.page.keyboard.press("Enter");
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("Three #ideas\n"));

  await app.page.keyboard.type(" #meet");
  await app.page.getByRole("option", { name: /work\/meetings/ }).waitFor();
  await app.page.keyboard.press("Enter");
  await app.page.waitForFunction(() => window.testing.text()?.startsWith("Three #ideas #work/meetings\n"));

  // In code, a # is a #.
  const code = await app.page.evaluate(() => window.testing.text()!.indexOf("code"));
  await app.page.evaluate((pos) => window.testing.place(pos), code);
  await app.page.keyboard.type(" #id");
  await app.page.waitForTimeout(200);
  expect(await app.page.getByRole("option").count()).toBe(0);
});

test("Check spelling turns the browser's spell checking off and on", async () => {
  await app.open("Speling");
  expect(await app.page.locator(".editor-pane .cm-content").getAttribute("spellcheck")).toBe("true");
  const settings = await app.settings("Editor");
  await toggle(settings, "Check spelling", false);
  expect(await app.page.locator(".editor-pane .cm-content").getAttribute("spellcheck")).toBe("false");
});

test("⌘D isn't a note's, which has one selection, nor listed in Settings → Shortcuts", async () => {
  await app.open("one two one");
  await app.page.evaluate(() => {
    window.testing.place(1);
    addEventListener("keydown", (event) => ((window as { taken?: boolean }).taken = event.defaultPrevented));
  });
  await app.page.keyboard.press(`${mod()}+D`);
  expect(await app.page.evaluate(() => [(window as { taken?: boolean }).taken, window.testing.editor()!.state.selection.main.empty])).toEqual([false, true]);
  const settings = await app.settings("Shortcuts");
  expect(await settings.getByText("Select the next match too").count()).toBe(0);
});

test("Enter on an empty item ends the list, when it's the second item too", async () => {
  for (const marker of ["- ", "* ", "1. ", "- [ ] "]) {
    await app.open("");
    await app.page.evaluate(() => window.testing.place(0));
    await app.page.keyboard.type(`${marker}one`);
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.press("Enter");
    await app.page.keyboard.type("after");
    expect(await app.text()).toBe(`${marker}one\nafter`);
  }
});

test("a note that couldn't be saved is saved once it can be, and until then a message says so", async () => {
  const id = await app.open("# Diary\n\nfirst line");
  const message = await app.page.evaluate(async () => {
    // Notes can't be written, as when the disk is full, for a while after the message shows.
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "notes") throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return put.apply(this, args);
    };
    const view = window.testing.editor()!;
    view.dispatch({ changes: { from: view.state.doc.length, insert: "\nsecond line" } });
    await window.testing.until(() => document.querySelector("[role=alert]"));
    const shown = document.querySelector("[role=alert]")!.textContent;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    IDBObjectStore.prototype.put = put;
    return shown;
  });
  expect(message).toContain("The quota has been exceeded.");
  await app.page.getByRole("alert").waitFor({ state: "detached", timeout: 10_000 });
  await app.page.reload();
  await app.page.waitForFunction(() => window.testing?.notes.ready);
  expect(await app.page.evaluate((id) => window.testing.notes.get(id)!.note.body, id)).toBe("# Diary\n\nfirst line\nsecond line");
  // Each failure logged, and nothing else: no write left failing unheard.
  expect(app.errors.length).toBeGreaterThan(1);
  expect(app.errors.filter((error) => !error.startsWith("lines: couldn't save notes"))).toEqual([]);
  app.errors.length = 0;
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

  test("⇧⌘M on a line ending in a line break (two spaces) goes before them, and taken off leaves them", async () => {
    for (const [format, mark] of [[undefined, "<!-- mark -->"], ["latex", "% mark"]]) {
      await app.open("Line  \nnext", format);
      await app.page.evaluate(() => window.testing.place(2));
      await app.page.keyboard.press(`${mod()}+Shift+M`);
      expect(await app.text()).toBe(`Line ${mark}  \nnext`);
      await app.page.keyboard.press(`${mod()}+Shift+M`);
      expect(await app.text()).toBe("Line  \nnext");
    }
  });
});

test("a page break is drawn as one, and the note's page splits at it over a backdrop", async () => {
  await app.open("Page one\n\n<!-- pagebreak -->\n\nPage two");
  await app.page.evaluate(() => window.testing.place());
  expect(await app.page.locator(".editor-pane .cm-page-break").count()).toBe(1);
  await app.page.evaluate(() => (window.testing.prefs.paperBackdrop = "dawn"));
  await app.page.waitForFunction(() => document.querySelectorAll(".cm-page-card").length === 2, null, { timeout: 5000 });
});

describe("leaving the page", () => {
  const bodyOf = (page: Page, id: string) => page.evaluate((id) => window.testing.notes.get(id)?.note.body, id);
  const ready = (page: Page) => page.waitForFunction(() => window.testing?.notes.ready);

  test("what's typed just before the page reloads, or its tab closes, is kept", async () => {
    const id = await app.open("# Quick\n\nfirst");
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.type(" second");
    await app.page.reload();
    await ready(app.page);
    expect(await bodyOf(app.page, id)).toBe("# Quick\n\nfirst second");

    await app.page.evaluate((id) => window.testing.notes.select(id), id);
    await app.page.waitForFunction(() => window.testing.text() === "# Quick\n\nfirst second");
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.type(" third");
    await app.page.close({ runBeforeUnload: true });
    const page = await app.page.context().newPage();
    await page.goto(globalThis.lines.url);
    await ready(page);
    expect(await bodyOf(page, id)).toBe("# Quick\n\nfirst second third");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lines.unsaved.")))).toEqual([]);
  });

  test("what was kept isn't stored over a later edit, nor over a note locked since", async () => {
    const id = await app.open("# Later\n\nedited since");
    const locked = await app.page.evaluate(async () => {
      const id = crypto.randomUUID();
      const key = { id: "key", changed: 0, kdf: "PBKDF2-SHA256", iterations: 1, salt: "", key: "" } as const;
      const locked = { key, title: "Secret", files: [], sealed: "sealed" };
      await window.testing.notes.insert({ id, body: "", locked, createdAt: 0, updatedAt: 0, pinned: false, trashed: false });
      return id;
    });
    await app.page.evaluate(
      ([id, locked]) => {
        const note = window.testing.notes.get(id)!.note;
        localStorage.setItem(`lines.unsaved.${id}`, JSON.stringify({ ...note, body: "# Earlier", updatedAt: note.updatedAt - 1000 }));
        const unlocked = { ...window.testing.notes.get(locked)!.note, body: "# Secret\n\nin plain text", updatedAt: Date.now(), locked: undefined };
        localStorage.setItem(`lines.unsaved.${locked}`, JSON.stringify(unlocked));
      },
      [id, locked],
    );
    await app.page.reload();
    await ready(app.page);
    expect(await bodyOf(app.page, id)).toBe("# Later\n\nedited since");
    expect(await app.page.evaluate((id) => window.testing.notes.get(id)!.note.locked?.title, locked)).toBe("Secret");
    expect(await app.page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lines.unsaved.")))).toEqual([]);
  });
});

test("Enter at the start of an item's text puts an empty item above it, under a paragraph after a blank line", async () => {
  const cases = [
    ["Shopping:\n- ‸milk", "Shopping:\n\n- \n- ‸milk"],
    ["Shopping:\n* ‸milk", "Shopping:\n\n* \n* ‸milk"],
    ["Shopping:\n1. ‸milk\n2. eggs", "Shopping:\n\n1. \n2. ‸milk\n3. eggs"],
    ["> Shopping:\n> - ‸milk", "> Shopping:\n>\n> - \n> - ‸milk"],
    ["- bread\n- [x] ‸milk", "- bread\n- [ ] \n- [x] ‸milk"],
    ["- bread\n  - ‸milk", "- bread\n  - \n  - ‸milk"],
  ];
  for (const [note, after] of cases) {
    await app.open(note.replace("‸", ""));
    await app.page.evaluate((pos) => window.testing.place(pos), note.indexOf("‸"));
    await app.page.keyboard.press("Enter");
    const head = await app.page.evaluate(() => window.testing.editor()!.state.selection.main.head);
    const text = (await app.text())!;
    expect(text.slice(0, head) + "‸" + text.slice(head)).toBe(after);
  }
});

test("Tab and ⇧Tab number a numbered item again, and the items around it", async () => {
  const cases = [
    ["1. a\n2. b‸\n3. c", "Tab", "1. a\n   1. b\n2. c"],
    ["1. a\n   1. b‸\n2. c", "Shift+Tab", "1. a\n2. b\n3. c"],
    ["1. a\n   1. x\n2. b‸\n3. c", "Tab", "1. a\n   1. x\n   2. b\n2. c"],
    ["1. a\n   1. b‸\n   2. c\n2. d", "Shift+Tab", "1. a\n2. b\n   1. c\n3. d"],
    ["1. a\n   1. b‸\n      1. x\n   2. c\n2. d", "Shift+Tab", "1. a\n2. b\n   1. x\n   2. c\n3. d"],
    ["> 1. a\n> 2. b‸\n> 3. c", "Tab", "> 1. a\n>    1. b\n> 2. c"],
    ["1. a\n   1. ‸b", "Backspace", "1. a\n2. b"],
  ];
  for (const [note, key, after] of cases) {
    await app.open(note.replace("‸", ""));
    await app.page.evaluate((pos) => window.testing.place(pos), note.indexOf("‸"));
    await app.page.keyboard.press(key);
    expect(await app.text()).toBe(after);
  }
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
  test("⌘⇧M marks only where a mark follows text, a todo's too: not a code fence, a table's row or the properties", async () => {
    const note = "---\ntype: book\n---\n# Plan\n\n```\ncode\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nText\n\n- [ ] Todo";
    await app.open(note);
    await app.page.evaluate(() => {
      const view = window.testing.editor()!;
      view.focus();
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    });
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    const marked = (await app.text())!.split("\n").filter((line) => line.includes("<!-- mark -->"));
    expect(marked).toEqual(["# Plan <!-- mark -->", "Text <!-- mark -->", "- [ ] Todo <!-- mark -->"]);
    // And again, taken off.
    await app.page.keyboard.press(`${mod()}+Shift+M`);
    expect(await app.text()).toBe(note);
  });

  test("⌘↵ makes a todo only of text: a code line, a table's row and a heading stay as they are", async () => {
    const note = "# Plan\n\n```js\nconst a = 1;\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n> Text\n- [ ] Todo";
    await app.open(note);
    for (const line of ["# Plan", "const a = 1;", "| 1 | 2 |"]) {
      await app.page.evaluate((at) => window.testing.place(at), note.indexOf(line) + 2);
      await app.page.keyboard.press(`${mod()}+Enter`);
      expect(await app.text()).toBe(note);
    }
    for (const line of ["- [ ] Todo", "> Text"]) {
      await app.page.evaluate((at) => window.testing.place(at), note.indexOf(line) + 3);
      await app.page.keyboard.press(`${mod()}+Enter`);
    }
    expect(await app.text()).toBe(note.replace("> Text", "> - [ ] Text").replace("- [ ] Todo", "- [x] Todo"));
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
    const plugins = await app.settings("All Plugins");
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

  test("a note its format can't read is still saved, and listed as plain text", async () => {
    const id = await app.open("# Requests\nGET https://example.com", "hurl");
    await app.page.evaluate(() => {
      window.testing.plugins.language("hurl").meta = () => {
        throw new Error("unreadable");
      };
      const view = window.testing.editor()!;
      view.dispatch({ changes: { from: view.state.doc.length, insert: "\nAccept: text/plain" } });
    });
    await app.page.evaluate(() => window.testing.notes.flush());
    expect(await app.page.evaluate((id) => window.testing.notes.get(id)!.meta.title, id)).toBe("# Requests");
    await app.page.reload();
    await app.page.waitForFunction(() => window.testing?.notes.ready);
    expect(await app.page.evaluate((id) => window.testing.notes.get(id)!.note.body, id)).toBe("# Requests\nGET https://example.com\nAccept: text/plain");
    expect(app.errors.length).toBeGreaterThan(0);
    expect(app.errors.filter((error) => !error.includes("couldn't read a note"))).toEqual([]);
    app.errors.length = 0;
  });

  test("a Python note downloads as .py", async () => {
    expect(await app.page.evaluate(() => window.testing.plugins.language("code-python").extensions[0])).toBe("py");
  });

  test("a tag with combining marks is drawn whole", async () => {
    await app.open(`Notes\n\n#हिंदी and ${"#tiếng_việt".normalize("NFD")}`);
    await app.page.evaluate(() => window.testing.place(0));
    const tags = await app.page.locator(".editor-pane .cm-lp-tag").allTextContents();
    expect(tags.map((tag) => tag.normalize("NFC"))).toEqual(["#हिंदी", "#tiếng_việt"]);
  });

  test("a spreadsheet block's cell with a ``` line in it doesn't end the block", async () => {
    await app.open("```csv\nname,example\nJS,x\n```\n\nAfter the block.");
    await app.page.locator(".cm-sheet [role=gridcell]").nth(3).dblclick();
    await app.page.keyboard.press(`${mod()}+A`);
    await app.page.keyboard.type("Example:");
    // ⌥↩: a line break in the cell.
    for (const line of ["```", "let a = 1", "```"]) {
      await app.page.keyboard.press("Alt+Enter");
      await app.page.keyboard.type(line);
    }
    await app.page.keyboard.press("Enter");
    await app.page.waitForFunction(() => window.testing.text()!.includes("let a = 1"));
    expect(await app.text()).toBe('````csv\nname,example\nJS,"Example:\n```\nlet a = 1\n```"\n````\n\nAfter the block.');
    expect(await app.page.locator(".cm-sheet").count()).toBe(1);
  });

  test("a table with a ``` cell, converted to a spreadsheet, keeps it in the block", async () => {
    await app.open("| Fence |\n| --- |\n| ``` |\n\nAfter the table.");
    await app.page.locator(".editor-pane .cm-lp-table-wrap").hover();
    await app.page.getByRole("button", { name: "Convert to Spreadsheet" }).click();
    expect(await app.text()).toBe("````csv\nFence\n```\n````\n\nAfter the table.");
  });

  test("an edit sync brings in while the note is typed in another window is left for sync to keep too", async () => {
    const id = await app.open("# Shared\n\nfirst");
    // Another window (a floating note, here a tab of its own) with the note open, typing in it.
    const other = await app.page.context().newPage();
    await other.goto(globalThis.lines.url);
    await other.waitForFunction(() => window.testing?.notes.ready);
    await other.evaluate((id) => window.testing.notes.select(id), id);
    await other.waitForFunction(() => window.testing.text() === "# Shared\n\nfirst");
    await other.evaluate(() => window.testing.place());
    await other.keyboard.type(" typed");
    // This window's sync stores an edit from another device, and its sync record.
    await app.page.evaluate(async (id) => {
      const note = window.testing.notes.get(id)!.note;
      await window.testing.notes.applyRemote({ ...note, body: "# Shared\n\nfirst\n\nfrom another device", updatedAt: note.updatedAt + 1 });
      const db = await new Promise<IDBDatabase>((resolve) => (indexedDB.open("lines").onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result)));
      const tx = db.transaction("sync", "readwrite");
      tx.objectStore("sync").put({ id, etag: "synced", hash: "synced" });
      await new Promise((resolve) => (tx.oncomplete = resolve));
    }, id);
    // The typing wins here, as it's stored, and the record goes: sync's next pass takes the note as
    // changed on both sides, keeping the newer edit and the other as a conflicted copy.
    await app.page.waitForFunction((id) => window.testing.notes.get(id)!.note.body === "# Shared\n\nfirst typed", id);
    const record = await app.page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve) => (indexedDB.open("lines").onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result)));
      return new Promise((resolve) => (db.transaction("sync").objectStore("sync").get(id).onsuccess = (event) => resolve((event.target as IDBRequest).result)));
    }, id);
    expect(record).toBeUndefined();
  });
});

test("a nested tag shows as one as soon as its slash is typed, and files under the tag it's in", async () => {
  await app.open("# Plan\n\n");
  await app.page.evaluate(() => window.testing.place());
  await app.page.keyboard.type("#idea/", { delay: 20 });
  const tag = app.page.locator(".editor-pane .cm-lp-tag");
  await tag.waitFor();
  expect(await tag.innerText()).toContain("idea/");
  await app.page.waitForFunction(() => window.testing.notes.entries[0].meta.tags.join() === "idea");
  await app.page.keyboard.type("app");
  await app.page.waitForFunction(() => document.querySelector(".editor-pane .cm-lp-tag")?.textContent?.includes("idea/app"));
});

test("a tag left ending in its slash loses it once the cursor leaves, and undo brings it back", async () => {
  await app.open("# Plan\n\n");
  const page = app.page;
  await page.evaluate(() => window.testing.place());
  await page.keyboard.type("#idea/", { delay: 20 });
  // Still in it: the slash stays.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  expect(await app.text()).toBe("# Plan\n\n#idea/");
  // Moved away: it's gone.
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => window.testing.text() === "# Plan\n\n#idea");
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.text() === "# Plan\n\n#idea/");
  // A space after it is moving on too.
  await page.evaluate(() => window.testing.place());
  await page.keyboard.type(" next");
  await page.waitForFunction(() => window.testing.text() === "# Plan\n\n#idea next");
});

describe("clicking a tag in a note", () => {
  /** Clicks the tag `#idea` in the open note: whether that showed its notes, rather than putting the cursor in it. */
  async function clickTag(app: App, modifiers: ("Meta" | "Control")[] = []) {
    await app.open("# Plan\n\nSee #idea here");
    await app.page.locator(".editor-pane .cm-lp-tag").click({ modifiers });
    await app.page.waitForTimeout(100);
    return app.page.evaluate(() => window.testing.notes.filter.kind === "tag");
  }
  const old = { web: { click: "edit", modClick: "open", modShiftClick: "copy" }, tag: { click: "edit", modClick: "open", modShiftClick: "open" } };

  test("shows its notes; ⌘-click puts the cursor in it", async () => {
    expect(await clickTag(app)).toBe(true);
    await app.close();
    app = await openApp();
    expect(await clickTag(app, [await clickMod(app.page)])).toBe(false);
  });

  test("does so too with settings saved before it did, unless they were changed", async () => {
    await app.close();
    app = await openApp({ prefs: { links: old } });
    expect(await clickTag(app)).toBe(true);
    await app.close();
    app = await openApp({ prefs: { links: { ...old, tag: { click: "edit", modClick: "edit", modShiftClick: "open" } } } });
    expect(await clickTag(app)).toBe(false);
  });
});

test("a score on a Key: Value line or in the properties is drawn as marks, as Little Touches says; the copy buttons can go", async () => {
  await app.open("---\nrating: 3/5\n---\n# Film\n\nScore: 4/7\n\nEnd");
  const page = app.page;
  // The cursor elsewhere, at the end.
  await page.evaluate(() => window.testing.place());
  const score = page.locator(".editor-pane .cm-lp-score[aria-label='4 out of 7']");
  await score.waitFor();
  expect(await score.locator(".cm-lp-score-mark").count()).toBe(7);
  expect(await score.locator(".cm-lp-score-mark.is-filled").count()).toBe(4);
  expect(await score.getAttribute("class")).toContain("cm-lp-score-stars");
  await page.locator(".editor-pane .cm-lp-score[aria-label='3 out of 5']").waitFor();
  expect(await page.locator(".editor-pane .cm-lp-copy").count()).toBe(2);

  // Hearts, then as written, and no copy buttons, from Settings.
  const settings = await app.settings("Little Touches");
  await choose(settings, "Scores", "Hearts");
  await page.locator(".editor-pane .cm-lp-score-hearts[aria-label='4 out of 7']").waitFor();
  await choose(settings, "Scores", "As Written");
  await toggle(settings, "Copy buttons on values", false);
  await app.closeSettings();
  await page.locator(".editor-pane .cm-lp-score").first().waitFor({ state: "detached" });
  expect(await page.locator(".editor-pane .cm-content").innerText()).toContain("Score: 4/7");
  expect(await page.locator(".editor-pane .cm-lp-copy").count()).toBe(0);
});

test("times and words between colons are text, not emoji shortcodes: a duration's 4:47:43, :smile:", async () => {
  app = await openApp();
  await app.open("---\nduration: 4:47:43\n---\n# Talk\n\nAt 1:02:03 and :smile: here");
  const lines = app.page.locator(".editor-pane .cm-line", { hasText: /4:47:43|1:02:03/ });
  await lines.first().waitFor();
  // Nothing between the colons is drawn apart from the rest of the text.
  const apart = await lines.evaluateAll((all) => all.flatMap((line) => [...line.querySelectorAll("span")].map((span) => span.textContent)).filter((text) => /^:\w+:$/.test(text ?? "")));
  expect(apart).toEqual([]);
});

test("Show Markdown: Hidden shows a note's properties without their `---` lines or a key's colon, even with the cursor on them; Live shows them there", async () => {
  const body = "---\nduration: 4:47:43\nstatus: to watch\n---\n# Talk";
  const seen = async (app: App) => {
    // The cursor at the end of `status: to watch`.
    await app.page.evaluate(() => window.testing.place(window.testing.text()!.indexOf("to watch") + 8));
    await app.page.waitForTimeout(100);
    return app.page.locator(".editor-pane .cm-content").evaluate((content) => ({
      fences: [...content.querySelectorAll(".cm-lp-props-fence")].map((line) => line.classList.contains("is-active") || /---/.test(line.textContent ?? "")),
      status: content.querySelector(".cm-line:nth-child(3)")?.textContent?.replace(/\s+/g, " ").trim(),
    }));
  };
  app = await openApp({ prefs: { markdownMode: "hidden" } });
  await app.open(body);
  expect(await seen(app)).toEqual({ fences: [false, false], status: "statusto watch" });
  await app.close();
  app = await openApp({ prefs: { markdownMode: "live" } });
  await app.open(body);
  expect(await seen(app)).toEqual({ fences: [true, true], status: "status: to watch" });
});

describe("properties drawn apart (Settings → Layout → Properties)", () => {
  const NOTE = "---\ntype: person\nfullname: Ada Lovelace\nborn: 1815\n---\n# Ada\n\nShe wrote the first program.\n\nThe end.";
  /** A MacBook's window, the sidebar and the list shown: room for them beside the text, once it's narrowed. */
  const WIDE = 1512;

  /** The app again, with the properties drawn at `place`, in a window `width` wide. */
  async function reopen(place: string, width = 1280) {
    await app.close();
    app = await openApp({ prefs: { propertiesPlace: place }, width });
  }
  const properties = () => app.page.locator(".editor-pane .cm-editor.cm-props");
  /** What the note's own editor shows, without the properties drawn apart. */
  const noteText = () => app.page.locator(".editor-pane .cm-editor:not(.cm-props) > .cm-scroller > .cm-content").first().innerText();
  /** Which editor has the keyboard, and the line of the note the cursor's on. */
  const where = () =>
    app.page.evaluate(() => {
      const editor = document.activeElement?.closest(".cm-editor");
      const { state } = window.testing.editor()!;
      return { in: editor?.classList.contains("cm-props") ? "properties" : editor ? "note" : null, line: state.doc.lineAt(state.selection.main.head).text };
    });
  const place = (at?: number) => app.page.evaluate((at) => window.testing.place(at), at);
  const inProperties = (yes = true) => app.page.waitForFunction((yes) => !!document.activeElement?.closest(".cm-props") === yes, yes);

  test("each place draws them there, as at the top, out of the note's text, which keeps them at its start", async () => {
    for (const [place, width] of [["left", WIDE], ["right", WIDE], ["bottom", 1280]] as const) {
      await reopen(place, width);
      await app.open(NOTE);
      await properties().locator(".cm-lp-prop-key", { hasText: "fullname" }).waitFor();
      const drawn = (await properties().boundingBox())!;
      const text = (await app.page.locator(".editor-pane .cm-line", { hasText: "She wrote" }).boundingBox())!;
      const title = (await app.page.locator(".editor-pane .cm-line", { hasText: "Ada" }).first().boundingBox())!;
      if (place === "left") expect(drawn.x + drawn.width).toBeLessThan(text.x);
      if (place === "right") expect(drawn.x).toBeGreaterThan(text.x + text.width);
      if (place === "bottom") expect(drawn.y).toBeGreaterThan(text.y + text.height);
      if (place !== "bottom") {
        // Level with the text's first line; the two a two-column page, centred, the text narrowed
        // for them (from 640 px) but no narrower than 30 of its ems.
        expect(Math.abs(drawn.y - title.y)).toBeLessThan(4);
        const scroller = (await app.page.locator(".editor-pane .cm-editor:not(.cm-props) > .cm-scroller").first().boundingBox())!;
        const [from, to] = place === "left" ? [drawn.x, text.x + text.width] : [text.x, drawn.x + drawn.width];
        expect(Math.abs(from - scroller.x - (scroller.x + scroller.width - to))).toBeLessThan(2);
        expect(text.width).toBeLessThan(640);
        expect(text.width).toBeGreaterThanOrEqual(30 * 17);
      }
      expect(await properties().locator(".cm-lp-prop-type-icon").count()).toBe(1);
      expect(await noteText()).not.toContain("Lovelace");
      expect(await app.text()).toBe(NOTE);
    }
    await reopen("top");
    await app.open(NOTE);
    expect(await noteText()).toContain("Lovelace");
    expect(await properties().count()).toBe(0);
    // A note without properties has nothing more.
    await reopen("bottom");
    await app.open("# Plain\n\nText");
    expect(await properties().count()).toBe(0);
  });

  test("typed in, they change the note's front matter; the arrows cross as if they were next in line; ⌘Z in either undoes in order", async () => {
    await reopen("bottom");
    await app.open(NOTE);
    const { page } = app;
    await place();
    await page.keyboard.press("ArrowDown");
    expect(await where()).toEqual({ in: "properties", line: "type: person" });
    await page.keyboard.press("End");
    await page.keyboard.type("s");
    expect(await app.text()).toBe(NOTE.replace("person", "persons"));
    // Down among them, and up out of the first onto the text's last line.
    await page.keyboard.press("ArrowDown");
    expect((await where()).line).toBe("fullname: Ada Lovelace");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect(await where()).toEqual({ in: "note", line: "The end." });
    await page.keyboard.type("!");
    expect(await app.text()).toBe(`${NOTE.replace("person", "persons")}!`);

    await page.keyboard.press(`${mod()}+z`);
    expect(await app.text()).toBe(NOTE.replace("person", "persons"));
    expect((await where()).in).toBe("note");
    await page.keyboard.press(`${mod()}+z`);
    expect(await app.text()).toBe(NOTE);
    await inProperties();
    expect(await where()).toEqual({ in: "properties", line: "type: person" });
    await page.keyboard.press(`${mod()}+Shift+z`);
    expect(await app.text()).toBe(NOTE.replace("person", "persons"));
    await page.keyboard.press(`${mod()}+Shift+z`);
    expect(await app.text()).toBe(`${NOTE.replace("person", "persons")}!`);
    await inProperties(false);

    // Backspace at the start of the text doesn't join it to their closing `---`, out of sight.
    await place((await app.text())!.indexOf("# Ada"));
    await page.keyboard.press("Backspace");
    expect(await app.text()).toBe(`${NOTE.replace("person", "persons")}!`);
  });

  test("beside the text, ↑ from its first line goes onto the last property, ↓ from there back; a click in them puts the cursor there, where `@` mentions", async () => {
    await reopen("right", WIDE);
    await app.open("# Charles Babbage\n\nAn engineer.");
    await app.open(NOTE);
    const { page } = app;
    await properties().waitFor();
    await place(NOTE.indexOf("# Ada") + 3);
    await page.keyboard.press("ArrowUp");
    expect(await where()).toEqual({ in: "properties", line: "born: 1815" });
    await page.keyboard.press("ArrowUp");
    expect(await where()).toEqual({ in: "properties", line: "fullname: Ada Lovelace" });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    expect(await where()).toEqual({ in: "note", line: "# Ada" });

    await properties().getByText("Lovelace").click();
    expect((await where()).in).toBe("properties");
    await page.keyboard.type("x");
    expect(await where()).toMatchObject({ in: "properties", line: expect.stringMatching(/^fullname: Ada L\w*x\w*$/) });

    await page.keyboard.press("End");
    await page.keyboard.type(", friend of @Char");
    await page.locator(".cm-tooltip-autocomplete li", { hasText: "Charles Babbage" }).waitFor();
    await page.keyboard.press("Enter");
    expect((await where()).line).toMatch(/^fullname: .*, friend of @\[Charles Babbage\]$/);
    expect(await app.text()).toEndWith("---\n# Ada\n\nShe wrote the first program.\n\nThe end.");
  });

  test("where there's no room beside the text they show at the top, and beside it again once there is", async () => {
    await reopen("left", WIDE);
    await app.open(NOTE);
    await properties().waitFor();
    await app.page.setViewportSize({ width: 1100, height: 820 });
    await properties().waitFor({ state: "detached" });
    expect(await noteText()).toContain("Lovelace");
    await app.page.setViewportSize({ width: WIDE, height: 820 });
    await properties().waitFor();
    expect(await noteText()).not.toContain("Lovelace");
    // A note without them has its text where it always is, centred, as wide as it's chosen.
    await app.open("# Plain\n\nText");
    const scroller = (await app.page.locator(".editor-pane .cm-editor > .cm-scroller").first().boundingBox())!;
    const content = (await app.page.locator(".editor-pane .cm-editor > .cm-scroller > .cm-content").first().boundingBox())!;
    expect(content.width).toBe(720);
    expect(Math.abs(content.x - scroller.x - (scroller.x + scroller.width - content.x - content.width))).toBeLessThan(16);
  });

  test("`/properties` puts them in their place with the cursor in them, and Find reaches them there", async () => {
    await reopen("bottom");
    await app.open("# Title\n\nText");
    const { page } = app;
    await place();
    await page.keyboard.press("Enter");
    await page.keyboard.type("/properties");
    await page.locator(".cm-tooltip-autocomplete").waitFor();
    await page.keyboard.press("Enter");
    await properties().waitFor();
    await inProperties();
    await page.keyboard.type("book");
    expect(await app.text()).toBe("---\ntype: book\n---\n# Title\n\nText\n");

    await place();
    await page.keyboard.press(`${mod()}+F`);
    await page.keyboard.type("book");
    await page.keyboard.press("Enter");
    await properties().locator(".cm-searchMatch-selected", { hasText: "book" }).waitFor();
    // Closed, the cursor is on what was found, in them.
    await page.keyboard.press("Escape");
    await inProperties();
  });

  test("Settings → Layout → Properties, found by searching Settings, is kept, after reloading too", async () => {
    await app.open(NOTE);
    const settings = await app.settings("General");
    await settings.getByRole("searchbox", { name: "Search settings" }).fill("properties");
    await settings.getByRole("list", { name: "Settings found" }).getByRole("button").filter({ hasText: /^Properties\s*Layout$/ }).click();
    await settings.getByRole("heading", { name: "Layout", level: 2 }).waitFor();
    await choose(settings, "Properties", "Bottom");
    await app.closeSettings();
    await properties().waitFor();
    await app.page.reload();
    await app.page.waitForFunction(() => window.testing?.notes.ready);
    expect(await app.page.evaluate(() => window.testing.prefs.propertiesPlace)).toBe("bottom");
  });
});
