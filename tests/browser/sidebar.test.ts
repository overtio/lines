import { afterEach, expect, test } from "bun:test";
import { type App, noErrors, openApp, toggle } from "./app";

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** The sidebar's rows, as their text reads, from the top. */
const rows = (app: App) => app.page.getByRole("navigation", { name: "Library" }).locator(".row").allInnerTexts();

/**
 * Right-clicks the sidebar's own empty space, below its rows, found where nothing's over it: rows are
 * as tall as the fonts make them, and where they fill the list, its space is at the end, scrolled to.
 */
async function rightClickEmpty(app: App) {
  const list = app.page.getByRole("navigation", { name: "Library" }).locator(".overflow-y-auto");
  const point = await list.evaluate(async (element) => {
    element.scrollTop = element.scrollHeight;
    await new Promise(requestAnimationFrame);
    const box = element.getBoundingClientRect();
    for (let y = box.bottom - 2; y > box.top; y -= 4) {
      for (const x of [box.left + 12, box.left + box.width / 2]) if (document.elementFromPoint(x, y) === element) return { x, y };
    }
    return null;
  });
  expect(point).not.toBeNull();
  await app.page.mouse.click(point!.x, point!.y, { button: "right" });
}

test("sections fold away; rows hide from their menu and come back from Show Hidden; order is kept", async () => {
  app = await openApp();
  await app.open("---\ntype: person\n---\n# Ada\n\n#work #home");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });

  // Tags folds away, and back.
  const tags = sidebar.getByRole("button", { name: "Tags", exact: true });
  await tags.click();
  expect(await tags.getAttribute("aria-expanded")).toBe("false");
  expect((await rows(app)).some((row) => row.startsWith("work"))).toBe(false);
  await tags.click();
  await sidebar.getByRole("button", { name: /^work/ }).waitFor();

  // Hide #work and Todo, from their menus.
  await sidebar.getByRole("button", { name: /^work/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide" }).click();
  await sidebar.getByRole("button", { name: /^Todo/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide" }).click();
  expect((await rows(app)).some((row) => row.startsWith("work") || row.startsWith("Todo"))).toBe(false);

  // Show Hidden, from the empty space: #work comes back alone, then everything.
  await page.getByRole("menu").waitFor({ state: "detached" });
  await rightClickEmpty(app);
  await page.getByRole("menuitem", { name: "Show Hidden" }).click();
  await page.getByRole("menuitem", { name: "#work" }).click();
  await sidebar.getByRole("button", { name: /^work/ }).waitFor();
  expect((await rows(app)).some((row) => row.startsWith("Todo"))).toBe(false);

  // Notes can't be hidden; Calendar moves up past it with ⌥↑, keeping focus, and stays there after a reload.
  await sidebar.getByRole("button", { name: /^Notes/ }).click({ button: "right" });
  expect(await page.getByRole("menuitem", { name: "Hide" }).count()).toBe(0);
  await page.keyboard.press("Escape");
  await sidebar.getByRole("button", { name: /^Calendar/ }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForFunction(() => document.activeElement?.textContent?.trim().startsWith("Calendar"));
  const places = async () => (await rows(app)).slice(0, 3).map((row) => row.split("\n")[0]);
  expect(await places()).toEqual(["Inbox", "Calendar", "Notes"]);
  await page.reload();
  await page.waitForFunction(() => window.testing?.notes.ready);
  expect(await places()).toEqual(["Inbox", "Calendar", "Notes"]);

  // Dragging Trash above Inbox.
  const [trash, inbox] = [await sidebar.getByRole("button", { name: /^Trash/ }).boundingBox(), await sidebar.getByRole("button", { name: /^Inbox/ }).boundingBox()];
  await page.mouse.move(trash!.x + 30, trash!.y + trash!.height / 2);
  await page.mouse.down();
  await page.mouse.move(trash!.x + 30, inbox!.y + 4, { steps: 6 });
  await page.mouse.up();
  expect((await places())[0]).toBe("Trash");
  // The drag didn't also choose Trash.
  expect(await page.locator("#note-list-title").innerText()).not.toBe("Trash");
});

test("a section's heading sorts what's in it by name, by most notes or by hand", async () => {
  app = await openApp();
  await app.open("# One\n\n#zebra #apple");
  await app.open("# Two\n\n#zebra #mango");
  await app.open("# Three\n\n#zebra");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const tags = async () => (await sidebar.locator("[data-tag]").allInnerTexts()).map((row) => row.split("\n")[0]);
  expect(await tags()).toEqual(["apple", "mango", "zebra"]);

  const sortBy = async (choice: string) => {
    await sidebar.getByRole("button", { name: "Tags", exact: true }).click({ button: "right" });
    await page.getByRole("menuitemcheckbox", { name: choice }).click();
  };
  await sortBy("Sort by Number of Notes");
  expect(await tags()).toEqual(["zebra", "apple", "mango"]);
  await sidebar.getByRole("button", { name: "Tags", exact: true }).click({ button: "right" });
  expect(await page.getByRole("menuitemcheckbox", { name: "Sort by Number of Notes" }).getAttribute("aria-checked")).toBe("true");
  await page.keyboard.press("Escape");

  // Moving one sorts by hand, from the order shown.
  await sidebar.getByRole("button", { name: /^mango/ }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await tags()).toEqual(["zebra", "mango", "apple"]);
  await sidebar.getByRole("button", { name: "Tags", exact: true }).click({ button: "right" });
  expect(await page.getByRole("menuitemcheckbox", { name: "Sort Manually" }).getAttribute("aria-checked")).toBe("true");
  await page.keyboard.press("Escape");
  await sortBy("Sort by Name");
  expect(await tags()).toEqual(["apple", "mango", "zebra"]);
});

test("a note dragged out of the list is a file for wherever it's dropped", async () => {
  app = await openApp();
  await app.open("# Trip: Rome\n\nPack light.");
  const data = await app.page.evaluateHandle(() => new DataTransfer());
  await app.page.locator(".note-list [data-id]").first().dispatchEvent("dragstart", { dataTransfer: data });
  const [text, download] = await data.evaluate((transfer) => [transfer.getData("text/plain"), transfer.getData("DownloadURL")]);
  expect(text).toBe("# Trip: Rome\n\nPack light.");
  expect(download).toMatch(/^text\/markdown:Trip - Rome\.md:blob:/);
});

test("a row dragged back over its own place shows no line, and stays put", async () => {
  app = await openApp();
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const places = async () => (await rows(app)).slice(0, 4).map((row) => row.split("\n")[0]);
  const before = await places();
  const [calendar, todo] = [await sidebar.getByRole("button", { name: /^Calendar/ }).boundingBox(), await sidebar.getByRole("button", { name: /^Todo/ }).boundingBox()];
  await page.mouse.move(calendar!.x + 30, calendar!.y + 8);
  await page.mouse.down();
  // Down past Todo, where the line shows, and back to the top of its own row.
  await page.mouse.move(calendar!.x + 30, todo!.y + todo!.height - 2, { steps: 4 });
  expect(await page.locator(".reorder-line").isVisible()).toBe(true);
  await page.mouse.move(calendar!.x + 30, calendar!.y + 4, { steps: 4 });
  expect(await page.locator(".reorder-line").isVisible()).toBe(false);
  await page.mouse.up();
  expect(await places()).toEqual(before);
});

test("a section dragged shows its line under the other whole section, starting where it goes, not gliding in from the top", async () => {
  app = await openApp();
  await app.open("---\ntype: person\n---\n# Ada\n\n#work");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const [types, tags] = [await sidebar.getByRole("button", { name: "Types", exact: true }).boundingBox(), await sidebar.getByRole("button", { name: "Tags", exact: true }).boundingBox()];
  await page.mouse.move(types!.x + 20, types!.y + 4);
  await page.mouse.down();
  await page.mouse.move(types!.x + 20, tags!.y + 40, { steps: 3 });
  const line = page.locator(".reorder-line");
  expect(await line.evaluate((element) => element.getAnimations().length)).toBe(0);
  // Under the whole Tags section, its last tag too, not just under its heading.
  const top = await line.evaluate((element) => element.getBoundingClientRect().top);
  const work = await sidebar.getByRole("button", { name: /^work/ }).boundingBox();
  expect(top).toBeGreaterThanOrEqual(work!.y + work!.height - 1);
  await page.mouse.up();
});

test("a hidden section or place comes back on its own from Show Hidden", async () => {
  app = await openApp();
  await app.open("---\ntype: person\n---\n# Ada");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const hide = async (name: string | RegExp) => {
    await sidebar.getByRole("button", { name, exact: typeof name === "string" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Hide" }).click();
    await page.getByRole("menu").waitFor({ state: "detached" });
  };
  const show = async (name: string) => {
    await rightClickEmpty(app);
    await page.getByRole("menuitem", { name: "Show Hidden" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "detached" });
  };
  await hide("Types");
  await hide(/^Calendar/);
  await show("Types");
  await sidebar.getByRole("button", { name: "Types", exact: true }).waitFor();
  expect(await sidebar.getByRole("button", { name: /^Calendar/ }).count()).toBe(0);
  await show("Calendar");
  await sidebar.getByRole("button", { name: /^Calendar/ }).waitFor();
});

test("places sit in sections, Inbox apart; rows drag between them; a new section is named, unnamed or deleted", async () => {
  app = await openApp();
  await app.open("---\ntype: person\n---\n# Ada\n\n#idea");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const row = (name: string) => sidebar.getByRole("button", { name: new RegExp(`^${name}`) });
  /** Which section a place is in, by the place first in it. */
  const sectionOf = (name: string) => row(name).evaluate((button) => button.closest("ul")!.querySelector("[data-reorder-key]")!.getAttribute("data-reorder-key"));
  const drag = async (name: string, to: { x: number; y: number }) => {
    const from = (await row(name).boundingBox())!;
    await page.mouse.move(from.x + 30, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  };

  // Two sections to begin with: the Inbox, and the rest.
  expect(await sectionOf("Inbox")).toBe("inbox");
  expect(await sectionOf("Notes")).toBe("all");

  // A new section, named as it's made.
  await rightClickEmpty(app);
  await page.getByRole("menuitem", { name: "New Section" }).click();
  const name = sidebar.getByRole("textbox", { name: "Section name" });
  await name.waitFor();
  await page.keyboard.type("Planning");
  await page.keyboard.press("Enter");
  const heading = sidebar.getByRole("button", { name: "Planning" });
  await heading.waitFor();
  await sidebar.getByText("Drag rows here").waitFor();

  // A second goes after it, above Types, as each new one does.
  await rightClickEmpty(app);
  await page.getByRole("menuitem", { name: "New Section" }).click();
  await name.waitFor();
  await page.keyboard.type("Someday");
  await page.keyboard.press("Enter");
  const headings = await sidebar.locator("h2").allInnerTexts();
  expect(headings.map((text) => text.trim().toLowerCase())).toEqual(["planning", "someday", "types", "tags"]);

  // Calendar into it, onto its heading; Todo into the Inbox's, under Inbox.
  const box = (await heading.boundingBox())!;
  await drag("Calendar", { x: box.x + 30, y: box.y + box.height - 2 });
  expect(await sectionOf("Calendar")).toBe("calendar");
  expect(await heading.locator("xpath=ancestor::*[@data-reorder-area][1]").getByText("Drag rows here").count()).toBe(0);
  const inbox = (await row("Inbox").boundingBox())!;
  await drag("Todo", { x: inbox.x + 30, y: inbox.y + inbox.height - 3 });
  expect(await sectionOf("Todo")).toBe("inbox");

  // Kept after a reload.
  await page.reload();
  await page.waitForFunction(() => window.testing?.notes.ready);
  expect(await sectionOf("Calendar")).toBe("calendar");
  expect(await sectionOf("Todo")).toBe("inbox");

  // No name: a gap, still a section of its own.
  await heading.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await name.fill("");
  await page.keyboard.press("Enter");
  expect(await sidebar.getByRole("button", { name: "Planning" }).count()).toBe(0);
  expect(await sectionOf("Calendar")).toBe("calendar");

  // Named again from a row's menu, then deleted: Calendar joins the section above.
  await row("Calendar").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Name Section" }).click();
  await page.keyboard.type("Later");
  await page.keyboard.press("Enter");
  await sidebar.getByRole("button", { name: "Later" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete Section" }).click();
  expect(await sidebar.getByRole("button", { name: "Later" }).count()).toBe(0);
  expect(await sectionOf("Calendar")).toBe("all");
});

test("Move to New Section, from a place's menu, makes a section with that place in it, after the one it was in", async () => {
  app = await openApp();
  await app.open("---\ntype: person\n---\n# Ada");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("button", { name: /^Calendar/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to New Section" }).click();
  await sidebar.getByRole("textbox", { name: "Section name" }).waitFor();
  await page.keyboard.type("Planning");
  await page.keyboard.press("Enter");
  // Its own section, right after Notes' (and before Types), with nothing else in it.
  const section = sidebar.getByRole("button", { name: "Planning" }).locator("xpath=ancestor::*[@data-reorder-area][1]");
  expect((await section.locator(".row").allInnerTexts()).map((row) => row.split("\n")[0])).toEqual(["Calendar"]);
  expect((await sidebar.locator("h2").allInnerTexts()).map((text) => text.trim().toLowerCase())).toEqual(["planning", "types"]);
  const tops = await Promise.all(["Trash", "Calendar"].map(async (name) => (await sidebar.getByRole("button", { name: new RegExp(`^${name}`) }).boundingBox())!.y));
  expect(tops[1]).toBeGreaterThan(tops[0]);
});

test("dragged into an empty section, the line takes the place of its words", async () => {
  app = await openApp();
  const page = app.page;
  // The line goes straight to its place, rather than gliding, which a sleeping display can stall.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await rightClickEmpty(app);
  await page.getByRole("menuitem", { name: "New Section" }).click();
  await page.keyboard.press("Enter");
  const words = sidebar.getByText("Drag rows here");
  const heading = (await sidebar.getByRole("button", { name: "New Section" }).boundingBox())!;
  const calendar = (await sidebar.getByRole("button", { name: /^Calendar/ }).boundingBox())!;
  await page.mouse.move(calendar.x + 30, calendar.y + 10);
  await page.mouse.down();
  await page.mouse.move(heading.x + 30, heading.y + heading.height - 2, { steps: 6 });
  const box = (await words.boundingBox())!;
  const line = await page.locator(".reorder-line").evaluate((element) => element.getBoundingClientRect().top);
  expect(line).toBeGreaterThan(box.y);
  expect(line).toBeLessThan(box.y + box.height);
  expect(await words.evaluate((element) => getComputedStyle(element).visibility)).toBe("hidden");
  // Elsewhere, the words come back.
  await page.mouse.move(calendar.x + 30, calendar.y - 30, { steps: 4 });
  expect(await words.evaluate((element) => getComputedStyle(element).visibility)).toBe("visible");
  await page.keyboard.press("Escape");
  await page.mouse.up();
});

/** The color a sidebar row's icon is drawn in, and the theme's `color` there (`var(--palette-green)`), as CSS computes them. */
const iconColor = (app: App, row: string, color: string) =>
  app.page.evaluate(
    ([row, color]) => {
      const button = [...document.querySelectorAll<HTMLElement>("nav .row")].find((each) => each.innerText.startsWith(row))!;
      const probe = button.appendChild(document.createElement("span"));
      probe.style.color = color;
      const colors = [getComputedStyle(button.querySelector("svg")!).color, getComputedStyle(probe).color];
      probe.remove();
      return colors;
    },
    [row, color] as const,
  );

test("a tag's, a type's and a note's color, chosen in the icon picker, colors their icons and the note on the Calendar", async () => {
  app = await openApp();
  const page = app.page;
  // Today, in the page's time zone.
  const day = await page.evaluate(() => new Date().toLocaleDateString("sv"));
  await app.open(`---\ntype: meeting\ndate: ${day} 10:00\n---\n# Standup\n\n#work`);
  const sidebar = page.getByRole("navigation", { name: "Library" });

  // Green for #work, from its menu; the picker stays open, for an icon too.
  await sidebar.getByRole("button", { name: /^work/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  const picker = page.getByRole("dialog", { name: "Icon for work" });
  await picker.getByRole("radio", { name: "Green" }).click();
  expect(await picker.getByRole("radio", { name: "Green" }).getAttribute("aria-checked")).toBe("true");
  const [work, green] = await iconColor(app, "work", "var(--palette-green)");
  expect(work).toBe(green);
  await page.keyboard.press("Escape");

  // The meeting is green on the Calendar, its tag's color, until its type has one of its own.
  await sidebar.getByRole("button", { name: /^Calendar/ }).click();
  const event = page.getByRole("button", { name: /^Standup, 10:00/ });
  // Once its colors have eased to the new one.
  const look = async () => {
    await event.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    // Its bar, down its inner edge.
    return event.evaluate((element) => getComputedStyle(element, "::before").backgroundColor);
  };
  expect(await look()).toBe(green);
  /** The color of the note's icon in the list (its type's), and the theme's `color`. */
  const listIcon = (color: string) =>
    page.evaluate((color) => {
      const icon = document.querySelector(".note-list [data-id] svg")!;
      const probe = icon.parentElement!.appendChild(document.createElement("span"));
      probe.style.color = color;
      const colors = [getComputedStyle(icon).color, getComputedStyle(probe).color];
      probe.remove();
      return colors;
    }, color);
  // A tag's color says nothing of the note's icon, which stays in the accent.
  const [shown, accent] = await listIcon("var(--accent)");
  expect(shown).toBe(accent);
  await sidebar.getByRole("button", { name: /^Meeting/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  await page.getByRole("dialog", { name: "Icon for Meeting" }).getByRole("radio", { name: "Purple" }).click();
  const [meeting, purple] = await iconColor(app, "Meeting", "var(--palette-purple)");
  expect(meeting).toBe(purple);
  expect(await look()).toBe(purple);
  // The note shows its type's icon, so in its type's color.
  expect((await listIcon("var(--accent)"))[0]).toBe(purple);

  // No Color takes it back.
  await page.getByRole("dialog", { name: "Icon for Meeting" }).getByRole("radio", { name: "No Color" }).click();
  expect(await look()).toBe(green);
  await page.keyboard.press("Escape");

  // The note's own color, from its menu in the list, is its icon's and its event's, over its tag's.
  await page.locator(".note-list [data-id]").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  await page.getByRole("dialog", { name: "Icon for Standup" }).getByRole("radio", { name: "Orange" }).click();
  const [own, orange] = await listIcon("var(--palette-orange)");
  expect(own).toBe(orange);
  expect(await look()).toBe(orange);
  // Kept beside the note, as its icon is, not in its text.
  expect(await page.evaluate(() => window.testing.notes.entries[0].note.body)).not.toContain("orange");
});

test("the icon picker finds icons by what they're for: money, cash, finance", async () => {
  app = await openApp();
  await app.open("# Budget\n\n#finance");
  const page = app.page;
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^finance/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  const picker = page.getByRole("dialog", { name: "Icon for finance" });
  const search = picker.getByRole("searchbox", { name: "Search icons" });
  const found = async (query: string) => {
    await search.fill(query);
    return picker.getByRole("option").evaluateAll((options) => options.map((option) => option.getAttribute("aria-label")));
  };
  for (const query of ["money", "cash", "finance"]) expect(await found(query)).toContain("banknote");
  expect(await found("money")).toEqual(expect.arrayContaining(["wallet", "coins", "piggy bank", "credit card"]));
  // Two words, as the name has them, and an icon in two groups listed once.
  expect(await found("credit card")).toEqual(["credit card"]);
  expect((await found("thumbs")).filter((name) => name === "thumbs up")).toHaveLength(1);
  expect(await found("zzz")).toEqual([]);
  await picker.getByText("No icons match “zzz”.").waitFor();
});

test("a tag whose nested tags are all hidden has no arrow, until one's shown again", async () => {
  app = await openApp();
  await app.open("# Plan\n\n#idea/app #finance");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const arrow = sidebar.getByRole("button", { name: "Tags in idea" });
  await arrow.click();
  await sidebar.getByRole("button", { name: /^app/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide" }).click();
  await arrow.waitFor({ state: "detached" });
  expect(await sidebar.getByRole("button", { name: /^app/ }).count()).toBe(0);

  await page.getByRole("menu").waitFor({ state: "detached" });
  await sidebar.getByRole("button", { name: /^finance/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show Hidden" }).click();
  await page.getByRole("menuitem", { name: "#idea/app" }).click();
  await arrow.waitFor();
});

test("nested tags have their tag's color, shown first in their picker, until given one of their own", async () => {
  app = await openApp();
  await app.open("# Plan\n\n#work/meetings");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("button", { name: "Tags in work" }).click();
  await sidebar.getByRole("button", { name: /^work/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  await page.getByRole("dialog", { name: "Icon for work" }).getByRole("radio", { name: "Blue" }).click();
  await page.keyboard.press("Escape");
  const [meetings, blue] = await iconColor(app, "meetings", "var(--palette-blue)");
  expect(meetings).toBe(blue);

  // Its picker: the first choice is the color it has from #work, and it's the one chosen.
  await sidebar.getByRole("button", { name: /^meetings/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  const picker = page.getByRole("dialog", { name: "Icon for work/meetings" });
  const same = picker.getByRole("radio", { name: "Same as #work" });
  expect(await same.getAttribute("aria-checked")).toBe("true");
  await picker.getByRole("radio", { name: "Red" }).click();
  const [own, red] = await iconColor(app, "meetings", "var(--palette-red)");
  expect(own).toBe(red);
  await same.click();
  expect((await iconColor(app, "meetings", "var(--palette-blue)"))[0]).toBe(blue);
});

test("a tag in a note is in the color chosen for it in the sidebar, its nested tags too", async () => {
  app = await openApp();
  await app.open("# Plan\n\n#work and #work/meetings and #home");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  await sidebar.getByRole("button", { name: /^work/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Icon and Color" }).click();
  await page.getByRole("dialog", { name: "Icon for work" }).getByRole("radio", { name: "Green" }).click();
  await page.keyboard.press("Escape");
  const looks = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = "var(--palette-green)";
    const green = getComputedStyle(probe).color;
    probe.remove();
    const pill = (tag: string) => document.querySelector<HTMLElement>(`.editor-pane .cm-lp-tag[data-tag="${tag}"]`)!;
    const icon = (tag: string) => getComputedStyle(pill(tag).querySelector(".cm-lp-tag-icon")!).color;
    return { green, work: icon("work"), meetings: icon("work/meetings"), home: icon("home"), text: getComputedStyle(pill("work")).color, body: getComputedStyle(document.querySelector(".editor-pane .cm-content")!).color };
  });
  expect(looks.work).toBe(looks.green);
  expect(looks.meetings).toBe(looks.green);
  expect(looks.home).not.toBe(looks.green);
  // Its name in the text's color, readable as the note is.
  expect(looks.text).toBe(looks.body);
});

test("dividers go between places from the menus, move by keyboard, are kept, and are removed from their own menu", async () => {
  app = await openApp();
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const order = () =>
    sidebar.locator(".row, button[aria-label='Divider']").evaluateAll((all) => all.map((each) => (each.getAttribute("aria-label") === "Divider" ? "—" : (each as HTMLElement).innerText.split("\n")[0])));

  // Below Calendar, from its menu.
  await sidebar.getByRole("button", { name: /^Calendar/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add Divider Below" }).click();
  const divider = sidebar.getByRole("button", { name: "Divider" });
  await divider.waitFor();
  expect((await order()).slice(0, 5)).toEqual(["Inbox", "Notes", "Calendar", "—", "Todo"]);

  // ⌥↑ moves it up past Calendar, and it stays there after a reload.
  await divider.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Divider");
  expect((await order()).slice(0, 4)).toEqual(["Inbox", "Notes", "—", "Calendar"]);
  await page.reload();
  await page.waitForFunction(() => window.testing?.notes.ready);
  expect((await order()).slice(0, 4)).toEqual(["Inbox", "Notes", "—", "Calendar"]);

  // Removed from its own menu.
  await divider.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove Divider" }).click();
  await divider.waitFor({ state: "detached" });

  // From the empty space: at the end of the places.
  await rightClickEmpty(app);
  await page.getByRole("menuitem", { name: "Add Divider" }).click();
  await divider.waitFor();
  const rows = await order();
  expect(rows[rows.indexOf("Trash") + 1]).toBe("—");
});

test("a note dragged onto the sidebar is tagged, made a type, put in the Inbox or moved to the Trash there", async () => {
  app = await openApp({ prefs: { newNotes: "inbox" } });
  await app.open("---\ntype: person\n---\n# Ada\n\n#work");
  await app.open("# Plan\n\nThe week.");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });
  const plan = () => page.evaluate(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Plan")!.note);
  const dropOn = (name: RegExp) => page.locator(".note-list [data-id]").filter({ hasText: "Plan" }).dragTo(sidebar.getByRole("button", { name }));

  await dropOn(/^work/);
  await page.waitForFunction(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Plan")!.meta.tags.includes("work"));
  await dropOn(/^Person/);
  await page.waitForFunction(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Plan")!.meta.type === "person");
  expect((await plan()).body).toBe("---\ntype: person\n---\n# Plan\n\nThe week.\n\n#work");
  // Onto a row that wouldn't change it, nothing (it has #work already).
  await dropOn(/^work/);
  expect((await plan()).body).toBe("---\ntype: person\n---\n# Plan\n\nThe week.\n\n#work");
  await dropOn(/^Inbox/);
  await page.waitForFunction(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Plan")!.note.inbox === true);
  await dropOn(/^Trash/);
  await page.waitForFunction(() => window.testing.notes.entries.find((entry) => entry.meta.title === "Plan")?.note.trashed === true);
});

test("a divider between sections sits halfway between them; dividers go among types and tags too", async () => {
  app = await openApp();
  await app.open("---\ntype: person\n---\n# Ada\n\n#work #home");
  const page = app.page;
  const sidebar = page.getByRole("navigation", { name: "Library" });

  // At the end of the places, from the empty space: halfway between Trash and the Types heading.
  await rightClickEmpty(app);
  await page.getByRole("menuitem", { name: "Add Divider", exact: true }).click();
  const divider = sidebar.getByRole("button", { name: "Divider" });
  await divider.waitFor();
  const [trash, line, types] = await Promise.all([
    sidebar.getByRole("button", { name: /^Trash/ }).boundingBox(),
    divider.locator("span").boundingBox(),
    sidebar.getByRole("button", { name: "Types", exact: true }).boundingBox(),
  ]);
  const [above, below] = [line!.y - (trash!.y + trash!.height), types!.y - (line!.y + line!.height)];
  expect(Math.abs(above - below)).toBeLessThan(3);

  // Below a type, and below a tag, from their menus.
  await sidebar.getByRole("button", { name: /^Person/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add Divider Below" }).click();
  await sidebar.getByRole("button", { name: /^home/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add Divider Below" }).click();
  expect(await divider.count()).toBe(3);
  const tagsOrder = await sidebar.locator("#sidebar-tags-list > li").evaluateAll((rows) => rows.map((row) => (row.querySelector("[aria-label='Divider']") ? "—" : (row as HTMLElement).innerText.split("\n")[0])));
  expect(tagsOrder).toEqual(["home", "—", "work"]);

  // Each goes from its own menu.
  for (let left = 3; left > 0; left--) {
    await page.getByRole("menu").waitFor({ state: "detached" });
    await divider.first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove Divider" }).click();
    await page.waitForFunction((count) => document.querySelectorAll("nav [aria-label='Divider']").length === count, left - 1);
  }
});

test("rows are small, standard or tiles, one by one or a whole section at once; tiles go two to a line; a tag with nested tags stays a row", async () => {
  app = await openApp({ height: 900 });
  await app.open("---\ntype: person\n---\n\n# Ada\n\n#home #work/meetings");
  const page = app.page;
  const nav = page.getByRole("navigation", { name: "Library" });
  /** Chooses `item` in the menu of the sidebar's button named `name`. */
  const choose = async (name: RegExp, item: string) => {
    await nav.getByRole("button", { name }).first().click({ button: "right" });
    await page.getByRole("menu").getByText(item, { exact: true }).click();
  };
  const tile = (name: RegExp) => nav.locator("li[data-tile]").filter({ has: page.getByRole("button", { name }) });

  await choose(/^Notes/, "Tile");
  await choose(/^Calendar/, "Tile");
  const [notesBox, calendarBox] = [await tile(/^Notes/).boundingBox(), await tile(/^Calendar/).boundingBox()];
  expect(Math.round(notesBox!.y)).toBe(Math.round(calendarBox!.y));
  expect(calendarBox!.x).toBeGreaterThan(notesBox!.x + notesBox!.width - 1);
  // Its count is in the room beside its icon and name: halfway down the tile, and a little right of that room's middle.
  const middle = await tile(/^Notes/).getByRole("button").evaluate((button) => {
    const box = button.getBoundingClientRect();
    const count = button.querySelector(".tabular")!.getBoundingClientRect();
    const name = button.querySelector(".truncate")!.getBoundingClientRect();
    const right = box.right - parseFloat(getComputedStyle(button).paddingRight);
    return { down: box.top + box.height / 2 - (count.top + count.height / 2), across: (name.right + right) / 2 - (count.left + count.width / 2) };
  });
  expect(Math.abs(middle.down)).toBeLessThan(1.5);
  expect(middle.across).toBeLessThan(0);
  expect(middle.across).toBeGreaterThan(-16);
  // A tile is chosen as a row is.
  await tile(/^Calendar/).getByRole("button").click();
  await page.waitForFunction(() => window.testing.notes.filter.kind === "calendar");

  // The whole Tags section as tiles, but for #work, which has a nested tag; and one tag back to a small row.
  await choose(/^Tags$/, "Tiles");
  await tile(/^home/).waitFor();
  expect(await tile(/^work/).count()).toBe(0);
  await nav.getByRole("button", { name: /^work/ }).first().click({ button: "right" });
  expect(await page.getByRole("menu").getByText("Tile", { exact: true }).count()).toBe(0);
  await page.keyboard.press("Escape");
  await choose(/^home/, "Small Row");
  await nav.locator(".row.h-6\\.5").filter({ hasText: "home" }).waitFor();

  // Kept after a reload.
  await page.reload();
  await tile(/^Notes/).waitFor();
  await nav.locator(".row.h-6\\.5").filter({ hasText: "home" }).waitFor();
});

test("Settings → Layout hides the sidebar's version badge and GitHub button, and shows them again", async () => {
  app = await openApp();
  const nav = app.page.getByRole("navigation", { name: "Library" });
  const github = nav.getByRole("button", { name: "Source on GitHub" });
  await github.waitFor();
  const settings = await app.settings("Layout");
  await toggle(settings, "Version and GitHub in the sidebar", false);
  await github.waitFor({ state: "detached" });
  expect(await nav.getByText(/^Alpha /).count()).toBe(0);
  await toggle(settings, "Version and GitHub in the sidebar", true);
  await github.waitFor();
  await nav.getByText(/^Alpha /).waitFor();
});
