<script lang="ts">
  // An import's group of Settings (a plugin's, lib/plugins/types.ts `Import`): its heading, and its
  // rows, loaded the first time they're shown.
  import { t } from "../../i18n/index.svelte";
  import type { Import } from "../../plugins/types";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import CardBlock from "./CardBlock.svelte";

  let { source }: { source: Import } = $props();

  const panel = $derived(
    source.panel().catch((error) => {
      console.error(`lines: couldn't load the ${source.id} import`, error);
      throw error;
    }),
  );
</script>

{#await panel then { default: Panel }}
  <FieldGroup title={source.name} note={source.note}>
    <Panel />
  </FieldGroup>
{:catch}
  <FieldGroup title={source.name} note={source.note}>
    <CardBlock>
      <Callout tone="danger" class="w-full">{t("import.unavailable")}</Callout>
    </CardBlock>
  </FieldGroup>
{/await}
