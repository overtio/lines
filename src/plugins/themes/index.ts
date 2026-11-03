import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { themes as all } from "./themes";

/** lines' sixteen themes (themes.ts), Lines first: the one lines falls back to. */
export const themes = (): Plugin => ({
  id: "themes",
  name: t("plugins.themes"),
  description: t("plugins.themes.description"),
  icon: "palette",
  enabledByDefault: true,
  required: true,
  contributes: { themes: all() },
});
