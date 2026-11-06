import { named, SECTIONS } from "../../lib/editor/slashCommands";
import { unsplashPhoto } from "../../lib/editor/unsplash";
import { type FoundImage, type ImageLibrary, pickWebImage } from "../../lib/editor/webImages";
import { language, t } from "../../lib/i18n/index.svelte";
import { webFetch } from "../../lib/platform";
import type { Plugin } from "../../lib/plugins/types";

/*
 * /unsplash: search Unsplash's free photos and put one in a note. The note keeps the link to the
 * photo's page, which lines shows as the photo (lib/editor/unsplash.ts) and which credits its
 * photographer. Unsplash's API needs a key, set as VITE_UNSPLASH_ACCESS_KEY when lines is built.
 */

const KEY: string | undefined = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const API = "https://api.unsplash.com";
const PER_PAGE = 24;

interface Photo {
  id: string;
  color: string | null;
  alt_description: string | null;
  /** Unsplash+ photos, which Unsplash only hands to subscribers. */
  premium?: boolean;
  urls: { small: string };
  links: { html: string; download_location: string };
  user: { name: string };
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const fetch = await webFetch();
  const response = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}`, "Accept-Version": "v1" }, signal });
  if (!response.ok) throw new Error(`Unsplash answered ${response.status}`);
  return response.json();
}

/** Where to tell Unsplash a photo was used, by its id. */
const downloads = new Map<string, string>();

function found(photo: Photo): FoundImage {
  downloads.set(photo.id, photo.links.download_location);
  const link = unsplashPhoto(photo.links.html);
  const alt = photo.alt_description?.trim() || link?.alt || "";
  return {
    id: photo.id,
    thumb: photo.urls.small,
    color: photo.color ?? undefined,
    by: photo.user.name,
    src: link ? photo.links.html : `https://unsplash.com/photos/${photo.id}`,
    alt: alt.charAt(0).toUpperCase() + alt.slice(1),
  };
}

const library: ImageLibrary = {
  name: "Unsplash",
  // Unsplash asks that links back to it say where they're from.
  credit: { text: t("plugins.unsplash.credit"), href: "https://unsplash.com/?utm_source=lines&utm_medium=referral" },
  async search(query, page, signal) {
    const paging = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    // With nothing typed, Unsplash's own picks.
    if (!query) {
      const photos = await get<Photo[]>(`${API}/photos?${paging}`, signal);
      return { images: photos.filter((photo) => !photo.premium).map(found), more: photos.length === PER_PAGE };
    }
    paging.set("query", query);
    paging.set("lang", language);
    const { results, total_pages } = await get<{ results: Photo[]; total_pages: number }>(`${API}/search/photos?${paging}`, signal);
    return { images: results.filter((photo) => !photo.premium).map(found), more: page < total_pages };
  },
  // Unsplash counts a photo's downloads this way, which its terms ask for.
  chosen(image) {
    const url = downloads.get(image.id);
    if (url) get(url).catch((error: unknown) => console.error("lines: couldn't tell Unsplash a photo was used", error));
  },
};

export const unsplash = (): Plugin => ({
  id: "unsplash",
  name: "Unsplash",
  description: t("plugins.unsplash.description"),
  icon: "camera",
  enabledByDefault: true,
  available: !!KEY,
  availability: t("plugins.noKey", { name: "Unsplash" }),
  contributes: {
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.unsplash"),
            after: "image",
            hint: "Unsplash",
            icon: "camera",
            section: SECTIONS.insert,
            apply: pickWebImage(library),
          },
        ],
      },
    ],
  },
});
