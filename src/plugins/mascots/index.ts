import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { alien, cat, girl, slime } from "./art";

/*
 * Mascots to keep you company (Settings → Mascot): a cat, an alien, a slime and a girl, each pixel
 * art in a few poses (art.ts). How they walk about and react is lines' own (lib/mascot/).
 */
export const mascots = (): Plugin => ({
  id: "mascots",
  name: t("plugins.mascots"),
  description: t("plugins.mascots.description"),
  icon: "sparkles",
  enabledByDefault: true,
  contributes: {
    mascots: [
      { id: "cat", name: t("mascots.cat"), description: t("mascots.cat.about"), ...cat },
      { id: "alien", name: t("mascots.alien"), description: t("mascots.alien.about"), ...alien },
      { id: "slime", name: t("mascots.slime"), description: t("mascots.slime.about"), ...slime },
      { id: "girl", name: t("mascots.girl"), description: t("mascots.girl.about"), ...girl },
    ],
  },
});
