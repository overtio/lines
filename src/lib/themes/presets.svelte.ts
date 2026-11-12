import { DEFAULT_THEME, plugins } from "../plugins/registry.svelte";
import type { AppStyle } from "../plugins/types";
import { prefs, readSettings, sameSpacing, type Stored } from "../prefs.svelte";
import { announce, onAnnounce } from "../windows/channel";
import { customThemes } from "./custom.svelte";
import { readThemeFile, type ThemeFile } from "./file";
import { schemePalettes } from "./names";

/*
 * Presets (Settings → Presets): a whole look in one. The theme and the style (corners, type,
 * borders), with the rest of how lines looks: the text's font, spacing and width, the paper and
 * backdrop, the cursor and pointer, the mascot and the window's see-through-ness. Each style a
 * plugin has is one, with the settings it brings; your own are saved from what you have, kept on
 * this device with the other settings, and shared as a file, which takes a theme of your own along,
 * palette and all. What's yours to see by stays yours: light or dark, contrast and the text's size
 * aren't in one.
 */

export const PRESET_KEYS = [
  "style",
  "theme",
  "darkPanes",
  "monochrome",
  "invert",
  "icons",
  "showIcons",
  "hideBars",
  "headingColor",
  "headingCustomColor",
  "font",
  "spacing",
  "noteWidth",
  "fullWidth",
  "paperPattern",
  "paperTexture",
  "paperSpacing",
  "paperSize",
  "paperColor",
  "paperCustomColor",
  "paperOpacity",
  "paperBackdrop",
  "backdropColor",
  "pageColor",
  "pageCustomColor",
  "pageOpacity",
  "caretShape",
  "caretWidth",
  "caretColor",
  "caretCustomColor",
  "caretBlink",
  "caretMotion",
  "caretEffect",
  "pointerStyle",
  "pointerTrail",
  "mascot",
  "mascotSize",
  "windowOpacity",
  "windowBlur",
  "windowSeeThrough",
] as const satisfies readonly (keyof Stored)[];

export type PresetSettings = Pick<Stored, (typeof PRESET_KEYS)[number]>;

export interface Preset {
  id: string;
  name: string;
  /** What it's like, under its name: a plugin's own words. */
  description?: string;
  author?: string;
  settings: PresetSettings;
  /** One of yours, rather than a plugin's. */
  mine: boolean;
}

/** A preset as its file has it, read: its theme along if it's one of the sharer's own. */
export interface PresetFile {
  name: string;
  author?: string;
  settings: PresetSettings;
  theme?: ThemeFile;
}

/** The extension lines' preset files have, after the preset's name. */
export const PRESET_FILE_EXTENSION = ".lines-preset.json";

const pick = (all: PresetSettings): PresetSettings => Object.fromEntries(PRESET_KEYS.map((key) => [key, $state.snapshot(all[key])])) as PresetSettings;

/** Settings as a preset has them: each checked, and lines' own for any it hasn't. */
export const presetSettings = (raw: Record<string, unknown>) => pick(readSettings(raw));

/** The look there is now, as a preset's settings. */
export const currentSettings = () => pick(prefs);

/** Whether two presets' settings make the same look. */
export function sameSettings(a: PresetSettings, b: PresetSettings) {
  return PRESET_KEYS.every((key) => (key === "spacing" ? sameSpacing(a.spacing, b.spacing) : a[key] === b[key]));
}

/** A style's preset: its look and theme, the settings it brings, and lines' own for the rest. */
const fromStyle = (style: AppStyle): Preset => ({
  id: style.id,
  name: style.name,
  description: style.description,
  settings: presetSettings({ ...style.settings, style: style.id, theme: style.theme ?? DEFAULT_THEME }),
  mine: false,
});

const KEY = "lines.presets";
const MINE = /^mine-[a-z0-9]+$/;

/** A preset's name and who made it, as a file or storage has them, checked. */
function readNames(raw: Record<string, unknown>) {
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "";
  const author = typeof raw.author === "string" && raw.author.trim() ? raw.author.trim().slice(0, 120) : undefined;
  return { name, author };
}

/** Your presets as `json` (or storage) has them, each checked; one that isn't a preset is left out. */
function read(json?: string): Preset[] {
  try {
    const stored: unknown = JSON.parse(json ?? localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((raw: Record<string, unknown>) => {
      const { name, author } = readNames(raw ?? {});
      const { id, settings } = raw ?? {};
      if (!name || typeof id !== "string" || !MINE.test(id) || !settings || typeof settings !== "object") return [];
      return [{ id, name, author, settings: presetSettings(settings as Record<string, unknown>), mine: true }];
    });
  } catch {
    return [];
  }
}

/** A preset's file, to save or send: with its theme and palette, if they're your own, and without a picture of yours behind the page. */
export function writePresetFile({ name, author, settings }: Preset) {
  const written = pick(settings);
  if (written.paperBackdrop === "image") written.paperBackdrop = "none";
  const theme = customThemes.file(written.theme);
  return `${JSON.stringify({ name, author, settings: written, theme }, null, 2)}\n`;
}

/** A preset as its file's text has it, checked; undefined for anything else. */
export function readPresetFile(text: string): PresetFile | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return;
  }
  if (!raw || typeof raw !== "object") return;
  const { settings, theme } = raw as Record<string, unknown>;
  const { name, author } = readNames(raw as Record<string, unknown>);
  if (!name || !settings || typeof settings !== "object") return;
  return { name, author, settings: presetSettings(settings as Record<string, unknown>), theme: theme ? readThemeFile(theme, schemePalettes) : undefined };
}

class Presets {
  #mine = $state<Preset[]>(read());

  /** The plugins' presets, then yours. */
  readonly builtIn = $derived(plugins.styles.map(fromStyle));
  readonly mine = $derived(this.#mine);
  /** The preset last chosen, if it's still there. */
  readonly chosen = $derived(this.get(prefs.preset));
  /** The look's been changed since the preset was chosen. */
  readonly changed = $derived(!!this.chosen && !sameSettings(currentSettings(), this.chosen.settings));

  constructor() {
    void onAnnounce((message) => message.type === "presets" && (this.#mine = read(message.presets)));
  }

  /** Saved, and sent to the other windows, before anything that comes of it. */
  #save() {
    const json = JSON.stringify(this.#mine.map(({ id, name, author, settings }) => ({ id, name, author, settings })));
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Storage that can't be written: they last until lines restarts.
    }
    void announce({ type: "presets", presets: json });
  }

  get(id: string) {
    return this.builtIn.find((preset) => preset.id === id) ?? this.#mine.find((preset) => preset.id === id);
  }

  /** Shows a preset's look, every setting in it; gives what there was before, to go back to. */
  choose(preset: Preset) {
    const before = { preset: prefs.preset, settings: currentSettings() };
    Object.assign(prefs, pick(preset.settings));
    prefs.preset = preset.id;
    return before;
  }

  /** Back to the look there was before a preset was chosen. */
  restore({ preset, settings }: { preset: string; settings: PresetSettings }) {
    Object.assign(prefs, settings);
    prefs.preset = preset;
  }

  /** A name for a new preset that none of yours has yet: `name`, or `name 2`, `name 3`… */
  freeName(name: string) {
    const taken = new Set(this.#mine.map((preset) => preset.name));
    for (let n = 1; ; n++) if (!taken.has(n === 1 ? name : `${name} ${n}`)) return n === 1 ? name : `${name} ${n}`;
  }

  /** A preset of your own with these settings; gives its id. */
  add(name: string, settings: PresetSettings, author?: string) {
    const id = `mine-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    this.#mine.push({ id, name, author, settings: pick(settings), mine: true });
    this.#save();
    return id;
  }

  /** A preset from a file, with its theme among yours (the same one, if you have it already); gives its id. */
  addFile({ name, author, settings, theme }: PresetFile) {
    const kept = { ...settings };
    if (theme) kept.theme = customThemes.find(theme) ?? customThemes.add(theme);
    // Someone else's theme that didn't come along: lines' own, rather than one of yours by chance.
    else if (kept.theme.startsWith("custom-")) kept.theme = DEFAULT_THEME;
    return this.add(this.freeName(name), kept, author);
  }

  /** One of yours, to have the look there is now. */
  update(id: string) {
    const preset = this.#mine.find((each) => each.id === id);
    if (!preset) return;
    preset.settings = currentSettings();
    this.#save();
  }

  rename(id: string, name: string) {
    const preset = this.#mine.find((each) => each.id === id);
    if (!preset || !name.trim() || preset.name === name.trim()) return;
    preset.name = name.trim();
    this.#save();
  }

  remove(id: string) {
    this.#mine = this.#mine.filter((preset) => preset.id !== id);
    this.#save();
  }
}

export const presets = new Presets();
