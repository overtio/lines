import { beforeEach, expect, test } from "bun:test";

const { sidebarLayout } = await import("../../src/lib/sidebarLayout.svelte");

// Each test orders lists of its own; what's hidden is shared.
beforeEach(() => sidebarLayout.showAll());

const names = (list: string, items: string[]) => sidebarLayout.sorted(list, items, (item) => item);

test("rows keep the order they're dragged into; new ones come after", () => {
  sidebarLayout.move("places", ["inbox", "all", "calendar", "todo"], "todo", "all");
  expect(names("places", ["inbox", "all", "calendar", "todo"])).toEqual(["inbox", "todo", "all", "calendar"]);
  expect(names("places", ["inbox", "all", "calendar", "todo", "trash"])).toEqual(["inbox", "todo", "all", "calendar", "trash"]);
  sidebarLayout.move("places", ["inbox", "todo", "all", "calendar"], "inbox", null);
  expect(names("places", ["inbox", "all", "calendar", "todo"])).toEqual(["todo", "all", "calendar", "inbox"]);
});

test("a renamed tag keeps its place, its nested tags theirs, and stays hidden", () => {
  sidebarLayout.move("tags:", ["home", "work"], "work", "home");
  sidebarLayout.move("tags:work", ["work/a", "work/b"], "work/b", "work/a");
  sidebarLayout.hide("tag:work/a");
  sidebarLayout.rename("tag", "work", "job");
  expect(names("tags:", ["home", "job"])).toEqual(["job", "home"]);
  expect(names("tags:job", ["job/a", "job/b"])).toEqual(["job/b", "job/a"]);
  expect(sidebarLayout.isHidden("tag:job/a")).toBe(true);
  expect(sidebarLayout.isHidden("tag:work/a")).toBe(false);
});

test("what's hidden comes back one at a time, or all together, and is kept", () => {
  sidebarLayout.hide("place:todo");
  sidebarLayout.hide("section:types");
  expect(sidebarLayout.hidden).toEqual(["place:todo", "section:types"]);
  expect(JSON.parse(localStorage.getItem("lines.sidebar")!).hidden).toEqual(["place:todo", "section:types"]);
  sidebarLayout.show("place:todo");
  expect(sidebarLayout.hidden).toEqual(["section:types"]);
  sidebarLayout.showAll();
  expect(sidebarLayout.hidden).toEqual([]);
});

test("a section sorts by name, by most notes, or by hand, and moving a row in it sorts it by hand from that order", () => {
  const tags = [
    { path: "zeta", count: 1 },
    { path: "alpha 10", count: 5 },
    { path: "Alpha 2", count: 5 },
  ];
  const arrange = () => sidebarLayout.arrange("labels", "labels:", tags, (tag) => tag.path, (tag) => tag.path, (tag) => tag.count).map((tag) => tag.path);
  expect(sidebarLayout.sortOf("labels")).toBe("name");
  expect(arrange()).toEqual(["Alpha 2", "alpha 10", "zeta"]);
  sidebarLayout.setSort("labels", "count");
  expect(arrange()).toEqual(["Alpha 2", "alpha 10", "zeta"]);
  sidebarLayout.move("labels:", arrange(), "zeta", "Alpha 2", "labels");
  expect(sidebarLayout.sortOf("labels")).toBe("manual");
  expect(arrange()).toEqual(["zeta", "Alpha 2", "alpha 10"]);
});

test("places start in two sections, the Inbox apart; they move between sections, and a deleted one's join the one above", () => {
  const all = ["inbox", "all", "calendar", "todo", "trash"];
  const groups = () => sidebarLayout.groups(all).map((group) => [group.name, group.places]);
  // In the order the places were put in before sections (the first test's), Todo before Notes.
  expect(groups()).toEqual([
    ["", ["inbox"]],
    ["", ["todo", "all", "calendar", "trash"]],
  ]);
  const id = sidebarLayout.addGroup(all, "Planning");
  sidebarLayout.movePlace(all, "calendar", `end:${id}`);
  sidebarLayout.movePlace(all, "todo", "inbox");
  expect(groups()).toEqual([
    ["", ["todo", "inbox"]],
    ["", ["all", "trash"]],
    ["Planning", ["calendar"]],
  ]);
  // A place in no section (one lines adds later) goes in the last.
  expect(sidebarLayout.groups([...all, "drafts"]).at(-1)!.places).toEqual(["calendar", "drafts"]);
  sidebarLayout.deleteGroup(all, id);
  expect(groups()).toEqual([
    ["", ["todo", "inbox"]],
    ["", ["all", "trash", "calendar"]],
  ]);
  // A gap that's emptied isn't a section any more.
  sidebarLayout.movePlace(all, "todo", "all");
  sidebarLayout.movePlace(all, "inbox", "all");
  expect(groups()).toEqual([["", ["todo", "inbox", "all", "trash", "calendar"]]]);
});

test("dividers go after a place, or at the end, move as places do, and are kept until removed", () => {
  const all = ["inbox", "all", "calendar", "todo", "trash"];
  const places = () => sidebarLayout.groups(all).flatMap((group) => group.places);
  // In whatever order the tests before left them.
  const before = places();
  const below = sidebarLayout.addDivider(all, "calendar");
  const last = sidebarLayout.addDivider(all, null);
  expect(places().indexOf(below)).toBe(places().indexOf("calendar") + 1);
  expect(places().at(-1)).toBe(last);
  sidebarLayout.movePlace(all, below, "inbox");
  expect(places().indexOf(below)).toBe(places().indexOf("inbox") - 1);
  sidebarLayout.removeDivider(all, below);
  sidebarLayout.removeDivider(all, last);
  expect(places()).toEqual(before);
});
