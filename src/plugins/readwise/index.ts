import { t } from "../../lib/i18n/index.svelte";
import { notes } from "../../lib/notes/store.svelte";
import type { Plugin } from "../../lib/plugins/types";
import type { fetchAll } from "./api";
import { plan } from "./plan";
import { sourcesOf } from "./sources";

/*
 * Moving from Readwise (docs/library.md#from-readwise): what Readwise and Reader keep (books,
 * articles, podcasts' episodes, tweets, with the highlights made in them, and what was saved in
 * Reader and where it's got to) brought into the Library, from its group of Settings → Library,
 * with an access token used for that and not kept. Nothing happens until it's asked to.
 */
export const readwise = (): Plugin => ({
  id: "readwise",
  name: "Readwise",
  description: t("plugins.readwise.description"),
  icon: "highlighter",
  enabledByDefault: true,
  requires: ["library"],
  contributes: {
    imports: [
      {
        id: "readwise",
        into: "library",
        name: "Readwise",
        note: t("readwise.note"),
        panel: () => import("./ReadwiseImport.svelte"),
        work: (input) => {
          const { books, documents } = input as Awaited<ReturnType<typeof fetchAll>>;
          return plan(sourcesOf(books, documents), notes.entries).work;
        },
      },
    ],
  },
});
