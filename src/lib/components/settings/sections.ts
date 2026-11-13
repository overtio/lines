import { t } from "../../i18n/index.svelte";
import type { IconName } from "../../icons/icons";
import { plugins } from "../../plugins/registry.svelte";
import type { Plugin } from "../../plugins/types";
import { windowLookAvailable } from "../../prefs.svelte";
import { canFloat } from "../../windows/floating";

/** lines' own sections, in the order they're listed; each plugin with settings has one too, after the list of plugins. */
export const SECTIONS = ["general", "presets", "theme", "layout", "text", "cursor", "editor", "floating", "touches", "library", "plugins", "sync", "privacy", "export", "shortcuts", "about"] as const;
type OwnSection = (typeof SECTIONS)[number];
/** A plugin's page of settings, by its id. */
export type PluginSection = `plugin:${string}`;
export type SettingsSection = OwnSection | PluginSection;

/** The section of a plugin's own settings. */
export const pluginSection = (plugin: Plugin): PluginSection => `plugin:${plugin.id}`;

/** Sections listed together under a heading of their own, which opens and closes. */
const GROUPS = {
  appearance: { icon: "palette", title: "settings.section.appearance", sections: ["presets", "theme", "layout", "text", "cursor", "editor", "floating"] },
  plugins: { icon: "puzzle", title: "settings.section.plugins", sections: ["plugins"] },
  data: { icon: "hard-drive", title: "settings.section.data", sections: ["sync", "privacy", "export"] },
} as const satisfies Record<string, { icon: IconName; title: string; sections: readonly OwnSection[] }>;
export type SettingsGroup = keyof typeof GROUPS;

const ICONS: Record<OwnSection, IconName> = {
  general: "settings",
  presets: "wand-sparkles",
  theme: "paintbrush",
  layout: "panel-left",
  text: "type",
  cursor: "text-cursor",
  editor: "square-pen",
  floating: "picture-in-picture-2",
  touches: "sparkles",
  library: "library",
  plugins: "puzzle",
  sync: "refresh",
  privacy: "shield",
  export: "arrow-left-right",
  shortcuts: "keyboard",
  about: "info",
};

export interface Section {
  id: SettingsSection;
  title: string;
  icon: IconName;
  /** The plugin whose settings it is. */
  plugin?: Plugin;
}

/**
 * The sections shown here: Floating only where windows can be see-through or float; and after the
 * list of plugins, a page for each that has settings, on or off (its switch is at its top).
 */
export function sections(): Section[] {
  const own = SECTIONS.filter((id) => id !== "floating" || windowLookAvailable || canFloat).map(
    (id): Section => ({ id, icon: ICONS[id], title: t(id === "plugins" ? "settings.section.allPlugins" : `settings.section.${id}`) }),
  );
  const pages = plugins.all
    .filter((plugin) => plugin.settings && plugin.available !== false)
    .map((plugin): Section => ({ id: pluginSection(plugin), icon: plugin.icon, title: plugin.name, plugin }));
  const after = own.findIndex((section) => section.id === "plugins") + 1;
  return [...own.slice(0, after), ...pages, ...own.slice(after)];
}

/** The group a section is listed under, if any: a plugin's page is under Plugins. */
const groupOf = (id: SettingsSection): SettingsGroup | undefined =>
  id.startsWith("plugin:") ? "plugins" : (Object.keys(GROUPS) as SettingsGroup[]).find((group) => (GROUPS[group].sections as readonly string[]).includes(id));

/** The list down the side: sections on their own, and groups of them under a heading. */
export function sectionList(shown: Section[]) {
  const list: ({ kind: "section"; section: Section } | { kind: "group"; id: SettingsGroup; icon: IconName; title: string; sections: Section[] })[] = [];
  for (const section of shown) {
    const group = groupOf(section.id);
    const last = list.at(-1);
    if (!group) list.push({ kind: "section", section });
    else if (last?.kind === "group" && last.id === group) last.sections.push(section);
    else list.push({ kind: "group", id: group, icon: GROUPS[group].icon, title: t(GROUPS[group].title), sections: [section] });
  }
  return list;
}

/** The section a name stands for, if it's one shown here, else General. */
export const sectionOf = (id: string | null | undefined): SettingsSection => sections().find((section) => section.id === id)?.id ?? "general";
