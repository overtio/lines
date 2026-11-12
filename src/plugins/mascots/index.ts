import { type MessageKey, t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { alien, cat, girl, slime } from "./art";

/*
 * Mascots to keep you company (Settings → Plugins → Mascots): a cat, an alien, a slime and a girl, each pixel
 * art in a few poses (art.ts). How they walk about and react is lines' own (lib/mascot/).
 */
/** What a mascot says its own way, in the app's language: a message of them, a comma between each. */
const says = (key: MessageKey) => t(key).split(", ");

export const mascots = (): Plugin => ({
  id: "mascots",
  name: t("plugins.mascots"),
  description: t("plugins.mascots.description"),
  icon: "paw-print",
  enabledByDefault: true,
  settings: () => import("./MascotsSettings.svelte"),
  contributes: {
    mascots: [
      { id: "cat", name: t("mascots.cat"), description: t("mascots.cat.about"), sounds: says("mascots.cat.says"), ...cat },
      { id: "alien", name: t("mascots.alien"), description: t("mascots.alien.about"), sounds: says("mascots.alien.says"), ...alien },
      { id: "slime", name: t("mascots.slime"), description: t("mascots.slime.about"), sounds: says("mascots.slime.says"), ...slime },
      { id: "girl", name: t("mascots.girl"), description: t("mascots.girl.about"), sounds: says("mascots.girl.says"), ...girl },
    ],
  },
});
