import { named, SECTIONS } from "../../lib/editor/slashCommands";
import { pickWebImage } from "../../lib/editor/webImages";
import { t } from "../../lib/i18n/index.svelte";
import { isTauri, webFetch } from "../../lib/platform";
import type { FoundImage, Plugin, PictureLibrary, SearchPage } from "../../lib/plugins/types";

/*
 * Wallhaven (wallhaven.cc), its wallpapers searched: /wallhaven puts one in a note, kept with it, and
 * Settings → Theme → New → From Wallhaven… makes a theme of one's colors, and can make it the
 * backdrop. Only what Wallhaven marks safe for work, which needs no key. Wallhaven's site answers
 * the apps but not web pages (it sends no CORS headers), so the plugin is the apps'.
 */

const API = "https://wallhaven.cc/api/v1/search";

/** A wallpaper as Wallhaven's search gives it. */
export interface Wallpaper {
  id: string;
  url: string;
  path: string;
  resolution: string;
  colors: string[];
  thumbs: { large: string; small: string };
}

/**
 * Where a page of what `query` finds is: by relevance, or with nothing typed, the month's top;
 * general, anime and people alike, and only those safe for work.
 */
export function searchUrl(query: string, page: number) {
  const params = new URLSearchParams({ categories: "111", purity: "100", page: String(page) });
  if (query) params.set("q", query);
  params.set("sorting", query ? "relevance" : "toplist");
  if (!query) params.set("topRange", "1M");
  return `${API}?${params}`;
}

/** The wallpapers' whole pictures, by id, for when one's chosen. */
const paths = new Map<string, string>();

/** A wallpaper as the picker shows it, described by the words it was found with (Wallhaven's search gives no description). */
export function found(wallpaper: Wallpaper, query: string): FoundImage {
  paths.set(wallpaper.id, wallpaper.path);
  const words = query.trim();
  return {
    id: wallpaper.id,
    thumb: wallpaper.thumbs.small,
    color: wallpaper.colors[0],
    src: wallpaper.url,
    alt: words ? words.charAt(0).toUpperCase() + words.slice(1) : t("plugins.wallhaven.wallpaper"),
  };
}

async function get(url: string, signal?: AbortSignal) {
  const fetch = await webFetch();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Wallhaven answered ${response.status}`);
  return response;
}

const library: PictureLibrary = {
  name: "Wallhaven",
  credit: { text: t("plugins.wallhaven.credit"), href: "https://wallhaven.cc" },
  async search(query, page, signal): Promise<SearchPage<FoundImage>> {
    const { data, meta } = (await (await get(searchUrl(query.trim(), page), signal)).json()) as { data: Wallpaper[]; meta: { current_page: number; last_page: number } };
    return { items: data.map((wallpaper) => found(wallpaper, query)), more: meta.current_page < meta.last_page };
  },
  async picture(image, signal) {
    const path = paths.get(image.id);
    if (!path) throw new Error("Not a wallpaper Wallhaven found");
    return (await get(path, signal)).blob();
  },
};

export const wallhaven = (): Plugin => ({
  id: "wallhaven",
  name: "Wallhaven",
  description: t("plugins.wallhaven.description"),
  icon: "image",
  enabledByDefault: true,
  available: isTauri,
  availability: t("plugins.wallhaven.apps"),
  contributes: {
    pictureLibraries: [library],
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.wallhaven"),
            after: "unsplash",
            hint: "Wallhaven",
            icon: "image",
            section: SECTIONS.insert,
            apply: pickWebImage(library),
          },
        ],
      },
    ],
  },
});
