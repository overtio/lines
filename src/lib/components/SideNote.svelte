<script lang="ts">
  import Editor from "../editor/Editor.svelte";
  import { t } from "../i18n/index.svelte";
  import { isClosed, notes } from "../notes/store.svelte";
  import { ui } from "../ui.svelte";
  import LockedNoteView from "./LockedNoteView.svelte";
  import IconButton from "./ui/IconButton.svelte";

  /*
   * A note open beside the selected one (Open to the Side, or ⌥-click in the list), in an editor of
   * its own: to read one while writing the other, or point at one's spreadsheet cells from a formula
   * in the other. Its title sits over it, with buttons to swap the two and to close it.
   */

  let { id }: { id: string } = $props();

  const entry = $derived(notes.get(id));
  const closed = $derived(!!entry && isClosed(entry.note));
  const title = $derived(entry?.meta.title || t("list.untitled"));

  /** This note to the main side, and the one there beside it. */
  function swap() {
    const main = notes.selectedId;
    notes.select(id);
    ui.side = main;
  }
</script>

<section class="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-line bg-surface" aria-label={t("app.side", { title })}>
  <header class="toolbar flex h-(--titlebar-h) shrink-0 items-center gap-1 pt-(--titlebar-pad-top) pr-3 pl-5" data-tauri-drag-region>
    <span class="min-w-0 flex-1 truncate text-sm text-muted" data-tauri-drag-region>{title}</span>
    <IconButton icon="arrow-left-right" iconSize={16} label={t("app.sideSwap")} onclick={swap} />
    <IconButton icon="x" iconSize={17} label={t("app.sideClose")} onclick={() => (ui.side = null)} />
  </header>
  {#if entry}
    <div class="min-h-0 flex-1" hidden={closed}>
      <Editor noteId={id} trashed={entry.note.trashed || closed} />
    </div>
    {#if closed}
      <LockedNoteView {entry} />
    {/if}
  {/if}
</section>
