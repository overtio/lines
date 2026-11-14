import type { Scale } from "../editor/scores";
import { ICONS, type IconName } from "../icons/icons";

/*
 * What things in the Library are rated on, as every device has it: each kind's scale and its named
 * ratings (a show's Story, Music…), and scales of your own. Kept in `library.json` with tags' and
 * types' looks (notes/looks.ts), each choice with when it was made, so devices merge them one by
 * one, the later winning, as looks do. A note's ratings are its properties: `rating: 4/5`,
 * `story: A` (ratings.svelte.ts).
 */

/** lines' own scales, by id: out of 5 in Little Touches' marks (the default), out of 10 and 100, thumbs, and grades. */
export const SCALES = {
  "5": { kind: "marks", of: 5 },
  "10": { kind: "points", of: 10 },
  "100": { kind: "points", of: 100 },
  thumbs: { kind: "labels", labels: ["thumbs up", "thumbs down"], icons: ["thumbs-up", "thumbs-down"] },
  grades: { kind: "labels", labels: ["S", "A", "B", "C", "D", "F"] },
} satisfies Record<string, Scale>;
export type LinesScale = keyof typeof SCALES;
export const DEFAULT_SCALE: LinesScale = "5";

/** The most a scale of your own can be out of: marks, which have to fit on a line; points; and words. */
export const MOST = { marks: 10, points: 1000, labels: 20 };
/** The longest a word on a scale, or a named rating, can be. */
export const LONGEST = 40;

/** A scale of your own, as kept: its name and what it is; or once it's removed, only when. */
export type OwnScale = { name: string; scale: Scale; at: number } | { removed: true; at: number };

/** A kind's choices: its scale, by id, and its named ratings besides the overall one, in order. */
export interface KindRatings {
  scale?: { id: string; at: number };
  named?: { names: string[]; at: number };
}

export interface RatingChoices {
  /** By the kind's type. */
  kinds: Record<string, KindRatings>;
  /** Scales of your own, by a random id. */
  scales: Record<string, OwnScale>;
}

export const noRatings = (): RatingChoices => ({ kinds: {}, scales: {} });

/** The property a named rating is written as: `Voice acting` is `voice acting: 8/10`. */
export const ratingKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

const time = (at: unknown) => (typeof at === "number" && Number.isFinite(at) ? at : 0);
const whole = (n: unknown, most: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= 2 && n <= most;

/** What a property's key can be (notes/properties.ts), as a named rating is one. */
const KEY = /^[\p{L}\p{N}_][\p{L}\p{N} _-]*$/u;

/**
 * Words for a scale (without commas, which a list of them is written with in Settings), or named
 * ratings (which are keys): each written once, without case, none too long.
 */
export function wordsIn(value: unknown, most: number, keys = false): string[] | null {
  if (!Array.isArray(value) || value.length > most) return null;
  const words = value.map((word) => (typeof word === "string" ? word.trim().replace(/\s+/g, " ") : ""));
  const fits = (word: string) => word && word.length <= LONGEST && (keys ? KEY.test(word) : !word.includes(","));
  return words.every(fits) && new Set(words.map(ratingKey)).size === words.length ? words : null;
}

/** A scale of your own as kept, if it's one this lines can draw. */
export function readScale(value: unknown): Scale | null {
  if (!value || typeof value !== "object") return null;
  const { kind, of, icon, labels } = value as Record<string, unknown>;
  if (kind === "marks" && whole(of, MOST.marks)) return { kind, of, ...(typeof icon === "string" && icon in ICONS && { icon: icon as IconName }) };
  if (kind === "points" && whole(of, MOST.points)) return { kind, of };
  const words = kind === "labels" ? wordsIn(labels, MOST.labels) : null;
  return words && words.length >= 2 ? { kind: "labels", labels: words } : null;
}

/** The choices as written (by `writeRatings`), leaving out what this lines can't read. */
export function readRatings(raw: unknown): RatingChoices {
  const ratings = noRatings();
  const { kinds, scales } = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const [type, value] of Object.entries(kinds && typeof kinds === "object" ? kinds : {})) {
    const { scale, named } = (value ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const kind: KindRatings = {};
    if (typeof scale?.id === "string") kind.scale = { id: scale.id, at: time(scale.at) };
    const names = named && wordsIn(named.names, MOST.labels, true);
    if (names && named) kind.named = { names, at: time(named.at) };
    if (kind.scale || kind.named) ratings.kinds[type] = kind;
  }
  for (const [id, value] of Object.entries(scales && typeof scales === "object" ? scales : {})) {
    const { name, scale, removed, at } = (value ?? {}) as Record<string, unknown>;
    const read = readScale(scale);
    if (removed === true) ratings.scales[id] = { removed: true, at: time(at) };
    else if (read && typeof name === "string" && name.trim()) ratings.scales[id] = { name: name.trim(), scale: read, at: time(at) };
  }
  return ratings;
}

const sorted = <T>(record: Record<string, T>) => Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));

/** As kept in the file, kinds and scales in order, so the same choices always read the same. */
export const writeRatings = (ratings: RatingChoices) => ({ kinds: sorted(ratings.kinds), scales: sorted(ratings.scales) });

/** The later of two choices; at the same time, `there`'s, so both devices end up alike. */
const later = <T extends { at: number }>(here: T | undefined, there: T | undefined) => (here && (!there || here.at > there.at) ? here : there);

/** Two devices' choices as one: for each kind's scale, its named ratings, and each scale of your own, the later. */
export function mergeRatings(here: RatingChoices, there: RatingChoices): RatingChoices {
  const kinds: Record<string, KindRatings> = {};
  for (const type of new Set([...Object.keys(here.kinds), ...Object.keys(there.kinds)])) {
    const [mine, theirs] = [here.kinds[type] ?? {}, there.kinds[type] ?? {}];
    const scale = later(mine.scale, theirs.scale);
    const named = later(mine.named, theirs.named);
    kinds[type] = { ...(scale && { scale }), ...(named && { named }) };
  }
  const scales: Record<string, OwnScale> = {};
  for (const id of new Set([...Object.keys(here.scales), ...Object.keys(there.scales)])) scales[id] = later(here.scales[id], there.scales[id])!;
  return { kinds, scales };
}
