import { plugins } from "../plugins/registry.svelte";
import type { Theme, ThemeColors } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { css, grey, inverted, parse, type Rgb } from "./color";
import { other, paneColors, rule, themeCss } from "./css";
import { FORMATTING_COLORS } from "./formatting";
import { BASE_COLORS, type Scheme } from "./palette";

/*
 * Themes come from plugins (lines' own are in plugins/themes), and your own (custom.svelte.ts). This
 * shows this window's theme, its colors as CSS custom properties that app.css builds on: the one
 * chosen, or Lines while the plugin it's from is off, light or dark as Settings says unless the theme
 * has colors for only one, and in greys (Monochrome) or turned around (Invert) if asked; and its
 * sidebar and note list in its dark colors while it's light, if Settings → Theme → Dark panes says.
 */

const style = document.createElement("style");
style.id = "lines-themes";
// First in the page, so app.css's rules come after the themes' and build on them.
document.head.prepend(style);
const panes = document.createElement("style");
panes.id = "lines-dark-panes";
style.after(panes);

/** The theme's colors, worked out from its palette as it's shown, and no other's. */
function showColors(theme: Theme) {
  const css = themeCss([theme]);
  if (style.textContent !== css) style.textContent = css;
}

/** Which of a theme's schemes shows when Settings asks for dark (or not): the one it has, if it has one. */
export const schemeShown = (theme: Theme, dark: boolean) => theme.scheme ?? (dark ? "dark" : "light");

/** The scheme a window shows `theme` in: its colors' (`own`), or that turned around by Invert. */
export function shownScheme(theme: Theme, dark = prefs.windowLook.dark) {
  const own = schemeShown(theme, dark);
  return { own, shown: prefs.invert ? other(own) : own };
}

/** The window's theme, the scheme of its colors, and the scheme it shows. */
function look() {
  const theme = plugins.theme(prefs.windowLook.theme);
  return { theme, ...shownScheme(theme) };
}

/** Whether Settings → Theme → Dark panes darkens `pane`, if the window shows `theme` (its own, if left out): only while that's light. */
export const isDarkPane = (pane: "sidebar" | "list", theme = plugins.theme(prefs.windowLook.theme)) =>
  (prefs.darkPanes === pane || prefs.darkPanes === "both") && shownScheme(theme).shown === "light";

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
  ...FORMATTING_COLORS,
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

/** The colors Monochrome and Invert change, from those `shown` has, as they show them. */
function filteredColors(shown: CSSStyleDeclaration) {
  const colors: Record<string, string> = {};
  for (const name of FILTERED) {
    const color = parse(shown.getPropertyValue(`--${name}`));
    // A highlighter is as bright in light as in dark, where app.css mixes in less of it.
    if (color) colors[name] = css(shownColor(color, prefs.invert && name !== "highlight-base"));
  }
  return colors;
}

/** A color as Monochrome and Invert show it, for what's drawn in a color of its own (the paper's). */
export function shownColor(color: Rgb, turned = prefs.invert): Rgb {
  const toned = prefs.monochrome ? grey(color) : color;
  return turned ? inverted(toned) : toned;
}

/** A color of your own as Monochrome and Invert show it, as CSS; or `fallback` if it isn't a color. */
export function ownColor(value: string, fallback: string) {
  const color = parse(value);
  return color ? css(shownColor(color)) : fallback;
}

/**
 * Monochrome makes each color the grey as light as it; Invert turns each around, light for dark, its
 * hue kept. Both keep the contrast every two colors had, so what read well still does. They work on
 * the colors as the theme shows them (with Increased contrast's), set on the page itself so they
 * outrank every rule; pictures in notes aren't touched.
 */
function filter(root: HTMLElement) {
  const filters = [prefs.monochrome && "monochrome", prefs.invert && "invert"].filter(Boolean).join(" ");
  if (filters) root.dataset.filters = filters;
  else delete root.dataset.filters;
  if (!filters) return;
  for (const [name, value] of Object.entries(filteredColors(getComputedStyle(root)))) {
    root.style.setProperty(`--${name}`, value);
    filtered.push(name);
  }
}

/**
 * The dark panes' colors (App.svelte marks them), for the window's theme. Through Monochrome and
 * Invert as the window's are: worked out by app.css on an element of their own, in the scheme they
 * have before Invert turns them around.
 */
function showPanes(theme: Theme, own: Scheme, shown: Scheme) {
  let colors: Partial<ThemeColors> = {};
  if (prefs.darkPanes !== "none" && shown === "light") {
    colors = paneColors(theme, own, prefs.moreContrast);
    if (prefs.monochrome || prefs.invert) {
      const probe = document.createElement("div");
      probe.hidden = true;
      probe.dataset.scheme = other(own);
      for (const [name, value] of Object.entries(colors)) if (value) probe.style.setProperty(`--${name}`, value);
      document.body.append(probe);
      colors = { ...colors, ...filteredColors(getComputedStyle(probe)) };
      probe.remove();
    }
  }
  // Outranking app.css's colors worked out from them, as the theme's own do on the page.
  const sheet = rule(":root [data-pane][data-scheme]", colors);
  if (panes.textContent !== sheet) panes.textContent = sheet;
}

function showTheme() {
  const { theme, own, shown } = look();
  // The page has to have them before Monochrome and Invert read them.
  showColors(theme);
  const root = document.documentElement;
  for (const name of filtered) root.style.removeProperty(`--${name}`);
  filtered = [];
  root.dataset.theme = theme.id;
  root.dataset.scheme = own;
  if (prefs.moreContrast) root.dataset.contrast = "more";
  else delete root.dataset.contrast;
  if (theme.accessible) root.dataset.accessible = "";
  else delete root.dataset.accessible;
  filter(root);
  // Inverted, a light theme's colors show as dark ones, so app.css, the web view and diagrams treat them so.
  root.dataset.scheme = shown;
  root.style.colorScheme = shown;
  showPanes(theme, own, shown);
  // Tint the browser's and phone's status bar to match.
  const bg = root.style.getPropertyValue("--bg") || theme[own].bg;
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", bg);
}

/** Headings in the theme's colors for them, the accent, or a color of your own (Settings → Typography; editor.css). */
function showHeadings() {
  const root = document.documentElement;
  const { headingColor, headingCustomColor } = prefs;
  if (headingColor === "text") root.style.removeProperty("--heading-color");
  else root.style.setProperty("--heading-color", headingColor === "accent" ? "var(--accent)" : ownColor(headingCustomColor, "var(--accent)"));
}

// Before the first paint, so there's no flash of another theme; then whenever they change.
showTheme();
showHeadings();
$effect.root(() => {
  $effect(showTheme);
  $effect(showHeadings);
});
