import { expect, test } from "bun:test";
import { MAIN, type PaneTree, panesOf, replacedPane, resized, sharesOf, topPanes, withoutPane, withPane } from "../../src/lib/panes";

const one: PaneTree = { pane: MAIN };

test("panes split to the right and below, as deep as wanted: one on top, two at the bottom", () => {
  const below = withPane(one, MAIN, "a", "down");
  expect(below).toEqual({ split: "column", children: [{ pane: MAIN }, { pane: "a" }], sizes: [0.5, 0.5] });
  const bottom = withPane(below, "a", "b", "right");
  expect(bottom).toEqual({ split: "column", children: [{ pane: MAIN }, { split: "row", children: [{ pane: "a" }, { pane: "b" }], sizes: [0.5, 0.5] }], sizes: [0.5, 0.5] });
  expect(panesOf(bottom)).toEqual([MAIN, "a", "b"]);
  expect([...topPanes(bottom)]).toEqual([MAIN]);
  expect(sharesOf(bottom).get("b")).toEqual({ width: 0.5, height: 0.5 });
});

test("a pane put beside another in a split that goes that way shares that pane's room", () => {
  const row = withPane(one, MAIN, "a", "right");
  const three = withPane(row, MAIN, "b", "right");
  expect(three).toEqual({ split: "row", children: [{ pane: MAIN }, { pane: "b" }, { pane: "a" }], sizes: [0.25, 0.25, 0.5] });
});

test("a pane closed gives its room to the one before it, and a split left with one pane is that pane", () => {
  const tree = withPane(withPane(withPane(one, MAIN, "a", "down"), "a", "b", "right"), MAIN, "c", "right");
  expect(withoutPane(tree, "b")).toEqual({
    split: "column",
    children: [{ split: "row", children: [{ pane: MAIN }, { pane: "c" }], sizes: [0.5, 0.5] }, { pane: "a" }],
    sizes: [0.5, 0.5],
  });
  expect(withoutPane(withoutPane(withoutPane(tree, "b"), "a"), "c")).toEqual(one);
});

test("a pane shows another note in its place, and a split's room is shared as dragged", () => {
  const tree = withPane(one, MAIN, "a", "right");
  expect(replacedPane(tree, "a", "z")).toEqual({ split: "row", children: [{ pane: MAIN }, { pane: "z" }], sizes: [0.5, 0.5] });
  const deeper = withPane(tree, "a", "b", "down");
  expect(resized(deeper, [1], [0.3, 0.7])).toEqual({ split: "row", children: [{ pane: MAIN }, { split: "column", children: [{ pane: "a" }, { pane: "b" }], sizes: [0.3, 0.7] }], sizes: [0.5, 0.5] });
});
