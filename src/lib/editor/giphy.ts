import { reducedMotion } from "../platform";

/*
 * GIFs on GIPHY, by their address: media.giphy.com/media/<id>/giphy.gif (as /giphy puts them in a
 * note, and as GIPHY's "Copy GIF link" gives them), i.giphy.com/<id>.gif, and the sizes GIPHY's
 * API hands out. They're images like any other; with reduced motion, a note shows them still.
 */

const ADDRESS = /^https:\/\/(?:media\d?|i)\.giphy\.com\/(?:media\/(?:v1\.[\w.-]+\/)?)?(\w+)(?:\/[\w-]+)?\.(?:gif|webp)(?:\?\S*)?$/i;

/** The GIF's address as a note keeps it. */
export const giphyGif = (id: string) => `https://media.giphy.com/media/${id}/giphy.gif`;

/** The GIF a GIPHY address is for, by its id, or null for anything else. */
export function giphyId(src: string): string | null {
  return ADDRESS.exec(src)?.[1] ?? null;
}

/** Its first frame, to show in place of a GIPHY GIF while the system asks for reduced motion, or null. */
export function giphyStill(src: string): string | null {
  const id = reducedMotion.matches && giphyId(src);
  return id ? `https://media.giphy.com/media/${id}/giphy_s.gif` : null;
}
