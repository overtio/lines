import { isPaletteColor, type PaletteColor } from "../palette";
import { ICONS, type IconName } from "../icons/icons";
import { mergeRatings, noRatings, type RatingChoices, readRatings, writeRatings } from "../library/ratings";

/*
 * What tags and types look like, as every device has it: the icon and color chosen for each; and
 * what the Library's kinds are rated on (library/ratings.ts). Synced as one file, `library.json`,
 * beside the notes (docs/sync.md); each choice keeps when it was made, so two devices' merge entry
 * by entry, the later choice winning. One set back to how it was stays, empty, so that undoing it
 * syncs too.
 */

/** What a tag or type looks like, as chosen: none of either, it looks as it would. */
export interface Look {
  icon?: IconName;
  color?: PaletteColor;
}

/** A look, and when it was last chosen (0: on this device before looks synced). */
export interface Chosen extends Look {
  at: number;
}

export type LookKind = "tags" | "types";

export interface Looks {
  tags: Record<string, Chosen>;
  types: Record<string, Chosen>;
  ratings: RatingChoices;
}

export const LOOKS_FILE = "library.json";

export const noLooks = (): Looks => ({ tags: {}, types: {}, ratings: noRatings() });

/** What's chosen in `value`, kept only if it's an icon and a color lines has. */
function chosen(value: unknown): Chosen | null {
  if (!value || typeof value !== "object") return null;
  const { icon, color, at } = value as Record<string, unknown>;
  return {
    ...(typeof icon === "string" && icon in ICONS && { icon: icon as IconName }),
    ...(isPaletteColor(color) && { color }),
    at: typeof at === "number" && Number.isFinite(at) ? at : 0,
  };
}

/** Looks as written (by `writeLooks`, or a newer lines with more), or none if they can't be read. */
export function readLooks(text: string): Looks {
  try {
    const raw = JSON.parse(text);
    const kind = (value: unknown) => {
      const looks: Record<string, Chosen> = {};
      for (const [name, look] of Object.entries(value && typeof value === "object" ? value : {})) {
        const read = chosen(look);
        if (read) looks[name] = read;
      }
      return looks;
    };
    return { tags: kind(raw?.tags), types: kind(raw?.types), ratings: readRatings(raw?.ratings) };
  } catch {
    return noLooks();
  }
}

/** As a file, names in order, so the same looks always read the same. */
export function writeLooks(looks: Looks): string {
  const sorted = (kind: Record<string, Chosen>) => Object.fromEntries(Object.keys(kind).sort().map((name) => [name, kind[name]]));
  return JSON.stringify({ format: "lines-library", version: 1, tags: sorted(looks.tags), types: sorted(looks.types), ratings: writeRatings(looks.ratings) }, null, 2) + "\n";
}

/** Two devices' looks as one: for each tag and type, and each rating choice, the later; at the same time, `there`'s, so both end up alike. */
export function mergeLooks(here: Looks, there: Looks): Looks {
  const kind = (mine: Record<string, Chosen>, theirs: Record<string, Chosen>) => {
    const merged = { ...theirs };
    for (const [name, look] of Object.entries(mine)) if (!theirs[name] || look.at > theirs[name].at) merged[name] = look;
    return merged;
  };
  return { tags: kind(here.tags, there.tags), types: kind(here.types, there.types), ratings: mergeRatings(here.ratings, there.ratings) };
}
