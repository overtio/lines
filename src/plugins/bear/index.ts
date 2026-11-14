import { t } from "../../lib/i18n/index.svelte";
import { notesWork } from "../../lib/imports/notes";
import { notes } from "../../lib/notes/store.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Moving from Bear (docs/importing.md#bear): its notes, tags, pictures and files, pins and dates,
 * from its backup or what it exported, brought in from Settings → Export and Import. Nothing happens
 * until it's asked to.
 */
export const bear = (): Plugin => ({
  id: "bear",
  name: "Bear",
  description: t("plugins.bear.description"),
  icon: "paw-print",
  enabledByDefault: true,
  contributes: {
    imports: [
      {
        id: "bear",
        into: "notes",
        name: t("import.bear.title"),
        note: t("import.bear.note"),
        panel: () => import("./BearImport.svelte"),
        work: (input) => notesWork(input, notes.entries),
      },
    ],
  },
});
