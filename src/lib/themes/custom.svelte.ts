import type { Palette, PaletteEntry, ThemeColors, ThemeDefinition } from "../plugins/types";
import { t } from "../i18n/index.svelte";
import { announce, onAnnounce } from "../windows/channel";
import { BLACK, difference, parse } from "./color";
import { filePalette, PALETTE_SIZE, type PaletteFile, paletteColor, readPaletteFile, readThemeFile, sameTheme, SCHEMES, type ThemeFile } from "./file";
import { schemePalettes } from "./names";
import { paletteOf, type Scheme } from "./palette";

/*
 * Themes and palettes of your own: a theme made in Settings → Theme from another, with a copy of its
 * palettes, or read from a file, a picture or another app's theme, with a palette of its colors (one
 * for each scheme where light and dark have more than a palette has). Kept on this device with the
 * other settings, and in every window at once. The registry lists them after the plugins', so
 * they're chosen and shown like any other.
 */

const THEMES = "lines.themes";
const PALETTES = "lines.palettes";
const ID = /^custom-[a-z0-9]+$/;
/** A palette's: a theme's own id, with the scheme it's for where it has one for each. */
const PALETTE_ID = /^custom-[a-z0-9]+(?:-light|-dark)?$/;

const newId = () => `custom-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

/** Your palettes as `json` (or storage) has them, each checked; one that isn't a palette is left out. */
function readPalettes(json?: string): Palette[] {
  try {
    const stored: unknown = JSON.parse(json ?? localStorage.getItem(PALETTES) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((raw) => {
      const palette = readPaletteFile(raw);
      const id = (raw as { id?: unknown } | null)?.id;
      return palette && typeof id === "string" && PALETTE_ID.test(id) ? [{ ...palette, id }] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Your themes and palettes as `json` (or storage) has them, each checked. A theme kept before
 * palettes, its colors by part, is read with a palette of those colors by the theme's own id (one
 * for each scheme, by its id and the scheme, if they're more than a palette has), and saved so at
 * the next change: nothing of it is lost, and every window reads it the same.
 */
export function readYours(themesJson?: string, palettesJson?: string): { themes: ThemeDefinition[]; palettes: Palette[] } {
  const palettes = readPalettes(palettesJson);
  try {
    const stored: unknown = JSON.parse(themesJson ?? localStorage.getItem(THEMES) ?? "[]");
    const themes = (Array.isArray(stored) ? stored : []).flatMap((raw): ThemeDefinition[] => {
      const file = readThemeFile(raw, schemePalettes);
      const id = (raw as { id?: unknown } | null)?.id;
      if (!file || typeof id !== "string" || !ID.test(id)) return [];
      const one = typeof file.palette === "string" || "colors" in file.palette;
      const kept = (scheme: Scheme) => {
        const palette = filePalette(file, scheme);
        if (typeof palette === "string") return palette;
        const own = one ? id : `${id}-${scheme}`;
        if (!palettes.some((each) => each.id === own)) palettes.push({ ...palette, id: own });
        return own;
      };
      const [light, dark] = SCHEMES.map(kept);
      return [{ ...file, id, palette: light === dark ? light : { light, dark } }];
    });
    return { themes, palettes };
  } catch {
    return { themes: [], palettes };
  }
}

/** A color for a palette that has none like it, by an id it doesn't use. */
function newColor(palette: Palette, color: string): PaletteEntry {
  let n = palette.colors.length + 1;
  while (palette.colors.some((entry) => entry.id === `c${n}`)) n++;
  const entry = { id: `c${n}`, color };
  palette.colors.push(entry);
  return entry;
}

/** The palette color like `color`, or a new one. */
const colorIn = (palette: Palette, color: string) => palette.colors.find((entry) => entry.color === color) ?? newColor(palette, color);

/** The palette's color that looks most like `color`. */
function nearest(palette: Palette, color: string) {
  const seen = parse(color) ?? BLACK;
  return palette.colors.reduce((best, entry) => (difference(parse(entry.color) ?? BLACK, seen) < difference(parse(best.color) ?? BLACK, seen) ? entry : best));
}

class CustomThemes {
  #stored = $state(readYours());

  /** Your themes, as the registry lists them after the plugins'. */
  readonly list = $derived(this.#stored.themes);
  readonly palettes = $derived(this.#stored.palettes);

  constructor() {
    void onAnnounce((message) => message.type === "themes" && (this.#stored = readYours(message.themes, message.palettes)));
  }

  /**
   * Saved, and sent to the other windows, at each change (a color's every step while it's picked),
   * before anything that comes of it, such as choosing a theme just added.
   */
  #save() {
    const themes = JSON.stringify(this.#stored.themes);
    const palettes = JSON.stringify(this.#stored.palettes);
    try {
      localStorage.setItem(PALETTES, palettes);
      localStorage.setItem(THEMES, themes);
    } catch {
      // Storage that can't be written: they last until lines restarts.
    }
    void announce({ type: "themes", themes, palettes });
  }

  get(id: string) {
    return this.#stored.themes.find((theme) => theme.id === id);
  }

  palette(id: string) {
    return this.#stored.palettes.find((palette) => palette.id === id);
  }

  /** A theme of yours as its file has it: its palettes in it where they're yours too, else their ids. */
  file(id: string): ThemeFile | undefined {
    const theme = this.get(id);
    if (!theme) return;
    const { name, author, palette, light, dark, properties } = $state.snapshot(theme);
    const inline = (each: string) => {
      const own = this.palette(each);
      return own ? { name: own.name, author: own.author, colors: $state.snapshot(own.colors) } : each;
    };
    return { name, author, palette: typeof palette === "string" ? inline(palette) : { light: inline(palette.light), dark: inline(palette.dark) }, light, dark, properties };
  }

  /** The id of one of yours with this name and these colors, if there is one. */
  find(file: ThemeFile) {
    return this.#stored.themes.find((theme) => theme.name === file.name && sameTheme(this.file(theme.id)!, file))?.id;
  }

  /** Adds a theme, with the palettes its file has as yours; gives its id. */
  add(file: ThemeFile) {
    const { palette, ...theme } = $state.snapshot(file) as ThemeFile;
    const id = newId();
    const kept = (each: string | PaletteFile) => (typeof each === "string" ? each : this.#addPalette(each));
    const one = typeof palette === "string" || "colors" in palette;
    this.#stored.themes.push({ ...theme, id, palette: one ? kept(palette) : { light: kept(palette.light), dark: kept(palette.dark) } });
    this.#save();
    return id;
  }

  #addPalette(palette: PaletteFile) {
    const id = newId();
    this.#stored.palettes.push({ ...palette, id });
    return id;
  }

  /** A theme of yours from `theme`, called `name`, with a copy of its palettes (as `palette` gives them by id); gives its id. */
  copy(theme: ThemeDefinition, palette: (id: string) => Palette | undefined, name: string) {
    const { author, light, dark, properties } = theme;
    const copied = (id: string, called: string) => {
      const from = palette(id);
      return from ? { name: called, author: from.author, colors: from.colors } : id;
    };
    const palettes = typeof theme.palette === "string" ? copied(theme.palette, name) : { light: copied(theme.palette.light, schemePalettes(name).light), dark: copied(theme.palette.dark, schemePalettes(name).dark) };
    return this.add({ name, author, palette: palettes, light, dark, properties });
  }

  /** Adds a palette of yours; gives its id. */
  addPalette(palette: PaletteFile) {
    const id = this.#addPalette($state.snapshot(palette) as PaletteFile);
    this.#save();
    return id;
  }

  /** Themes of yours drawn in palette `id`. */
  themesIn(id: string) {
    return this.#stored.themes.filter((theme) => SCHEMES.some((scheme) => paletteOf(theme, scheme) === id));
  }

  /**
   * Deletes a palette of yours. Themes of yours drawn in it are drawn in `instead` (`palette` gives
   * it by id), each part in its nearest color; without another to draw them in, it stays. Whether it went.
   */
  removePalette(id: string, instead?: string, palette?: (id: string) => Palette | undefined) {
    const drawn = this.themesIn(id);
    if (drawn.length && (!instead || instead === id || !palette?.(instead))) return false;
    for (const theme of drawn) this.setPalette(theme.id, SCHEMES.filter((scheme) => paletteOf(theme, scheme) === id), instead!, palette!);
    this.#stored.palettes = this.#stored.palettes.filter((each) => each.id !== id);
    this.#save();
    return true;
  }

  renamePalette(id: string, name: string) {
    const palette = this.palette(id);
    if (!palette || !name.trim() || palette.name === name.trim()) return;
    palette.name = name.trim();
    this.#save();
  }

  /** Changes a color of a palette of yours, which every part drawn in it follows. */
  setPaletteColor(id: string, colorId: string, value: string) {
    const entry = this.palette(id)?.colors.find((each) => each.id === colorId);
    const color = paletteColor(value);
    if (!entry || !color || entry.color === color) return;
    entry.color = color;
    this.#save();
  }

  /** Names a color of a palette of yours; an empty name leaves lines to name it from its look. */
  nameColor(id: string, colorId: string, name: string) {
    const entry = this.palette(id)?.colors.find((each) => each.id === colorId);
    if (!entry || (entry.name ?? "") === name.trim()) return;
    if (name.trim()) entry.name = name.trim().slice(0, 80);
    else delete entry.name;
    this.#save();
  }

  /** Adds a color to a palette of yours, unless it has it or all a palette has (32); gives its id. */
  addColor(id: string, value: string) {
    const palette = this.palette(id);
    const color = paletteColor(value);
    if (!palette || !color) return;
    const had = palette.colors.find((entry) => entry.color === color);
    if (had || palette.colors.length >= PALETTE_SIZE) return had?.id;
    const entry = newColor(palette, color);
    this.#save();
    return entry.id;
  }

  /** Moves a color of a palette of yours a place earlier (-1) or later (1). */
  moveColor(id: string, colorId: string, by: -1 | 1) {
    const colors = this.palette(id)?.colors;
    const at = colors?.findIndex((each) => each.id === colorId) ?? -1;
    if (!colors || at < 0 || !colors[at + by]) return;
    [colors[at], colors[at + by]] = [colors[at + by], colors[at]];
    this.#save();
  }

  /** Takes a color out of a palette of yours (not its last): parts drawn in it are drawn in its nearest color left. */
  removeColor(id: string, colorId: string) {
    const palette = this.palette(id);
    const entry = palette?.colors.find((each) => each.id === colorId);
    if (!palette || !entry || palette.colors.length < 2) return;
    palette.colors = palette.colors.filter((each) => each !== entry);
    const instead = nearest(palette, entry.color).id;
    for (const parts of this.#drawnIn(id)) for (const [part, each] of Object.entries(parts)) if (each === colorId) parts[part] = instead;
    this.#save();
  }

  /**
   * Draws a theme of yours, its scheme or both, in another palette (`palette` gives each by id): each
   * part in the new palette's color nearest the one it had.
   */
  setPalette(themeId: string, schemes: readonly Scheme[], to: string, palette: (id: string) => Palette | undefined) {
    const theme = this.get(themeId);
    const target = palette(to);
    if (!theme || !target?.colors.length) return;
    for (const scheme of schemes) {
      const parts = theme[scheme];
      const before = palette(paletteOf(theme, scheme));
      if (!parts) continue;
      for (const [part, id] of Object.entries(parts)) {
        const color = before?.colors.find((each) => each.id === id)?.color;
        if (color) parts[part] = nearest(target, color).id;
        else delete parts[part];
      }
    }
    const [light, dark] = SCHEMES.map((scheme) => (schemes.includes(scheme) ? to : paletteOf(theme, scheme)));
    theme.palette = light === dark ? light : { light, dark };
    this.#save();
  }

  /** Each scheme of yours drawn in palette `id`, by its parts. */
  #drawnIn(id: string) {
    return this.#stored.themes.flatMap((theme) => SCHEMES.filter((scheme) => paletteOf(theme, scheme) === id).map((scheme) => theme[scheme] ?? {}));
  }

  /** Deletes a theme, and its palettes where no other theme of yours is drawn in them. */
  remove(id: string) {
    const theme = this.get(id);
    this.#stored.themes = this.#stored.themes.filter((each) => each.id !== id);
    const unused = new Set(theme ? SCHEMES.map((scheme) => paletteOf(theme, scheme)).filter((palette) => !this.#drawnIn(palette).length) : []);
    this.#stored.palettes = this.#stored.palettes.filter((palette) => !unused.has(palette.id));
    this.#save();
  }

  /** Renames a theme, and its palettes with it while they're named after it and only it is drawn in them. */
  rename(id: string, name: string) {
    const theme = this.get(id);
    if (!theme || !name.trim() || theme.name === name.trim()) return;
    const [before, after] = [theme.name, name.trim()];
    for (const scheme of SCHEMES) {
      const palette = this.palette(paletteOf(theme, scheme));
      if (!palette || this.#stored.themes.some((each) => each !== theme && SCHEMES.some((other) => paletteOf(each, other) === palette.id))) continue;
      if (palette.name === before) palette.name = after;
      else if (palette.name === schemePalettes(before)[scheme]) palette.name = schemePalettes(after)[scheme];
    }
    theme.name = after;
    this.#save();
  }

  /**
   * The palette a theme's `scheme` is drawn in, as one of yours to change: its own, or a copy of the
   * plugin's `from`, which it's drawn in from then on (both schemes, if they share it).
   */
  #ownPalette(theme: ThemeDefinition, scheme: Scheme, from: Palette | undefined) {
    const id = paletteOf(theme, scheme);
    const own = this.palette(id);
    if (own) return own;
    const name = t("settings.paletteCopyName", { name: from?.name ?? theme.name });
    const copy = this.#addPalette({ name, author: from?.author, colors: $state.snapshot(from?.colors) ?? [] });
    theme.palette = typeof theme.palette === "string" ? copy : { ...theme.palette, [scheme]: copy };
    return this.palette(copy)!;
  }

  /** Draws a theme's scheme in a copy, yours to add to, of the plugin's palette `from` it's drawn in. */
  ownPalette(id: string, scheme: Scheme, from: Palette | undefined) {
    const theme = this.get(id);
    if (!theme) return;
    this.#ownPalette(theme, scheme, from);
    this.#save();
  }

  /** Draws a theme's part, for a scheme, in one of its palette's colors (a plugin's palette's too), by its id. */
  assign(id: string, scheme: Scheme, part: string, colorId: string) {
    const theme = this.get(id);
    const parts = theme?.[scheme];
    if (!theme || !parts || (parts[part] === colorId && theme.properties?.[scheme]?.[part] === undefined)) return;
    delete theme.properties?.[scheme]?.[part];
    parts[part] = colorId;
    this.#save();
  }

  /**
   * Draws a theme's part in `value` for a scheme, or takes it out (`undefined`) for lines to work it
   * out. The color is that scheme's palette's: the one it has that's the same, or the part's own
   * changed while only this part is drawn in it, or else a new one, or its nearest once it has all a
   * palette has. `palette` is that palette as the registry has it, copied as yours if it's a plugin's.
   */
  setColor(id: string, scheme: Scheme, part: string, value: string | undefined, palette?: Palette) {
    const theme = this.get(id);
    const assignment = theme?.[scheme];
    if (!theme || !assignment) return;
    const property = theme.properties?.[scheme]?.[part];
    if (property !== undefined) delete theme.properties![scheme]![part];
    if (value === undefined) {
      if (part in assignment) delete assignment[part];
      else if (property === undefined) return;
      this.#save();
      return;
    }
    const color = paletteColor(value);
    if (!color) return;
    const own = this.#ownPalette(theme, scheme, palette);
    const current = own.colors.find((entry) => entry.id === assignment[part]);
    const same = own.colors.find((entry) => entry.color === color);
    if (same && same === current && property === undefined) return;
    const uses = this.#drawnIn(own.id).flatMap((parts) => Object.values(parts)).filter((each) => each === current?.id);
    if (!same && current && uses.length === 1) current.color = color;
    else assignment[part] = (same ?? (own.colors.length < PALETTE_SIZE ? newColor(own, color) : nearest(own, color))).id;
    this.#save();
  }

  /**
   * Gives a theme colors for a scheme it hadn't, so it's shown in both: in its palette, or in one of
   * their own if that would have more than a palette has.
   */
  addScheme(id: string, scheme: Scheme, colors: Partial<ThemeColors>, palette?: Palette) {
    const theme = this.get(id);
    if (!theme || theme[scheme]) return;
    const given = Object.entries(colors).flatMap(([part, value]) => {
      const color = value && paletteColor(value);
      return color ? [[part, color] as const] : [];
    });
    const shared = this.#ownPalette(theme, scheme === "light" ? "dark" : "light", palette);
    const fits = new Set([...shared.colors.map((entry) => entry.color), ...given.map(([, color]) => color)]).size <= PALETTE_SIZE;
    const own = fits ? shared : this.palette(this.#addPalette({ name: schemePalettes(theme.name)[scheme], colors: [] }))!;
    if (!fits) theme.palette = scheme === "light" ? { light: own.id, dark: shared.id } : { light: shared.id, dark: own.id };
    theme[scheme] = Object.fromEntries(given.map(([part, color]) => [part, colorIn(own, color).id]));
    this.#save();
  }
}

export const customThemes = new CustomThemes();
