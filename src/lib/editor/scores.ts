import { WidgetType } from "@codemirror/view";
import { mount } from "svelte";
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

/**
 * Each icon drawn once in each icon set (`set`, the one chosen, which Icon draws in), and copied into
 * every mark that shows it: a table of 250 ratings is 1,250 marks.
 */
const drawn = new Map<string, Element>();
function iconOf(name: IconName, set: string): Node {
  const key = `${set}:${name}`;
  let icon = drawn.get(key);
  if (!icon) {
    const target = document.createElement("span");
    mount(Icon, { target, props: { name, size: 16, strokeWidth: 2 } });
    icon = target.firstElementChild!;
    drawn.set(key, icon);
  }
  return icon.cloneNode(true);
}

/** How far apart marks are, as a share of one: the gap after each (editor.css's, `.cm-lp-score-compact`'s too). */
const GAP = 0.125;

/**
 * An icon as masks for marks drawn in one piece (`compact`): its outline, and filled, each with the
 * gap after it, to repeat along a line; none where its set doesn't draw it as an SVG (SF Symbols').
 */
const masks = new Map<string, { outline: string; filled: string } | null>();
function masksOf(name: IconName, set: string) {
  const key = `${set}:${name}`;
  if (!masks.has(key)) {
    iconOf(name, set);
    const icon = drawn.get(key);
    let found = null;
    if (icon instanceof SVGSVGElement) {
      const svg = icon.cloneNode(true) as SVGSVGElement;
      const [x, y, width, height] = (svg.getAttribute("viewBox") ?? "0 0 24 24").split(/\s+/).map(Number);
      svg.setAttribute("viewBox", `${x} ${y} ${width * (1 + GAP)} ${height}`);
      svg.removeAttribute("class");
      svg.setAttribute("stroke", "black");
      const url = () => `url("data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}")`;
      const outline = url();
      svg.setAttribute("fill", "black");
      found = { outline, filled: url() };
    }
    masks.set(key, found);
  }
  return masks.get(key);
}

/**
 * A score drawn: its marks, its points or its word, said as "4 out of 5". `mark` is the icon of
 * marks whose scale has none of its own; `set`, the icon set chosen. `compact`, its marks are one
 * piece, masked by their icon, where they needn't each be clicked (a table's 250 ratings).
 */
export function drawScore(score: Score, scale: Scale, mark: IconName, set: string, compact = false): HTMLElement {
  const el = document.createElement("span");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", spokenScore(score, scale));
  const icon = scale.kind === "marks" ? (scale.icon ?? mark) : null;
  const masked = compact && icon && masksOf(icon, set);
  if (masked) {
    el.className = `cm-lp-score cm-lp-score-${TONES[icon] ?? "accent"} cm-lp-score-compact`;
    const whole = Math.floor(score.score);
    el.style.cssText = `--marks: ${score.of}; --outline: ${masked.outline}; --filled: ${masked.filled}; --fill: calc(${whole} * ${1 + GAP}em + ${score.score - whole}em)`;
    el.append(document.createElement("span"), document.createElement("span"));
    return el;
  }
  /** One of its marks: `fill` of it filled, 0, ½ or 1; a click on it sets `value` (ratings.ts). */
  const markOf = (icon: IconName, fill: number, value: number) => {
    const target = document.createElement("span");
    target.className = `cm-lp-score-mark${fill === 1 ? " is-filled" : fill ? " is-half" : ""}`;
    target.dataset.score = String(value);
    target.setAttribute("aria-hidden", "true");
    for (let layer = 0; layer < (fill === 0.5 ? 2 : 1); layer++) target.append(iconOf(icon, set));
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
  return el;
}

export class ScoreWidget extends WidgetType {
  constructor(
    readonly score: Score,
    readonly scale: Scale,
    /** The icon of marks whose scale has none of its own. */
    readonly mark: IconName,
    /** The icon set it's drawn in, so it's drawn again in another. */
    readonly set: string,
  ) {
    super();
  }
  eq(other: ScoreWidget) {
    return JSON.stringify([other.score, other.scale, other.mark, other.set]) === JSON.stringify([this.score, this.scale, this.mark, this.set]);
  }
  toDOM() {
    return drawScore(this.score, this.scale, this.mark, this.set);
  }
  // A click on a mark sets it (ratings.ts); elsewhere, it puts the cursor on its line, which shows it as written.
  ignoreEvent() {
    return false;
  }
}
