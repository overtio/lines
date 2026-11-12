import { afterEach, expect, test } from "bun:test";
import { type App, mod, noErrors, openApp } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** The pane focus is in, if any. */
const focused = () =>
  app.page.evaluate(() => {
    const pane = document.activeElement?.closest("[data-pane], .editor-pane");
    return pane ? (pane.getAttribute("data-pane") ?? "editor") : null;
  });

test("F6 goes only through the panes showing: past a hidden sidebar, and nowhere in focus mode", async () => {
  app = await openApp();
  await app.open("Some text");
  await app.page.keyboard.press(`${mod()}+\\`);
  // Once the sidebar has slid away.
  await app.page.waitForFunction(() => getComputedStyle(document.querySelector("[data-pane=sidebar]")!).visibility === "hidden");
  await app.page.evaluate(() => window.testing.place());
  const visited = [];
  for (const key of ["F6", "F6", "Shift+F6"]) {
    await app.page.keyboard.press(key);
    visited.push(await focused());
  }
  expect(visited).toEqual(["list", "editor", "list"]);
  await app.page.keyboard.press(`${mod()}+Shift+\\`);
  await app.page.waitForFunction(() => getComputedStyle(document.querySelector("[data-pane=list]")!).visibility === "hidden");
  await app.page.evaluate(() => window.testing.place());
  await app.page.keyboard.press("F6");
  expect(await focused()).toBe("editor");
});

test("the sidebar drawer closed by a click beside it gives focus back to what had it", async () => {
  app = await openApp({ width: 850 });
  await app.open("Some text");
  const drawer = async (open: () => Promise<void>) => {
    await open();
    await app.page.waitForFunction(() => document.querySelector("[data-pane=sidebar]")?.contains(document.activeElement));
    await app.page.getByRole("button", { name: "Close sidebar" }).click({ position: { x: 700, y: 400 } });
  };
  await drawer(async () => {
    await app.page.evaluate(() => window.testing.place());
    await app.page.keyboard.press(`${mod()}+\\`);
  });
  await app.page.waitForFunction(() => document.activeElement?.classList.contains("cm-content"), null, { timeout: 2000 });
  // Opened by a click, on the button that opens it (which in Safari a click doesn't focus).
  await drawer(() => app.page.locator(".sidebar-toggle").first().click());
  await app.page.waitForFunction(() => document.activeElement?.classList.contains("sidebar-toggle"), null, { timeout: 2000 });
});

test("notes open in panes below and beside, as deep as wanted: one on top, two at the bottom", async () => {
  app = await openApp({ height: 900 });
  await app.open("# Bottom right");
  await app.open("# Bottom left");
  await app.open("# Top\n\n");
  const page = app.page;
  const row = (title: string) => page.locator(".note-list [data-id]").filter({ hasText: title });
  // Typed in the open note, to undo after the panes are made.
  await page.evaluate(() => window.testing.place());
  await page.keyboard.type("kept");

  await row("Bottom left").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open Below" }).click();
  const left = page.getByRole("region", { name: /Bottom left/ });
  await left.waitFor();
  // Used last, its pane is where the next opens beside.
  await left.locator(".cm-content").click();
  await row("Bottom right").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open to the Side" }).click();
  const right = page.getByRole("region", { name: /Bottom right/ });
  await right.waitFor();

  const [top, a, b] = await Promise.all([page.locator(".editor-pane .toolbar").first().boundingBox(), left.boundingBox(), right.boundingBox()]);
  expect(a!.y).toBeGreaterThan(top!.y + 100);
  expect(Math.round(a!.y)).toBe(Math.round(b!.y));
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 2);

  // The open note's editor stayed as it was: its typing still undoes.
  await page.evaluate(() => window.testing.place());
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => !window.testing.text()?.includes("kept"));

  // The line between the bottom two moves by keyboard; Enter shares the room again.
  const line = page.getByRole("separator", { name: "Size of the panes" }).last();
  await line.focus();
  await page.keyboard.press("Shift+ArrowRight");
  expect(Number(await line.getAttribute("aria-valuenow"))).toBeGreaterThan(55);
  await page.keyboard.press("Enter");
  expect(await line.getAttribute("aria-valuenow")).toBe("50");

  // Closed, the other bottom pane takes its room.
  await right.getByRole("button", { name: "Close this note" }).click();
  await right.waitFor({ state: "detached" });
  expect((await left.boundingBox())!.width).toBeGreaterThan(a!.width * 1.8);
});

test("a note dragged from the list opens where it's dropped: beside a pane near its edge, in its place in its middle", async () => {
  app = await openApp({ height: 900 });
  await app.open("# Second");
  await app.open("# Third");
  await app.open("# First");
  const page = app.page;
  const row = (title: string) => page.locator(".note-list [data-id]").filter({ hasText: title });
  const at = (await page.locator("[data-pane-place='main']").boundingBox())!;

  // Near the open note's bottom edge, it opens below it; where it'd go shows on the way.
  await row("Second").hover();
  await page.mouse.down();
  await page.mouse.move(at.x + at.width / 2, at.y + at.height - 30, { steps: 8 });
  await page.locator("[data-pane-place='main'] > [aria-hidden].inset-x-1.bottom-1").waitFor();
  await page.mouse.up();
  const second = page.getByRole("region", { name: /Second/ });
  await second.waitFor();
  expect((await second.boundingBox())!.y).toBeGreaterThan(at.y + at.height / 3);

  // In the middle of a pane, it takes its place.
  const target = (await second.boundingBox())!;
  await row("Third").hover();
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("region", { name: /Third/ }).waitFor();
  expect(await page.getByRole("region", { name: /Second/ }).count()).toBe(0);
});

test("a note dragged as the Mac app follows it shows a card of it by the pointer, over a cover nothing under takes the pointer from, and drops on a tag or into a pane", async () => {
  app = await openApp({ height: 900 });
  await app.open("# Plan\n\n#work");
  await app.open("# Ada");
  await app.open("# First");
  const page = app.page;
  /** Follows the pointer to the middle of `box`, as NoteRow.svelte does in the Mac app, dragging note `title`, and lets go there. */
  const drag = (title: string, box: { x: number; y: number; width: number; height: number }, fy = 0.5) =>
    page.evaluate(
      async ({ title, x, y }) => {
        const { notes, panes } = window.testing;
        panes.startDrag("note", notes.entries.find((entry) => entry.meta.title === title)!.note.id);
        panes.follow(x - 40, y);
        await new Promise(requestAnimationFrame);
        // Moved on with the cover over the window: what's under it is still found.
        panes.follow(x, y);
        await new Promise(requestAnimationFrame);
        const cover = document.querySelector<HTMLElement>("[data-drag-cover]");
        const label = cover?.querySelector(".truncate")?.textContent?.trim();
        const covered = document.elementFromPoint(x, y) === cover && getComputedStyle(cover!).cursor === "default";
        const at = panes.rowAt ?? panes.dropAt?.zone ?? null;
        panes.drop();
        return { label, covered, at };
      },
      { title, x: box.x + box.width / 2, y: box.y + box.height * fy },
    );

  const work = (await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^work/ }).boundingBox())!;
  expect(await drag("Ada", work)).toEqual({ label: "Ada", covered: true, at: "tag:work" });
  await page.waitForFunction(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Ada")!.meta.tags.includes("work"));

  const main = (await page.locator("[data-pane-place='main']").boundingBox())!;
  expect(await drag("Plan", main, 0.95)).toEqual({ label: "Plan", covered: true, at: "down" });
  await page.getByRole("region", { name: /Plan/ }).waitFor();
  // Let go, the card and the cover are gone.
  expect(await page.locator("[data-drag-cover]").count()).toBe(0);
});

test("a file dragged over where nothing takes it is dropped nowhere, not opened in lines' place; the editor still takes it", async () => {
  app = await openApp();
  await app.open("# Some text");
  /** Whether a file dragged over `selector` is handled by the page (not left to the browser, which opens it). */
  const over = (selector: string) =>
    app.page.evaluate((selector) => {
      const data = new DataTransfer();
      data.items.add(new File(["# Tasks"], "Tasks.md", { type: "text/markdown" }));
      const event = new DragEvent("dragover", { dataTransfer: data, bubbles: true, cancelable: true });
      document.querySelector(selector)!.dispatchEvent(event);
      return event.defaultPrevented;
    }, selector);
  expect(await over(".note-list [data-id]")).toBe(true);
  expect(await over("[data-pane=sidebar]")).toBe(true);
  expect(await over(".cm-scroller")).toBe(true);
  expect(await over(".cm-content")).toBe(true);
});

test("a pane dragged by its grip moves beside another, or into its place; Esc stops it", async () => {
  app = await openApp({ height: 900 });
  await app.open("# Second");
  await app.open("# First");
  const page = app.page;
  await page.locator(".note-list [data-id]").filter({ hasText: "Second" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open Below" }).click();
  const second = page.getByRole("region", { name: /Second/ });
  await second.waitFor();
  const main = page.locator("[data-pane-place='main']");

  /** Drags Second's pane by its grip to (x, y) in the open note's pane, as fractions of it. */
  async function dragGrip(x: number, y: number, cancel = false) {
    const [handle, at] = [(await second.getByRole("button", { name: "Drag to move this note" }).boundingBox())!, (await main.boundingBox())!];
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width * x, at.y + at.height * y, { steps: 8 });
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
  }
  const leftOfMain = () =>
    page.evaluate(() => document.querySelector("section[aria-label='Beside: Second']")!.getBoundingClientRect().right <= document.querySelector("[data-pane-place='main']")!.getBoundingClientRect().left + 2);

  // Esc on the way: nothing moves.
  await dragGrip(0.03, 0.5, true);
  expect(await leftOfMain()).toBe(false);
  // To the open note's left edge: it moves there.
  await dragGrip(0.03, 0.5);
  await page.waitForFunction(() => document.querySelector("section[aria-label='Beside: Second']")!.getBoundingClientRect().right <= document.querySelector("[data-pane-place='main']")!.getBoundingClientRect().left + 2);
  // Into the open note's place: they swap.
  await dragGrip(0.5, 0.5);
  await page.waitForFunction(() => window.testing.text()?.startsWith("# Second"));
  await page.getByRole("region", { name: /First/ }).waitFor();
});

test("Swap exchanges a note below with the open one: each shows in the other's pane, both editable", async () => {
  app = await openApp({ height: 900 });
  await app.open("# Hello\n\nworld");
  await app.open("# Lines\n\nSimple.");
  const page = app.page;
  await page.locator(".note-list [data-id]").filter({ hasText: "Hello" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open Below" }).click();
  await page.getByRole("region", { name: /Hello/ }).getByRole("button", { name: "Swap the two notes" }).click();
  const below = page.getByRole("region", { name: /Lines/ });
  await below.waitFor();
  await page.waitForFunction(() => window.testing.text() === "# Hello\n\nworld");
  expect(await below.locator(".cm-content").innerText()).toContain("Simple.");
  // And back again.
  await below.getByRole("button", { name: "Swap the two notes" }).click();
  await page.getByRole("region", { name: /Hello/ }).waitFor();
  await page.waitForFunction(() => window.testing.text() === "# Lines\n\nSimple.");
});
