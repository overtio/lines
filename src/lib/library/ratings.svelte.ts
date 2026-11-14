import { speak } from "../a11y";
import { type Scale, type Score, scoreIn, scoreOn, scoresOf, spokenScore } from "../editor/scores";
import { t } from "../i18n/index.svelte";
import { looks } from "../notes/looks.svelte";
import { frontMatter, keyOf, propertyOf, renameKey, typeOf } from "../notes/properties";
import { notes } from "../notes/store.svelte";
import type { NoteMeta } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { MenuItem } from "../ui.svelte";
import { DEFAULT_SCALE, type KindRatings, type LinesScale, ratingKey, SCALES } from "./ratings";

/*
 * What each kind in the Library is rated on (Settings → Library → Ratings): its scale, lines' own or
 * one of yours, and its named ratings beside the overall one. A note's ratings are its properties,
 * `rating: 4/5`, `story: 8/10`, drawn on its kind's scale (editor/scores.ts) and set from its row's
 * menu, or by a click on a mark (editor/ratings.ts). Kept and synced in `library.json` (ratings.ts).
 */

/** lines' own words for a scale (thumbs up, thumbs down) as they're shown, in the app's language. */
function shown(scale: Scale): Scale {
  return scale.kind === "labels" && scale.icons ? { ...scale, names: [t("library.rating.thumbsUp"), t("library.rating.thumbsDown")] } : scale;
}

/** The overall rating's key, which every kind has. */
export const OVERALL = "rating";

/** A scale to choose, as Settings lists it. */
export interface ScaleChoice {
  id: string;
  name: string;
  scale: Scale;
  /** One of yours, which can be changed and removed. */
  own: boolean;
}

/** A rating a kind's notes can have: the overall one, or one named for something (`story`). */
export interface Rating {
  /** The property it's written as. */
  key: string;
  name: string;
}

class Ratings {
  readonly #choices = $derived(looks.looks.ratings);

  /** Every scale there is to choose from: lines' own, then yours by name. */
  readonly scales = $derived<ScaleChoice[]>([
    ...(Object.keys(SCALES) as LinesScale[]).map((id) => ({ id, name: t(`library.rating.scale.${id}`), scale: shown(SCALES[id]), own: false })),
    ...Object.entries(this.#choices.scales)
      .flatMap(([id, own]) => ("removed" in own ? [] : [{ id, name: own.name, scale: own.scale, own: true }]))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]);

  scale(id: string): ScaleChoice | undefined {
    return this.scales.find((scale) => scale.id === id);
  }

  /** Whether notes of a type are rated: a library kind's with a shelf (a feed's are subscriptions). */
  rated(type: string) {
    const kind = plugins.libraryKind(type);
    return !!kind && kind.shelf !== false;
  }

  /** The id of the scale a kind is rated on: as chosen, or lines' default, out of 5. */
  scaleId(type: string) {
    const id = this.#choices.kinds[type]?.scale?.id;
    return id && this.scale(id) ? id : DEFAULT_SCALE;
  }

  scaleOf(type: string): Scale {
    return this.scale(this.scaleId(type))!.scale;
  }

  /** A kind's named ratings, in order, as they're called: `Story`, `Music`. */
  named(type: string): string[] {
    return this.#choices.kinds[type]?.named?.names ?? [];
  }

  /** A kind's ratings: the overall one, then those it names. None for a type that isn't rated. */
  of(type: string): Rating[] {
    if (!this.rated(type)) return [];
    return [{ key: OVERALL, name: t("library.rating.overall") }, ...this.named(type).map((name) => ({ key: ratingKey(name), name }))];
  }

  /** The scale a property of a note of `type` is read on, if it's one of the type's ratings. */
  scaleFor(type: string, key: string): Scale | null {
    const wanted = keyOf(key);
    return this.of(type).some((rating) => keyOf(rating.key) === wanted) ? this.scaleOf(type) : null;
  }

  /** Which kinds are rated on a scale, by type. */
  usedBy(id: string): string[] {
    return Object.entries(this.#choices.kinds).flatMap(([type, kind]) => (kind.scale?.id === id && plugins.libraryKind(type) ? [type] : []));
  }

  setScale(type: string, id: string) {
    this.#kind(type, { scale: { id, at: Date.now() } });
  }

  setNamed(type: string, names: string[]) {
    this.#kind(type, { named: { names, at: Date.now() } });
  }

  /**
   * Calls a named rating something else, and its property in each of the kind's notes too (not
   * locked ones), as renaming a type does: they keep their dates. A note with both keeps them both.
   */
  rename(type: string, from: string, to: string) {
    const names = this.named(type);
    const at = names.findIndex((name) => ratingKey(name) === ratingKey(from));
    if (at < 0 || !to.trim()) return;
    this.setNamed(type, names.map((name, i) => (i === at ? to.trim() : name)));
    if (keyOf(from) === keyOf(to)) return;
    notes.rewrite((body) => (typeOf(frontMatter(body)?.properties ?? []) === type ? renameKey(body, ratingKey(from), ratingKey(to)) : body));
  }

  /** Keeps a scale of your own, a new one where `id` is null; its id. */
  saveScale(id: string | null, name: string, scale: Scale) {
    const kept = id ?? crypto.randomUUID();
    looks.setRatings({ ...this.#choices, scales: { ...this.#choices.scales, [kept]: { name: name.trim(), scale, at: Date.now() } } });
    return kept;
  }

  /** Removes a scale of yours, which syncs as removed. Kinds rated on it are on lines' default again. */
  removeScale(id: string) {
    looks.setRatings({ ...this.#choices, scales: { ...this.#choices.scales, [id]: { removed: true, at: Date.now() } } });
  }

  #kind(type: string, change: KindRatings) {
    looks.setRatings({ ...this.#choices, kinds: { ...this.#choices.kinds, [type]: { ...this.#choices.kinds[type], ...change } } });
  }
}

export const ratings = new Ratings();

/** A menu of a scale's scores, the best first, the one set checked, and a way to take it out: a row's Rate, a word's in a note. */
export function rateItems(scale: Scale, current: Score | null, set: (score: number | null) => void): MenuItem[] {
  const scores = scoresOf(scale).map((score) => ({ label: spokenScore(scoreOn(score, scale), scale), checked: current?.score === score, run: () => set(score) }));
  return current ? [...scores, "separator", { label: t("library.rating.clear"), icon: "x", run: () => set(null) }] : scores;
}

/** Says a rating was set ("Rated 4 out of 5") or taken out, for screen readers. */
export const sayRated = (score: number | null, scale: Scale) =>
  speak(score === null ? t("library.rating.cleared") : t("library.rating.rated", { score: spokenScore(scoreOn(score, scale), scale) }));

/** A library note's overall rating, on its kind's scale (as written, `score` null, where it doesn't fit), if it has one: what its row shows. */
export function ratingOf({ meta }: { meta: NoteMeta }): { score: Score | null; scale: Scale; written: string } | null {
  const written = propertyOf(meta.properties, OVERALL)?.value.trim();
  if (!written || !ratings.rated(meta.type)) return null;
  const scale = ratings.scaleOf(meta.type);
  return { score: scoreIn(written, scale), scale, written };
}
