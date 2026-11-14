import { readAtMost } from "../feeds/fetch";
import { markdownLink } from "../feeds/markdown";
import { attachmentNameOf, putAttachment } from "../notes/attachments";
import { mentionOf, propertyOf } from "../notes/properties";
import type { Entry } from "../notes/store.svelte";
import { drawable, smaller } from "../pictures";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { iconCover } from "./icon";
import { firstStatus } from "./shelves.svelte";
import { libraryNoteText } from "./text";
import { isPublic, request } from "./web";

/** The longest side a cover is kept at: sharp in a note on a Retina screen, and light to sync. */
const COVER_SIDE = 1200;
/** The most a cover may weigh as it's downloaded: it stops being read past that. */
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
 * web at large (a page can't have lines fetch from this computer's network), or says it's too big to
 * draw.
 */
async function coverAt(url: string, signal?: AbortSignal): Promise<Blob | undefined> {
  if (!isPublic(url)) return undefined;
  try {
    const response = await request(url, signal ?? new AbortController().signal);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return undefined;
    if (Number(response.headers.get("content-length")) > COVER_BYTES) return undefined;
    const bytes = await readAtMost(response.body, COVER_BYTES);
    return drawable(bytes) ? await smaller(new Blob([bytes as BlobPart], { type }), COVER_SIDE) : undefined;
  } catch (error) {
    signal?.throwIfAborted();
    console.warn("lines: couldn't get a cover", error);
    return undefined;
  }
}

/**
 * A library note for what a source found, written the same way however it's added (a link, Add to
 * Library, a saved post): starting where its kind starts (`to read`), its cover downloaded but kept
 * only with `keep()`, once the note is written, so nothing's left over when it isn't, and what it
 * names that the library has (`notes`, the notes there are) mentioned. Something brought from
 * another app can say where it's got to instead (`status`, or null for nowhere).
 */
export async function libraryNote(item: LibraryItem, notes: readonly Entry[], signal?: AbortSignal, { status = firstStatus(item.type) }: { status?: string | null } = {}): Promise<LibraryNote> {
  const cover = await coverOfItem(item, signal);
  return {
    text: libraryNoteText(item, { status: status ?? undefined, cover, written: namedValues(item, notes) }),
    keep: async () => {
      if (cover) await putAttachment(cover.name, cover.picture);
    },
  };
}

/**
 * How `item`'s properties naming something with a note of its own are written (its kind's
 * `mentions`: an episode's podcast, a video's channel): a mention of that note while the Library has
 * it (among `notes`), found by its page (`LibraryItem.linked`) or else by its title; else a link to
 * its page, or just its name. Never a mention of a note that isn't there.
 */
export function namedValues(item: LibraryItem, notes: readonly Entry[]): Record<string, string> {
  const library = notes.filter(({ note, meta }) => !note.trashed && plugins.libraryKind(meta.type));
  return Object.fromEntries(
    (plugins.libraryKind(item.type)?.mentions ?? []).flatMap((key) => {
      const name = item.properties.find(([each]) => each === key)?.[1].trim();
      if (!name) return [];
      const page = item.linked?.[key];
      const named = library.find(({ meta }) => (page ? propertyOf(meta.properties, "link")?.value.trim() === page : meta.title === name));
      return named ? [[key, mentionOf(named.meta.title)]] : page ? [[key, markdownLink(name, page)]] : [];
    }),
  );
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
