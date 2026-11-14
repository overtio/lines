<script lang="ts">
  // Obsidian's group of Settings → Export and Import: a vault's folder, chosen and read (vault.ts).
  import NotesImport from "../../lib/components/settings/NotesImport.svelte";
  import { t } from "../../lib/i18n/index.svelte";
  import type { ImportFile } from "../../lib/plugins/types";
  import { readVault } from "./vault";

  // A vault is a folder, chosen here: `files` is never given.
  let { onclose }: { files?: ImportFile[]; onclose?: () => void } = $props();
</script>

<NotesImport id="obsidian" choose={t("import.obsidian.choose")} folder read={readVault} {onclose} />
