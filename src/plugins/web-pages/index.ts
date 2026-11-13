import { t } from "../../lib/i18n/index.svelte";
import type { Page } from "../../lib/library/page";
import { known } from "../../lib/library/text";
import { getJson, getPage } from "../../lib/library/web";
import { isTauri } from "../../lib/platform";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";
import { itemOfPage } from "./read";

/*
 * Web pages, as they describe themselves (read.ts): most sites say what a page is, for search
 * engines and for links shared elsewhere, which covers IMDb's kin, Letterboxd, Goodreads, Spotify,
 * Bandcamp, Substack and most blogs and news. Asked after the sources for particular sites. Pages
 * don't let other pages read them (CORS), so it's the apps', which read them as lines.
 */

/** What a video's oEmbed says of it, for a page that says nothing more of itself but where to ask. */
interface OEmbed {
  type?: string;
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

async function fromOEmbed(page: Page, signal: AbortSignal): Promise<LibraryItem | null> {
  const href = page.links.find((link) => link.type === "application/json+oembed")?.href;
  const embed = href ? await getJson<OEmbed>(href, signal) : null;
  if (embed?.type !== "video" || !embed.title) return null;
  return { type: "video", title: embed.title, link: page.url, properties: known([["channel", embed.author_name]]), cover: embed.thumbnail_url };
}

const source: LibrarySource = {
  id: "web-pages",
  name: t("plugins.webPages.name"),
  general: true,
  recognizes: (url) => url.protocol === "https:" || url.protocol === "http:",
  async lookup(url, signal) {
    const page = await getPage(url.href, signal);
    if (!page) return null;
    return itemOfPage(page) ?? (await fromOEmbed(page, signal));
  },
};

export const webPages = (): Plugin => ({
  id: "web-pages",
  name: t("plugins.webPages.name"),
  description: t("plugins.webPages.description"),
  icon: "link",
  enabledByDefault: true,
  requires: ["library"],
  available: isTauri,
  availability: t("plugins.webPages.apps"),
  contributes: { librarySources: [source] },
});
