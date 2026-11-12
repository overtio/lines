<script lang="ts">
  // A plugin, as Settings → Plugins lists it and at the top of its own page: its icon, name and what
  // it does, what it's waiting for, and its switch; in the list, a way to its page if it has one.
  import Icon from "../../icons/Icon.svelte";
  import { t } from "../../i18n/index.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Plugin } from "../../plugins/types";
  import { ui } from "../../ui.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Switch from "../ui/Switch.svelte";
  import { pluginSection } from "./sections";

  /** `page`: a button to the plugin's own page of settings, where it has one. */
  let { plugin, page = false }: { plugin: Plugin; page?: boolean } = $props();

  /** The plugins it needs that aren't running, by name. */
  const missing = (plugin: Plugin) =>
    (plugin.requires ?? []).flatMap((id) => plugins.get(id) ?? []).filter((needed) => !plugins.isActive(needed)).map((needed) => needed.name);

  const needs = $derived(plugins.isOn(plugin) ? missing(plugin) : []);
  const toggles = $derived(!plugin.required && plugin.available !== false);
  const active = $derived(plugins.isActive(plugin));
</script>

<!-- Off, or waiting for a plugin it needs, its icon and name step back. -->
<div class="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
  <!-- On the name's first line. -->
  <Icon name={plugin.icon} size={18} class="mt-px shrink-0 self-start {active ? 'text-muted' : 'text-faint'}" />
  <div class="min-w-0 flex-1">
    <svelte:element this={toggles ? "label" : "div"} for={toggles ? `plugin-${plugin.id}` : undefined} class={["text-sm font-medium", active ? "text-fg" : "text-faint"]}>
      {plugin.name}
    </svelte:element>
    <p id="plugin-{plugin.id}-about" class="m-0 mt-0.5 text-xs leading-normal text-muted">{plugin.description}</p>
    {#if plugin.available === false && plugin.availability}
      <p class="m-0 mt-0.5 text-xs leading-normal text-faint">{plugin.availability}</p>
    {:else if needs.length}
      <p class="m-0 mt-0.5 text-xs leading-normal text-faint">{t("plugins.needs", { names: needs.join(", ") })}</p>
    {/if}
  </div>
  {#if page && plugin.settings && plugin.available !== false}
    <IconButton icon="settings" iconSize={16} label={t("plugins.openSettings", { name: plugin.name })} onclick={() => (ui.settings = pluginSection(plugin))} />
  {/if}
  {#if plugin.required}
    <span class="shrink-0 text-xs whitespace-nowrap text-faint">{t("plugins.alwaysOn")}</span>
  {:else if toggles}
    <Switch id="plugin-{plugin.id}" aria-describedby="plugin-{plugin.id}-about" label={plugin.name} checked={plugins.isOn(plugin)} onchange={(on) => plugins.setOn(plugin, on)} />
  {/if}
</div>
