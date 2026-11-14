import { attachmentNameOf, putAttachment } from "../notes/attachments";
import { smaller } from "../pictures";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { firstStatus } from "./shelves.svelte";
import { libraryNoteText } from "./text";
import { isPublic, request } from "./web";

/** The longest side a cover is kept at: sharp in a note on a Retina screen, and light to sync. */
const COVER_SIDE = 1200;
/** The most a cover may weigh as it's downloaded: anything heavier isn't one. */
const COVER_BYTES = 20_000_000;
/** How wide a note shows its cover, by its kind's shape: enough to know it by, leaving room for the rest. */
export const COVER_WIDTH = { tall: 240, square: 240, wide: 400 };

/** A library note to write: its text, and its cover to keep once it's written (the text links to it). */
export interface LibraryNote {
  text: string;
  keep(): Promise<void>;
}

/** A cover to keep with a note: the picture, the attachment's name it's kept under, and how wide the note shows it. */
export interface Cover {
  picture: Blob;
  name: string;
  width: number;
}

/**
 * The picture at `url`, ready to keep with a note (no larger than it needs to be); nothing where it
 * can't be had (on the web, a site that doesn't let pages download it), or where it isn't on the
 * web at large (a page can't have lines fetch from this computer's network).
 */
async function coverAt(url: string, signal?: AbortSignal): Promise<Blob | undefined> {
  if (!isPublic(url)) return undefined;
  try {
    const response = await request(url, signal ?? new AbortController().signal);
    if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) return undefined;
    if (Number(response.headers.get("content-length")) > COVER_BYTES) return undefined;
    return await smaller(await response.blob(), COVER_SIDE);
  } catch (error) {
    signal?.throwIfAborted();
    console.warn("lines: couldn't get a cover", error);
    return undefined;
  }
}

/**
 * A library note for what a source found, written the same way however it's added (a link, Add to
 * Library, a saved post): starting where its kind starts (`to read`), its cover downloaded but kept
 * only with `keep()`, once the note is written, so nothing's left over when it isn't. Something
 * brought from another app can say where it's got to instead (`status`, or null for nowhere).
 */
export async function libraryNote(item: LibraryItem, signal?: AbortSignal, { status = firstStatus(item.type) }: { status?: string | null } = {}): Promise<LibraryNote> {
  const cover = item.cover ? await coverFor(item.cover, item.type, signal) : undefined;
  return {
    text: libraryNoteText(item, { status: status ?? undefined, cover, mentions: plugins.libraryKind(item.type)?.mentions }),
    keep: async () => {
      if (cover) await putAttachment(cover.name, cover.picture);
    },
  };
}

/** The picture at `url` as the cover of a note of `type`, at the width its kind's covers are shown; nothing where it can't be had. */
export async function coverFor(url: string, type: string, signal?: AbortSignal): Promise<Cover | undefined> {
  const picture = await coverAt(url, signal);
  return picture && { picture, name: await attachmentNameOf(picture), width: COVER_WIDTH[plugins.libraryKind(type)?.cover ?? "square"] };
}
