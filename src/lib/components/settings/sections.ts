import type { MessageKey } from "../../i18n/index.svelte";
import { t } from "../../i18n/index.svelte";
import type { IconName } from "../../icons/icons";
import { isSite } from "../../platform";
import { windowLookAvailable } from "../../prefs.svelte";
import { canFloat } from "../../windows/floating";

/** Settings' sections, in the order they're listed. */
export const SECTIONS = ["general", "theme", "paper", "layout", "text", "cursor", "mascot", "editor", "floating", "plugins", "sync", "privacy", "export", "shortcuts", "about"] as const;
export type SettingsSection = (typeof SECTIONS)[number];

/** Sections listed together under a heading of their own, which opens and closes. */
const GROUPS = {
  appearance: { icon: "palette", sections: ["theme", "paper", "layout", "text", "cursor", "mascot", "editor", "floating"] },
  data: { icon: "hard-drive", sections: ["sync", "privacy", "export"] },
} as const satisfies Record<string, { icon: IconName; sections: readonly SettingsSection[] }>;
export type SettingsGroup = keyof typeof GROUPS;

/** The icons of the sections listed on their own; those in a group are under its icon. */
const ICONS: Partial<Record<SettingsSection, IconName>> = {
  general: "settings",
  plugins: "puzzle",
  shortcuts: "keyboard",
  about: "info",
};

/** What each is for, under its title. */
const ABOUT: Partial<Record<SettingsSection, MessageKey>> = {
  general: "settings.section.generalAbout",
  theme: "settings.section.themeAbout",
  paper: "settings.section.paperAbout",
  layout: "settings.section.layoutAbout",
  text: "settings.section.textAbout",
  cursor: "settings.section.cursorAbout",
  mascot: "settings.section.mascotAbout",
  editor: "settings.section.editorAbout",
  floating: "settings.section.floatingAbout",
  plugins: "plugins.intro",
  // The demo website only saves to a folder, which says what it does itself.
  sync: isSite ? undefined : "sync.intro",
  privacy: "settings.section.privacyAbout",
  export: "settings.section.exportAbout",
};

export interface Section {
  id: SettingsSection;
  title: string;
  about: string | null;
  icon?: IconName;
}

/** The sections shown here: Floating only where windows can be see-through or float. */
export const sections = (): Section[] =>
  SECTIONS.filter((id) => id !== "floating" || windowLookAvailable || canFloat).map((id) => {
    const about = ABOUT[id];
    return { id, icon: ICONS[id], title: t(`settings.section.${id}`), about: about ? t(about) : null };
  });

/** The list down the side: sections on their own, and groups of them under a heading. */
export function sectionList(shown: Section[]) {
  const grouped = new Map<SettingsSection, SettingsGroup>(
    Object.entries(GROUPS).flatMap(([id, group]) => group.sections.map((section) => [section, id as SettingsGroup] as const)),
  );
  const list: ({ kind: "section"; section: Section } | { kind: "group"; id: SettingsGroup; icon: IconName; title: string; sections: Section[] })[] = [];
  for (const section of shown) {
    const group = grouped.get(section.id);
    const last = list.at(-1);
    if (!group) list.push({ kind: "section", section });
    else if (last?.kind === "group" && last.id === group) last.sections.push(section);
    else list.push({ kind: "group", id: group, icon: GROUPS[group].icon, title: t(`settings.section.${group}`), sections: [section] });
  }
  return list;
}

/** The section a name stands for, if it's one shown here, else General. */
export const sectionOf = (id: string | null | undefined): SettingsSection => sections().find((section) => section.id === id)?.id ?? "general";
