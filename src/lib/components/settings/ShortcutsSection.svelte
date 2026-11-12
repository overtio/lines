<script lang="ts">
  import { t } from "../../i18n/index.svelte";
  import { applies, formatKeys, SHORTCUTS, speakKeys, system, type System } from "../../shortcuts";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";

  /** Whose keys to show: this device's at first, the other system's on request (for someone switching). */
  let showing = $state<System>(system);

  const systems: { id: System; label: string }[] = [
    { id: "mac", label: t("shortcuts.mac") },
    { id: "other", label: t("shortcuts.other") },
  ];

  /** Only what works here: the web has no floating notes, and makes a new note with ⌥N rather than ⌘N. */
  const groups = SHORTCUTS.map((group) => ({ ...group, shortcuts: group.shortcuts.filter(applies) }));
</script>

<FieldGroup>
  <FieldRow label={t("shortcuts.system")} note={t("shortcuts.intro")}>
    <Segmented label={t("shortcuts.system")} options={systems} value={showing} onselect={(id) => (showing = id)} />
  </FieldRow>
</FieldGroup>

{#each groups as group (group.name)}
  <FieldGroup title={t(group.name)} id="shortcuts-{group.name}">
    <!-- Each row's action is its header, so a screen reader says it with the keys. A narrow card's keys go onto more lines. -->
    <div class="@container">
      <table class="w-full border-collapse text-sm" aria-labelledby="shortcuts-{group.name}">
        <tbody>
          {#each group.shortcuts as shortcut (shortcut.action + shortcut.keys.join())}
            <tr class="border-b border-line last:border-0">
              <th scope="row" class="py-2 pl-4 text-left align-baseline font-normal text-fg @max-[30rem]:w-1/2">
                {t(shortcut.action)}
                {#if shortcut.note}<span class="mt-px block text-xs text-muted">{t(shortcut.note)}</span>{/if}
              </th>
              <td class="py-2 pr-4 pl-4 text-right align-baseline whitespace-nowrap @max-[30rem]:whitespace-normal">
                {#each shortcut.keys as keys, i (i)}
                  <!-- Each key with the "or" before it, so lines break between them. -->
                  <span class="inline-block whitespace-nowrap">
                    {#if i > 0}<span class="mx-1.5 text-xs text-muted">{t("shortcuts.or")}</span>{/if}
                    <!-- Symbols for the eye, words for screen readers (which may not say "⌘⇧"). -->
                    <kbd
                      aria-hidden="true"
                      class="inline-block min-w-[1.6em] rounded-sm border border-b-2 border-line bg-panel px-1.5 py-0.5 text-center font-ui text-xs text-fg"
                      >{formatKeys(keys, showing)}</kbd
                    ><span class="sr-only">{speakKeys(keys, showing)}</span>
                  </span>
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </FieldGroup>
{/each}
