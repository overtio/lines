/*
 * How the note's place is split: into panes side by side and one above another, as deep as wanted
 * (one on top, two at the bottom). A pane is the open note's (`MAIN`, with its toolbar: the note
 * selected in the list, or the Calendar's week) or another note's, by its id. Each split shares its
 * room among its panes by `sizes`, fractions that add up to 1.
 */

/** The pane of the note selected in the list, which every layout has. */
export const MAIN = "main";

export type Direction = "left" | "right" | "up" | "down";

export type PaneTree = { pane: string } | { split: "row" | "column"; children: PaneTree[]; sizes: number[] };

/** The way a split goes to put panes in `direction`. */
export const along = (direction: Direction) => (direction === "left" || direction === "right" ? "row" : "column");
/** Whether a pane put in `direction` goes after the one it's put beside. */
const after = (direction: Direction) => direction === "right" || direction === "down";

/** Every pane, from the top left. */
export function panesOf(tree: PaneTree): string[] {
  return "pane" in tree ? [tree.pane] : tree.children.flatMap(panesOf);
}

/**
 * The layout with `pane` put beside `at`, to its left or right, above or below it: in `at`'s split,
 * sharing its room, if that split goes that way; or else `at`'s room split in two.
 */
export function withPane(tree: PaneTree, at: string, pane: string, direction: Direction): PaneTree {
  if ("pane" in tree) {
    if (tree.pane !== at) return tree;
    return { split: along(direction), children: after(direction) ? [tree, { pane }] : [{ pane }, tree], sizes: [0.5, 0.5] };
  }
  const i = tree.children.findIndex((child) => "pane" in child && child.pane === at);
  if (i !== -1 && tree.split === along(direction)) {
    const half = tree.sizes[i] / 2;
    const to = after(direction) ? i + 1 : i;
    return {
      ...tree,
      children: [...tree.children.slice(0, to), { pane }, ...tree.children.slice(to)],
      sizes: [...tree.sizes.slice(0, i), half, half, ...tree.sizes.slice(i + 1)],
    };
  }
  return { ...tree, children: tree.children.map((child) => withPane(child, at, pane, direction)) };
}

/** The layout without `pane`: its room goes to the pane before it (or after, for the first), and a split left with one pane is that pane. */
export function withoutPane(tree: PaneTree, pane: string): PaneTree {
  if ("pane" in tree) return tree;
  const i = tree.children.findIndex((child) => "pane" in child && child.pane === pane);
  if (i === -1) {
    const children = tree.children.map((child) => withoutPane(child, pane));
    return children.every((child, j) => child === tree.children[j]) ? tree : { ...tree, children };
  }
  const children = tree.children.filter((_, j) => j !== i);
  const sizes = tree.sizes.filter((_, j) => j !== i);
  sizes[Math.max(0, i - 1)] += tree.sizes[i];
  return children.length === 1 ? children[0] : { ...tree, children, sizes };
}

/** The layout with two panes in each other's places. */
export function swappedPanes(tree: PaneTree, a: string, b: string): PaneTree {
  if ("pane" in tree) return tree.pane === a ? { pane: b } : tree.pane === b ? { pane: a } : tree;
  return { ...tree, children: tree.children.map((child) => swappedPanes(child, a, b)) };
}

/** The layout with the pane `from` showing `to` instead, in its place. */
export function replacedPane(tree: PaneTree, from: string, to: string): PaneTree {
  if ("pane" in tree) return tree.pane === from ? { pane: to } : tree;
  return { ...tree, children: tree.children.map((child) => replacedPane(child, from, to)) };
}

/** The layout with the split at `path` (each step the index of a child) sharing its room by `sizes`. */
export function resized(tree: PaneTree, path: readonly number[], sizes: number[]): PaneTree {
  if ("pane" in tree) return tree;
  if (!path.length) return { ...tree, sizes };
  const [i, ...rest] = path;
  return { ...tree, children: tree.children.map((child, j) => (j === i ? resized(child, rest, sizes) : child)) };
}

/** How much of the whole width and height each pane has, as fractions. */
export function sharesOf(tree: PaneTree, width = 1, height = 1, into = new Map<string, { width: number; height: number }>()) {
  if ("pane" in tree) return into.set(tree.pane, { width, height });
  tree.children.forEach((child, i) => {
    const share = tree.sizes[i];
    sharesOf(child, tree.split === "row" ? width * share : width, tree.split === "column" ? height * share : height, into);
  });
  return into;
}

/** The panes along the window's top: all of a row's, the first of a column's. */
export function topPanes(tree: PaneTree, top = true, into = new Set<string>()): Set<string> {
  if ("pane" in tree) return top ? into.add(tree.pane) : into;
  tree.children.forEach((child, i) => topPanes(child, top && (tree.split === "row" || i === 0), into));
  return into;
}
