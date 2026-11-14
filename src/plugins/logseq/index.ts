import { t } from "../../lib/i18n/index.svelte";
import { notesWork } from "../../lib/imports/notes";
import { notes } from "../../lib/notes/store.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Moving from Logseq (docs/importing.md#logseq): a graph's pages and journals, with their outlines,
 * properties, tasks, references and assets, brought in from Settings → Export and Import. Nothing
 * happens until it's asked to.
 */
export const logseq = (): Plugin => ({
  id: "logseq",
  name: "Logseq",
  description: t("plugins.logseq.description"),
  icon: "list",
  enabledByDefault: true,
  contributes: {
    imports: [
      {
        id: "logseq",
        into: "notes",
        name: t("import.logseq.title"),
        note: t("import.logseq.note"),
        panel: () => import("./LogseqImport.svelte"),
        work: (input) => notesWork(input, notes.entries),
      },
    ],
  },
});
