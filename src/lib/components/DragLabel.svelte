<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { t } from "../i18n/index.svelte";
  import { iconColor, iconOf } from "../notes/looks.svelte";
  import { notes } from "../notes/store.svelte";
  import { paletteVar } from "../palette";
  import { panes } from "../panes.svelte";

  /*
   * While lines follows a drag itself (panes.svelte.ts): a small card of the note dragged, its title
   * and first line, beside the pointer (a browser's own drag shows its picture of the row instead),
   * over a cover of the whole window, so what's under the pointer on the way doesn't take it: no text
   * or resize pointers, no edge or row lit up as it's passed over (panes.svelte.ts looks under it).
   */

  const entry = $derived(panes.drag && panes.pointer ? notes.get(panes.drag.id) : undefined);
  const icon = $derived(entry && iconOf(entry));
</script>

{#if entry && panes.pointer}
  <div class="fixed inset-0 z-50 cursor-default" data-drag-cover aria-hidden="true">
    <div
      class="pointer-events-none absolute top-0 left-0 flex w-56 flex-col gap-0.5 rounded-lg border border-line bg-panel px-3 py-2 shadow-menu"
      style:translate="{panes.pointer.x + 12}px {panes.pointer.y + 12}px"
      style:--look={icon && paletteVar(iconColor(entry) ?? "accent")}
    >
      <span class={["flex min-w-0 items-center gap-1.5 text-sm font-semibold", entry.meta.title ? "text-fg" : "text-faint"]}>
        {#if icon}<Icon name={icon} size={14} strokeWidth={2} class="flex-none text-(--look)" />{/if}
        <span class="truncate">{entry.meta.title || t("list.untitled")}</span>
      </span>
      {#if entry.meta.excerpt}<span class="line-clamp-2 text-xs leading-[1.45] text-muted">{entry.meta.excerpt}</span>{/if}
    </div>
  </div>
{/if}
