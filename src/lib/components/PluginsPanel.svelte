<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { t } from "../i18n/index.svelte";
  import { plugins } from "../plugins/registry.svelte";
  import type { Plugin } from "../plugins/types";

  /** The plugins, grouped by what they add most: formats, then engines that draw and typeset, looks, and pictures. */
  const GROUPS: { label: string; has: (plugin: Plugin) => unknown }[] = [
    { label: t("plugins.groupFormats"), has: ({ contributes }) => contributes.languages?.length },
    {
      label: t("plugins.groupEngines"),
      has: ({ contributes }) => contributes.math?.length || contributes.renderers?.length || contributes.typesetters?.length,
    },
    { label: t("plugins.groupLook"), has: ({ contributes }) => contributes.themes?.length || contributes.iconSets?.length },
    { label: t("plugins.groupPictures"), has: ({ contributes }) => contributes.pictures?.length },
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

<p class="prose">{t("plugins.intro")}</p>

{#each groups as group (group.label)}
  <section>
    <h3>{group.label}</h3>
    <ul class="plugins">
      {#each group.plugins as plugin (plugin.id)}
        {@const needs = plugins.isOn(plugin) ? missing(plugin) : []}
        {@const toggles = !plugin.required && plugin.available !== false}
        <li>
          <svelte:element this={toggles ? "label" : "div"} class="plugin" class:off={!plugins.isActive(plugin)}>
            <span class="plugin-icon"><Icon name={plugin.icon} size={18} /></span>
            <span class="about">
              <span class="name" id="plugin-{plugin.id}">{plugin.name}</span>
              <span class="description" id="plugin-{plugin.id}-about">{plugin.description}</span>
              {#if plugin.available === false && plugin.availability}
                <span class="status">{plugin.availability}</span>
              {:else if needs.length}
                <span class="status">{t("plugins.needs", { names: needs.join(", ") })}</span>
              {/if}
            </span>
            {#if plugin.required}
              <span class="always">{t("plugins.alwaysOn")}</span>
            {:else if toggles}
              <input
                type="checkbox"
                aria-labelledby="plugin-{plugin.id}"
                aria-describedby="plugin-{plugin.id}-about"
                checked={plugins.isOn(plugin)}
                onchange={(event) => plugins.setOn(plugin, event.currentTarget.checked)}
              />
            {/if}
          </svelte:element>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .plugins {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    border-top: 1px solid var(--border);
  }

  .plugin {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    align-items: start;
    gap: 12px;
    padding: 11px 0;
  }

  label.plugin {
    cursor: pointer;
  }

  .plugin-icon {
    display: flex;
    /* On the name's first line. */
    padding-top: 1px;
    color: var(--text-muted);
  }

  .about {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .name {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text);
  }

  .description {
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .status,
  .always {
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-faint);
  }

  .always {
    padding-top: 1px;
    white-space: nowrap;
  }

  input {
    margin: 2px 0 0;
    accent-color: var(--accent);
  }

  /* Off, or waiting for a plugin it needs: its icon and name step back. */
  .off .plugin-icon,
  .off .name {
    color: var(--text-faint);
  }

  @media (pointer: coarse) {
    .plugin {
      min-height: 44px;
    }
  }
</style>
