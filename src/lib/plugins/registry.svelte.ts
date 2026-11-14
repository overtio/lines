import { builtIn } from "../../plugins";
import { customThemes } from "../themes/custom.svelte";
import { themeDrafts } from "../themes/drafts.svelte";
import { resolveTheme } from "../themes/palette";
import { announce, onAnnounce } from "../windows/channel";
import { plainTextLanguage } from "./plainText";
import { soundPacks } from "../sounds/packs.svelte";
import type { NoteMeta } from "../notes/types";
import type { AppStyle, Contributions, EmbedLink, IconSet, KeyboardSound, NoteLanguage, Palette, Plugin, Theme, ThemeDefinition } from "./types";

/*
 * The plugins lines has, which of them are on, and what the ones on add. Everything that asks for a
 * language, theme, icon set or engine asks here, so a plugin turned on or off takes effect at once,
 * in every window. Turning one off loses nothing: a note in its language opens as plain text until
 * it's on again.
 */

const KEY = "lines.plugins";

/** What a note is written in when it doesn't say. */
export const DEFAULT_LANGUAGE = "markdown";
export const DEFAULT_THEME = "lines";
export const DEFAULT_STYLE = "lines";
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

/** A plugin off at first that its notes turn on (`keepLanguagesInUse`). */
const comesWithItsNotes = (plugin: Plugin) => !plugin.enabledByDefault && !!plugin.contributes.languages?.length;

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
  /** The plugins' palettes, then your own (themes/custom.svelte.ts). */
  readonly palettes = $derived([...this.#from("palettes"), ...customThemes.palettes]);
  /** The plugins' themes, then your own, as they're made: a palette and what each of its colors is for. */
  readonly #definitions = $derived([...this.#from("themes"), ...customThemes.list]);
  /**
   * Every theme, as `theme()` gives it. Worked out the first time they're asked for together, as
   * Settings lists them, rather than as lines starts, which shows only one.
   */
  readonly themes = $derived(this.#definitions.map((theme) => this.#shown(theme)));
  readonly themeFormats = $derived(this.#from("themeFormats"));
  readonly styles = $derived(this.#from("styles"));
  readonly fonts = $derived(this.#from("fonts"));
  readonly iconSets = $derived(this.#from("iconSets"));
  readonly mathEngines = $derived(this.#from("math"));
  readonly renderers = $derived(this.#from("renderers"));
  readonly fileViews = $derived(this.#from("files"));
  readonly bookReaders = $derived(this.#from("bookReaders"));
  readonly typesetters = $derived(this.#from("typesetters"));
  readonly formulaEngines = $derived(this.#from("formulas"));
  readonly markdown = $derived(this.#from("markdown"));
  readonly embeds = $derived(this.markdown.flatMap((addition) => addition.embeds ?? []));
  readonly codeLanguages = $derived(this.#from("codeLanguages"));
  readonly links = $derived(this.#from("links"));
  readonly papers = $derived(this.#from("papers"));
  readonly paperStyles = $derived(this.#from("paperStyles"));
  readonly markerSources = $derived(this.#from("markers"));
  /** Keyboards to hear as you type: the plugins', then your sound packs (sounds/packs.svelte.ts). */
  readonly keyboardSounds = $derived([...this.#from("keyboardSounds"), ...soundPacks.keyboards]);
  readonly mascots = $derived(this.#from("mascots"));
  readonly pictureLibraries = $derived(this.#from("pictureLibraries"));
  readonly libraryKinds = $derived(this.#from("libraryKinds"));
  /** Where links are looked up, in the order they're asked: each site's, then those that read any page; each with the plugins it needs running. */
  readonly librarySources = $derived.by(() => {
    const running = new Set(this.active.map((plugin) => plugin.id));
    return this.#from("librarySources")
      .filter((source) => (source.requires ?? []).every((id) => running.has(id)))
      .sort((a, b) => Number(!!a.general) - Number(!!b.general));
  });
  readonly linkActions = $derived(this.#from("linkActions"));
  readonly libraryImports = $derived(this.#from("libraryImports"));
  readonly discussions = $derived(this.#from("discussions"));

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
        // Back to its default: nothing to remember. But one that comes on with its notes is kept off.
        if (on === each.enabledByDefault && !comesWithItsNotes(each)) delete choices[each.id];
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

  /**
   * Plugins off at first (Spreadsheet Notes) that notes here are written in, from another device,
   * an import or the feature tour, turned on, so none of those opens as text; not one turned off by choice.
   */
  keepLanguagesInUse(languages: ReadonlySet<string>) {
    for (const plugin of this.all) {
      if (!comesWithItsNotes(plugin) || plugin.id in this.#choices) continue;
      if (plugin.contributes.languages?.some((language) => languages.has(language.id))) this.setOn(plugin, true);
    }
  }

  /** The language a note shows in: its own while its plugin runs, plain text otherwise. */
  language(id = DEFAULT_LANGUAGE): NoteLanguage {
    return this.languages.find((language) => language.id === id) ?? plainTextLanguage;
  }

  /**
   * What the list knows of a note written in language `id`. Read as plain text if its plugin
   * fails to read it, so the note is still listed, saved and synced.
   */
  meta(id: string | undefined, body: string): NoteMeta {
    const language = this.language(id);
    try {
      return language.meta(body);
    } catch (error) {
      console.error(`lines: ${language.name} couldn't read a note`, error);
      return plainTextLanguage.meta(body);
    }
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

  /**
   * The palette `id`: yours, or a plugin's, on or not, so a theme of yours drawn in one keeps its
   * colors while that plugin's off.
   */
  palette(id: string): Palette | undefined {
    return customThemes.palette(id) ?? this.all.flatMap((plugin) => plugin.contributes.palettes ?? []).find((palette) => palette.id === id);
  }

  /** A theme as lines shows it: worked out from its palettes (themes/palette.ts), with the colors changed in it and not saved yet (themes/drafts.svelte.ts). */
  #shown(definition: ThemeDefinition): Theme {
    return themeDrafts.over(resolveTheme(definition, (id) => this.palette(id)));
  }

  /** The theme `id`, or lines' own while its plugin is off. */
  theme(id: string): Theme {
    return this.#shown(this.#definitions.find((theme) => theme.id === id) ?? this.#definitions.find((theme) => theme.id === DEFAULT_THEME)!);
  }

  /** The keyboard `id` to hear as you type, or the first there is while its plugin is off or its pack is gone. */
  keyboardSound(id: string): KeyboardSound | undefined {
    return this.keyboardSounds.find((keyboard) => keyboard.id === id) ?? this.keyboardSounds[0];
  }

  /** The style `id` (a preset's: Settings → Presets), or lines' own while its plugin is off. */
  style(id: string): AppStyle | undefined {
    return this.styles.find((style) => style.id === id) ?? this.styles.find((style) => style.id === DEFAULT_STYLE);
  }

  /** The paper style `id` (Settings → Plugins → Paper), if its plugin is on. */
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

  /** What reads a book of this name (`….epub`) in a note's place, if anything does. */
  bookReader(name: string) {
    return this.bookReaders.find((reader) => reader.extensions.includes(extension(name)));
  }

  /** What makes a block from an attached file of this name (a `.csv` file's spreadsheet), if anything does. */
  blockFromFile(name: string) {
    return this.renderers.find((renderer) => renderer.fromFiles?.extensions.includes(extension(name)));
  }

  /** What draws a link on a line of its own (an asciinema recording as its player), if anything does. */
  embed(link: EmbedLink) {
    return this.embeds.find((embed) => embed.draws(link));
  }

  /** The library's kind of things whose notes have this `type`, if it's one. */
  libraryKind(type: string) {
    return this.libraryKinds.find((kind) => kind.type === type);
  }

  /** What reads the discussion at `link` (a post's comments link), if anything does. */
  discussion(link: string) {
    try {
      const url = new URL(link);
      return this.discussions.find((source) => source.recognizes(url));
    } catch {
      return undefined;
    }
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
