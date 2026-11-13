import type { IconName } from "../icons/icons";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryKind, Made } from "../plugins/types";

/*
 * The Library's rows in the sidebar, its shelves: one for each kind of thing plugins add (Books,
 * Movies…), or for several listed together (Music: songs and albums), in the order the kinds come.
 */

export interface Shelf {
  /** The type of its first kind, which it's known by: "book", "song". */
  key: string;
  label: string;
  icon: IconName;
  kinds: LibraryKind[];
}

class Shelves {
  readonly all = $derived.by(() => {
    const kinds = plugins.libraryKinds;
    const types = new Set(kinds.map((kind) => kind.type));
    const shelves = new Map<string, Shelf>();
    for (const kind of kinds) {
      const key = kind.shelf && types.has(kind.shelf) ? kind.shelf : kind.type;
      const shelf = shelves.get(key);
      if (shelf) shelf.kinds.push(kind);
      else shelves.set(key, { key, label: kind.label, icon: kind.icon, kinds: [kind] });
    }
    return [...shelves.values()];
  });

  readonly #byType = $derived(new Map(this.all.flatMap((shelf) => shelf.kinds.map((kind) => [kind.type, shelf] as const))));

  /** The shelf a note of this type is on, if its type is a library kind's. */
  of(type: string): Shelf | undefined {
    return this.#byType.get(type);
  }

  get(key: string): Shelf | undefined {
    return this.all.find((shelf) => shelf.key === key);
  }

  /** What a new note of a kind is, by its type (on a shelf, its first kind's: the shelf's key): of that type, where it starts (`status: to read`). */
  made(type: string): Made {
    const kind = plugins.libraryKind(type);
    if (!kind) return {};
    const status = kind.statuses?.[0]?.value;
    return { type: kind.type, ...(status && { properties: { status } }) };
  }
}

export const shelves = new Shelves();
