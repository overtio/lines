import { WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { t } from "../i18n/index.svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import type { ScoreStyle } from "../prefs.svelte";

/*
 * Scores: a value like `5/7` on a `Key: Value` line or in the properties (`Rating: 4/5`), drawn as
 * marks, five of seven filled (Settings → Little Touches): stars, hearts or circles, or as written.
 * A library note's ratings are read on its kind's scale instead (library/ratings.svelte.ts): marks,
 * points (`85/100`) or words (`A`). With the cursor on its line, it's as written, to change; a click
 * on a mark sets it (ratings.ts). Screen readers hear "5 out of 7".
 */

/** The most marks a score is drawn with: a `12/20` is more number than marks. */
export const MOST_MARKS = 10;

/** What something is rated on. */
export type Scale =
  /** Marks, so many filled, or half of one (`3.5/5`): in an icon of their own, or Little Touches'. */
  | { kind: "marks"; of: number; icon?: IconName }
  /** A number out of so many, to a tenth: `85/100`, `7.5/10`. */
  | { kind: "points"; of: number }
  /**
   * Words, the best first (`S`, `A`, `B`…), drawn as their icons where they have them (thumbs up and
   * down), and shown by their `names` where they're lines' own, in the app's language.
   */
  | { kind: "labels"; labels: string[]; icons?: IconName[]; names?: string[] };

/** A value on a scale: `score` out of `of`. A word counts up from the worst, 1, to the best, `of`, and `label` is it as its scale writes it. */
export interface Score {
  score: number;
  of: number;
  label?: string;
}

const OUT_OF = /^(\d{1,4}(?:\.\d)?)\s*\/\s*(\d{1,4})$/;

/** The score a value is on `scale`, as it writes them; with none, marks out of 2 to 10 (`5/7`, `4 / 5`, `3.5/5`). */
export function scoreIn(value: string, scale?: Scale): Score | null {
  const text = value.trim();
  if (scale?.kind === "labels") {
    const index = scale.labels.findIndex((label) => label.toLowerCase() === text.toLowerCase());
    return index < 0 ? null : { score: scale.labels.length - index, of: scale.labels.length, label: scale.labels[index] };
  }
  const match = OUT_OF.exec(text);
  if (!match) return null;
  const [score, of] = [Number(match[1]), Number(match[2])];
  if (score > of) return null;
  if (scale?.kind === "points") return of === scale.of ? { score, of } : null;
  // Marks fill whole, or by halves.
  const fits = scale ? of === scale.of : of >= 2 && of <= MOST_MARKS;
  return fits && Number.isInteger(score * 2) ? { score, of } : null;
}

/** `score` on `scale`, with its word where it's one. */
export function scoreOn(score: number, scale: Scale): Score {
  const of = scale.kind === "labels" ? scale.labels.length : scale.of;
  return { score, of, ...(scale.kind === "labels" && { label: scale.labels[of - score] }) };
}

/** How `score` is written on `scale`: `4/5`, `85/100`, `A`. */
export const scoreText = (score: number, scale: Scale) => (scale.kind === "labels" ? scale.labels[scale.labels.length - score] : `${score}/${scale.of}`);

/** The scores a scale has, the best first, as a menu offers them: points out of more than 10 by tenths of the whole (`100/100`, `90/100`…). */
export function scoresOf(scale: Scale): number[] {
  const of = scale.kind === "labels" ? scale.labels.length : scale.of;
  const steps = scale.kind === "points" && of > MOST_MARKS ? MOST_MARKS : of;
  return Array.from({ length: steps }, (_, i) => Math.round((of * (steps - i)) / steps));
}

/** How far up its scale a score is, from 0 to 1: a word from the worst, 0, to the best, 1. */
export const fractionOf = ({ score, of, label }: Score) => (label === undefined ? score / of : of > 1 ? (score - 1) / (of - 1) : 1);

/** A score as it's said: "4 out of 5", or its word. */
export function spokenScore({ score, of, label }: Score, scale?: Scale) {
  if (label === undefined) return t("editor.score", { score, of });
  return (scale?.kind === "labels" && scale.names?.[scale.labels.indexOf(label)]) || label;
}

/** Little Touches' marks, which scores are drawn in where their scale has no icon of its own. */
export const MARKS: Record<Exclude<ScoreStyle, "off">, IconName> = { stars: "star", hearts: "heart", circles: "circle" };

/** The color marks of these icons are filled in: stars yellow and hearts red, as the theme has them, and others its accent. */
const TONES: Partial<Record<IconName, string>> = { star: "stars", heart: "hearts" };

const mounted = new WeakMap<HTMLElement, Record<string, unknown>[]>();

/**
 * A score drawn: its marks, its points or its word, said as "4 out of 5". `mark` is the icon of
 * marks whose scale has none of its own. Its icons are to be unmounted with it (`unmountScore`).
 */
export function drawScore(score: Score, scale: Scale, mark: IconName): HTMLElement {
  const el = document.createElement("span");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", spokenScore(score, scale));
  const icons: Record<string, unknown>[] = [];
  /** One of its marks: `fill` of it filled, 0, ½ or 1; a click on it sets `value` (ratings.ts). */
  const markOf = (icon: IconName, fill: number, value: number) => {
    const target = document.createElement("span");
    target.className = `cm-lp-score-mark${fill === 1 ? " is-filled" : fill ? " is-half" : ""}`;
    target.dataset.score = String(value);
    target.setAttribute("aria-hidden", "true");
    for (let layer = 0; layer < (fill === 0.5 ? 2 : 1); layer++) icons.push(mount(Icon, { target, props: { name: icon, size: 16, strokeWidth: 2 } }));
    el.append(target);
  };
  if (scale.kind === "points") {
    el.className = "cm-lp-score cm-lp-score-points";
    const of = document.createElement("span");
    of.className = "cm-lp-score-of";
    of.textContent = `/${score.of}`;
    const meter = document.createElement("span");
    meter.className = "cm-lp-score-meter";
    meter.style.setProperty("--filled", `${(score.score / score.of) * 100}%`);
    // The bar first, so bars of ratings under each other line up whatever their numbers.
    el.append(meter, String(score.score), of);
  } else if (scale.kind === "labels" && !scale.icons) {
    // A word, which a click offers the others of (ratings.ts).
    el.className = "cm-lp-score cm-lp-score-label";
    el.textContent = spokenScore(score, scale);
  } else if (scale.kind === "labels") {
    el.className = "cm-lp-score cm-lp-score-icons";
    scale.icons!.forEach((icon, i) => markOf(icon, Number(score.label === scale.labels[i]), scale.labels.length - i));
  } else {
    const icon = scale.icon ?? mark;
    el.className = `cm-lp-score cm-lp-score-${TONES[icon] ?? "accent"}`;
    for (let i = 0; i < scale.of; i++) markOf(icon, Math.min(1, Math.max(0, score.score - i)), i + 1);
  }
  mounted.set(el, icons);
  return el;
}

export function unmountScore(el: HTMLElement) {
  for (const icon of mounted.get(el) ?? []) void unmount(icon);
}

export class ScoreWidget extends WidgetType {
  constructor(
    readonly score: Score,
    readonly scale: Scale,
    /** The icon of marks whose scale has none of its own. */
    readonly mark: IconName,
  ) {
    super();
  }
  eq(other: ScoreWidget) {
    return JSON.stringify([other.score, other.scale, other.mark]) === JSON.stringify([this.score, this.scale, this.mark]);
  }
  toDOM() {
    return drawScore(this.score, this.scale, this.mark);
  }
  destroy(dom: HTMLElement) {
    unmountScore(dom);
  }
  // A click on a mark sets it (ratings.ts); elsewhere, it puts the cursor on its line, which shows it as written.
  ignoreEvent() {
    return false;
  }
}
