import type { ImportedColors, Palette, Theme, ThemeAssignment, ThemeColors, ThemeDefinition } from "../plugins/types";
import { BLACK, contrast, fromLch, hex, isDark, mix, over, parse, reach, readableOn, type Rgb, toLch, WHITE } from "./color";

/*
 * Working out a theme's colors. A theme is a palette and which of its colors each part of lines is
 * drawn in; lines works the other parts out from those (here, and app.css's mixes), makes the ones
 * that have to read readable, and works out Increased contrast's. A theme made for another app is
 * read the same way, from what it says its colors are for, and so are colors for a scheme a theme lacks.
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

/** Where text and icons sit: the note, the note list, the sidebar, and menus and dialogs. */
const PANES = ["bg", "bg-list", "bg-sidebar", "bg-elevated"];
/** Where status colors and callouts show: the note, and menus and dialogs. */
const NOTE = ["bg", "bg-elevated"];
const STATUS = ["danger", "success", "pin"];
const NEAR_BLACK: Rgb = { r: 20, g: 20, b: 20, a: 1 };
const PIN_TEXT: Rgb = { r: 29, g: 28, b: 26, a: 1 };

/** A note's formatting, each in a color of its own if a theme gives it one: headings, bold, links, code… */
const FORMATTING = ["h1", "h2", "h3", "h4", "h5", "h6", "bold", "italic", "strike", "underline", "link", "code", "quote"].map((kind) => `text-${kind}`);

/**
 * How well a part has to read against what it's drawn on, in every theme (docs/accessibility.md):
 * danger, and a note's formatting, as text, 4.5:1; success, the callouts and the colors tags and
 * events can be given as icons, 3:1; and text on buttons in the status colors, 4.5:1. A palette
 * color that falls short is made just light or dark enough, its hue kept.
 */
export const GOALS: Record<string, { ratio: number; on: readonly string[] }> = {
  danger: { ratio: 4.5, on: NOTE },
  ...Object.fromEntries(FORMATTING.map((part) => [part, { ratio: 4.5, on: ["bg"] }])),
  ...Object.fromEntries(["success", "callout-info", "callout-question", "callout-warning", "callout-decision"].map((part) => [part, { ratio: 3, on: NOTE }])),
  ...Object.fromEntries(["red", "orange", "yellow", "green", "blue", "purple", "gray"].map((name) => [`palette-${name}`, { ratio: 3, on: PANES }])),
  ...Object.fromEntries(STATUS.map((part) => [`on-${part}`, { ratio: 4.5, on: [part] }])),
};
const GOAL_ORDER = Object.keys(GOALS);

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

/** `color` made light or dark enough to reach `ratio` against each of `backgrounds`. */
const readableOnAll = (color: Rgb, backgrounds: Rgb[], ratio: number) => backgrounds.reduce((each, background) => readableOn(each, background, ratio), color);

/**
 * A scheme's colors, from those its parts are given: each as it is, made readable where it has a
 * goal; the rest worked out from them as far as they can be (the note list between the note and the
 * sidebar, faint text from the text, tags from the accent…), and `properties` set as they are. What
 * there's nothing to work out from, a red in a theme without one, is left to app.css, and so are the
 * mixes it makes (borders, hovers, the selection).
 */
export function workOut(given: Partial<ThemeColors>, properties: Record<string, string> = {}): ThemeColors {
  const bg = over(parse(given.bg) ?? WHITE, WHITE);
  const dark = isDark(bg);
  const read = (part: string) => {
    const color = parse(given[part]);
    return color && over(color, bg);
  };
  const text = read("text") ?? (dark ? WHITE : BLACK);
  const sidebar = read("bg-sidebar") ?? mix(bg, text, dark ? 0.05 : 0.045);
  const accent = read("accent") ?? text;
  const worked: Record<string, Rgb> = {
    bg,
    "bg-list": mix(bg, sidebar, 0.45),
    "bg-sidebar": sidebar,
    "bg-elevated": dark ? mix(bg, text, 0.075) : bg,
    text,
    "text-sidebar": mix(text, sidebar, 0.1),
    "text-muted": mix(text, bg, 0.38),
    "text-faint": mix(text, bg, 0.6),
    accent,
    "tag-text": readableOn(accent, over({ ...accent, a: dark ? 0.14 : 0.1 }, bg), 4.5),
    ink: text,
    // app.css's, white in light and the background in dark, if it reads.
    "on-accent": textOn(accent, [dark ? bg : WHITE, bg, text, WHITE, BLACK]),
  };
  const colors: Record<string, string> = Object.fromEntries(Object.entries(worked).filter(([part]) => !given[part]).map(([part, color]) => [part, hex(color)]));
  Object.assign(colors, properties);
  const shown = (part: string) => parse(colors[part] ?? given[part]);
  // Those with goals after the rest, in the goals' order, as text on a status color is measured on it made readable.
  const order = (part: string) => (part in GOALS ? GOAL_ORDER.indexOf(part) : -1);
  for (const part of Object.keys(given).sort((a, b) => order(a) - order(b))) {
    const color = read(part);
    if (!color) continue;
    const goal = GOALS[part];
    // Measured on what it's drawn on, where that's known here: not app.css's own.
    const on = goal?.on.map(shown) ?? [];
    const readable = goal && on.every(Boolean) ? readableOnAll(color, on.map((each) => over(each!, bg)), goal.ratio) : color;
    colors[part] = readable === color ? given[part]! : hex(readable);
  }
  for (const status of STATUS) {
    const color = shown(status);
    // app.css's first, if it reads: white on danger and success in light, dark text on the pin and in dark.
    const own = dark ? NEAR_BLACK : status === "pin" ? PIN_TEXT : WHITE;
    if (color && !colors[`on-${status}`]) colors[`on-${status}`] = hex(textOn(over(color, bg), [own, WHITE, NEAR_BLACK]));
  }
  return colors as ThemeColors;
}

/** The colors a theme's parts are given from its palette, for a scheme; none for a color it hasn't. */
export function assigned(palette: Palette | undefined, assignment: ThemeAssignment = {}): Partial<ThemeColors> {
  const colors = new Map(palette?.colors.map((entry) => [entry.id, entry.color]));
  return Object.fromEntries(Object.entries(assignment).flatMap(([part, id]) => (parse(colors.get(id)) ? [[part, colors.get(id)!]] : [])));
}

/** Themes worked out already, by what they're made of: built in, or one of yours as a color changes a step at a time. */
const resolved = new Map<string, Pick<Theme, "scheme" | "light" | "dark" | "moreContrast">>();

/** The id of the palette a theme's `scheme` is drawn in: its one, or that scheme's. */
export const paletteOf = ({ palette }: Pick<ThemeDefinition, "palette">, scheme: Scheme) => (typeof palette === "string" ? palette : palette[scheme]);

function colorsOf(definition: ThemeDefinition, palettes: Partial<Record<Scheme, Palette>>) {
  const scheme: Scheme | undefined = definition.light && definition.dark ? undefined : definition.light ? "light" : "dark";
  const of = (each: Scheme) => workOut(assigned(palettes[each], definition[each]), definition.properties?.[each]);
  const light = of(scheme ?? "light");
  const dark = scheme ? light : of("dark");
  return { scheme, light, dark, moreContrast: { light: moreContrast(light), dark: moreContrast(dark) } };
}

/**
 * A theme as lines shows it: its colors for light and dark, worked out from its palettes (`palette`
 * gives each by id; lines' own colors where one's gone) and what each is for, and Increased
 * contrast's from those. A theme with one scheme has the same colors in both.
 */
export function resolveTheme(definition: ThemeDefinition, palette: (id: string) => Palette | undefined): Theme {
  const { id, name, author, accessible, light, dark, properties } = definition;
  const palettes = { light: palette(paletteOf(definition, "light")), dark: palette(paletteOf(definition, "dark")) };
  const key = JSON.stringify([light, dark, properties, palettes.light?.colors, palettes.dark?.colors]);
  let colors = resolved.get(key);
  if (!colors) {
    if (resolved.size > 200) resolved.clear();
    resolved.set(key, (colors = colorsOf(definition, palettes)));
  }
  return { id, name, author, accessible, ...colors, definition };
}

/**
 * What a theme made for another app gives each part, light or dark as its background is: its
 * colors, drawn over its background, for the parts it says they're for.
 */
export function importedColors(imported: ImportedColors): { scheme: Scheme; colors: Partial<ThemeColors> } {
  const bg = over(parse(imported.background) ?? WHITE, WHITE);
  const read = (text?: string) => {
    const color = parse(text);
    return color && hex(over(color, bg));
  };
  const { hues = {}, syntax = {} } = imported;
  const colors: Record<string, string | undefined> = {
    bg: hex(bg),
    "bg-sidebar": read(imported.sidebar),
    "bg-elevated": read(imported.elevated),
    text: read(imported.foreground),
    "text-sidebar": read(imported.sidebarForeground),
    "text-muted": read(imported.muted),
    "text-faint": read(imported.faint),
    accent: read(imported.accent) ?? read(hues.blue),
    danger: read(imported.danger ?? hues.red),
    success: read(imported.success ?? hues.green),
    pin: read(hues.orange ?? hues.yellow ?? imported.warning),
    "highlight-base": read(hues.yellow ?? imported.warning),
    "callout-info": read(imported.info ?? hues.blue),
    "callout-question": read(hues.magenta),
    "callout-warning": read(imported.warning ?? hues.yellow ?? hues.orange),
    "callout-decision": read(hues.cyan ?? hues.green),
    "syn-keyword": read(syntax.keyword ?? hues.magenta ?? hues.red),
    "syn-string": read(syntax.string ?? hues.green),
    "syn-number": read(syntax.number ?? hues.orange ?? hues.yellow),
    "syn-comment": read(syntax.comment ?? imported.faint),
    "syn-function": read(syntax.function ?? hues.blue),
    "syn-type": read(syntax.type ?? hues.yellow ?? hues.cyan),
    // Its own red, green and the rest for tags, types and events (colors.ts).
    "palette-red": read(hues.red),
    "palette-orange": read(hues.orange),
    "palette-yellow": read(hues.yellow),
    "palette-green": read(hues.green),
    "palette-blue": read(hues.blue),
    "palette-purple": read(hues.magenta),
  };
  return {
    scheme: isDark(bg) ? "dark" : "light",
    colors: Object.fromEntries(Object.entries(colors).filter((entry): entry is [string, string] => !!entry[1])),
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
  // Text on the accent is chosen again for the accent it's moved to: the theme's own (or app.css's) if it still reads.
  if (changed.accent) changed["on-accent"] = hex(textOn(parse(changed.accent)!, [color("on-accent") ?? (dark ? bg : WHITE), bg, text, WHITE, BLACK]));
  return changed;
}

/**
 * What a scheme a theme lacks gives each part, from its colors for the one it has: its backgrounds
 * and text keep their tint at the lightness lines' own theme has there, and its colors their hue,
 * made light or dark enough to read on the new background. A start, to change as wanted.
 */
export function otherScheme(colors: ThemeColors): Partial<ThemeColors> {
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
  return importedColors({
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
