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
