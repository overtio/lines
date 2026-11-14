import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import type { IconName } from "../icons/icons";
import { ROW_SIZES, type RowSize, sidebarLayout, type SortBy, SORTS } from "../sidebarLayout.svelte";
import { type MenuItem, ui } from "../ui.svelte";

/*
 * What every row of the sidebar's menu has besides its own items: its size, hiding it, and bringing
 * back what's hidden; and a section heading's, how what's in it is sorted and how big its rows are.
 * Rows are moved by dragging, or ⌥↑ and ⌥↓ (reorder.ts).
 */

/** What kind of row a list holds, as hidden rows are named (`tag:work`). */
export type RowKind = "place" | "section" | "type" | "shelf" | "feeds" | "stream" | "tag";

/** How a hidden row is shown in Show Hidden's menu: its name and icon, or null if it's gone (a tag no note has now). */
export type Describe = (hidden: string) => { label: string; icon: IconName } | null;

/** Hide, for the row of this kind named `key`. */
export const hideItems = (kind: RowKind, key: string): MenuItem[] => [{ label: t("sidebar.hideItem"), icon: "eye-off", run: () => hide(`${kind}:${key}`) }];

/** How the section's rows are sorted, as choices to make. */
export function sortItems(section: "types" | "tags"): MenuItem[] {
  const now = sidebarLayout.sortOf(section);
  const labels: Record<SortBy, string> = { name: t("sidebar.sortName"), count: t("sidebar.sortCount"), manual: t("sidebar.sortManual") };
  return SORTS.map((sort) => ({ label: labels[sort], checked: sort === now, run: () => sidebarLayout.setSort(section, sort) }));
}

/**
 * Small, standard or a tile, as choices: a row's own (`row`, its key) or, with `rows`, a whole
 * section's. A row that can't be a tile (a tag with nested tags, which it opens) has two.
 */
export function sizeItems(section: string, row: string, rows?: readonly string[], canTile = true): MenuItem[] {
  const chosen = rows ? sidebarLayout.sectionSize(section) : sidebarLayout.sizeOf(row, section);
  const now = !canTile && chosen === "large" ? "standard" : chosen;
  const labels: Record<RowSize, string> = rows
    ? { small: t("sidebar.sizeSmallRows"), standard: t("sidebar.sizeStandardRows"), large: t("sidebar.sizeTiles") }
    : { small: t("sidebar.sizeSmall"), standard: t("sidebar.sizeStandard"), large: t("sidebar.sizeTile") };
  return ROW_SIZES.filter((size) => canTile || size !== "large").map((size) => ({
    label: labels[size],
    checked: size === now,
    run: () => (rows ? sidebarLayout.setSectionSize(section, size, rows) : sidebarLayout.setRowSize(row, section, size)),
  }));
}

function hide(key: string) {
  sidebarLayout.hide(key);
  speak(t("sidebar.didHide"));
}

/** Show Hidden…, while something is: it opens a menu of what's hidden, to show one or all. */
export function showHiddenItems(describe: Describe, x: number, y: number): MenuItem[] {
  const hidden = sidebarLayout.hidden.flatMap((key) => {
    const row = describe(key);
    return row ? [{ key, label: row.label, icon: row.icon }] : [];
  });
  if (!hidden.length) return [];
  const items: MenuItem[] = [
    { label: t("sidebar.showAll"), icon: "eye", run: () => sidebarLayout.showAll() },
    "separator",
    ...hidden.map(({ key, label, icon }) => ({ label, icon, run: () => sidebarLayout.show(key) })),
  ];
  // Opened once this menu has closed, which it does after the item runs.
  return [{ label: t("sidebar.showHidden"), icon: "eye", run: () => setTimeout(() => ui.openMenu({ x, y, label: t("sidebar.hiddenMenu"), items })) }];
}
