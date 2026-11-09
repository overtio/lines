import type { ThemeColors } from "../plugins/types";
import { BASE_COLORS, type Scheme } from "./palette";

/*
 * lines' own theme files, for sharing a theme: JSON with its name, who made it, and its colors for
 * light, dark or both, by app.css's custom properties, the same as a theme plugin's (docs/themes.md).
 */

export interface ThemeFile {
  name: string;
  author?: string;
  light?: ThemeColors;
  dark?: ThemeColors;
  moreContrast?: Partial<Record<Scheme, Partial<ThemeColors>>>;
}

export const SCHEMES: readonly Scheme[] = ["light", "dark"];

const PROPERTY = /^[a-z][a-z0-9-]*$/;

/** A color a theme can set: anything CSS reads as one, which a URL (to fetch) never is. */
export const isColor = (value: unknown): value is string => typeof value === "string" && value.length <= 120 && CSS.supports("color", value);

/** The colors in `raw` that are colors, by their property; undefined unless it has all a theme needs. */
function colors(raw: unknown, partial: true): Partial<ThemeColors> | undefined;
function colors(raw: unknown, partial?: false): ThemeColors | undefined;
function colors(raw: unknown, partial = false) {
  if (!raw || typeof raw !== "object") return;
  const found = Object.fromEntries(Object.entries(raw).filter(([key, value]) => PROPERTY.test(key) && isColor(value)));
  return partial || BASE_COLORS.every((key) => key in found) ? found : undefined;
}

/** A theme as a lines theme file has it, checked; undefined for anything else. */
export function readThemeFile(json: unknown): ThemeFile | undefined {
  if (!json || typeof json !== "object") return;
  const { name, author, light, dark, moreContrast } = json as Record<string, unknown>;
  const theme: ThemeFile = {
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : "",
    light: colors(light),
    dark: colors(dark),
  };
  if (!theme.name || (!theme.light && !theme.dark)) return;
  if (typeof author === "string" && author.trim()) theme.author = author.trim().slice(0, 120);
  if (moreContrast && typeof moreContrast === "object") {
    const more = moreContrast as Record<string, unknown>;
    theme.moreContrast = Object.fromEntries(SCHEMES.flatMap((scheme) => (theme[scheme] && more[scheme] ? [[scheme, colors(more[scheme], true)]] : [])));
  }
  return theme;
}

/** A theme as its file's text, to save or send. */
export function writeThemeFile({ name, author, light, dark, moreContrast }: ThemeFile) {
  return `${JSON.stringify({ name, author, light, dark, moreContrast }, null, 2)}\n`;
}

/** The extension lines' theme files have, after the theme's name. */
export const THEME_FILE_EXTENSION = ".lines-theme.json";
