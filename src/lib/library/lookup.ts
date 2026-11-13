import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";

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
