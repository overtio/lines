import { colorName } from "../components/settings/colorNames";
import type { SwatchColor } from "../components/ui/Swatches.svelte";
import { solid } from "../colors";

/*
 * The colors a color picker offers first, until themes have palettes: the theme's own, as they're
 * drawn where the picker opens (in Settings → Theme's editor, the theme being changed), each once.
 */

/** In the order they're offered: the accent and the colors things can be given, then the theme's greys, text to background. */
const PARTS = [
  "accent",
  ...["red", "orange", "yellow", "green", "blue", "purple"].map((color) => `palette-${color}`),
  ...["info", "question", "warning", "error", "decision"].map((kind) => `callout-${kind}`),
  "danger",
  "success",
  "pin",
  "highlight-base",
  "tag-text",
  "text",
  "text-sidebar",
  "palette-gray",
  "text-muted",
  "text-faint",
  "bg-sidebar",
  "bg-list",
  "bg",
  "bg-elevated",
];

/** The theme's distinct colors where `at` is, each named after the first part it's drawn in. */
export function shownColors(at: Element): SwatchColor[] {
  const style = getComputedStyle(at);
  const seen = new Set<string>();
  return PARTS.flatMap((part) => {
    const value = style.getPropertyValue(`--${part}`).trim();
    const color = value && solid(value);
    if (!color || seen.has(color)) return [];
    seen.add(color);
    return [{ id: part, name: colorName(part), color }];
  });
}
