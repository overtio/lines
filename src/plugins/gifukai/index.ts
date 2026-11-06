import { oneByOne } from "../../lib/editor/pictures";
import { t } from "../../lib/i18n/index.svelte";
import { getJSON } from "../../lib/net";
import { isTauri } from "../../lib/platform";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Gifukai (gifukai.com): anime reaction GIFs, each with the anime it's from, one at random per
 * request. Its API doesn't answer web pages, so it's only in the apps.
 */

const API = "https://api.gifukai.com/v1";

export const gifukai = (): Plugin => ({
  id: "gifukai",
  name: "Gifukai",
  description: t("plugins.gifukai.description"),
  icon: "film",
  enabledByDefault: false,
  available: isTauri,
  availability: t("plugins.appsOnly", { name: "Gifukai" }),
  contributes: {
    pictures: [
      {
        id: "gifukai",
        name: "Gifukai",
        icon: "film",
        site: "https://gifukai.com",
        categories: async () => Object.keys((await getJSON<{ actions: Record<string, unknown> }>(`${API}/actions`)).actions).sort(),
        pictures: (category, count) =>
          oneByOne(count, async () => {
            const { url, anime } = await getJSON<{ url: string; anime?: string }>(`${API}/${encodeURIComponent(category)}?nsfw=false`);
            return { url, credit: anime };
          }),
      },
    ],
  },
});
