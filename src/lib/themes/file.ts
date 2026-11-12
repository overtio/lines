import type { Palette, PaletteEntry, Theme, ThemeAssignment, ThemeColors } from "../plugins/types";
import { css, parse } from "./color";
import { BASE_COLORS, resolveTheme, type Scheme } from "./palette";

/*
 * lines' own files for sharing a theme or a palette: JSON with a name, who made it, and for a theme
 * its palette, or one for light and one for dark (inline when they're yours, or palettes lines has,
 * by id), and which of their colors each part is drawn in, light, dark or both (docs/themes.md).
 * Theme files from before palettes, with colors by part, still read: their colors become the
 * theme's palette.
 */

/** A palette as its file has it, and as a theme file carries it. */
export type PaletteFile = Omit<Palette, "id">;

/** A palette in a theme file: there, or the id of one lines has. */
type FilePalette = string | PaletteFile;

/** A theme as its file has it: its palette with it, or one for each scheme. */
export interface ThemeFile {
  name: string;
  author?: string;
  palette: FilePalette | Record<Scheme, FilePalette>;
  light?: ThemeAssignment;
  dark?: ThemeAssignment;
  properties?: Partial<Record<Scheme, Record<string, string>>>;
}

export const SCHEMES: readonly Scheme[] = ["light", "dark"];

/** The palette a theme file's `scheme` is drawn in. */
export const filePalette = ({ palette }: Pick<ThemeFile, "palette">, scheme: Scheme): FilePalette =>
  typeof palette === "string" || "colors" in palette ? palette : palette[scheme];

/** What a theme's palettes are called when it has one for each scheme; in English unless the app says. */
export type SchemeNames = (theme: string) => Record<Scheme, string>;
const inEnglish: SchemeNames = (theme) => ({ light: `${theme} Light`, dark: `${theme} Dark` });

/** As many colors as one palette has as a rule (Nord's 16, Gruvbox's): a theme with more across light and dark has one for each. */
export const PALETTE_SIZE = 32;

/** The extensions lines' files have, after the theme's or palette's name. */
export const THEME_FILE_EXTENSION = ".lines-theme.json";
export const PALETTE_FILE_EXTENSION = ".lines-palette.json";

/** As many colors as a palette read from a file can have: the editor stops adding at 32, a file can be generous. */
const MOST_COLORS = 64;
const PROPERTY = /^[a-z][a-z0-9-]*$/;
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
/** A value made from a theme's colors alone, with none of its own: a mix of them, a share, a shadow (`ThemeDefinition.properties`). */
const FROM_PARTS = /^(?:var\(--[a-z][a-z0-9-]*\)|color-mix\(|in (?:srgb|oklab)|transparent|none|-?\d*\.?\d+(?:%|px|em|rem)?|[\s,()])+$/;

/** A color a theme can set: anything CSS reads as one, which a URL (to fetch) never is. */
export const isColor = (value: unknown): value is string => typeof value === "string" && value.length <= 120 && CSS.supports("color", value);

const text = (value: unknown, length: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, length) : undefined);

/**
 * A color as a palette keeps it, hex or `rgb()` (with its alpha), so its shades can be worked out;
 * any other CSS reads (`oklch()`, `hsl()`, `teal`) as the browser draws it.
 */
export function paletteColor(value: string): string | undefined {
  let color = parse(value);
  if (!color && isColor(value) && typeof document !== "undefined") {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (context) {
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      color = { r, g, b, a: a / 255 };
    }
  }
  return color && css(color);
}

/** A palette's colors from a file, each checked: a color it can't read is left out, as is one more than it can have. */
function readColors(raw: unknown): PaletteEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.slice(0, MOST_COLORS).flatMap((entry) => {
    const { id, name, color } = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const value = typeof color === "string" ? paletteColor(color) : undefined;
    if (typeof id !== "string" || !ID.test(id) || seen.has(id) || !value) return [];
    seen.add(id);
    const label = text(name, 80);
    return [{ id, ...(label && { name: label }), color: value }];
  });
}

/** A palette as its file (or a theme file) has it, checked; undefined for anything else. */
export function readPaletteFile(json: unknown): PaletteFile | undefined {
  if (!json || typeof json !== "object") return;
  const { name, author, colors } = json as Record<string, unknown>;
  const palette: PaletteFile = { name: text(name, 80) ?? "", colors: readColors(colors) };
  if (!palette.name || !palette.colors.length) return;
  const by = text(author, 120);
  if (by) palette.author = by;
  return palette;
}

/** A palette as its file's text, to save or send. */
export const writePaletteFile = ({ name, author, colors }: PaletteFile) => `${JSON.stringify({ name, author, colors }, null, 2)}\n`;

/** The colors written in text, each once, as a palette keeps them: hex and `rgb()`, as many as a palette has. */
export function colorsIn(text: string) {
  const found = text.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^)]*\)/gi) ?? [];
  return [...new Set(found.flatMap((each) => paletteColor(each) ?? []))].slice(0, PALETTE_SIZE);
}

/** A palette from colors, named `name`. */
export const paletteOfColors = (name: string, colors: string[]): PaletteFile => ({ name, colors: colors.map((color, i) => ({ id: `c${i + 1}`, color })) });

/** The palette in a file's text, or pasted: lines' palette file, or else the colors written in it, called `name`. */
export function readPalette(text: string, name: string) {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Not a palette file: colors written some other way.
  }
  const colors = colorsIn(text);
  return readPaletteFile(json) ?? (colors.length ? paletteOfColors(name, colors) : undefined);
}

/** Which palette colors a file's parts are drawn in, each checked: by its part, and one the palette has (if it's in the file). */
function readAssignment(raw: unknown, palette: string | PaletteFile): ThemeAssignment | undefined {
  if (!raw || typeof raw !== "object") return;
  const ids = typeof palette === "string" ? undefined : new Set(palette.colors.map((entry) => entry.id));
  return Object.fromEntries(Object.entries(raw).filter(([part, id]) => PROPERTY.test(part) && typeof id === "string" && ID.test(id) && (!ids || ids.has(id))));
}

function readProperties(raw: unknown) {
  if (!raw || typeof raw !== "object") return;
  const read = Object.fromEntries(
    SCHEMES.flatMap((scheme) => {
      const values = (raw as Record<string, unknown>)[scheme];
      const kept = Object.entries(values && typeof values === "object" ? values : {}).filter(
        ([part, value]) => PROPERTY.test(part) && typeof value === "string" && value.length <= 120 && FROM_PARTS.test(value),
      );
      return kept.length ? [[scheme, Object.fromEntries(kept)]] : [];
    }),
  );
  return Object.keys(read).length ? read : undefined;
}

/**
 * A theme from colors by part, light, dark or both, as theme files had them before palettes (and as
 * a theme made for another app or from a picture gives them): its palette their colors, each once,
 * named after the theme; or, if light and dark have more than a palette has, one for each. A value
 * made from the theme's other colors (`var(--accent)`, a mix of them) is kept as it is; one that's
 * neither is left out, for lines to work out.
 */
export function fromColors(name: string, author: string | undefined, colors: Partial<Record<Scheme, Partial<ThemeColors>>>, names = inEnglish): ThemeFile {
  const given: Partial<Record<Scheme, Record<string, string>>> = {};
  const properties: ThemeFile["properties"] = {};
  for (const scheme of SCHEMES) {
    const values = colors[scheme];
    if (!values) continue;
    const parts: Record<string, string> = (given[scheme] = {});
    for (const [part, value] of Object.entries(values)) {
      if (!PROPERTY.test(part) || typeof value !== "string") continue;
      if (FROM_PARTS.test(value)) (properties[scheme] ??= {})[part] = value;
      else {
        const color = paletteColor(value);
        if (color) parts[part] = color;
      }
    }
  }
  const schemes = SCHEMES.filter((scheme) => given[scheme]);
  const distinct = (of: readonly Scheme[]) => [...new Set(of.flatMap((scheme) => Object.values(given[scheme]!)))];
  const split = schemes.length === 2 && distinct(schemes).length > PALETTE_SIZE;
  const theme: ThemeFile = {
    name,
    ...(author && { author }),
    palette: split ? { light: paletteOfColors(names(name).light, distinct(["light"])), dark: paletteOfColors(names(name).dark, distinct(["dark"])) } : paletteOfColors(name, distinct(schemes)),
  };
  for (const scheme of schemes) {
    const { colors: entries } = filePalette(theme, scheme) as PaletteFile;
    theme[scheme] = Object.fromEntries(Object.entries(given[scheme]!).map(([part, color]) => [part, entries.find((entry) => entry.color === color)!.id]));
  }
  if (Object.keys(properties).length) theme.properties = properties;
  return theme;
}

/** Colors by part, as files before palettes had them; undefined unless it has the colors a theme needed then. */
function oldColors(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return;
  const found = Object.fromEntries(Object.entries(raw).filter(([key, value]) => PROPERTY.test(key) && isColor(value)));
  return BASE_COLORS.every((key) => key in found) ? found : undefined;
}

/** A palette as a theme file names or carries it, checked. */
const readFilePalette = (raw: unknown): FilePalette | undefined => (typeof raw === "string" ? (ID.test(raw) ? raw : undefined) : readPaletteFile(raw));

/**
 * A theme as a lines theme file has it, checked, from before palettes too (its palettes, if it has
 * one for each scheme, called as `names` says); undefined for anything else.
 */
export function readThemeFile(json: unknown, names = inEnglish): ThemeFile | undefined {
  if (!json || typeof json !== "object") return;
  const raw = json as Record<string, unknown>;
  const name = text(raw.name, 80);
  const author = text(raw.author, 120);
  if (!name) return;
  if (raw.palette === undefined) {
    // Colors by part, and `moreContrast`, which lines works out now.
    const [light, dark] = SCHEMES.map((scheme) => oldColors(raw[scheme]));
    return light || dark ? fromColors(name, author, { light, dark }, names) : undefined;
  }
  const both = raw.palette && typeof raw.palette === "object" && "light" in raw.palette ? (raw.palette as Record<string, unknown>) : undefined;
  const [light, dark] = both ? SCHEMES.map((scheme) => readFilePalette(both[scheme])) : [];
  const palette = both ? light && dark && { light, dark } : readFilePalette(raw.palette);
  if (!palette) return;
  const theme: ThemeFile = { name, ...(author && { author }), palette };
  for (const scheme of SCHEMES) {
    const assignment = readAssignment(raw[scheme], filePalette(theme, scheme));
    if (assignment) theme[scheme] = assignment;
  }
  if (!theme.light && !theme.dark) return;
  const properties = readProperties(raw.properties);
  if (properties) theme.properties = properties;
  return theme;
}

/** A theme as its file's text, to save or send. */
export function writeThemeFile({ name, author, palette, light, dark, properties }: ThemeFile) {
  return `${JSON.stringify({ name, author, palette, light, dark, properties }, null, 2)}\n`;
}

/** A theme file as lines shows it, its palettes the file's own or `palette(id)`. */
export function resolveFile(file: ThemeFile, palette: (id: string) => Palette | undefined = () => undefined): Theme {
  const own = (scheme: Scheme) => {
    const each = filePalette(file, scheme);
    return typeof each === "string" ? each : `file-${scheme}`;
  };
  const lookUp = (id: string) => {
    const scheme = SCHEMES.find((each) => id === `file-${each}`);
    const each = scheme && filePalette(file, scheme);
    return each && typeof each !== "string" ? { id, ...each } : palette(id);
  };
  return resolveTheme({ ...file, id: "file", palette: { light: own("light"), dark: own("dark") } }, lookUp);
}

/** Whether two theme files draw each part in the same color, whatever their palettes and colors are called. */
export function sameTheme(a: ThemeFile, b: ThemeFile) {
  const colors = (file: ThemeFile) => {
    const parts = (scheme: Scheme) => {
      const palette = filePalette(file, scheme);
      const color = (id: string) => (typeof palette === "string" ? `${palette} ${id}` : palette.colors.find((entry) => entry.id === id)?.color);
      return Object.entries(file[scheme] ?? {}).map(([part, id]) => [part, color(id)]).sort();
    };
    return JSON.stringify([parts("light"), parts("dark"), file.properties]);
  };
  return colors(a) === colors(b);
}
