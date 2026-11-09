<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { notes } from "../notes/store.svelte";
  import Callout from "./ui/Callout.svelte";

  /** Over the note while notes can't be saved here; it goes once a save works again. */
  let { class: className }: { class?: string } = $props();
</script>

{#if notes.saveError !== null}
  <Callout tone="danger" class={["shrink-0", className]}>{t("app.saveError", { error: notes.saveError })}</Callout>
{/if}
