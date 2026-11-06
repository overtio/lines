import { oneByOne } from "../../lib/editor/pictures";
import { t } from "../../lib/i18n/index.svelte";
import { getJSON } from "../../lib/net";
import type { Plugin } from "../../lib/plugins/types";

/* OtakuGIFs (otakugifs.xyz): anime reaction GIFs, one at random per request. */

const API = "https://api.otakugifs.xyz/gif";

export const otakuGifs = (): Plugin => ({
  id: "otakugifs",
  name: "OtakuGIFs",
  description: t("plugins.otakugifs.description"),
  icon: "smile",
  enabledByDefault: false,
  contributes: {
    pictures: [
      {
        id: "otakugifs",
        name: "OtakuGIFs",
        icon: "smile",
        site: "https://otakugifs.xyz",
        categories: async () => (await getJSON<{ reactions: string[] }>(`${API}/allreactions`)).reactions,
        pictures: (category, count) =>
          oneByOne(count, async () => ({ url: (await getJSON<{ url: string }>(`${API}?reaction=${encodeURIComponent(category)}`)).url })),
      },
    ],
  },
});
