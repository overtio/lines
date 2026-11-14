import { readAtMost } from "../feeds/fetch";
import { attachmentNameOf, putAttachment } from "../notes/attachments";
import { drawablePicture, smaller } from "../pictures";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { iconCover } from "./icon";
import { firstStatus } from "./shelves.svelte";
import { COVER_WIDTH, libraryNoteText } from "./text";
import { isPublic, request } from "./web";

/** The longest side a cover is kept at: sharp in a note on a Retina screen, and light to sync. */
const COVER_SIDE = 1200;
/** The most a cover may weigh as it's downloaded: it stops being read past that. */
const COVER_BYTES = 20_000_000;

/** A library note to write: its text, and its cover to keep once it's written (the text links to it). */
export interface LibraryNote {
  text: string;
  /** Keeps its cover, now the note's written (covers.ts's keepCover, which takes it out of the note if it can't be). */
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
 * can't be had (on the web, a site that doesn't let pages download it), where it isn't on the web
 * at large (a page can't have lines fetch from this computer's network), where its bytes aren't a
 * picture lines keeps (a drawing, an SVG, is a logo or a diagram, not a cover), or where they say
 * it's too big to draw.
 */
export async function coverAt(url: string, signal?: AbortSignal): Promise<Blob | undefined> {
  if (!isPublic(url) || /\.svg(?:$|[/.])/i.test(new URL(url).pathname)) return undefined;
  try {
    const response = await request(url, signal ?? new AbortController().signal);
    if (!response.ok || Number(response.headers.get("content-length")) > COVER_BYTES) return undefined;
    // What it is by its bytes, whatever it's called: an app's download says no type, a file host says
    // `application/octet-stream`, and a server can say the wrong one. No more of them than a cover can be.
    const bytes = await readAtMost(response.body, COVER_BYTES);
    const picture = drawablePicture(bytes);
    return picture ? await smaller(new Blob([bytes], { type: picture.type }), COVER_SIDE) : undefined;
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
  const cover = await coverOfItem(item, signal);
  return {
    text: libraryNoteText(item, { status: status ?? undefined, cover, mentions: plugins.libraryKind(item.type)?.mentions }),
    keep: async () => {
      if (cover) await putAttachment(cover.name, cover.picture);
    },
  };
}

/** The cover of a note for `item`: its picture, else its site's icon (a feed's that has none); nothing where neither can be had. */
export async function coverOfItem(item: LibraryItem, signal?: AbortSignal): Promise<Cover | undefined> {
  return (item.cover && (await coverFor(item.cover, item.type, signal))) || (item.icon ? await iconCover(item.icon) : undefined);
}

/** The picture at `url` as the cover of a note of `type`, at the width its kind's covers are shown; nothing where it can't be had. */
export async function coverFor(url: string, type: string, signal?: AbortSignal): Promise<Cover | undefined> {
  const picture = await coverAt(url, signal);
  return picture && { picture, name: await attachmentNameOf(picture), width: COVER_WIDTH[plugins.libraryKind(type)?.cover ?? "square"] };
}
