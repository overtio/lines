import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import "./reader.css";

/*
 * Reads EPUBs kept with library notes, in the note's place (lib/books/): a reader of lines' own,
 * on the book's XHTML, made safe and shown a chapter at a time in a sandboxed frame (read.ts), in
 * the theme's colors and the notes' font. Places are EPUB CFIs, as other EPUB readers write them.
 */
export const epubReader = (): Plugin => ({
  id: "epub-reader",
  name: t("plugins.epubReader"),
  description: t("plugins.epubReader.description"),
  icon: "book-open",
  enabledByDefault: true,
  requires: ["library"],
  contributes: {
    bookReaders: [
      {
        id: "epub",
        extensions: ["epub"],
        types: ["application/epub+zip"],
        details: async (bytes) => (await import("./read")).epubDetails(bytes),
        open: async (dom, book) => (await import("./read")).openEpub(dom, book),
      },
    ],
  },
});
