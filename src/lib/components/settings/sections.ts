import type { MessageKey } from "../../i18n/index.svelte";
import { t } from "../../i18n/index.svelte";
import type { IconName } from "../../icons/icons";
import { isSite } from "../../platform";
import { windowLookAvailable } from "../../prefs.svelte";
import { canFloat } from "../../windows/floating";

/** Settings' sections, in the order they're listed. */
export const SECTIONS = ["general", "appearance", "windows", "text", "editing", "plugins", "sync", "privacy", "data", "shortcuts", "about"] as const;
export type SettingsSection = (typeof SECTIONS)[number];

const ICONS: Record<SettingsSection, IconName> = {
  general: "settings",
  appearance: "palette",
  windows: "app-window",
  text: "type",
  editing: "pencil",
  plugins: "puzzle",
  sync: "refresh",
  privacy: "lock",
  data: "hard-drive",
  shortcuts: "keyboard",
  about: "info",
};

/** What each is for, under its title. */
const ABOUT: Partial<Record<SettingsSection, MessageKey>> = {
  general: "settings.section.generalAbout",
  appearance: "settings.section.appearanceAbout",
  windows: "settings.section.windowsAbout",
  text: "settings.section.textAbout",
  editing: "settings.section.editingAbout",
  plugins: "plugins.intro",
  // The demo website only saves to a folder, which says what it does itself.
  sync: isSite ? undefined : "sync.intro",
  privacy: "settings.section.privacyAbout",
  data: "settings.section.dataAbout",
};

/** The sections shown here: Windows only where windows can be see-through or float. */
export const sections = () =>
  SECTIONS.filter((id) => id !== "windows" || windowLookAvailable || canFloat).map((id) => {
    const about = ABOUT[id];
    return { id, icon: ICONS[id], title: t(`settings.section.${id}`), about: about ? t(about) : null };
  });

/** The section a name stands for, if it's one shown here, else General. */
export const sectionOf = (id: string | null | undefined): SettingsSection => sections().find((section) => section.id === id)?.id ?? "general";
