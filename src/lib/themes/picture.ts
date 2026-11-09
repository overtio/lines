import type { Palette, ThemeColors } from "../plugins/types";
import { contrast, fromLch, hex, isDark, type Lch, parse, readableOn, toLch } from "./color";
import type { ThemeFile } from "./file";
import { themeColors } from "./palette";

/*
 * A theme from a picture (Settings → Theme → New → From a Picture…): a wallpaper's colors, read on
 * this device. The picture's colors are grouped (k-means, in OKLab, where distance is how different
 * colors look); its main tone tints the backgrounds, light and dark, as much as it's colorful; its
 * most vivid color that's also plentiful is the accent; and colors near red, green, blue and the rest
 * color callouts and code. Text and accent are made to read on the backgrounds; palette.ts does the
 * rest, as for a theme from another app.
 */

/** The longest side the picture is read at: enough for its colors, quick to group. */
const SIDE = 96;
const GROUPS = 8;

interface Group extends Lch {
  /** The share of the picture's pixels. */
  weight: number;
}

/** OKLab's a and b, from a hue and chroma. */
const ab = ({ c, h }: Lch) => [c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

/** The picture's pixels as OKLab points (lightness, a, b), at most SIDE pixels on its longest side; see-through ones left out. */
async function pixels(picture: Blob): Promise<number[][]> {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const data = context.getImageData(0, 0, width, height).data;
  const points: number[][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const lch = toLch({ r: data[i], g: data[i + 1], b: data[i + 2], a: 1 });
    points.push([lch.l, ...ab(lch)]);
  }
  return points;
}

const distance = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** The points grouped around `k` centers: k-means, its centers started far apart (k-means++, the same each time). */
function groups(points: number[][], k: number): Group[] {
  if (!points.length) return [];
  let seed = points.length;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const centers = [points[Math.floor(random() * points.length)]];
  while (centers.length < Math.min(k, points.length)) {
    const far = points.map((point) => Math.min(...centers.map((center) => distance(point, center))));
    const total = far.reduce((sum, d) => sum + d, 0);
    if (!total) break;
    let pick = random() * total;
    const index = far.findIndex((d) => (pick -= d) <= 0);
    centers.push(points[index < 0 ? points.length - 1 : index]);
  }
  const owner = new Int32Array(points.length);
  for (let round = 0; round < 12; round++) {
    points.forEach((point, i) => {
      let best = 0;
      for (let j = 1; j < centers.length; j++) if (distance(point, centers[j]) < distance(point, centers[best])) best = j;
      owner[i] = best;
    });
    const sums = centers.map(() => [0, 0, 0, 0]);
    points.forEach((point, i) => {
      const sum = sums[owner[i]];
      sum[0] += point[0];
      sum[1] += point[1];
      sum[2] += point[2];
      sum[3]++;
    });
    sums.forEach((sum, j) => sum[3] && (centers[j] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]]));
  }
  const counts = new Int32Array(centers.length);
  for (const j of owner) counts[j]++;
  return centers
    .map(([l, a, b], j) => ({ l, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI, weight: counts[j] / points.length }))
    .filter((group) => group.weight > 0)
    .sort((x, y) => y.weight - x.weight);
}

/** Where each hue a palette names sits in OKLCH, in degrees. */
const HUES = { red: 25, orange: 55, yellow: 100, green: 145, cyan: 200, blue: 255, magenta: 330 } as const;

const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** The colors of a scheme's palette from the picture's groups. */
function palette(found: Group[], dark: boolean): Palette {
  const main = found[0];
  const colorful = found.filter((group) => group.c >= 0.05);
  // Plentiful and vivid: a bright sliver counts less than a wide wash of color.
  const lead = colorful.reduce<Group | undefined>((best, group) => (!best || group.c * Math.sqrt(group.weight) > best.c * Math.sqrt(best.weight) ? group : best), undefined);
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

/** A theme, light and dark, from `picture`'s colors, called `name`. Throws if the picture can't be read. */
export async function themeFromPicture(picture: Blob, name: string): Promise<ThemeFile> {
  const found = groups(await pixels(picture), GROUPS);
  if (!found.length) throw new Error("The picture has no colors to read");
  const [light, dark] = [false, true].map((dark) => themeColors(palette(found, dark)).colors);
  if (!reads(light, false) || !reads(dark, true)) throw new Error("The picture's colors don't make a readable theme");
  return { name, light, dark };
}

/** For a picture called "Lake at dawn.jpg": "Lake at dawn". */
export const pictureName = (fileName: string) => fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
