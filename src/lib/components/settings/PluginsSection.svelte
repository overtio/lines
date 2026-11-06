<script lang="ts">
  import Icon from "../../icons/Icon.svelte";
  import { t } from "../../i18n/index.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Plugin } from "../../plugins/types";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import Switch from "../ui/Switch.svelte";

  /** The plugins, grouped by what they add most: formats, then engines that draw, work out formulas and typeset, then looks. */
  const GROUPS: { label: string; has: (plugin: Plugin) => unknown }[] = [
    { label: t("plugins.groupFormats"), has: ({ contributes }) => contributes.languages?.length },
    {
      label: t("plugins.groupEngines"),
      has: ({ contributes }) =>
        contributes.math?.length || contributes.renderers?.length || contributes.formulas?.length || contributes.typesetters?.length,
    },
    { label: t("plugins.groupLook"), has: ({ contributes }) => contributes.themes?.length || contributes.iconSets?.length },
    { label: t("plugins.groupMore"), has: () => true },
  ];

  const groups = GROUPS.map((group, i) => ({
    label: group.label,
    plugins: plugins.all.filter((plugin) => group.has(plugin) && !GROUPS.slice(0, i).some((before) => before.has(plugin))),
  })).filter((group) => group.plugins.length);

  /** The plugins it needs that aren't running, by name. */
  const missing = (plugin: Plugin) =>
    (plugin.requires ?? []).flatMap((id) => plugins.get(id) ?? []).filter((needed) => !plugins.isActive(needed)).map((needed) => needed.name);
</script>

{#each groups as group (group.label)}
  <FieldGroup title={group.label}>
    {#each group.plugins as plugin (plugin.id)}
      {@const needs = plugins.isOn(plugin) ? missing(plugin) : []}
      {@const toggles = !plugin.required && plugin.available !== false}
      {@const active = plugins.isActive(plugin)}
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
        {#if plugin.required}
          <span class="shrink-0 text-xs whitespace-nowrap text-faint">{t("plugins.alwaysOn")}</span>
        {:else if toggles}
          <Switch id="plugin-{plugin.id}" aria-describedby="plugin-{plugin.id}-about" label={plugin.name} checked={plugins.isOn(plugin)} onchange={(on) => plugins.setOn(plugin, on)} />
        {/if}
      </div>
    {/each}
  </FieldGroup>
{/each}
