import { afterEach, expect, test } from "bun:test";
import { type App, mod, noErrors, openApp } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

test("⌘⇧F puts focus in the search field from focus mode, and from an open note on a phone", async () => {
  for (const width of [1280, 390]) {
    // The list on the right, where it slides in from beyond the window's edge.
    app = await openApp({ width, prefs: { listSide: "right" } });
    await app.open("Some text");
    await app.page.evaluate(() => window.testing.place());
    if (width > 390) {
      await app.page.keyboard.press(`${mod()}+Shift+\\`);
      await app.page.waitForFunction(() => getComputedStyle(document.querySelector("[data-pane=list]")!).visibility === "hidden");
    }
    await app.page.keyboard.press(`${mod()}+Shift+F`);
    const [searching, shifted] = await app.page.evaluate(() => [document.activeElement?.getAttribute("type") === "search", document.querySelector(".app")!.scrollLeft]);
    expect(searching, `${width}`).toBe(true);
    // Nothing scrolled along as the list slides in.
    expect(shifted).toBe(0);
    noErrors(app);
    if (width > 390) await app.close();
  }
});

test("a note's menu is in sections: opening it, what it is and where it's kept, its text, and the Trash", async () => {
  app = await openApp();
  await app.open("# Groceries\n\nmilk");
  await app.open("# Trip\n\nRome");
  const page = app.page;
  await page.locator(".note-list [data-id]").filter({ hasText: "Groceries" }).click({ button: "right" });
  const menu = page.getByRole("menu");
  await menu.waitFor();
  const items = await menu.evaluate((element) =>
    [...element.querySelectorAll('[role="menuitem"], [role="separator"]')].map((item) => (item.getAttribute("role") === "separator" ? "—" : item.textContent!.trim())),
  );
  expect(items).toEqual(["Open to the Side", "Open Below", "—", "Pin to Top", "Icon and Color", "Move to Inbox", "—", "Lock Note", "Copy Text", "—", "Move to Trash"]);
});

test("a row's Trash pressed again while it slides away doesn't start it over; the note goes once", async () => {
  app = await openApp();
  await app.open("# Keep");
  await app.open("# Going");
  const page = app.page;
  const animations = await page.evaluate(() => {
    const row = [...document.querySelectorAll<HTMLElement>(".note-list li")].find((li) => li.textContent?.includes("Going"))!;
    // The action under the row, as a swipe shows it: pressed twice, quickly.
    const trash = [...row.querySelectorAll<HTMLButtonElement>("button[aria-hidden]")].find((button) => button.textContent?.includes("Trash"))!;
    trash.click();
    trash.click();
    return row.getAnimations().length;
  });
  expect(animations).toBe(1);
  await page.waitForFunction(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Going")?.note.trashed);
  expect(await page.locator(".note-list [data-id]").filter({ hasText: "Keep" }).count()).toBe(1);
});
