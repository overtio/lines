<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { applies, formatKeys, SHORTCUTS, speakKeys, system, type System } from "../shortcuts";
  import Segmented from "./Segmented.svelte";

  /** Whose keys to show: this device's at first, the other system's on request (for someone switching). */
  let showing = $state<System>(system);

  const systems: { id: System; label: string }[] = [
    { id: "mac", label: t("shortcuts.mac") },
    { id: "other", label: t("shortcuts.other") },
  ];

  /** Only what works here: the web has no floating notes, and makes a new note with ⌥N rather than ⌘N. */
  const groups = SHORTCUTS.map((group) => ({ ...group, shortcuts: group.shortcuts.filter(applies) }));
</script>

<section>
  <h3>{t("shortcuts.system")}</h3>
  <Segmented label={t("shortcuts.system")} options={systems} value={showing} onselect={(id) => (showing = id)} />
  <p class="note">{t("shortcuts.intro")}</p>
</section>

{#each groups as group (group.name)}
  <section>
    <h3 id="shortcuts-{group.name}">{t(group.name)}</h3>
    <!-- Each row's action is its header, so a screen reader says it with the keys. -->
    <table aria-labelledby="shortcuts-{group.name}">
      <tbody>
        {#each group.shortcuts as shortcut (shortcut.action + shortcut.keys.join())}
          <tr>
            <th scope="row">
              {t(shortcut.action)}
              {#if shortcut.note}<span class="when">{t(shortcut.note)}</span>{/if}
            </th>
            <td>
              {#each shortcut.keys as keys, i (i)}
                {#if i > 0}<span class="or">{t("shortcuts.or")}</span>{/if}
                <!-- Symbols for the eye, words for screen readers (which may not say "⌘⇧"). -->
                <kbd aria-hidden="true">{formatKeys(keys, showing)}</kbd><span class="visually-hidden">{speakKeys(keys, showing)}</span>
              {/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/each}

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }

  tr + tr {
    border-top: 1px solid var(--border);
  }

  th,
  td {
    padding: 7px 0;
    vertical-align: baseline;
  }

  th {
    font-weight: 400;
    text-align: left;
    color: var(--text);
  }

  .when {
    display: block;
    margin-top: 1px;
    font-size: 12px;
    color: var(--text-muted);
  }

  td {
    padding-left: 16px;
    text-align: right;
    white-space: nowrap;
  }

  kbd {
    display: inline-block;
    min-width: 1.6em;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--bg-elevated);
    font-family: var(--font-ui);
    font-size: 12.5px;
    text-align: center;
    color: var(--text);
  }

  .or {
    margin: 0 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
