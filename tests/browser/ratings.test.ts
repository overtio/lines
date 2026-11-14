import { afterEach, expect, test } from "bun:test";
import { type App, mod, noErrors, openApp } from "./app";

/*
 * Ratings in the Library: a note's are its properties, drawn on its kind's scale, set by a click on a
 * mark, from its row's menu or by typing, and what each kind is rated on chosen in Settings →
 * Library → Ratings, which comes in from other devices as library.json does.
 */

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const has = (page: App["page"], text: string) => page.waitForFunction((text) => window.testing.text()?.includes(text), text);
const lacks = (page: App["page"], text: string) => page.waitForFunction((text) => !window.testing.text()?.includes(text), text);
const body = (page: App["page"], title: string) =>
  page.evaluate((title) => window.testing.notes.entries.find((entry) => entry.meta.title === title)?.note.body, title);

/** Chooses `option` in the select labelled `label` (Bits UI's). */
async function select(within: App["page"] | ReturnType<App["page"]["locator"]>, page: App["page"], label: string, option: string) {
  await within.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("a rating's marks set it with a click, as one change ⌘Z takes back, and a click on the one set takes it out", async () => {
  app = await openApp();
  const { page } = app;
  await app.open("---\ntype: book\nauthor: Frank Herbert\nrating: 3.5/5\n---\n# Dune\n\nScore: 2/7\n\nEnd");
  await page.evaluate(() => window.testing.place());
  const half = page.locator(".editor-pane .cm-lp-score[aria-label='3.5 out of 5']");
  await half.waitFor();
  expect(await half.locator(".cm-lp-score-mark.is-filled").count()).toBe(3);
  expect(await half.locator(".cm-lp-score-mark.is-half").count()).toBe(1);

  await half.locator(".cm-lp-score-mark").nth(4).click();
  await has(page, "\nrating: 5/5\n");
  // The cursor stays where it was, so the marks do too.
  const five = page.locator(".editor-pane .cm-lp-score[aria-label='5 out of 5']");
  await five.locator(".cm-lp-score-mark").nth(4).click();
  await lacks(page, "rating:");
  expect(await app.text()).toBe("---\ntype: book\nauthor: Frank Herbert\n---\n# Dune\n\nScore: 2/7\n\nEnd");
  await page.keyboard.press(`${mod()}+z`);
  await has(page, "\nrating: 5/5\n");
  await page.keyboard.press(`${mod()}+z`);
  await has(page, "\nrating: 3.5/5\n");

  // A score on a line of its own: the one set, clicked, is 0.
  const score = page.locator(".editor-pane .cm-lp-score[aria-label='2 out of 7']");
  await score.locator(".cm-lp-score-mark").nth(5).click();
  await has(page, "Score: 6/7");
  await page.locator(".editor-pane .cm-lp-score[aria-label='6 out of 7'] .cm-lp-score-mark").nth(5).click();
  await has(page, "Score: 0/7");
});

test("an item's menu on its shelf rates it, on its kind's scale, and its row shows it", async () => {
  app = await openApp();
  const { page } = app;
  await app.open("---\ntype: book\nauthor: Frank Herbert\nstatus: to read\n---\n# Dune");
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Books/ }).click();
  const row = page.locator(".note-list [data-id]").filter({ hasText: "Dune" });
  const before = await page.evaluate(() => window.testing.notes.visible[0].note.updatedAt);
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rate" }).click();
  await page.getByRole("menuitemcheckbox", { name: "4 out of 5" }).click();
  await page.waitForFunction(() => window.testing.notes.visible[0].note.body.includes("\nrating: 4/5\n---"));
  await row.locator("[aria-label='4 out of 5']").waitFor();
  // It keeps its date, so its place in the list.
  expect(await page.evaluate(() => window.testing.notes.visible[0].note.updatedAt)).toBe(before);

  // By keyboard: → opens Rate's menu, the one set checked, and ↵ chooses. (The pointer out of the way, where it'd point at a choice.)
  await row.click({ button: "right" });
  await page.mouse.move(0, 0);
  await page.getByRole("menuitem", { name: "Rate" }).focus();
  await page.keyboard.press("ArrowRight");
  const set = page.getByRole("menuitemcheckbox", { name: "4 out of 5" });
  await set.waitFor();
  expect(await set.getAttribute("aria-checked")).toBe("true");
  const focused = (name: string) => page.waitForFunction((name) => document.activeElement?.textContent?.trim() === name, name);
  await focused("5 out of 5");
  // ↓ down past the scores, the line between skipped.
  for (let i = 0; i < 8 && (await page.evaluate(() => document.activeElement?.textContent?.trim())) !== "Remove Rating"; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(50);
  }
  await focused("Remove Rating");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !window.testing.notes.visible[0].note.body.includes("rating:"));
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => window.testing.notes.visible[0].note.body.includes("\nrating: 4/5\n"));
});

test("Settings → Library → Ratings: a kind's scale and its named ratings, renamed in its notes; a scale of words of your own", async () => {
  app = await openApp();
  const { page } = app;
  await app.open("---\ntype: movie\nrating: great\n---\n# Arrival");
  await app.open("---\ntype: show\nrating: 4/5\n---\n# Severance");
  await app.open("---\ntype: show\nrating: 8/10\nstory: 7/10\n---\n# Frieren");
  await page.evaluate(() => window.testing.place());
  // Out of 5, a show's scale until another is chosen: as written.
  await page.locator(".editor-pane .cm-lp-kv-value", { hasText: "8/10" }).waitFor();

  const settings = await app.settings("Library");
  await select(settings, page, "Show scale", "Out of 10");
  // Nothing is rewritten: what doesn't fit shows as written, and Settings says so.
  const shows = settings.locator("[data-setting]").filter({ has: page.getByRole("combobox", { name: "Show scale" }) });
  await shows.getByText("1 note’s rating doesn’t fit this scale, and shows as written.").waitFor();
  expect(await body(page, "Severance")).toContain("\nrating: 4/5\n");

  await settings.getByRole("button", { name: "Show ratings" }).click();
  await settings.getByRole("textbox", { name: "New rating" }).fill("Story");
  await settings.getByRole("button", { name: "Add", exact: true }).click();
  await settings.getByText("Also rated for Story.").waitFor();
  const story = settings.getByRole("textbox", { name: "Rating 1" });
  await story.fill("Plot");
  await story.press("Enter");
  await page.waitForFunction(() => window.testing.notes.entries.some((entry) => entry.note.body.includes("\nplot: 7/10\n")));
  // Not a property the kind's notes have already.
  await settings.getByRole("textbox", { name: "New rating" }).fill("Status");
  await settings.getByRole("button", { name: "Add", exact: true }).click();
  await settings.getByText("“Status” is a property these notes have already.").waitFor();

  await settings.getByRole("button", { name: "New Scale" }).click();
  await settings.getByRole("textbox", { name: "Scale’s name" }).fill("Vibes");
  await settings.getByRole("radio", { name: "Words" }).click();
  await settings.getByRole("textbox", { name: "Words" }).fill("Masterpiece, Great, Meh");
  await settings.getByRole("button", { name: "Save" }).click();
  await settings.getByText("Words: Masterpiece, Great, Meh").waitFor();
  await select(settings, page, "Movie scale", "Vibes");
  // A scale in use isn't removed.
  expect(await settings.getByRole("button", { name: "Remove Vibes" }).isDisabled()).toBe(true);
  await app.closeSettings();

  // Both of Frieren's on its scale, as points.
  await page.locator(".editor-pane .cm-lp-score-points[aria-label='7 out of 10']").waitFor();
  await page.evaluate(() => window.testing.notes.select(window.testing.notes.entries.find((entry) => entry.meta.title === "Arrival")!.note.id));
  await page.waitForFunction(() => window.testing.text()?.includes("Arrival"));
  await page.evaluate(() => window.testing.place());
  // A word is a chip, which offers the scale's others.
  const word = page.locator(".editor-pane .cm-lp-score-label", { hasText: "Great" });
  await word.click();
  await page.getByRole("menuitemcheckbox", { name: "Masterpiece" }).click();
  await has(page, "\nrating: Masterpiece\n");
});

test("in a library note's properties, a key typed offers the kind's ratings, and then its scale's values", async () => {
  app = await openApp();
  const { page } = app;
  await page.evaluate(() => window.testing.looks.setRatings({ kinds: { show: { scale: { id: "10", at: 1 }, named: { names: ["Story"], at: 1 } } }, scales: {} }));
  await app.open("---\ntype: show\n---\n# Frieren");
  await page.evaluate(() => window.testing.place("---\ntype: show".length));
  await page.keyboard.press("Enter");
  await page.keyboard.type("st");
  await page.getByRole("option", { name: /^story/ }).waitFor();
  await page.keyboard.press("Enter");
  await has(page, "\nstory: \n");
  await page.getByRole("option", { name: /^10\/10/ }).waitFor();
  await page.keyboard.type("8");
  await page.waitForFunction(() => document.querySelectorAll("[role=option]").length === 1);
  expect(await page.getByRole("option").innerText()).toBe("8/10");
  await page.keyboard.press("Enter");
  await has(page, "\nstory: 8/10\n");
});

test("what kinds are rated on comes in from other devices' library.json, and from Settings in another window, and notes are drawn again", async () => {
  app = await openApp();
  const { page } = app;
  await app.open("---\ntype: book\nrating: A\n---\n# Dune\n\nEnd");
  await page.evaluate(() => window.testing.place());
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.waitForFunction(() => window.testing?.notes.ready);

  // Another device chose grades for books since.
  await page.evaluate(() => window.testing.looks.merge(window.testing.readLooks(JSON.stringify({ ratings: { kinds: { book: { scale: { id: "grades", at: Date.now() } } } } }))));
  await page.locator(".editor-pane .cm-lp-score-label", { hasText: "A" }).waitFor();
  // The other window has it at once.
  await other.waitForFunction(() => window.testing.looks.looks.ratings.kinds.book?.scale?.id === "grades");

  // Chosen in the other window: thumbs, which A isn't on, so it's as written.
  await other.evaluate(() => window.testing.looks.setRatings({ ...window.testing.looks.looks.ratings, kinds: { book: { scale: { id: "thumbs", at: Date.now() } } } }));
  await page.locator(".editor-pane .cm-lp-score-label").waitFor({ state: "detached" });
  expect(await page.locator(".editor-pane .cm-content").innerText()).toContain("A");
  await app.open("---\ntype: book\nrating: thumbs up\n---\n# Dune Messiah\n\nEnd");
  await page.evaluate(() => window.testing.place());
  await page.locator(".editor-pane .cm-lp-score-icons[aria-label='Thumbs Up']").waitFor();
  await other.close();
});
