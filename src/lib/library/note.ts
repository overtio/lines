import { saveAttachment } from "../notes/attachments";
import { smaller } from "../pictures";
import { webFetch } from "../platform";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { libraryNoteText } from "./text";

/** The longest side a cover is kept at: sharp in a note on a Retina screen, and light to sync. */
const COVER_SIDE = 1200;
/** The most a cover may weigh as it's downloaded: anything heavier isn't one. */
const COVER_BYTES = 20_000_000;

/**
 * Keeps the picture at `url` as an attachment, so the note shows it offline and it syncs; its name,
 * or nothing where it can't be had (on the web, a site that doesn't let pages download it).
 */
async function keepCover(url: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const fetch = await webFetch();
    const response = await fetch(url, { signal });
    if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) return undefined;
    if (Number(response.headers.get("content-length")) > COVER_BYTES) return undefined;
    return await saveAttachment(await smaller(await response.blob(), COVER_SIDE));
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn("lines: couldn't keep a cover", error);
    return undefined;
  }
}

/**
 * A library note's text for what a source found, the same however it's added (a link, Add to
 * Library, a saved post): its cover kept with it, and starting where its kind starts (`to read`).
 */
export async function libraryNote(item: LibraryItem, signal?: AbortSignal): Promise<string> {
  const cover = item.cover ? await keepCover(item.cover, signal) : undefined;
  return libraryNoteText(item, { status: plugins.libraryKind(item.type)?.statuses?.[0]?.value, cover });
}
