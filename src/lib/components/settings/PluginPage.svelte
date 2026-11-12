<script lang="ts">
  // A plugin's own page of settings (Settings → Plugins → its name): the plugin with its switch, then
  // its settings while it's running.
  import type { Component } from "svelte";
  import { t } from "../../i18n/index.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Plugin } from "../../plugins/types";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import PluginRow from "./PluginRow.svelte";

  /** `page`: its settings, once loaded. */
  let { plugin, page }: { plugin: Plugin; page: Component | undefined } = $props();
  const active = $derived(plugins.isActive(plugin));
</script>

<FieldGroup>
  <PluginRow {plugin} />
</FieldGroup>

{#if active}
  {#if page}
    {@const Page = page}
    <Page />
  {/if}
{:else}
  <p class="m-0 px-1 text-sm text-muted">{t("plugins.offSettings", { name: plugin.name })}</p>
{/if}
