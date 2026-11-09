import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { formats } from "./formats";
import { themes as all } from "./themes";

/**
 * lines' seventeen themes (themes.ts), Lines first: the one lines falls back to; and the theme files
 * of other apps it can read (formats/).
 */
export const themes = (): Plugin => ({
  id: "themes",
  name: t("plugins.themes"),
  description: t("plugins.themes.description"),
  icon: "palette",
  enabledByDefault: true,
  required: true,
  contributes: { themes: all(), themeFormats: formats() },
});
