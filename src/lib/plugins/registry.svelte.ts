import { builtIn } from "../../plugins";
import { customThemes } from "../themes/custom.svelte";
import { announce, onAnnounce } from "../windows/channel";
import { plainTextLanguage } from "./plainText";
import type { Contributions, EmbedLink, IconSet, NoteLanguage, Plugin, Theme } from "./types";

/*
 * The plugins lines has, which of them are on, and what the ones on add. Everything that asks for a
 * language, theme, icon set or engine asks here, so a plugin turned on or off takes effect at once,
 * in every window. Turning one off loses nothing: a note in its language opens as plain text until
 * it's on again.
 */

const KEY = "lines.plugins";

/** What a note is written in when it doesn't say. */
export const DEFAULT_LANGUAGE = "markdown";
const DEFAULT_THEME = "lines";
const DEFAULT_ICONS = "lucide";

/** A file name's extension, in lowercase: `stl` for `Bracket.STL`. */
const extension = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

/** The plugins turned on or off by choice, by id; the rest are as they are by default. */
function read(): Record<string, boolean> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (stored && typeof stored === "object") {
      return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
    }
  } catch {
    // Unreadable: every plugin as it is by default.
  }
  return {};
}

class Plugins {
  #all: readonly Plugin[] | undefined;
  #choices = $state(read());

  /** Every plugin lines has, on or not. Made the first time it's asked for, once every module has loaded. */
  get all(): readonly Plugin[] {
    return (this.#all ??= builtIn());
  }

  /** The plugins running: on, able to work here, and with every plugin they need running too. */
  readonly active = $derived.by(() => {
    let running = this.all.filter((plugin) => plugin.available !== false && this.isOn(plugin));
    for (let before = -1; before !== running.length; ) {
      before = running.length;
      const ids = new Set(running.map((plugin) => plugin.id));
      running = running.filter((plugin) => (plugin.requires ?? []).every((id) => ids.has(id)));
    }
    return running;
  });

  readonly languages = $derived(this.#from("languages"));
  /** The plugins' themes, then your own (themes/custom.svelte.ts). */
  readonly themes = $derived([...this.#from("themes"), ...customThemes.themes]);
  readonly themeFormats = $derived(this.#from("themeFormats"));
  readonly iconSets = $derived(this.#from("iconSets"));
  readonly mathEngines = $derived(this.#from("math"));
  readonly renderers = $derived(this.#from("renderers"));
  readonly fileViews = $derived(this.#from("files"));
  readonly typesetters = $derived(this.#from("typesetters"));
  readonly formulaEngines = $derived(this.#from("formulas"));
  readonly markdown = $derived(this.#from("markdown"));
  readonly embeds = $derived(this.markdown.flatMap((addition) => addition.embeds ?? []));
  readonly codeLanguages = $derived(this.#from("codeLanguages"));
  readonly links = $derived(this.#from("links"));
  readonly papers = $derived(this.#from("papers"));
  readonly paperStyles = $derived(this.#from("paperStyles"));

  constructor() {
    // Turned on or off in another window (Settings is one in the desktop apps).
    void onAnnounce((message) => message.type === "plugins" && (this.#choices = message.choices));
  }

  /** What the running plugins add of one kind, in their order. */
  #from<K extends keyof Contributions>(kind: K) {
    return this.active.flatMap((plugin) => (plugin.contributes[kind] ?? []) as unknown[]) as NonNullable<Contributions[K]>;
  }

  /** On, by choice or by default, whether or not it can run. */
  isOn(plugin: Plugin) {
    return !!plugin.required || (this.#choices[plugin.id] ?? plugin.enabledByDefault);
  }

  isActive(plugin: Plugin) {
    return this.active.includes(plugin);
  }

  get(id: string) {
    return this.all.find((plugin) => plugin.id === id);
  }

  /**
   * Turns a plugin on or off, here and in every window. Turned on, so are the plugins it needs, and
   * its alternatives are turned off.
   */
  setOn(plugin: Plugin, on: boolean) {
    const choices = { ...this.#choices };
    const seen = new Set<Plugin>();
    const set = (each: Plugin | undefined, on: boolean) => {
      if (!each || seen.has(each)) return;
      seen.add(each);
      if (!each.required && this.isOn(each) !== on) {
        // Back to its default: nothing to remember.
        if (on === each.enabledByDefault) delete choices[each.id];
        else choices[each.id] = on;
      }
      if (!on) return;
      for (const id of each.requires ?? []) set(this.get(id), true);
      for (const id of each.alternatives ?? []) set(this.get(id), false);
    };
    set(plugin, on);
    if (JSON.stringify(choices) === JSON.stringify(this.#choices)) return;
    this.#choices = choices;
    try {
      localStorage.setItem(KEY, JSON.stringify(choices));
    } catch {
      // Storage that can't be written: the choice lasts until lines restarts.
    }
    void announce({ type: "plugins", choices });
  }

  /** The language a note shows in: its own while its plugin runs, plain text otherwise. */
  language(id = DEFAULT_LANGUAGE): NoteLanguage {
    return this.languages.find((language) => language.id === id) ?? plainTextLanguage;
  }

  /**
   * A note's own language, its plugin on or not, to write the note out as what it is (exports,
   * downloads); plain text for a language lines doesn't have.
   */
  ownLanguage(id = DEFAULT_LANGUAGE): NoteLanguage {
    return this.pluginOf(id)?.contributes.languages?.find((language) => language.id === id) ?? plainTextLanguage;
  }

  /** The plugin a language comes from. */
  pluginOf(language: string) {
    return this.all.find((plugin) => plugin.contributes.languages?.some((each) => each.id === language));
  }

  /** The theme `id`, or lines' own while its plugin is off. */
  theme(id: string): Theme {
    return this.themes.find((theme) => theme.id === id) ?? this.themes.find((theme) => theme.id === DEFAULT_THEME)!;
  }

  /** The paper style `id` (Settings → Paper), if its plugin is on. */
  paperStyle(id: string) {
    return this.paperStyles.find((style) => style.id === id);
  }

  /** The icon set `id`, or Lucide while its plugin is off. */
  iconSet(id: string): IconSet {
    return this.iconSets.find((set) => set.id === id) ?? this.iconSets.find((set) => set.id === DEFAULT_ICONS)!;
  }

  /** What draws a code block of `language` (```mermaid), if anything does. */
  renderer(language: string) {
    const name = language.toLowerCase();
    return this.renderers.find((renderer) => renderer.languages.includes(name));
  }

  /** What shows an attached file of this name (`….stl`) in a note, if anything does. */
  fileView(name: string) {
    return this.fileViews.find((view) => view.extensions.includes(extension(name)));
  }

  /** What makes a block from an attached file of this name (a `.csv` file's spreadsheet), if anything does. */
  blockFromFile(name: string) {
    return this.renderers.find((renderer) => renderer.fromFiles?.extensions.includes(extension(name)));
  }

  /** What draws a link on a line of its own (an asciinema recording as its player), if anything does. */
  embed(link: EmbedLink) {
    return this.embeds.find((embed) => embed.draws(link));
  }

  /** What draws math, if anything does. */
  get math() {
    return this.mathEngines[0];
  }

  /** What works out formulas in tables and spreadsheets, if anything does. */
  get formulas() {
    return this.formulaEngines[0];
  }

  /** Typesetters for notes in `language`, besides lines' own pages. */
  typesettersFor(language: string) {
    return this.typesetters.filter((typesetter) => typesetter.languages.includes(language));
  }
}

export const plugins = new Plugins();
