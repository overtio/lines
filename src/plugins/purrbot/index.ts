import { t } from "../../lib/i18n/index.svelte";
import { getJSON } from "../../lib/net";
import { isTauri } from "../../lib/platform";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Purr Bot's API (docs.purrbot.site/api): anime GIFs and pictures. Only its safe-for-work ones are
 * asked for. Its API doesn't answer web pages, so it's only in the apps.
 */

const API = "https://api.purrbot.site/v2";

/** Its safe-for-work categories, as GIFs or as still pictures. */
const CATEGORIES: Record<string, "gif" | "img"> = {
  angry: "gif",
  bite: "gif",
  blush: "gif",
  comfy: "gif",
  cry: "gif",
  cuddle: "gif",
  dance: "gif",
  eevee: "gif",
  fluff: "gif",
  holo: "img",
  hug: "gif",
  icon: "img",
  kiss: "gif",
  kitsune: "img",
  lay: "gif",
  lick: "gif",
  neko: "gif",
  okami: "img",
  pat: "gif",
  poke: "gif",
  pout: "gif",
  senko: "img",
  shiro: "img",
  slap: "gif",
  smile: "gif",
  tail: "gif",
  tickle: "gif",
};

/** `count` of `items`, picked at random. */
function some<T>(items: T[], count: number) {
  const left = [...items];
  return Array.from({ length: Math.min(count, left.length) }, () => left.splice(Math.floor(Math.random() * left.length), 1)[0]);
}

export const purrBot = (): Plugin => ({
  id: "purrbot",
  name: "Purr Bot",
  description: t("plugins.purrbot.description"),
  icon: "paw-print",
  enabledByDefault: false,
  available: isTauri,
  availability: t("plugins.appsOnly", { name: "Purr Bot" }),
  contributes: {
    pictures: [
      {
        id: "purrbot",
        name: "Purr Bot",
        icon: "paw-print",
        site: "https://purrbot.site",
        categories: async () => Object.keys(CATEGORIES),
        // The whole category's list, a few of them picked from it.
        pictures: async (category, count) => {
          const { links } = await getJSON<{ links: string[] }>(`${API}/list/sfw/${category}/${CATEGORIES[category]}`);
          return some(links, count).map((url) => ({ url }));
        },
      },
    ],
  },
});
