import { afterEach, expect, test } from "bun:test";
import { type App, mod, noErrors, openApp, toggle } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/**
 * A day as `YYYY-MM-DD`, `months` and then `days` from today, as Page Down and → move: in the page,
 * whose time zone may not be this process's.
 */
const dayIn = (app: App, days = 0, months = 0) =>
  app.page.evaluate(
    ([days, months]) => {
      const date = new Date();
      const wanted = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + months);
      date.setDate(Math.min(wanted, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    },
    [days, months] as const,
  );

/**
 * Types a new event's title where it is, as making one asks for, and Enter; the note's text then.
 * It isn't opened: the Calendar stays.
 */
async function nameNew(app: App, title: string) {
  const field = app.page.getByRole("textbox", { name: "Event name" });
  await app.page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Event name");
  expect(await field.inputValue()).toBe("");
  await field.pressSequentially(title);
  await field.press("Enter");
  await field.waitFor({ state: "detached" });
  expect(await app.page.getByRole("button", { name: "Back to Calendar" }).count()).toBe(0);
  return app.page.evaluate((title) => window.testing.notes.entries.find((entry) => entry.meta.title === title)?.note.body, title);
}

/** The note list's rows, as their text reads. */
const listed = async (app: App) => (await app.page.locator(".note-list [data-id]").allInnerTexts()).join("\n");

test("the Calendar lists the notes on the day chosen, moves by keyboard, and makes a note on a day", async () => {
  app = await openApp();
  const day = (days = 0, months = 0) => dayIn(app, days, months);
  await app.open(`---\ndate: ${await day()}\n---\n# Dated today`);
  await app.open(`---\nstart: ${await day(0, 1)}\nend: ${await day(0, 1)}\n---\n# Next month`);
  await app.open("# Undated");

  const page = app.page;
  // Its row counts what's on today: the note dated today, not next month's or the undated one.
  const calendar = page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" });
  await page.waitForFunction(() => /Calendar\s*1$/.test(document.querySelector<HTMLElement>("[data-reorder='places'][data-reorder-key='calendar']")?.innerText ?? ""));
  await calendar.click();
  const grid = page.getByRole("grid");
  const today = grid.locator(`[data-day="${await day()}"]`);
  await expect(today.getAttribute("aria-current")).resolves.toBe("date");
  await expect(today.getAttribute("aria-label")).resolves.toEndWith(", 1 note");
  expect(await listed(app)).toContain("Dated today");
  expect(await listed(app)).not.toContain("Undated");

  // Page Down goes to the same day next month, and focus goes with it.
  await today.focus();
  await page.keyboard.press("PageDown");
  await page.waitForFunction((next) => document.activeElement?.getAttribute("data-day") === next, await day(0, 1));
  expect(await listed(app)).toContain("Next month");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction((next) => document.activeElement?.getAttribute("data-day") === next, await day(1, 1));
  await page.getByText(/^Nothing on /).waitFor();

  // ↵ makes a note dated that day.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.testing.text()?.startsWith("---\ndate: "));
  expect(await app.text()).toBe(`---\ndate: ${await day(1, 1)}\n---\n# `);
});

test("notes made or edited that day show once Settings asks for them", async () => {
  app = await openApp();
  await app.open("# Undated");
  await app.page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  expect(await listed(app)).not.toContain("Undated");
  const settings = await app.settings("General");
  await toggle(settings, "Notes made or edited that day", true);
  await app.closeSettings();
  expect(await listed(app)).toContain("Undated");
});

test("the week and the day show notes at their times, open them, and make one at an hour", async () => {
  app = await openApp();
  const day = (days = 0) => dayIn(app, days);
  await app.open(`---\ndate: ${await day()} 10:00\n---\n# Review`);
  await app.open(`---\ndate: ${await day()}\n---\n# All of today`);
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();

  // In the week, at its time, the whole day's note above the hours.
  const review = page.getByRole("button", { name: /^Review, 10:00/ });
  expect(await review.evaluate((block) => block.parentElement!.style.top)).toBe(`${10 * 48}px`);
  await page.getByRole("list", { name: /^All day, / }).getByRole("button", { name: "All of today" }).waitFor();

  // Opened in its place, and back again.
  await review.click();
  await page.waitForFunction(() => window.testing.text()?.endsWith("# Review"));
  await page.getByRole("button", { name: "Back to Calendar" }).click();
  await review.waitFor();

  // The day alone, and a double-click at 2 PM makes an event an hour long then.
  await page.getByRole("radio", { name: "Day" }).click();
  await page.getByRole("heading", { level: 2 }).filter({ hasText: /, \d{4}$/ }).waitFor();
  await page.locator(".hours").first().dblclick({ position: { x: 40, y: 14 * 48 + 10 } });
  expect(await nameNew(app, "Call")).toBe(`---\ntype: event\nstart: ${await day()} 14:00\nend: ${await day()} 15:00\n---\n# Call`);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lines.prefs")!).calendarView)).toBe("day");
});

/** Drags with the mouse in a day's column of the hours, from one time to another (in minutes), and on to `toDay`'s column. */
async function dragIn(app: App, on: string, from: number, to: number, toDay = on) {
  const page = app.page;
  // Morning in view, wherever the hours were scrolled to.
  await page.evaluate(() => (document.querySelector("[data-column]")!.parentElement!.parentElement!.scrollTop = 7 * 48));
  const [a, b] = [await page.locator(`[data-column="${on}"]`).boundingBox(), await page.locator(`[data-column="${toDay}"]`).boundingBox()];
  await page.mouse.move(a!.x + a!.width / 2, a!.y + (from / 60) * 48);
  await page.mouse.down();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + ((from + to) / 2 / 60) * 48, { steps: 4 });
  await page.mouse.move(b!.x + b!.width / 2, b!.y + (to / 60) * 48, { steps: 4 });
  await page.mouse.up();
}

test("dragging down the hours makes an event; dragging a note moves it, and ⌘Z moves it back", async () => {
  app = await openApp({ prefs: { calendarView: "week", weekStart: "monday" } });
  const page = app.page;
  const day = (days = 0) => dayIn(app, days);
  // A day in the middle of this week, and the next, so both are in it.
  const weekday = await page.evaluate(() => (new Date().getDay() + 6) % 7);
  const [wed, thu] = [await day(2 - weekday), await day(3 - weekday)];
  await app.open(`---\ndate: ${wed} 09:00\n---\n# Standup`);
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();

  // From 10:00 to 11:30 on Wednesday.
  await dragIn(app, wed, 10 * 60 + 5, 11 * 60 + 30);
  expect(await nameNew(app, "Planning")).toBe(`---\ntype: event\nstart: ${wed} 10:00\nend: ${wed} 11:30\n---\n# Planning`);

  // Standup, from 9:00 on Wednesday to 13:00 on Thursday, still an hour long; it doesn't open.
  await dragIn(app, wed, 9 * 60 + 20, 13 * 60 + 20, thu);
  const standup = page.getByRole("button", { name: /^Standup, 1:00/ });
  await standup.waitFor();
  expect(await page.getByRole("button", { name: "Back to Calendar" }).count()).toBe(0);
  expect(await standup.evaluate((block) => block.closest("[data-column]")!.getAttribute("data-column"))).toBe(thu);

  // Back to Wednesday at 9.
  await page.keyboard.press(`${mod()}+z`);
  await page.getByRole("button", { name: /^Standup, 9:00/ }).waitFor();
});

test("All day makes events of whole days: a double-click for one, dragging across for several; Esc stops a drag", async () => {
  app = await openApp();
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  const cells = page.locator("[data-all-day]");
  await cells.first().waitFor();
  const days = await cells.evaluateAll((all) => all.map((cell) => cell.getAttribute("data-all-day")!));
  const box = async (i: number) => (await cells.nth(i).boundingBox())!;

  // A double-click on a day's cell: an event that day.
  const third = await box(2);
  await page.mouse.dblclick(third.x + third.width / 2, third.y + third.height - 4);
  expect(await nameNew(app, "Holiday")).toBe(`---\ntype: event\ndate: ${days[2]}\n---\n# Holiday`);

  // Dragging from the fifth day back to the second: those four days, the new event shown across them as it goes.
  const [from, to] = [await box(4), await box(1)];
  await page.mouse.move(from.x + from.width / 2, from.y + from.height - 4);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 8 });
  expect(await page.locator("[data-all-day] li[aria-hidden]").count()).toBe(4);
  await page.mouse.up();
  expect(await nameNew(app, "Trip")).toBe(`---\ntype: event\nstart: ${days[1]}\nend: ${days[4]}\n---\n# Trip`);

  // Esc, mid-drag, makes nothing.
  const count = await page.evaluate(() => window.testing.notes.entries.length);
  const [a, b] = [await box(0), await box(3)];
  await page.mouse.move(a.x + a.width / 2, a.y + a.height - 4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 4, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await page.locator("[data-all-day] li[aria-hidden]").count()).toBe(0);
  expect(await page.evaluate(() => window.testing.notes.entries.length)).toBe(count);
});

test("an event's menu renames it in place, gives it a color, and moves it to the Trash", async () => {
  app = await openApp();
  const day = await dayIn(app);
  const id = await app.page.evaluate(async (day) => {
    await window.testing.open(`---\ntype: event\ndate: ${day} 10:00\n---\n# Review\n\nNotes`);
    return window.testing.notes.selectedId!;
  }, day);
  await app.page.evaluate((day) => window.testing.open(`---\ndate: ${day}\n---\n`), day);
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  const body = () => page.evaluate((id) => window.testing.notes.get(id)!.note.body, id);

  // Rename: a field over its title; Enter keeps the name, as its heading.
  const review = page.getByRole("button", { name: /^Review, 10:00/ });
  await review.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const field = page.getByRole("textbox", { name: "Event name" });
  await field.fill("Design review");
  await field.press("Enter");
  await page.getByRole("button", { name: /^Design review, 10:00/ }).waitFor();
  // Focus is back on the event, not lost.
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  expect(await focused()).toStartWith("Design review, 10:00");
  expect(await body()).toBe(`---\ntype: event\ndate: ${day} 10:00\n---\n# Design review\n\nNotes`);

  // Esc leaves it as it was.
  await page.getByRole("button", { name: /^Design review, 10:00/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await field.fill("Nope");
  await field.press("Escape");
  await field.waitFor({ state: "detached" });
  expect(await body()).toContain("# Design review\n");
  expect(await focused()).toStartWith("Design review, 10:00");

  // An untitled whole day's note gets a heading after its properties.
  const untitled = page.getByRole("list", { name: /^All day, / }).getByRole("button", { name: "Untitled" });
  await untitled.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await field.fill("Holiday");
  await field.press("Enter");
  await page.getByRole("list", { name: /^All day, / }).getByRole("button", { name: "Holiday" }).waitFor();

  // Icon and Color: orange, on the event.
  const event = page.getByRole("button", { name: /^Design review, 10:00/ });
  await event.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  await page.getByRole("dialog", { name: "Icon for Design review" }).getByRole("radio", { name: "Orange" }).click();
  expect(await page.evaluate((id) => window.testing.notes.get(id)!.note.color, id)).toBe("orange");
  await page.keyboard.press("Escape");

  // Move to Trash: gone from the week.
  await event.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await event.waitFor({ state: "detached" });
  expect(await page.evaluate((id) => window.testing.notes.get(id)!.note.trashed, id)).toBe(true);
});

test("Open to the Side on the Calendar opens the note beside the week, from the list or from the event", async () => {
  app = await openApp();
  const day = await dayIn(app);
  await app.open(`---\ndate: ${day} 10:00\n---\n# Review`);
  await app.open(`---\ndate: ${day} 14:00\n---\n# Retro`);
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  const week = page.getByRole("button", { name: /^Review, 10:00/ });
  await week.waitFor();

  // From the list: the week stays, the note beside it.
  await page.locator(".note-list [data-id]").filter({ hasText: "Review" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open to the Side" }).click();
  await page.getByRole("region", { name: /Review/ }).waitFor();
  expect(await week.isVisible()).toBe(true);

  // From the event, below the week: too narrow now for another beside it, it isn't offered.
  await page.getByRole("button", { name: /^Retro, 2:00/ }).click({ button: "right" });
  expect(await page.getByRole("menuitem", { name: "Open to the Side" }).count()).toBe(0);
  await page.getByRole("menuitem", { name: "Open Below" }).click();
  await page.getByRole("region", { name: /Retro/ }).waitFor();
  expect(await week.isVisible()).toBe(true);
  expect(await page.getByRole("region", { name: /Review/ }).count()).toBe(1);

  // Beside the week, there's no other note to swap with: it opens in the week's place, and Back to Calendar goes back.
  expect(await page.getByRole("button", { name: "Swap the two notes" }).count()).toBe(0);
  await page.getByRole("region", { name: /Retro/ }).getByRole("button", { name: "Open in Place of the Calendar" }).click();
  await page.waitForFunction(() => window.testing.text()?.endsWith("# Retro"));
  expect(await page.getByRole("region", { name: /Retro/ }).count()).toBe(0);
  expect(await page.getByRole("region", { name: /Review/ }).count()).toBe(1);
  await page.getByRole("button", { name: "Back to Calendar" }).click();
  await week.waitFor();
});

test("an event shows the note's icon before its title, or its type's, and none without one", async () => {
  app = await openApp();
  const day = await dayIn(app);
  await app.open(`---\ntype: meeting\ndate: ${day} 10:00\n---\n# Standup`);
  await app.open(`---\ndate: ${day} 14:00\n---\n# Retro`);
  await app.open(`---\ndate: ${day}\n---\n# Holiday`);
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  const icons = (name: RegExp) => page.getByRole("button", { name }).first().locator(".icon").count();
  await page.getByRole("button", { name: /^Standup, 10:00/ }).waitFor();
  expect(await icons(/^Standup, 10:00/)).toBe(1);
  expect(await icons(/^Retro, 2:00/)).toBe(0);

  // Given one of its own, the whole day's note shows it too.
  const id = await page.evaluate(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Holiday")!.note.id);
  await page.evaluate((id) => window.testing.notes.setIcon(id, "tree-palm"), id);
  await page.getByRole("list", { name: /^All day, / }).getByRole("button", { name: "Holiday" }).locator(".icon").waitFor();
});

test("stretching an event shows just it, at its new length, solid; let go, it's that long", async () => {
  app = await openApp({ prefs: { calendarView: "day" } });
  const day = await dayIn(app);
  await app.open(`---\nstart: ${day} 09:00\nend: ${day} 10:00\n---\n# Review`);
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  await page.evaluate(() => (document.querySelector("[data-column]")!.parentElement!.parentElement!.scrollTop = 7 * 48));
  const block = (await page.getByRole("button", { name: /^Review, 9:00/ }).boundingBox())!;
  // Its bottom edge, down to 11:00.
  await page.mouse.move(block.x + block.width / 2, block.y + block.height - 2);
  await page.mouse.down();
  await page.mouse.move(block.x + block.width / 2, block.y + block.height + 48, { steps: 6 });
  const preview = page.locator("[data-column] > div[aria-hidden]").filter({ hasText: "Review" });
  expect(await preview.innerText()).toContain("9:00 – 11:00");
  // No see-through background, so the event's own title and time don't show through.
  const background = await preview.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toMatch(/\/ 0?\.\d|rgba\(.*, 0?\.\d+\)/);
  // The event as it was is gone while it's stretched: one event, not two.
  await page.waitForFunction(() => {
    const original = [...document.querySelectorAll<HTMLElement>("[data-column] li")].find((li) => li.innerText.includes("Review"));
    return original && getComputedStyle(original).opacity === "0";
  });
  await page.mouse.up();
  await page.getByRole("button", { name: /^Review, 9:00 – 11:00/ }).waitFor();
});

test("a new event left without a title is gone: Esc, or Enter with none", async () => {
  app = await openApp({ prefs: { calendarView: "day" } });
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  const count = () => page.evaluate(() => window.testing.notes.entries.length);
  const field = page.getByRole("textbox", { name: "Event name" });
  for (const key of ["Escape", "Enter"]) {
    await page.locator(".hours").first().dblclick({ position: { x: 40, y: 14 * 48 + 10 } });
    await field.waitFor();
    expect(await count()).toBe(1);
    await field.press(key);
    await page.waitForFunction(() => window.testing.notes.entries.length === 0);
  }
});

test("the week's dates and controls are in the note's toolbar, at the top; with tabs there, over the week", async () => {
  for (const tabs of [false, true]) {
    app = await openApp({ prefs: { tabs } });
    await app.page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
    const inToolbar = await app.page.locator("#calendar-range").evaluate((heading) => !!heading.closest(".toolbar"));
    expect(inToolbar).toBe(!tabs);
    await app.page.getByRole("radio", { name: "Week" }).waitFor();
    if (!tabs) await app.close();
  }
});

test("an event repeats as chosen in its menu, shown each time it comes round, and stops", async () => {
  app = await openApp({ prefs: { calendarView: "week" } });
  const day = await dayIn(app);
  await app.open(`---\nstart: ${day} 09:00\nend: ${day} 09:30\n---\n# Standup`);
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  const weekday = await page.evaluate((day) => new Date(`${day}T12:00`).toLocaleDateString("en", { weekday: "long" }), day);
  const body = () => page.evaluate(() => window.testing.notes.entries[0].note.body);

  await page.getByRole("button", { name: /^Standup, 9:00/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Repeat" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Doesn’t Repeat" }).waitFor();
  expect(await page.getByRole("menuitemcheckbox", { name: "Doesn’t Repeat" }).getAttribute("aria-checked")).toBe("true");
  await page.getByRole("menuitemcheckbox", { name: `Every Week on ${weekday}` }).click();
  await page.waitForFunction(() => window.testing.notes.entries[0].note.body.includes("repeat: every week"));
  expect(await body()).toBe(`---\nstart: ${day} 09:00\nend: ${day} 09:30\nrepeat: every week\n---\n# Standup`);

  // Next week, and the one after: there too, said to repeat.
  await page.getByRole("button", { name: "Next Week" }).click();
  await page.getByRole("button", { name: /^Standup, 9:00 – 9:30 AM, repeats/ }).waitFor();
  await page.getByRole("button", { name: "Next Week" }).click();
  const later = page.getByRole("button", { name: /^Standup, 9:00 – 9:30 AM, repeats/ });
  await later.waitFor();

  // Its menu has it checked; Doesn't Repeat takes it away, and it's gone from this week.
  await later.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Repeat" }).click();
  expect(await page.getByRole("menuitemcheckbox", { name: `Every Week on ${weekday}` }).getAttribute("aria-checked")).toBe("true");
  await page.getByRole("menuitemcheckbox", { name: "Doesn’t Repeat" }).click();
  await later.waitFor({ state: "detached" });
  expect(await body()).not.toContain("repeat:");
});

test("dragging one time of a repeating event moves them all to that time, but not to another day", async () => {
  app = await openApp({ prefs: { calendarView: "week", weekStart: "monday" } });
  const page = app.page;
  // A Wednesday this week, and the next week's Wednesday and Thursday.
  const weekday = await page.evaluate(() => (new Date().getDay() + 6) % 7);
  const [wed, nextWed, nextThu] = [await dayIn(app, 2 - weekday), await dayIn(app, 9 - weekday), await dayIn(app, 10 - weekday)];
  await app.open(`---\nstart: ${wed} 09:00\nend: ${wed} 10:00\nrepeat: every week\n---\n# Review`);
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
  await page.getByRole("button", { name: "Next Week" }).click();
  await page.getByRole("button", { name: /^Review, 9:00/ }).waitFor();
  // Next week's, from 9:20 to 11:20 and on to Thursday: 11:00, still on Wednesdays, from this one.
  await dragIn(app, nextWed, 9 * 60 + 20, 11 * 60 + 20, nextThu);
  await page.waitForFunction(() => window.testing.notes.entries[0].note.body.includes("11:00"));
  expect(await page.evaluate(() => window.testing.notes.entries[0].note.body)).toBe(`---\nstart: ${wed} 11:00\nend: ${wed} 12:00\nrepeat: every week\n---\n# Review`);
  expect(await page.getByRole("button", { name: /^Review, 11:00/ }).evaluate((block) => block.closest("[data-column]")!.getAttribute("data-column"))).toBe(nextWed);
});
