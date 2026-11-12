/*
 * How the sidebar is laid out on this device: its sections, in order (Types, Tags, and sections of
 * the places at the top, Inbox, Notes, Calendar…, named or not, made as wanted); which places each of
 * those has, and the dividers among them; the order of the types and each level of tags; what's hidden; and which sections are
 * collapsed. Kept on this device, as tags' icons are, so a phone's sidebar can be shorter than a Mac's.
 *
 * What's hidden is named by its kind and name: `place:todo`, `section:tags`, `type:person`,
 * `tag:work/meetings`. The Types and Tags sections are each sorted by name, by how many notes, or
 * by hand. A row is small, standard or a large tile, as its section is unless it has a size of its
 * own. Each list in order is named too: `sections`, `types`, and `tags:` followed by the tag
 * whose nested tags it orders (`tags:` alone for the top level); a tag in one is its whole path.
 */

const KEY = "lines.sidebar";

/** How a section's rows are sorted: by name, most notes first, or in the order they were put in. */
export const SORTS = ["name", "count", "manual"] as const;
export type SortBy = (typeof SORTS)[number];

/** How big a row is drawn: a compact row, the usual one, or a tile (two to a line, Sidebar.svelte). */
export const ROW_SIZES = ["small", "standard", "large"] as const;
export type RowSize = (typeof ROW_SIZES)[number];

/** A section of the places at the top: named, with a heading, or not, set apart by a gap; and its places, in order. */
export interface PlaceGroup {
  id: string;
  name: string;
  places: string[];
}

/** A line between places, put where wanted: named `divider:` and its own id, among a section's places. */
export const isDivider = (key: string) => key.startsWith("divider:");

/** The sections places start in: the Inbox apart, then the rest. */
const INBOX_GROUP = "g-inbox";
const PLACES_GROUP = "g-places";

interface Stored {
  order: Record<string, string[]>;
  hidden: string[];
  collapsed: string[];
  sort: Record<string, SortBy>;
  /** Null until places are moved between sections or one is made. */
  groups: PlaceGroup[] | null;
  /** Rows' sizes, by row (`tag:work`) or section (`section:tags`), where they're not standard. */
  sizes: Record<string, RowSize>;
}

function readGroups(value: unknown): PlaceGroup[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((group) => group && typeof group.id === "string")
    .map((group) => ({ id: group.id, name: typeof group.name === "string" ? group.name : "", places: strings(group.places) }));
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function read(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
    const order = Object.fromEntries(Object.entries(raw.order ?? {}).map(([list, keys]) => [list, strings(keys)]));
    const sort = Object.fromEntries(Object.entries(raw.sort ?? {}).filter((entry): entry is [string, SortBy] => SORTS.includes(entry[1] as SortBy)));
    const groups = readGroups(raw.groups);
    const sizes = Object.fromEntries(Object.entries(raw.sizes ?? {}).filter((entry): entry is [string, RowSize] => ROW_SIZES.includes(entry[1] as RowSize)));
    // Sections ordered before places had sections of their own: theirs come first, as they did.
    if (!groups && order.sections) order.sections = [INBOX_GROUP, PLACES_GROUP, ...order.sections];
    return { order, hidden: strings(raw.hidden), collapsed: strings(raw.collapsed), sort, groups, sizes };
  } catch {
    return { order: {}, hidden: [], collapsed: [], sort: {}, groups: null, sizes: {} };
  }
}

/** Names compared as people read them: `tag 2` before `tag 10`, case aside. */
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** A tag, and every tag nested in it. */
const within = (path: string, tag: string) => path === tag || path.startsWith(`${tag}/`);

class SidebarLayout {
  #order = $state<Record<string, string[]>>({});
  #hidden = $state<string[]>([]);
  #collapsed = $state<string[]>([]);
  #sort = $state<Record<string, SortBy>>({});
  #groups = $state<PlaceGroup[] | null>(null);
  #sizes = $state<Record<string, RowSize>>({});

  constructor() {
    const stored = read();
    this.#order = stored.order;
    this.#hidden = stored.hidden;
    this.#collapsed = stored.collapsed;
    this.#sort = stored.sort;
    this.#groups = stored.groups;
    this.#sizes = stored.sizes;
  }

  #save() {
    try {
      const stored: Stored = { order: this.#order, hidden: this.#hidden, collapsed: this.#collapsed, sort: this.#sort, groups: this.#groups, sizes: this.#sizes };
      localStorage.setItem(KEY, JSON.stringify(stored));
    } catch {
      // Private mode or full storage: the layout just won't be kept.
    }
  }

  /**
   * The sections of places, each with those of `all` it has, in order: as arranged, or else the Inbox
   * apart from the rest (in the order they were put in, if they were). A place in none goes in the
   * last; an unnamed section with no places is no section.
   */
  groups(all: readonly string[]): PlaceGroup[] {
    const order = this.sorted("places", all, (key) => key);
    const stored = this.#groups ?? [
      { id: INBOX_GROUP, name: "", places: order.filter((key) => key === "inbox") },
      { id: PLACES_GROUP, name: "", places: order.filter((key) => key !== "inbox") },
    ];
    const known = new Set(all);
    const placed = new Set<string>();
    const groups = stored.map((group) => {
      const places = group.places.filter((key) => (known.has(key) || isDivider(key)) && !placed.has(key));
      for (const key of places) placed.add(key);
      return { ...group, places };
    });
    const unplaced = all.filter((key) => !placed.has(key));
    if (unplaced.length) {
      if (groups.length) groups[groups.length - 1].places.push(...unplaced);
      else groups.push({ id: PLACES_GROUP, name: "", places: unplaced });
    }
    return groups.filter((group) => group.name || group.places.length);
  }

  #setGroups(groups: PlaceGroup[]) {
    this.#groups = groups.filter((group) => group.name || group.places.length);
    this.#save();
  }

  /** Moves a place before another (`before`), or to the end of a section (`end:` and its id). */
  movePlace(all: readonly string[], key: string, before: string) {
    const groups = this.groups(all).map((group) => ({ ...group, places: group.places.filter((each) => each !== key) }));
    const end = before.startsWith("end:") ? before.slice("end:".length) : null;
    const target = groups.find((group) => (end ? group.id === end : group.places.includes(before)));
    if (!target) return;
    target.places.splice(end ? target.places.length : target.places.indexOf(before), 0, key);
    this.#setGroups(groups);
  }

  /** A new section of places, called `name`, with `places` moved into it (none: empty); its id. */
  addGroup(all: readonly string[], name: string, places: string[] = []) {
    const id = `g-${Date.now().toString(36)}`;
    const rest = this.groups(all).map((group) => ({ ...group, places: group.places.filter((key) => !places.includes(key)) }));
    this.#setGroups([...rest, { id, name, places }]);
    return id;
  }

  /** A divider after the place `after` in its section (or at the end of the last section); its key. */
  addDivider(all: readonly string[], after: string | null) {
    const key = `divider:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const groups = this.groups(all);
    const group = groups.find((each) => after !== null && each.places.includes(after)) ?? groups.at(-1);
    if (!group) return key;
    const at = after === null ? group.places.length : group.places.indexOf(after) + 1;
    this.#setGroups(groups.map((each) => (each === group ? { ...each, places: [...each.places.slice(0, at), key, ...each.places.slice(at)] } : each)));
    return key;
  }

  removeDivider(all: readonly string[], key: string) {
    this.#setGroups(this.groups(all).map((group) => ({ ...group, places: group.places.filter((each) => each !== key) })));
  }

  /** The dividers in an ordered list (`types`, `tags:…`), which are drawn there while it's sorted by hand. */
  dividersIn(list: string): string[] {
    return (this.#order[list] ?? []).filter(isDivider);
  }

  /**
   * A divider after `after` in an ordered list whose rows are `keys` (dividers among them), in a
   * `section` sorted by hand from then on, as moving a row there does; its key.
   */
  addListDivider(list: string, keys: readonly string[], after: string, section: string) {
    const key = `divider:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.move(list, [...keys, key], key, keys[keys.indexOf(after) + 1] ?? null, section);
    return key;
  }

  removeListDivider(list: string, key: string) {
    this.#order = { ...this.#order, [list]: (this.#order[list] ?? []).filter((each) => each !== key) };
    this.#save();
  }

  /** Names a section of places, or (with no name) leaves it a gap. */
  renameGroup(all: readonly string[], id: string, name: string) {
    this.#setGroups(this.groups(all).map((group) => (group.id === id ? { ...group, name: name.trim() } : group)));
  }

  /** Takes a section of places away; its places go to the section above (or below, for the first). */
  deleteGroup(all: readonly string[], id: string) {
    const groups = this.groups(all);
    const i = groups.findIndex((group) => group.id === id);
    if (i < 0 || groups.length < 2) return;
    const [gone] = groups.splice(i, 1);
    const into = groups[Math.max(0, i - 1)];
    groups[Math.max(0, i - 1)] = { ...into, places: i > 0 ? [...into.places, ...gone.places] : [...gone.places, ...into.places] };
    this.#setGroups(groups);
    this.show(`section:${id}`);
  }

  /** What's hidden, most recently hidden last. */
  get hidden(): readonly string[] {
    return this.#hidden;
  }

  isHidden(key: string) {
    return this.#hidden.includes(key);
  }

  hide(key: string) {
    if (this.isHidden(key)) return;
    this.#hidden = [...this.#hidden, key];
    this.#save();
  }

  show(key: string) {
    this.#hidden = this.#hidden.filter((hidden) => hidden !== key);
    this.#save();
  }

  showAll() {
    this.#hidden = [];
    this.#save();
  }

  isCollapsed(section: string) {
    return this.#collapsed.includes(section);
  }

  toggleCollapsed(section: string) {
    this.#collapsed = this.isCollapsed(section) ? this.#collapsed.filter((each) => each !== section) : [...this.#collapsed, section];
    this.#save();
  }

  /** How big a section's rows are, unless one has a size of its own. */
  sectionSize(section: string): RowSize {
    return this.#sizes[`section:${section}`] ?? "standard";
  }

  /** How big a row (`tag:work`) in `section` is: its own size, or its section's. */
  sizeOf(row: string, section: string): RowSize {
    return this.#sizes[row] ?? this.sectionSize(section);
  }

  /** A row's size; its section's, it follows the section again. */
  setRowSize(row: string, section: string, size: RowSize) {
    const { [row]: _, ...rest } = this.#sizes;
    this.#sizes = size === this.sectionSize(section) ? rest : { ...rest, [row]: size };
    this.#save();
  }

  /** A whole section's size, its `rows` (as `tag:work`) all following it again. */
  setSectionSize(section: string, size: RowSize, rows: readonly string[]) {
    const gone = new Set([...rows, `section:${section}`]);
    const rest = Object.fromEntries(Object.entries(this.#sizes).filter(([key]) => !gone.has(key)));
    this.#sizes = size === "standard" ? rest : { ...rest, [`section:${section}`]: size };
    this.#save();
  }

  /** How a section is sorted: as chosen, or by hand if it was ever ordered so, or by name. */
  sortOf(section: string): SortBy {
    const ordered = Object.keys(this.#order).some((list) => list === section || list.startsWith(`${section}:`));
    return this.#sort[section] ?? (ordered ? "manual" : "name");
  }

  setSort(section: string, sort: SortBy) {
    this.#sort = { ...this.#sort, [section]: sort };
    this.#save();
  }

  /** `items` of a list in `section`, sorted as the section is: by `name`, by `count` (then name), or by hand. */
  arrange<T>(section: string, list: string, items: readonly T[], key: (item: T) => string, name: (item: T) => string, count: (item: T) => number): T[] {
    const sort = this.sortOf(section);
    if (sort === "manual") return this.sorted(list, items, key);
    return [...items].sort((a, b) => (sort === "count" ? count(b) - count(a) : 0) || byName.compare(name(a), name(b)));
  }

  /**
   * `items` in the order chosen for `list`: those it was given a place among first, as placed, then
   * any it hasn't seen (new ones) in the order they came in.
   */
  sorted<T>(list: string, items: readonly T[], keyOf: (item: T) => string): T[] {
    const order = this.#order[list];
    if (!order?.length) return [...items];
    const rank = new Map(order.map((key, i) => [key, i]));
    return items
      .map((item, i) => ({ item, rank: rank.get(keyOf(item)) ?? order.length + i }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ item }) => item);
  }

  /**
   * Moves `key` in `list`, whose items are `keys` in their order now, to before `before` (or the
   * end). Moved in a sorted `section`, it's sorted by hand from now on, starting from that order.
   */
  move(list: string, keys: readonly string[], key: string, before: string | null, section?: string) {
    const rest = keys.filter((each) => each !== key);
    const at = before === null ? rest.length : rest.indexOf(before);
    if (at < 0) return;
    rest.splice(at, 0, key);
    if (section && this.sortOf(section) !== "manual") this.#sort = { ...this.#sort, [section]: "manual" };
    this.#order = { ...this.#order, [list]: rest };
    this.#save();
  }

  /** A tag or type renamed: it keeps its place, and stays hidden if it was. */
  rename(kind: "tag" | "type", from: string, to: string) {
    const renamed = (name: string) => (kind === "type" ? (name === from ? to : name) : within(name, from) ? to + name.slice(from.length) : name);
    const renamedKey = (key: string) => (key.startsWith(`${kind}:`) ? `${kind}:${renamed(key.slice(kind.length + 1))}` : key);
    this.#hidden = this.#hidden.map(renamedKey);
    this.#sizes = Object.fromEntries(Object.entries(this.#sizes).map(([key, size]) => [renamedKey(key), size]));
    this.#order = Object.fromEntries(
      Object.entries(this.#order).map(([list, keys]) => {
        if (kind === "type") return [list, list === "types" ? keys.map(renamed) : keys];
        if (!list.startsWith("tags:")) return [list, keys];
        const parent = list.slice("tags:".length);
        return [parent ? `tags:${renamed(parent)}` : list, keys.map(renamed)];
      }),
    );
    this.#save();
  }
}

export const sidebarLayout = new SidebarLayout();
