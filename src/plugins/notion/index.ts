import { t } from "../../lib/i18n/index.svelte";
import { notesWork } from "../../lib/imports/notes";
import { notes } from "../../lib/notes/store.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Moving from Notion (docs/importing.md#notion): its "Markdown & CSV" export's pages, databases
 * (rows as notes of a type, the database as a table of them), pictures and files, brought in from
 * Settings → Export and Import. Nothing happens until it's asked to.
 */
export const notion = (): Plugin => ({
  id: "notion",
  name: "Notion",
  description: t("plugins.notion.description"),
  icon: "table",
  enabledByDefault: true,
  contributes: {
    imports: [
      {
        id: "notion",
        into: "notes",
        name: t("import.notion.title"),
        note: t("import.notion.note"),
        panel: () => import("./NotionImport.svelte"),
        work: (input) => notesWork(input, notes.entries),
      },
    ],
  },
});
