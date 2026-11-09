import type { Palette, ThemeColors } from "../plugins/types";
import { BLACK, contrast, fromLch, hex, isDark, mix, over, parse, reach, readableOn, type Rgb, toLch, WHITE } from "./color";

/*
 * Working out a theme's colors: from the few a theme made for another app has (a Palette), for the
 * scheme a theme lacks, and for Increased contrast.
 */

export type Scheme = "light" | "dark";

/** The colors a theme has to have; each theme can set the others app.css has too. */
export const BASE_COLORS = [
  "bg",
  "bg-list",
  "bg-sidebar",
  "bg-elevated",
  "text",
  "text-sidebar",
  "text-muted",
  "text-faint",
  "accent",
  "tag-text",
  "ink",
] as const;

/**
 * The first of `candidates` that's a color rather than a grey and stands out from `background`:
 * what an app's theme most likely means as its accent, among the colors it gives its parts.
 */
export function colorful(candidates: (string | undefined)[], background: string): string | undefined {
  const base = parse(background) ?? WHITE;
  return candidates.find((candidate) => {
    const color = parse(candidate);
    if (!color) return false;
    const seen = over(color, base);
    return toLch(seen).c >= 0.05 && contrast(seen, base) >= 1.8;
  });
}

/** The first that has at least 4.5:1 against `color`, or else the one with the most. */
function textOn(color: Rgb, choices: Rgb[]) {
  return choices.find((choice) => contrast(choice, color) >= 4.5) ?? choices.reduce((a, b) => (contrast(b, color) > contrast(a, color) ? b : a));
}

/** A whole theme's colors for one scheme, light or dark as its background is, from what a palette has. */
export function themeColors(palette: Palette): {
  scheme: Scheme;
  colors: ThemeColors;
} {
  const bg = over(parse(palette.background) ?? WHITE, WHITE);
  const dark = isDark(bg);
  const read = (text?: string) => {
    const color = parse(text);
    return color && over(color, bg);
  };
  const fg = read(palette.foreground) ?? (dark ? WHITE : BLACK);
  const { hues = {}, syntax = {} } = palette;

  const sidebar = read(palette.sidebar) ?? mix(bg, fg, dark ? 0.05 : 0.045);
  const accent = read(palette.accent) ?? read(hues.blue) ?? fg;
  const tagBackground = over({ ...accent, a: dark ? 0.14 : 0.1 }, bg);
  const colors: Record<string, Rgb | undefined> = {
    bg,
    "bg-list": mix(bg, sidebar, 0.45),
    "bg-sidebar": sidebar,
    "bg-elevated": read(palette.elevated) ?? (dark ? mix(bg, fg, 0.075) : bg),
    text: fg,
    "text-sidebar": read(palette.sidebarForeground) ?? mix(fg, sidebar, 0.1),
    "text-muted": read(palette.muted) ?? mix(fg, bg, 0.38),
    "text-faint": read(palette.faint) ?? mix(fg, bg, 0.6),
    accent,
    "tag-text": readableOn(accent, tagBackground, 4.5),
    ink: fg,
    "on-accent": textOn(accent, [bg, fg, WHITE, BLACK]),
    danger: read(palette.danger ?? hues.red),
    success: read(palette.success ?? hues.green),
    pin: read(hues.orange ?? hues.yellow ?? palette.warning),
    "highlight-base": read(hues.yellow ?? palette.warning),
    "callout-info": read(palette.info ?? hues.blue),
    "callout-question": read(hues.magenta),
    "callout-warning": read(palette.warning ?? hues.yellow ?? hues.orange),
    "callout-decision": read(hues.cyan ?? hues.green),
    "syn-keyword": read(syntax.keyword ?? hues.magenta ?? hues.red),
    "syn-string": read(syntax.string ?? hues.green),
    "syn-number": read(syntax.number ?? hues.orange ?? hues.yellow),
    "syn-comment": read(syntax.comment ?? palette.faint),
    "syn-function": read(syntax.function ?? hues.blue),
    "syn-type": read(syntax.type ?? hues.yellow ?? hues.cyan),
  };
  for (const status of ["danger", "success", "pin"]) {
    const color = colors[status];
    if (color) colors[`on-${status}`] = textOn(color, [WHITE, { r: 20, g: 20, b: 20, a: 1 }]);
  }
  return {
    scheme: dark ? "dark" : "light",
    colors: Object.fromEntries(Object.entries(colors).flatMap(([key, color]) => (color ? [[key, hex(color)]] : []))) as ThemeColors,
  };
}

/** A theme's colors as numbers, each drawn over its background. */
function numbers(colors: Partial<ThemeColors>) {
  const bg = over(parse(colors.bg) ?? WHITE, WHITE);
  return (key: string) => {
    const color = parse(colors[key]);
    return color && over(color, bg);
  };
}

/**
 * The colors Increased contrast changes, worked out as lines' own themes' were (docs/accessibility.md):
 * each mixed toward the text, then toward black (white in dark), until it reaches its ratio against
 * the note's, the list's and the sidebar's backgrounds; links and tags on their tinted chips too.
 */
export function moreContrast(colors: ThemeColors): Partial<ThemeColors> {
  const color = numbers(colors);
  const [bg, text, list, sidebar, accent] = ["bg", "text", "bg-list", "bg-sidebar", "accent"].map(color);
  // Colors CSS reads but this can't (`oklch()`, `var()`) are left as they are.
  if (!bg || !text || !list || !sidebar || !accent) return {};
  const dark = isDark(bg);
  const backgrounds = [bg, list, sidebar];
  const chips = backgrounds.map((background) => over({ ...accent, a: dark ? 0.14 : 0.1 }, background));
  const goals: [key: string, ratio: number, on: Rgb[]][] = [
    ["text", 9, backgrounds],
    ["text-muted", 7, backgrounds],
    ["text-faint", 4.5, backgrounds],
    ["accent", 4.5, [...backgrounds, ...chips]],
    ["tag-text", 4.5, chips],
  ];
  const changed: Partial<ThemeColors> = {};
  for (const [key, ratio, on] of goals) {
    const from = color(key);
    if (!from) continue;
    const enough = (candidate: Rgb) => on.every((background) => contrast(candidate, background) >= ratio);
    const toText = key === "text" ? from : reach(from, on, ratio, text);
    const reached = enough(toText) ? toText : reach(toText, on, ratio, dark ? WHITE : BLACK);
    if (hex(reached) !== hex(from)) changed[key] = hex(reached);
  }
  return changed;
}

/**
 * Colors for the other scheme, from a theme's colors for one: its backgrounds and text keep their
 * tint at the lightness lines' own theme has there, and its colors their hue, made light or dark
 * enough to read on the new background. A start, to change as wanted.
 */
export function otherScheme(colors: ThemeColors): ThemeColors {
  const color = numbers(colors);
  const toDark = !isDark(color("bg") ?? WHITE);
  const neutral = (key: string, lightness: number) => {
    const { c, h } = toLch(color(key) ?? WHITE);
    return hex(fromLch({ l: lightness, c: Math.min(c, 0.025), h }));
  };
  const background = neutral("bg", toDark ? 0.215 : 0.995);
  const on = parse(background)!;
  const readable = (key: string, ratio: number) => {
    const value = color(key);
    return value && hex(readableOn(value, on, ratio));
  };
  return themeColors({
    background,
    foreground: neutral("text", toDark ? 0.93 : 0.22),
    accent: readable("accent", 3),
    danger: readable("danger", 3),
    success: readable("success", 3),
    warning: readable("callout-warning", 3),
    info: readable("callout-info", 3),
    hues: {
      orange: readable("pin", 2),
      yellow: colors["highlight-base"],
      magenta: readable("callout-question", 3),
      cyan: readable("callout-decision", 3),
    },
    syntax: {
      keyword: readable("syn-keyword", 4.5),
      string: readable("syn-string", 4.5),
      number: readable("syn-number", 4.5),
      comment: readable("syn-comment", 3),
      function: readable("syn-function", 4.5),
      type: readable("syn-type", 4.5),
    },
  }).colors;
}
