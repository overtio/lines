import type { EditorView } from "@codemirror/view";
import type { SearchPage } from "../plugins/types";
import { insertWebImage } from "./attachments";
import WebImagePicker from "./WebImagePicker.svelte";
import { openPicker } from "./webSearch";

/*
 * Pictures from a library on the web, found by searching and put in a Markdown note: /unsplash and
 * /giphy (src/plugins/). The library searches; the picker (WebImagePicker.svelte) is the same for each.
 */

/** A picture a library found. */
export interface FoundImage {
  id: string;
  /** A small version, for the picker. */
  thumb: string;
  /** Its color while the thumbnail loads, if the library says. */
  color?: string;
  /** Who made it, shown over it in the picker. */
  by?: string;
  /** Its address and description in the note: `![alt](src)`. */
  src: string;
  alt: string;
}

export interface ImageLibrary {
  /** As it's known: "Unsplash". */
  name: string;
  /** The credit under the picker, linking to the library ("Powered by GIPHY"). */
  credit: { text: string; href: string };
  /**
   * One page (1 for the first) of what `query` finds, or with no query what's featured, and
   * whether there are more pages.
   */
  search(query: string, page: number, signal: AbortSignal): Promise<SearchPage<FoundImage>>;
  /** Told which picture went in the note, for libraries that count them (Unsplash). */
  chosen?(image: FoundImage): void;
}

/** A "/" command's work: takes the typed command out, and opens a picker of `library`'s pictures at the cursor. */
export const pickWebImage = (library: ImageLibrary) => (view: EditorView, from: number, to: number) =>
  openPicker(view, from, to, WebImagePicker, {
    library,
    onchoose(image: FoundImage) {
      library.chosen?.(image);
      insertWebImage(view, image.src, image.alt);
    },
  });
