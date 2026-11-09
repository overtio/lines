import type { EditorView } from "@codemirror/view";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { ATTACHMENT_PATH, saveAttachment } from "../notes/attachments";
import { smaller } from "../pictures";
import type { FoundImage, ImageLibrary, PictureLibrary } from "../plugins/types";
import { insertWebImage } from "./attachments";
import WebImagePicker from "./WebImagePicker.svelte";
import { openPicker } from "./webSearch";

/*
 * Pictures from a library on the web, found by searching and put in a Markdown note: /unsplash,
 * /giphy and /wallhaven (src/plugins/). The library searches; the picker (WebImagePicker.svelte) is
 * the same for each. A library whose pictures can be had whole (a `PictureLibrary`) has the one
 * chosen kept with the note, no larger than it needs to be; the rest are shown from the library.
 */

/** The longest side a picture kept in a note is: sharp across a wide note on a Retina screen. */
const KEPT = 2400;

const keeps = (library: ImageLibrary): library is PictureLibrary => "picture" in library;

/** Keeps `image` with the note, and puts it in at the cursor once it's here. */
async function keep(view: EditorView, library: PictureLibrary, image: FoundImage) {
  try {
    const name = await saveAttachment(await smaller(await library.picture(image), KEPT));
    insertWebImage(view, ATTACHMENT_PATH + name, image.alt);
  } catch (error) {
    console.error(`lines: couldn't get the picture from ${library.name}`, error);
    speak(t("editor.images.failed", { name: library.name }));
  }
}

/** A "/" command's work: takes the typed command out, and opens a picker of `library`'s pictures at the cursor. */
export const pickWebImage = (library: ImageLibrary) => (view: EditorView, from: number, to: number) =>
  openPicker(view, from, to, WebImagePicker, {
    library,
    onchoose(image: FoundImage) {
      library.chosen?.(image);
      if (keeps(library)) void keep(view, library, image);
      else insertWebImage(view, image.src, image.alt);
    },
  });
