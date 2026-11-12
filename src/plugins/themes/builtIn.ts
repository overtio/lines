import type { Palette, ThemeDefinition } from "../../lib/plugins/types";
import { schemePalettes } from "../../lib/themes/names";

/** A palette written beside its theme: named after it, unless it has a name of its own (Catppuccin Latte). */
type OwnPalette = Omit<Palette, "id" | "name"> & { name?: string };

/**
 * A theme of lines' own with its palette beside it: one, or one for light and one for dark where
 * they share few colors, as families of themes publish them.
 */
export type WithPalette = Omit<ThemeDefinition, "palette"> & { palette: OwnPalette | { light: OwnPalette; dark: OwnPalette } };

/** The palettes and the themes drawn in them, as a plugin gives them: a theme's palette by its id, or by its id and the scheme. */
export function contributions(all: WithPalette[]) {
  const palettes: Palette[] = [];
  const themes = all.map(({ palette, ...theme }): ThemeDefinition => {
    if ("colors" in palette) {
      palettes.push({ ...palette, id: theme.id, name: palette.name ?? theme.name });
      return { ...theme, palette: theme.id };
    }
    const ids = { light: `${theme.id}-light`, dark: `${theme.id}-dark` };
    const names = schemePalettes(theme.name);
    palettes.push({ ...palette.light, id: ids.light, name: palette.light.name ?? names.light }, { ...palette.dark, id: ids.dark, name: palette.dark.name ?? names.dark });
    return { ...theme, palette: ids };
  });
  return { palettes, themes };
}
