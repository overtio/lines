<script lang="ts">
  // Notion's group of Settings → Export and Import: its export's ZIP, or the folder it unpacks to, chosen and read (export.ts).
  import NotesImport from "../../lib/components/settings/NotesImport.svelte";
  import { t } from "../../lib/i18n/index.svelte";
  import type { ImportFile } from "../../lib/plugins/types";
  import { readNotion } from "./export";

  // Notion's export is chosen here: `files` is never given.
  let { onclose }: { files?: ImportFile[]; onclose?: () => void } = $props();
</script>

<NotesImport
  id="notion"
  choices={[
    { label: t("import.notion.chooseZip"), accept: ".zip" },
    { label: t("import.notion.chooseFolder"), folder: true },
  ]}
  read={readNotion}
  {onclose}
/>
