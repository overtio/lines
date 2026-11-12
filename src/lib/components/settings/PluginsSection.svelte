<script lang="ts">
  import { t } from "../../i18n/index.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Plugin } from "../../plugins/types";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import PluginRow from "./PluginRow.svelte";

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
</script>

{#each groups as group (group.label)}
  <FieldGroup title={group.label}>
    {#each group.plugins as plugin (plugin.id)}
      <PluginRow {plugin} page />
    {/each}
  </FieldGroup>
{/each}
