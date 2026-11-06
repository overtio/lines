import { t } from "../../lib/i18n/index.svelte";
import { getJSON } from "../../lib/net";
import type { Picture, Plugin } from "../../lib/plugins/types";

/*
 * nekos.best (docs.nekos.best): anime reaction GIFs, and pictures of nekos, kitsune, waifus and
 * husbandos, all safe for work, each with the anime or artist it's from. Its GIFs can be searched
 * by anime.
 */

const API = "https://nekos.best/api/v2";

interface Result {
  url: string;
  anime_name?: string;
  artist_name?: string;
}

async function results(path: string): Promise<Picture[]> {
  const { results } = await getJSON<{ results: Result[] }>(`${API}/${path}`);
  return results.map(({ url, anime_name, artist_name }) => ({ url, credit: anime_name ?? artist_name }));
}

export const nekosBest = (): Plugin => ({
  id: "nekos-best",
  name: "nekos.best",
  description: t("plugins.nekosBest.description"),
  icon: "cat",
  enabledByDefault: false,
  contributes: {
    pictures: [
      {
        id: "nekos-best",
        name: "nekos.best",
        icon: "cat",
        site: "https://nekos.best",
        categories: async () => Object.keys(await getJSON<Record<string, unknown>>(`${API}/endpoints`)).sort(),
        pictures: (category, count) => results(`${encodeURIComponent(category)}?amount=${count}`),
        // Type 2 is GIFs.
        search: (query, count) => results(`search?type=2&amount=${count}&query=${encodeURIComponent(query)}`),
      },
    ],
  },
});
