import { giphyGif } from "../../lib/editor/giphy";
import { named, SECTIONS } from "../../lib/editor/slashCommands";
import { type FoundImage, type ImageLibrary, pickWebImage } from "../../lib/editor/webImages";
import { language, t } from "../../lib/i18n/index.svelte";
import { reducedMotion, webFetch } from "../../lib/platform";
import type { Plugin } from "../../lib/plugins/types";

/*
 * /giphy: search GIPHY's GIFs and put one in a note, as an image by its address on GIPHY
 * (lib/editor/giphy.ts). GIPHY's API needs a key, set as VITE_GIPHY_API_KEY when lines is built.
 */

const KEY: string | undefined = import.meta.env.VITE_GIPHY_API_KEY;
const API = "https://api.giphy.com/v1/gifs";
const LIMIT = 24;
/** As far as GIPHY pages through trending GIFs, and through a search's. */
const MOST = { trending: 500, search: 5000 };

interface Gif {
  id: string;
  title: string;
  alt_text?: string;
  user?: { display_name?: string };
  images: { fixed_width: { url: string; webp?: string }; fixed_width_still: { url: string } };
}

interface Found {
  data: Gif[];
  pagination: { total_count: number; count: number; offset: number };
}

function found(gif: Gif): FoundImage {
  const { fixed_width: moving, fixed_width_still: still } = gif.images;
  return {
    id: gif.id,
    thumb: reducedMotion.matches ? still.url : (moving.webp ?? moving.url),
    by: gif.user?.display_name || undefined,
    src: giphyGif(gif.id),
    // Its title says what it is, then "GIF by" who made it.
    alt: gif.alt_text?.trim() || gif.title.replace(/\s+GIF(?:\s+by\s.*)?$/i, ""),
  };
}

const library: ImageLibrary = {
  name: "GIPHY",
  // GIPHY's attribution, in its own words.
  credit: { text: "Powered by GIPHY", href: "https://giphy.com" },
  async search(query, page, signal) {
    const offset = (page - 1) * LIMIT;
    const params = new URLSearchParams({ api_key: KEY!, limit: String(LIMIT), offset: String(offset), rating: "pg-13", bundle: "messaging_non_clips" });
    if (query) {
      params.set("q", query);
      params.set("lang", language);
    }
    const fetch = await webFetch();
    const response = await fetch(`${API}/${query ? "search" : "trending"}?${params}`, { signal });
    if (!response.ok) throw new Error(`GIPHY answered ${response.status}`);
    const { data, pagination }: Found = await response.json();
    const end = Math.min(pagination.total_count, query ? MOST.search : MOST.trending);
    return { images: data.map(found), more: offset + pagination.count < end };
  },
};

export const giphy = (): Plugin => ({
  id: "giphy",
  name: "GIPHY",
  description: t("plugins.giphy.description"),
  icon: "image-play",
  enabledByDefault: true,
  available: !!KEY,
  availability: t("plugins.noKey", { name: "GIPHY" }),
  contributes: {
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.giphy"),
            after: "image",
            hint: "GIPHY",
            icon: "image-play",
            section: SECTIONS.insert,
            apply: pickWebImage(library),
          },
        ],
      },
    ],
  },
});
