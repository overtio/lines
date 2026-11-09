import type { Theme, ThemeColors } from "../plugins/types";

/** What Increased contrast changes in every theme, before each theme's own changes. */
const MORE_CONTRAST = `:root[data-theme][data-scheme][data-contrast="more"] {
  --text-sidebar: var(--text);
  --border: color-mix(in srgb, var(--ink) 42%, transparent);
  --card-border: color-mix(in srgb, var(--ink) 42%, transparent);
}

:root[data-theme][data-scheme="dark"][data-contrast="more"] {
  --border: color-mix(in srgb, var(--ink) 36%, transparent);
  --card-border: color-mix(in srgb, var(--ink) 36%, transparent);
}`;

/** A theme's id or a custom property's name, and a value that can't end the rule it's in. */
const NAME = /^[a-z][a-z0-9-]*$/;
const VALUE = /^[^;{}<>]*$/;

function rule(selector: string, colors: Partial<ThemeColors> = {}) {
  const lines = Object.entries(colors)
    .filter(([name, value]) => NAME.test(name) && typeof value === "string" && VALUE.test(value))
    .map(([name, value]) => `  --${name}: ${value};`);
  return lines.length ? `${selector} {\n${lines.join("\n")}\n}` : "";
}

/**
 * The themes' colors as CSS, for the app (themes.svelte.ts) and the website (site/). With the theme
 * and scheme in their selectors, Increased contrast's colors outrank the theme's own, and each
 * theme's outrank those every theme shares.
 */
export function themeCss(all: readonly Theme[]): string {
  const themes = all.filter((theme) => NAME.test(theme.id));
  const root = (theme: Theme) => `:root[data-theme="${theme.id}"]`;
  return [
    ...themes.flatMap((theme) => [rule(root(theme), theme.light), rule(`${root(theme)}[data-scheme="dark"]`, theme.dark)]),
    MORE_CONTRAST,
    ...themes.flatMap((theme) => [
      rule(`${root(theme)}[data-scheme="light"][data-contrast="more"]`, theme.moreContrast?.light),
      rule(`${root(theme)}[data-scheme="dark"][data-contrast="more"]`, theme.moreContrast?.dark),
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");
}
