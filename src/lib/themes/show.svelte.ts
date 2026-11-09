import { plugins } from "../plugins/registry.svelte";
import type { Theme } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { css, grey, inverted, parse } from "./color";
import { themeCss } from "./css";
import { BASE_COLORS } from "./palette";

/*
 * Themes come from plugins (lines' own are in plugins/themes), and your own (custom.svelte.ts). This
 * writes the colors of the ones on as CSS custom properties, which app.css builds on, and shows this
 * window's theme: the one chosen, or Lines while the plugin it's from is off, light or dark as
 * Settings says unless the theme has colors for only one, and in greys (Monochrome) or turned
 * around (Invert) if asked.
 */

const style = document.createElement("style");
style.id = "lines-themes";
// First in the page, so app.css's rules come after the themes' and build on them.
document.head.prepend(style);

function showThemes() {
  const css = themeCss(plugins.themes);
  if (style.textContent !== css) style.textContent = css;
}

/** Which of a theme's schemes shows when Settings asks for dark (or not): the one it has, if it has one. */
export const schemeShown = (theme: Theme, dark: boolean) => theme.scheme ?? (dark ? "dark" : "light");

/**
 * The colors Monochrome and Invert change: each theme's, and app.css's own. Those app.css mixes from
 * them (borders from `ink`, the selection from `accent`) follow, unless a theme sets its own.
 */
const FILTERED = [
  ...BASE_COLORS,
  "danger",
  "success",
  "pin",
  "highlight-base",
  "on-accent",
  "on-danger",
  "on-success",
  "on-pin",
  "callout-info",
  "callout-question",
  "callout-warning",
  "callout-error",
  "callout-decision",
  "syn-keyword",
  "syn-string",
  "syn-number",
  "syn-comment",
  "syn-function",
  "syn-type",
  "border",
  "hover",
  "active",
  "input",
  "code-bg",
  "selection",
  "tag-bg",
  "card-bg",
  "card-border",
];
/** The colors set on the page for them, taken off before they're worked out again. */
let filtered: string[] = [];

/**
 * Monochrome makes each color the grey as light as it; Invert turns each around, light for dark, its
 * hue kept. Both keep the contrast every two colors had, so what read well still does. They work on
 * the colors as the theme shows them (with Increased contrast's), set on the page itself so they
 * outrank every rule; pictures in notes aren't touched.
 */
function filter(root: HTMLElement, scheme: "light" | "dark") {
  const { monochrome, invert } = prefs;
  const filters = [monochrome && "monochrome", invert && "invert"].filter(Boolean).join(" ");
  if (filters) root.dataset.filters = filters;
  else delete root.dataset.filters;
  if (!filters) return scheme;
  const shown = getComputedStyle(root);
  for (const name of FILTERED) {
    const color = parse(shown.getPropertyValue(`--${name}`));
    if (!color) continue;
    const toned = monochrome ? grey(color) : color;
    // A highlighter is as bright in light as in dark, where app.css mixes in less of it.
    const turned = invert && name !== "highlight-base";
    root.style.setProperty(`--${name}`, css(turned ? inverted(toned) : toned));
    filtered.push(name);
  }
  return invert ? (scheme === "dark" ? "light" : "dark") : scheme;
}

function showTheme() {
  const { theme: id, dark } = prefs.windowLook;
  const theme = plugins.theme(id);
  const root = document.documentElement;
  for (const name of filtered) root.style.removeProperty(`--${name}`);
  filtered = [];
  const own = schemeShown(theme, dark);
  root.dataset.theme = theme.id;
  root.dataset.scheme = own;
  if (prefs.moreContrast) root.dataset.contrast = "more";
  else delete root.dataset.contrast;
  if (theme.accessible) root.dataset.accessible = "";
  else delete root.dataset.accessible;
  // Inverted, a light theme's colors show as dark ones, so app.css, the web view and diagrams treat them so.
  const scheme = filter(root, own);
  root.dataset.scheme = scheme;
  root.style.colorScheme = scheme;
  // Tint the browser's and phone's status bar to match.
  const bg = root.style.getPropertyValue("--bg") || theme[own].bg;
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", bg);
}

// Before the first paint, so there's no flash of another theme; then whenever they change. One
// effect, as the page has to have the themes' colors before Monochrome and Invert read them.
showThemes();
showTheme();
$effect.root(() => {
  $effect(() => {
    showThemes();
    showTheme();
  });
});
