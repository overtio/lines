import { builtIn } from "../../plugins";
import { announce, onAnnounce } from "../windows/channel";
import { plainTextLanguage } from "./plainText";
import type { Contributions, IconSet, NoteLanguage, Plugin, Theme } from "./types";

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
  readonly themes = $derived(this.#from("themes"));
  readonly iconSets = $derived(this.#from("iconSets"));
  readonly mathEngines = $derived(this.#from("math"));
  readonly renderers = $derived(this.#from("renderers"));
  readonly typesetters = $derived(this.#from("typesetters"));
  readonly markdown = $derived(this.#from("markdown"));
  readonly pictures = $derived(this.#from("pictures"));

  constructor() {
    // Turned on or off in another window (Settings is one in the desktop apps).
    void onAnnounce((message) => message.type === "plugins" && (this.#choices = read()));
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

  /** Turns a plugin on or off, here and in every window. Turned on, so are the plugins it needs. */
  setOn(plugin: Plugin, on: boolean) {
    const choices = { ...this.#choices };
    const seen = new Set<Plugin>();
    const set = (each: Plugin | undefined) => {
      if (!each || seen.has(each)) return;
      seen.add(each);
      if (!each.required && this.isOn(each) !== on) {
        // Back to its default: nothing to remember.
        if (on === each.enabledByDefault) delete choices[each.id];
        else choices[each.id] = on;
      }
      if (on) for (const id of each.requires ?? []) set(this.get(id));
    };
    set(plugin);
    if (JSON.stringify(choices) === JSON.stringify(this.#choices)) return;
    this.#choices = choices;
    try {
      localStorage.setItem(KEY, JSON.stringify(choices));
    } catch {
      // Storage that can't be written: the choice lasts until lines restarts.
    }
    void announce({ type: "plugins" });
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

  /** The icon set `id`, or Lucide while its plugin is off. */
  iconSet(id: string): IconSet {
    return this.iconSets.find((set) => set.id === id) ?? this.iconSets.find((set) => set.id === DEFAULT_ICONS)!;
  }

  /** What draws a code block of `language` (```mermaid), if anything does. */
  renderer(language: string) {
    const name = language.toLowerCase();
    return this.renderers.find((renderer) => renderer.languages.includes(name));
  }

  /** What draws math, if anything does. */
  get math() {
    return this.mathEngines[0];
  }

  /** Typesetters for notes in `language`, besides lines' own pages. */
  typesettersFor(language: string) {
    return this.typesetters.filter((typesetter) => typesetter.languages.includes(language));
  }
}

export const plugins = new Plugins();
