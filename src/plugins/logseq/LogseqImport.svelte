<script lang="ts">
  // Logseq's group of Settings → Export and Import: a graph's folder, chosen and read (graph.ts).
  import NotesImport from "../../lib/components/settings/NotesImport.svelte";
  import { t } from "../../lib/i18n/index.svelte";
  import type { ImportFile } from "../../lib/plugins/types";
  import { readGraph } from "./graph";

  // A graph is a folder, chosen here: `files` is never given.
  let { onclose }: { files?: ImportFile[]; onclose?: () => void } = $props();
</script>

<NotesImport id="logseq" choices={[{ label: t("import.logseq.choose"), folder: true }]} read={readGraph} {onclose} />
