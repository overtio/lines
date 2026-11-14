import { t } from "../../lib/i18n/index.svelte";
import { notesWork } from "../../lib/imports/notes";
import { notes } from "../../lib/notes/store.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Moving from Obsidian (docs/importing.md#obsidian): a vault's notes, folders, links, pictures and
 * files, brought in from Settings → Export and Import. Nothing happens until it's asked to.
 */
export const obsidian = (): Plugin => ({
  id: "obsidian",
  name: "Obsidian",
  description: t("plugins.obsidian.description"),
  icon: "gem",
  enabledByDefault: true,
  contributes: {
    imports: [
      {
        id: "obsidian",
        into: "notes",
        name: t("import.obsidian.title"),
        note: t("import.obsidian.note"),
        panel: () => import("./ObsidianImport.svelte"),
        work: (input) => notesWork(input, notes.entries),
      },
    ],
  },
});
