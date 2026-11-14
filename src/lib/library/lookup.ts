import { dayOf } from "../notes/calendar";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { absolute, type Page } from "./page";
import { known } from "./text";
import { getPage } from "./web";

/**
 * What `link` is, asked of the sources in turn (the registry's order: each site's, then those that
 * read any page): the first to recognize it and find something the library keeps. Null when none
 * can say, so nothing is guessed; rejects when none found it and one couldn't be asked (offline).
 */
export async function lookUp(link: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const url = new URL(link);
  let failure: unknown = null;
  for (const source of plugins.librarySources) {
    if (!source.recognizes(url)) continue;
    try {
      const item = await source.lookup(url, signal);
      if (item?.title.trim() && plugins.libraryKind(item.type)) return item;
    } catch (error) {
      signal.throwIfAborted();
      console.warn(`lines: ${source.name} couldn't look up ${url.hostname}`, error);
      failure ??= error;
    }
  }
  if (failure) throw failure;
  return null;
}

/**
 * A page nothing can say more of (a product's home page, say), as a resource: its title, its site,
 * the day it's added, its picture where it names one, and what it says of itself.
 */
export function pageResource(page: Page): LibraryItem {
  const host = new URL(page.url).hostname.replace(/^www\./, "");
  const said = (...keys: string[]) => keys.map((key) => page.meta.get(key)?.trim()).find(Boolean);
  const picture = said("og:image", "twitter:image");
  return {
    type: "resource",
    title: said("og:title", "twitter:title") || page.title.trim() || host,
    link: page.url,
    properties: known([
      ["site", said("og:site_name") ?? host],
      ["added", dayOf(Date.now())],
    ]),
    cover: (picture && absolute(picture, page.url)) || undefined,
    description: said("og:description", "twitter:description", "description"),
  };
}

/**
 * What `link` is, as `lookUp` says; or else, as it's being added on purpose (Add to Library, a
 * link's menu), the page itself, as a resource, kept rather than left out because nothing could
 * say more of it. Null when it isn't a page (not there, or not one); rejects when it couldn't be
 * asked (offline; on the web, a site that doesn't let pages read it).
 */
export async function lookUpAny(link: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const item = await lookUp(link, signal);
  if (item) return item;
  const page = await getPage(link, signal);
  return page && pageResource(page);
}
