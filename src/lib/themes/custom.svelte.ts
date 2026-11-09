import type { Theme, ThemeColors } from "../plugins/types";
import { announce, onAnnounce } from "../windows/channel";
import { readThemeFile, type ThemeFile } from "./file";
import { moreContrast, type Scheme } from "./palette";

/*
 * Themes of your own: made in Settings → Theme from another theme, or read from a file. Kept on
 * this device with the other settings, and in every window at once. The registry lists them after
 * the plugins' themes, so they're chosen and shown like any other.
 */

const KEY = "lines.themes";

export interface CustomTheme extends ThemeFile {
  id: string;
}

/** Your themes as `json` (or storage) has them, each checked; one that isn't a theme is left out. */
function read(json?: string): CustomTheme[] {
  try {
    const stored: unknown = JSON.parse(json ?? localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((raw) => {
      const theme = readThemeFile(raw);
      const id = (raw as { id?: unknown }).id;
      return theme && typeof id === "string" && /^custom-[a-z0-9]+$/.test(id) ? [{ ...theme, id }] : [];
    });
  } catch {
    return [];
  }
}

/** Increased contrast's colors for a theme's, kept while a color is changed a step at a time, as only it changes. */
const worked = new Map<string, Partial<ThemeColors>>();
function moreContrastOf(colors: ThemeColors) {
  const key = JSON.stringify(colors);
  let more = worked.get(key);
  if (!more) {
    if (worked.size > 200) worked.clear();
    worked.set(key, (more = moreContrast(colors)));
  }
  return more;
}

/** As the registry lists it: with both schemes (a theme with one shows it in both), and its colors for Increased contrast. */
function asTheme({ id, name, author, light, dark, moreContrast: more }: CustomTheme): Theme {
  const colors = { light: (light ?? dark)!, dark: (dark ?? light)! };
  return {
    id,
    name,
    author,
    scheme: light && dark ? undefined : light ? "light" : "dark",
    ...colors,
    moreContrast: {
      light: more?.light ?? moreContrastOf(colors.light),
      dark: more?.dark ?? moreContrastOf(colors.dark),
    },
  };
}

class CustomThemes {
  #list = $state<CustomTheme[]>(read());

  /** As themes, for the registry. */
  readonly themes = $derived(this.#list.map(asTheme));

  constructor() {
    void onAnnounce((message) => message.type === "themes" && (this.#list = read(message.themes)));
  }

  /**
   * Saved, and sent to the other windows, at each change (a color's every step while it's picked),
   * before anything that comes of it, such as choosing a theme just added.
   */
  #save() {
    const json = JSON.stringify(this.#list);
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Storage that can't be written: they last until lines restarts.
    }
    void announce({ type: "themes", themes: json });
  }

  get(id: string) {
    return this.#list.find((theme) => theme.id === id);
  }

  /** Adds a theme; gives its id. */
  add(theme: ThemeFile) {
    const id = `custom-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    this.#list.push({ ...$state.snapshot(theme), id });
    this.#save();
    return id;
  }

  remove(id: string) {
    this.#list = this.#list.filter((theme) => theme.id !== id);
    this.#save();
  }

  rename(id: string, name: string) {
    const theme = this.get(id);
    if (!theme || !name.trim() || theme.name === name.trim()) return;
    theme.name = name.trim();
    this.#save();
  }

  /** Sets one of a theme's colors for a scheme, or takes it out (one that isn't needed) to follow the theme's others. */
  setColor(id: string, scheme: Scheme, property: string, value: string | undefined) {
    const theme = this.get(id);
    const colors = theme?.[scheme];
    if (!colors || colors[property] === value) return;
    if (value === undefined) delete colors[property];
    else colors[property] = value;
    // Worked out again from the new colors.
    delete theme.moreContrast?.[scheme];
    this.#save();
  }

  /** Gives a theme colors for a scheme it hadn't, so it's shown in both. */
  addScheme(id: string, scheme: Scheme, colors: ThemeColors) {
    const theme = this.get(id);
    if (!theme || theme[scheme]) return;
    theme[scheme] = { ...colors };
    delete theme.moreContrast?.[scheme];
    this.#save();
  }
}

export const customThemes = new CustomThemes();
