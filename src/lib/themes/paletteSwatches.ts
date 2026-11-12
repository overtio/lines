import type { SwatchColor } from "../components/ui/Swatches.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { Palette } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { customThemes } from "./custom.svelte";
import { PALETTE_SIZE } from "./file";
import { paletteNames } from "./names";
import { paletteOf } from "./palette";
import { shownScheme } from "./show.svelte";

/*
 * The palettes a theme of yours can be drawn in, and the colors a color picker offers first: a
 * palette's, each named; unless said, the palette the window's theme is drawn in, for the scheme it
 * shows. Its color can be added to the palette when it's yours.
 */

/** Every palette a theme of yours can be drawn in, yours first, for a select. */
export function paletteChoices() {
  const yours = customThemes.palettes;
  return [...yours, ...plugins.palettes.filter((palette) => !customThemes.palette(palette.id))].map((palette) => ({ value: palette.id, label: palette.name }));
}

/** A palette's colors as swatches to choose from, each by its name, or one from its look. */
export function swatchesOf(palette: Palette | undefined): SwatchColor[] {
  if (!palette) return [];
  const names = paletteNames(palette);
  return palette.colors.map(({ id, color }) => ({ id, name: names.get(id)!, color }));
}

/** The palette the window's theme is drawn in, for the scheme it shows. */
export function shownPalette() {
  const theme = plugins.theme(prefs.windowLook.theme);
  return plugins.palette(paletteOf(theme.definition, shownScheme(theme).own));
}

/** A picker's Add to Palette for `palette`, while it's yours and has room for another color. */
export function addingTo(palette: Palette | undefined) {
  if (!palette || !customThemes.palette(palette.id) || palette.colors.length >= PALETTE_SIZE) return undefined;
  return (color: string) => void customThemes.addColor(palette.id, color);
}
