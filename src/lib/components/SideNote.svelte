<script lang="ts">
  import Editor from "../editor/Editor.svelte";
  import { t } from "../i18n/index.svelte";
  import { isClosed, notes } from "../notes/store.svelte";
  import { panes } from "../panes.svelte";
  import { followPointer } from "./followPointer";
  import LockedNoteView from "./LockedNoteView.svelte";
  import IconButton from "./ui/IconButton.svelte";

  /*
   * A note open in a pane of its own beside the selected one (Open to the Side or Below, ⌥-click or
   * ⌥⇧-click in the list; Panes.svelte), in an editor of its own: to read one while writing another,
   * or point at one's spreadsheet cells from a formula in another. Its title sits over it, with
   * buttons to swap it with the open note and to close it. With the Calendar's week open instead of
   * a note, the first opens it in the week's place (Back to Calendar, there, goes back). At the
   * window's top (`top`) its header is the title bar, the window dragged by it.
   */

  let { id, top = true }: { id: string; top?: boolean } = $props();

  const entry = $derived(notes.get(id));
  const closed = $derived(!!entry && isClosed(entry.note));
  const title = $derived(entry?.meta.title || t("list.untitled"));

  /** A note is open, not the Calendar's week. */
  const besideNote = $derived(!!notes.selectedId);

  /** Dragging the pane by its grip, to beside another or into its place (panes.svelte.ts); Esc stops. */
  function ongrip(event: PointerEvent) {
    if (event.button !== 0 || event.pointerType === "touch") return;
    // Text isn't selected along the way.
    event.preventDefault();
    followPointer(event, {
      move: (moved, first) => {
        if (first) panes.startDrag("pane", id);
        panes.follow(moved.clientX, moved.clientY);
      },
      drop: () => panes.drop(),
      cancel: () => panes.endDrag(),
    });
  }
</script>

<section class="flex h-full min-h-0 w-full min-w-0 flex-col bg-surface" aria-label={t("app.side", { title })}>
  <header
    class={["toolbar flex shrink-0 items-center gap-1 pr-3 pl-5", top ? "h-(--titlebar-h) pt-(--titlebar-pad-top)" : "h-11"]}
    data-tauri-drag-region={top || undefined}
  >
    <!-- Dragged, it moves the pane beside another, or into its place. -->
    <IconButton icon="grip-vertical" iconSize={15} label={t("app.paneMove")} class="-ml-3 cursor-grab text-faint" onpointerdown={ongrip} />
    <span class="min-w-0 flex-1 truncate text-sm text-muted" data-tauri-drag-region={top || undefined}>{title}</span>
    <IconButton
      icon={besideNote ? "arrow-left-right" : "arrow-left"}
      iconSize={16}
      label={besideNote ? t("app.sideSwap") : t("app.sideInCalendar")}
      onclick={() => panes.toMain(id)}
    />
    <IconButton icon="x" iconSize={17} label={t("app.sideClose")} onclick={() => panes.close(id)} />
  </header>
  {#if entry}
    <div class="min-h-0 flex-1" hidden={closed}>
      <Editor noteId={id} trashed={entry.note.trashed || closed} pane={id} />
    </div>
    {#if closed}
      <LockedNoteView {entry} />
    {/if}
  {/if}
</section>
