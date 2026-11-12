import { t } from "../i18n/index.svelte";
import type { Palette } from "../plugins/types";
import { BLACK, parse, type Rgb, toLch } from "./color";
import type { Scheme } from "./palette";

/*
 * What a palette's colors are called when they have no name of their own: worked out from how they
 * look ("Teal", "Dark Gray", "Pale Pink"), in the app's language; and a theme's palettes for light and dark.
 */

export type Hue = "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink" | "brown" | "gray" | "black" | "white";
export type Tone = "dark" | "light" | "pale";

/** Where each hue starts going round OKLCH's, in degrees, last first; pink runs on past 360 to red. */
const HUES: [start: number, hue: Hue][] = [
  [340, "pink"],
  [270, "purple"],
  [210, "blue"],
  [170, "teal"],
  [115, "green"],
  [75, "yellow"],
  [45, "orange"],
  [12, "red"],
];

/** How dark a hue is before it's called dark, and how light before it's light: yellow is light to begin with, blue dark. */
const TONES: Partial<Record<Hue, [dark: number, light: number]>> = {
  red: [0.45, 0.8],
  orange: [0.5, 0.82],
  yellow: [0.6, 0.93],
  green: [0.5, 0.88],
  teal: [0.45, 0.85],
  pink: [0.55, 0.85],
  brown: [0.35, 0.7],
};

/** A color's hue, and whether it's dark, light or pale for one, in words. */
export function describe(color: Rgb): { hue: Hue; tone?: Tone } {
  const { l, c, h } = toLch(color);
  if (c < 0.04 && l >= 0.97) return { hue: "white" };
  if (c < 0.04 && l <= 0.22) return { hue: "black" };
  const angle = (h + 360) % 360;
  let hue: Hue = c < 0.04 ? "gray" : (HUES.find(([start]) => angle >= start)?.[1] ?? "pink");
  // Dull dark reds, oranges and yellows, and greyish light ones, are browns; light reds are pinks.
  if ((hue === "red" || hue === "orange" || hue === "yellow") && (l < 0.55 ? c < (hue === "red" ? 0.1 : 0.15) : hue !== "red" && c < 0.07)) hue = "brown";
  else if (hue === "red" && l > 0.75) hue = "pink";
  const [dark, light] = TONES[hue] ?? [0.4, 0.8];
  const pale = c < 0.1 && hue !== "gray" && hue !== "brown";
  return { hue, tone: l < dark ? "dark" : l > light ? (pale ? "pale" : "light") : undefined };
}

/** What a theme's palettes are called where its light and dark colors are one each: "Ocean Light", "Ocean Dark". */
export const schemePalettes = (theme: string): Record<Scheme, string> => ({
  light: t("settings.paletteLight", { name: theme }),
  dark: t("settings.paletteDark", { name: theme }),
});

/** What lines calls a color, from how it looks: "Teal", "Dark Gray", "Pale Pink". */
export function nameFor(color: Rgb) {
  const { hue, tone } = describe(color);
  const name = t(`picker.color.${hue}`);
  return tone ? t(`picker.color.${tone}`, { color: name }) : name;
}

/** Each of a palette's colors' names, by id: its own, or one worked out, numbered where two are the same ("Gray 2"). */
export function paletteNames(palette: Palette): Map<string, string> {
  const names = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const { id, name, color } of palette.colors) {
    const plain = name ?? nameFor(parse(color) ?? BLACK);
    const count = (seen.get(plain) ?? 0) + 1;
    seen.set(plain, count);
    names.set(id, count === 1 ? plain : t("picker.color.again", { name: plain, count }));
  }
  return names;
}
