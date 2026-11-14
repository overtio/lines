import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Reads PDFs kept with library notes, in the note's place (lib/books/), with Mozilla's pdf.js: each
 * page drawn in the theme's colors as it comes into view, over its text, which can be chosen and
 * kept as a quote, searched, and read by screen readers. pdf.js loads the first time a PDF is read.
 */
export const pdfReader = (): Plugin => ({
  id: "pdf-reader",
  name: t("plugins.pdfReader"),
  description: t("plugins.pdfReader.description"),
  icon: "file-text",
  enabledByDefault: true,
  requires: ["library"],
  contributes: {
    bookReaders: [
      {
        id: "pdf",
        extensions: ["pdf"],
        types: ["application/pdf"],
        details: async (bytes) => (await import("./read")).pdfDetails(bytes),
        open: async (dom, book) => (await import("./read")).openPdf(dom, book),
      },
    ],
  },
});
