import type { Theme, ThemeColors } from "../plugins/types";
import { moreContrast, otherScheme, type Scheme, workOut } from "./palette";

/**
 * Borders with Increased contrast: the faint text's color, which it makes 4.5:1 on every pane, a
 * little lighter, for 3:1. A share of the ink isn't enough where the text itself is grey.
 */
const BORDER = "color-mix(in srgb, var(--text-faint) 85%, transparent)";

/** What Increased contrast changes in every theme, light and dark, before each theme's own changes. */
export const MORE_CONTRAST = {
  light: { "text-sidebar": "var(--text)", border: BORDER, "card-border": BORDER },
  dark: { "text-sidebar": "var(--text)", border: BORDER, "card-border": BORDER },
};

export const other = (scheme: Scheme): Scheme => (scheme === "dark" ? "light" : "dark");

/**
 * A pane's colors while it's dark and the window's light (Settings → Theme → Dark panes): the
 * theme's for its other scheme (worked out from the one it has, for a theme with only one), with
 * Increased contrast's if `more`.
 */
export function paneColors(theme: Theme, own: Scheme, more: boolean): Partial<ThemeColors> {
  const scheme = other(own);
  const colors = theme.scheme ? workOut(otherScheme(theme[own])) : theme[scheme];
  if (!more) return colors;
  return { ...colors, ...MORE_CONTRAST[scheme], ...(theme.scheme ? moreContrast(colors) : theme.moreContrast?.[scheme]) };
}

/** A theme's id or a custom property's name, and a value that can't end the rule it's in. */
const NAME = /^[a-z][a-z0-9-]*$/;
const VALUE = /^[^;{}<>]*$/;

/** A rule setting custom properties, by name (`accent`, `radius-md`), leaving out any that isn't one. */
export function rule(selector: string, properties: Partial<ThemeColors> | Record<string, string> = {}) {
  const lines = Object.entries(properties)
    .filter(([name, value]) => NAME.test(name) && typeof value === "string" && VALUE.test(value))
    .map(([name, value]) => `  --${name}: ${value};`);
  return lines.length ? `${selector} {\n${lines.join("\n")}\n}` : "";
}

/**
 * The themes' colors as CSS, for the app (show.svelte.ts) and the website (site/). With the theme
 * and scheme in their selectors, Increased contrast's colors outrank the theme's own, and each
 * theme's outrank those every theme shares.
 */
export function themeCss(all: readonly Theme[]): string {
  const themes = all.filter((theme) => NAME.test(theme.id));
  const root = (theme: Theme) => `:root[data-theme="${theme.id}"]`;
  return [
    ...themes.flatMap((theme) => [rule(root(theme), theme.light), rule(`${root(theme)}[data-scheme="dark"]`, theme.dark)]),
    rule(':root[data-theme][data-scheme="light"][data-contrast="more"]', MORE_CONTRAST.light),
    rule(':root[data-theme][data-scheme="dark"][data-contrast="more"]', MORE_CONTRAST.dark),
    ...themes.flatMap((theme) => [
      rule(`${root(theme)}[data-scheme="light"][data-contrast="more"]`, theme.moreContrast?.light),
      rule(`${root(theme)}[data-scheme="dark"][data-contrast="more"]`, theme.moreContrast?.dark),
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");
}
