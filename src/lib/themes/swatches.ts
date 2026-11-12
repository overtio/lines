import type { Palette, ThemeColors } from "../plugins/types";
import { contrast, fromLch, hex, isDark, type Lch, parse, readableOn, toLch } from "./color";
import type { ThemeFile } from "./file";
import { themeColors } from "./palette";

/*
 * A picture's colors, and a theme from them. Its pixels are grouped (k-means, in OKLab, where
 * distance is how different colors look); the main tone tints the backgrounds, light and dark, as
 * much as it's colorful; the most vivid color that's also plentiful is the accent; and colors near
 * red, green, blue and the rest color callouts and code. Text and accent are made to read on the
 * backgrounds; palette.ts does the rest, as for a theme from another app.
 *
 * Settings → Theme → New → From a Picture… uses it (picture.ts), and so does tools/themes, which
 * reads videos too and keeps more of the colors.
 */

/** A color a picture has, and the share of its pixels near it. */
export interface Swatch extends Lch {
  weight: number;
}

/** OKLab's a and b, from a hue and chroma. */
const ab = ({ c, h }: Lch) => [c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

/** RGBA bytes as OKLab points (lightness, a, b), three numbers each; see-through pixels left out. */
export function points(data: ArrayLike<number>): Float64Array {
  const found = new Float64Array((data.length / 4) * 3);
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const lch = toLch({ r: data[i], g: data[i + 1], b: data[i + 2], a: 1 });
    const [a, b] = ab(lch);
    found[n++] = lch.l;
    found[n++] = a;
    found[n++] = b;
  }
  return found.subarray(0, n);
}

const distance = (p: Float64Array, i: number, q: ArrayLike<number>, j: number) => (p[i] - q[j]) ** 2 + (p[i + 1] - q[j + 1]) ** 2 + (p[i + 2] - q[j + 2]) ** 2;

/** The points grouped around `k` centers, most plentiful first: k-means, its centers started far apart (k-means++, the same each time). */
export function groups(points: Float64Array, k: number): Swatch[] {
  const n = points.length / 3;
  if (!n) return [];
  let seed = n;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const centers: number[] = [];
  const add = (i: number) => centers.push(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
  add(Math.floor(random() * n));
  // How far each point is from its nearest center so far.
  const far = new Float64Array(n).fill(Infinity);
  while (centers.length / 3 < Math.min(k, n)) {
    const last = centers.length - 3;
    let total = 0;
    for (let i = 0; i < n; i++) total += far[i] = Math.min(far[i], distance(points, i * 3, centers, last));
    if (!total) break;
    let pick = random() * total;
    let index = n - 1;
    for (let i = 0; i < n; i++) if ((pick -= far[i]) <= 0) {
      index = i;
      break;
    }
    add(index);
  }
  const count = centers.length / 3;
  const owner = new Int32Array(n);
  for (let round = 0; round < 12; round++) {
    for (let i = 0; i < n; i++) {
      let best = 0;
      let nearest = Infinity;
      for (let j = 0; j < count; j++) {
        const d = distance(points, i * 3, centers, j * 3);
        if (d < nearest) [best, nearest] = [j, d];
      }
      owner[i] = best;
    }
    const sums = new Float64Array(count * 4);
    for (let i = 0; i < n; i++) {
      const s = owner[i] * 4;
      sums[s] += points[i * 3];
      sums[s + 1] += points[i * 3 + 1];
      sums[s + 2] += points[i * 3 + 2];
      sums[s + 3]++;
    }
    for (let j = 0; j < count; j++) if (sums[j * 4 + 3]) for (let axis = 0; axis < 3; axis++) centers[j * 3 + axis] = sums[j * 4 + axis] / sums[j * 4 + 3];
  }
  const counts = new Int32Array(count);
  for (const j of owner) counts[j]++;
  return Array.from({ length: count }, (_, j) => {
    const [l, a, b] = centers.slice(j * 3, j * 3 + 3);
    return { l, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI, weight: counts[j] / n };
  })
    .filter((group) => group.weight > 0)
    .sort((x, y) => y.weight - x.weight);
}

/**
 * `count` colors that show a picture: its pixels grouped finely, then the groups picked one at a
 * time for being plentiful, vivid and unlike those picked already, so a small bright patch (a
 * glowing leaf in a dark scene) makes it in beside the wide washes of color. Each takes in the
 * pixels of the groups not picked that are nearest it. Most plentiful first.
 */
export function swatches(points: Float64Array, count: number): Swatch[] {
  const fine = groups(points, Math.max(48, count * 3));
  if (fine.length <= count) return fine;
  const lab = fine.map((group) => [group.l, ...ab(group)]);
  const apart = (i: number, j: number) => Math.hypot(lab[i][0] - lab[j][0], lab[i][1] - lab[j][1], lab[i][2] - lab[j][2]);
  const worth = (i: number, distance: number) => Math.sqrt(fine[i].weight) * (1 + 4 * fine[i].c) * distance;
  const picked = [0];
  const nearest = fine.map((_, i) => apart(i, 0));
  while (picked.length < count) {
    let best = -1;
    for (let i = 0; i < fine.length; i++) if (nearest[i] > 0 && (best < 0 || worth(i, nearest[i]) > worth(best, nearest[best]))) best = i;
    if (best < 0) break;
    picked.push(best);
    for (let i = 0; i < fine.length; i++) nearest[i] = Math.min(nearest[i], apart(i, best));
  }
  const weights = picked.map(() => 0);
  fine.forEach((group, i) => {
    const closest = picked.reduce((a, b, at) => (apart(i, b) < apart(i, picked[a]) ? at : a), 0);
    weights[closest] += group.weight;
  });
  return picked.map((i, at) => ({ ...fine[i], weight: weights[at] })).sort((x, y) => y.weight - x.weight);
}

/** Where each hue a palette names sits in OKLCH, in degrees. */
const HUES = { red: 25, orange: 55, yellow: 100, green: 145, cyan: 200, blue: 255, magenta: 330 } as const;

const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** The colors of a scheme's palette from a picture's swatches. */
function palette(found: Swatch[], dark: boolean): Palette {
  const main = found[0];
  const colorful = found.filter((group) => group.c >= 0.05);
  // Plentiful and vivid: a bright sliver counts less than a wide wash of color.
  const lead = colorful.reduce<Swatch | undefined>((best, group) => (!best || group.c * Math.sqrt(group.weight) > best.c * Math.sqrt(best.weight) ? group : best), undefined);
  // The backgrounds take the main tone's hue, more of it the more colorful the picture is; light
  // ones less, where a little color goes a long way.
  const tint = Math.min(dark ? 0.03 : 0.02, main.c * 0.3);
  const shade = (l: number, c = tint) => hex(fromLch({ l, c, h: main.h }));
  const bg = fromLch({ l: dark ? 0.2 : 0.985, c: tint, h: main.h });
  // A picture without color (black and white) has a grey accent, as dark or light as the text's.
  const accentFrom: Lch = lead ?? { l: dark ? 0.85 : 0.35, c: 0, h: 0 };
  // The accent at a lightness that reads as a color, then as far as it takes to read on the page.
  const accent = readableOn(fromLch({ ...accentFrom, l: dark ? Math.max(accentFrom.l, 0.72) : Math.min(accentFrom.l, 0.55) }), bg, 4.5);
  const near = (hue: number) =>
    colorful.filter((group) => group.c >= 0.08 && apart(group.h, hue) <= 25).sort((x, y) => y.c * Math.sqrt(y.weight) - x.c * Math.sqrt(x.weight))[0];
  const hues = Object.fromEntries(
    Object.entries(HUES).flatMap(([name, hue]) => {
      const group = near(hue);
      return group ? [[name, hex(readableOn(fromLch({ ...group, l: dark ? Math.max(group.l, 0.7) : Math.min(group.l, 0.6) }), bg, 3))]] : [];
    }),
  ) as Palette["hues"];
  return {
    background: hex(bg),
    foreground: shade(dark ? 0.93 : 0.23, Math.min(tint, 0.02)),
    sidebar: shade(dark ? 0.235 : 0.955, tint * 1.4),
    elevated: dark ? shade(0.26) : undefined,
    muted: hex(readableOn(fromLch({ l: dark ? 0.72 : 0.5, c: Math.min(tint, 0.02), h: main.h }), bg, 5)),
    accent: hex(accent),
    hues,
  };
}

/** Whether a scheme's colors read (its text and accent on its background), and are light or dark as they should be. */
function reads(colors: ThemeColors, dark: boolean) {
  const [bg, text, accent] = [colors.bg, colors.text, colors.accent].map((value) => parse(value)!);
  return isDark(bg) === dark && contrast(text, bg) >= 7 && contrast(accent, bg) >= 4.5;
}

/** A theme, light and dark, from a picture's swatches, called `name`. Throws if they can't make one. */
export function themeFromSwatches(found: Swatch[], name: string): ThemeFile {
  if (!found.length) throw new Error("The picture has no colors to read");
  const [light, dark] = [false, true].map((dark) => themeColors(palette(found, dark)).colors);
  if (!reads(light, false) || !reads(dark, true)) throw new Error("The picture's colors don't make a readable theme");
  return { name, light, dark };
}
