<script lang="ts">
  // Bear's group of Settings → Export and Import: its backup, or a folder it exported to, chosen and read (backup.ts).
  import NotesImport from "../../lib/components/settings/NotesImport.svelte";
  import { t } from "../../lib/i18n/index.svelte";
  import type { ImportFile } from "../../lib/plugins/types";
  import { readBear } from "./backup";

  // Bear's files are chosen here: `files` is never given.
  let { onclose }: { files?: ImportFile[]; onclose?: () => void } = $props();
</script>

<NotesImport
  id="bear"
  choices={[
    { label: t("import.bear.chooseBackup"), accept: ".bear2bk,.textpack,.zip" },
    { label: t("import.bear.chooseFolder"), folder: true },
  ]}
  read={readBear}
  {onclose}
/>
