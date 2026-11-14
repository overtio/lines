import type { IconName } from "../icons/icons";
import type { PaletteColor } from "../palette";
import { plugins } from "../plugins/registry.svelte";
import type { Note, NoteMeta } from "./types";
import { type Chosen, type Look, type LookKind, type Looks, mergeLooks, noLooks, readLooks, writeLooks } from "./looks";

const KEY = "lines.looks";
/** Where each device kept its icons before they synced: brought in once, as chosen before anything synced. */
const BEFORE: Record<LookKind, string> = { tags: "lines.tagIcons", types: "lines.typeIcons" };

function read(): Looks {
  try {
    const kept = localStorage.getItem(KEY);
    if (kept !== null) return readLooks(kept);
    const looks = noLooks();
    for (const kind of ["tags", "types"] as const) {
      const icons: unknown = JSON.parse(localStorage.getItem(BEFORE[kind]) ?? "{}");
      looks[kind] = readLooks(JSON.stringify({ [kind]: Object.fromEntries(Object.entries(icons ?? {}).map(([name, icon]) => [name, { icon, at: 0 }])) }))[kind];
    }
    return looks;
  } catch {
    return noLooks();
  }
}

/** Every tag's and type's look, kept on this device and synced (looks.ts). */
class LibraryLooks {
  #looks = $state.raw<Looks>(read());
  #listeners = new Set<() => void>();

  get looks(): Looks {
    return this.#looks;
  }

  get(kind: LookKind, name: string): Look | undefined {
    return this.#looks[kind][name];
  }

  /** Changes what's chosen for one; null for either goes back to how it'd look. */
  set(kind: LookKind, name: string, change: { icon?: IconName | null; color?: PaletteColor | null }) {
    const { icon, color } = { ...this.#looks[kind][name], ...change };
    const look: Chosen = { ...(icon && { icon }), ...(color && { color }), at: Date.now() };
    this.#change({ ...this.#looks, [kind]: { ...this.#looks[kind], [name]: look } });
  }

  /** A tag renamed (with those nested in it) or a type: its look goes with it, unless the new name has one. */
  rename(kind: LookKind, from: string, to: string) {
    const at = Date.now();
    const moves = (name: string) => name === from || (kind === "tags" && name.startsWith(`${from}/`));
    const looks = { ...this.#looks[kind] };
    for (const [name, look] of Object.entries(this.#looks[kind])) {
      if (!moves(name) || (!look.icon && !look.color)) continue;
      const renamed = to + name.slice(from.length);
      if (!looks[renamed]?.icon && !looks[renamed]?.color) looks[renamed] = { ...look, at };
      looks[name] = { at };
    }
    this.#change({ ...this.#looks, [kind]: looks });
  }

  /** Takes in another device's looks; whether any here changed. */
  merge(there: Looks): boolean {
    const merged = mergeLooks(this.#looks, there);
    if (writeLooks(merged) === writeLooks(this.#looks)) return false;
    this.#looks = merged;
    this.#save();
    return true;
  }

  /** Called on each change made here, to sync it. */
  onChange(listener: () => void) {
    this.#listeners.add(listener);
  }

  #change(looks: Looks) {
    this.#looks = looks;
    this.#save();
    for (const listener of this.#listeners) listener();
  }

  #save() {
    try {
      localStorage.setItem(KEY, writeLooks(this.#looks));
    } catch {
      // Private mode or full storage: they last until lines is closed, and sync if it's on.
    }
  }
}

export const looks = new LibraryLooks();

/** The looks of one kind: each one's icon (its own, or else `fallback`'s) and its color. */
class KindLooks {
  #kind: LookKind;
  #fallback: (name: string) => IconName;

  constructor(kind: LookKind, fallback: (name: string) => IconName) {
    this.#kind = kind;
    this.#fallback = fallback;
  }

  icon(name: string): IconName {
    return looks.get(this.#kind, name)?.icon ?? this.#fallback(name);
  }

  /** The icon chosen for it, if one was. */
  chosenIcon(name: string): IconName | undefined {
    return looks.get(this.#kind, name)?.icon;
  }

  /** The color chosen for it, if one was. */
  color(name: string): PaletteColor | undefined {
    return looks.get(this.#kind, name)?.color;
  }

  /** The color it shows in: its own, or else (a nested tag) the nearest tag it's in that has one. */
  shownColor(name: string): PaletteColor | undefined {
    return this.color(name) ?? this.inherited(name)?.color;
  }

  /** The color a nested tag has, when it has none of its own: that of the nearest tag it's in with one, and which. */
  inherited(name: string): { color: PaletteColor; from: string } | undefined {
    if (this.#kind !== "tags") return undefined;
    for (let from = name.slice(0, Math.max(0, name.lastIndexOf("/"))); from; from = from.slice(0, Math.max(0, from.lastIndexOf("/")))) {
      const color = this.color(from);
      if (color) return { color, from };
    }
  }

  /** Chooses its icon; null (or its fallback) goes back to the fallback. */
  setIcon(name: string, icon: IconName | null) {
    looks.set(this.#kind, name, { icon: icon === this.#fallback(name) ? null : icon });
  }

  setColor(name: string, color: PaletteColor | null) {
    looks.set(this.#kind, name, { color });
  }

  rename(from: string, to: string) {
    looks.rename(this.#kind, from, to);
  }
}

/** Tags without an icon of their own show a #. */
export const tagLooks = new KindLooks("tags", () => "hash");

/** Icons that suit types people often use, until another is chosen. */
const TYPE_ICONS: Record<string, IconName> = {
  person: "user",
  people: "users",
  contact: "user",
  friend: "user",
  team: "users",
  company: "building-2",
  organization: "building-2",
  organisation: "building-2",
  project: "briefcase",
  meeting: "calendar",
  event: "calendar",
  book: "book",
  article: "newspaper",
  paper: "file-text",
  place: "map-pin",
  location: "map-pin",
  city: "map-pin",
  trip: "plane",
  recipe: "utensils",
  movie: "film",
  film: "film",
  album: "music",
  song: "music",
  product: "package",
  device: "laptop",
  car: "car",
  task: "square-check",
  idea: "lightbulb",
};

/** The look of each type (`type: person`, see properties.ts): a library kind's icon (books', movies'…), or else one that suits it. */
export const typeLooks = new KindLooks("types", (type) => plugins.libraryKind(type)?.icon ?? TYPE_ICONS[type] ?? "shapes");

/**
 * The color a note shows in on the Calendar: its own (chosen with its icon), or else its type's, or
 * else its first tag's that has one (a nested tag's, or the tag it's in).
 */
export function noteColor({ note, meta }: { note: Note; meta: NoteMeta }): PaletteColor | undefined {
  if (note.color) return note.color;
  const type = meta.type && typeLooks.color(meta.type);
  if (type) return type;
  for (const tag of meta.tags) {
    const color = tagLooks.shownColor(tag);
    if (color) return color;
  }
}

/** A note's icon, where it shows one (the list, the Calendar): its own, or else its type's. */
export const iconOf = ({ note, meta }: { note: Note; meta: NoteMeta }): IconName | undefined =>
  note.icon ?? (meta.type ? typeLooks.icon(meta.type) : undefined);

/** The color of a note's icon in the list: its own, or its type's while it shows the type's icon. Not a tag's, which says nothing of its icon. */
export const iconColor = ({ note, meta }: { note: Note; meta: NoteMeta }): PaletteColor | undefined =>
  note.color ?? (!note.icon && meta.type ? typeLooks.color(meta.type) : undefined);
