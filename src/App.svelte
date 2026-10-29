<script lang="ts">
  import Icon from "./lib/icons/Icon.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
  import NoteList from "./lib/components/NoteList.svelte";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import NoteInfo from "./lib/components/NoteInfo.svelte";
  import Settings from "./lib/components/Settings.svelte";
  import IconPicker from "./lib/components/IconPicker.svelte";
  import LockedNoteView from "./lib/components/LockedNoteView.svelte";
  import NotesPasswordDialog from "./lib/components/NotesPasswordDialog.svelte";
  import Editor from "./lib/editor/Editor.svelte";
  import { lock } from "./lib/lock/lock.svelte";
  import { lockedNotes } from "./lib/notes/locked.svelte";
  import { isClosed, notes } from "./lib/notes/store.svelte";
  import { plainText } from "./lib/notes/stats";
  import { copyText, downloadText, isApple, isNewNoteShortcut, isTauri, newNoteKey } from "./lib/platform";
  import { ui, type MenuItem } from "./lib/ui.svelte";
  import { canFloat, floatingOpen, toggleFloating } from "./lib/windows/floating";

  let searchInput = $state<HTMLInputElement>();

  const selected = $derived(notes.selected);
  /** A locked note that isn't open shows the password prompt instead of its text. */
  const closed = $derived(!!selected && isClosed(selected.note));

  const focusKey = isApple ? "⇧⌘\\" : "Ctrl+Shift+\\";

  let shareOpen = $state(false);
  let lockMenuOpen = $state(false);
  /** The info button, while its panel is open. */
  let infoAnchor = $state<HTMLElement | null>(null);

  function toggleInfo(event: MouseEvent) {
    infoAnchor = infoAnchor ? null : (event.currentTarget as HTMLElement);
  }

  function closeInfo() {
    infoAnchor = null;
  }

  /** Share menu under the toolbar button: the system share sheet where there is one, copying, and download. */
  function openShare(event: MouseEvent) {
    if (shareOpen) return ui.closeMenu();
    if (!selected) return;
    const { body } = selected.note;
    const title = selected.meta.title || "Untitled";
    const items: MenuItem[] = [];
    if (typeof navigator.share === "function") {
      items.push(
        { label: "Share…", icon: "share", run: () => void navigator.share({ title, text: plainText(body) }).catch(() => {}) },
        "separator",
      );
    }
    items.push(
      { label: "Copy Markdown", icon: "copy", run: () => copyText(body) },
      { label: "Copy Plain Text", icon: "file-text", run: () => copyText(plainText(body)) },
    );
    // Browsers save downloads; the native apps need their own save dialog for this, so it's web-only for now.
    if (!isTauri) {
      const filename = title.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "Untitled";
      items.push("separator", { label: "Download Markdown", icon: "download", run: () => downloadText(`${filename}.md`, body) });
    }
    const anchor = event.currentTarget as HTMLElement;
    const rect = anchor.getBoundingClientRect();
    shareOpen = true;
    ui.openMenu({ x: rect.right, y: rect.bottom + 6, align: "end", anchor, items, onclose: () => (shareOpen = false) });
  }

  /** An open locked note's lock button: lock it again, or take the lock off. */
  function openLockMenu(event: MouseEvent) {
    if (lockMenuOpen) return ui.closeMenu();
    if (!selected) return;
    const id = selected.note.id;
    const anchor = event.currentTarget as HTMLElement;
    const rect = anchor.getBoundingClientRect();
    lockMenuOpen = true;
    ui.openMenu({
      x: rect.right,
      y: rect.bottom + 6,
      align: "end",
      anchor,
      items: [
        { label: "Lock Now", icon: "lock", run: () => void lockedNotes.close() },
        { label: "Remove Lock", icon: "lock-open", run: () => void notes.removeLock(id) },
      ],
      onclose: () => (lockMenuOpen = false),
    });
  }

  /** ⌘Z right after moving a note to the trash brings it back, even from inside the editor. */
  function onKeydownCapture(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "z") return;
    if (target.matches("input, textarea")) return;
    if (!notes.undoTrash()) return;
    event.preventDefault();
    // Keeps the editor from also undoing its last change.
    event.stopPropagation();
  }

  function onKeydown(event: KeyboardEvent) {
    if (isNewNoteShortcut(event)) {
      event.preventDefault();
      notes.create();
      return;
    }
    // ⌃⌘L locks lines (Ctrl+Alt+L elsewhere), by key position so other keyboard layouts work too.
    if (event.code === "KeyL" && event.ctrlKey && (isApple ? event.metaKey : event.altKey) && lock.enabled) {
      event.preventDefault();
      void lock.lockNow();
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (key === "f" && event.shiftKey) {
      event.preventDefault();
      // The list (and its search field) has to be showing: out of focus mode, and on a phone
      // back from the open note.
      ui.focus = false;
      if (ui.layout === "narrow") notes.select(null);
      searchInput?.focus();
    } else if (event.code === "Backslash" && event.shiftKey) {
      event.preventDefault();
      if (ui.layout !== "narrow") ui.focus = !ui.focus;
    } else if (key === "\\") {
      event.preventDefault();
      ui.toggleSidebar();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} onkeydowncapture={onKeydownCapture} />

<div
  class="app"
  data-layout={ui.layout}
  class:sidebar-open={ui.sidebarOpen}
  class:has-selection={!!selected}
  class:focus={ui.focus && ui.layout !== "narrow"}
>
  <aside class="pane sidebar-pane" inert={ui.layout !== "wide" && !ui.sidebarOpen}>
    <Sidebar />
  </aside>

  {#if ui.layout !== "wide"}
    <button class="scrim" aria-label="Close sidebar" tabindex="-1" onclick={() => (ui.sidebarOpen = false)}></button>
  {/if}

  <!-- On a phone one pane shows at a time; the other is off-screen and out of reach. -->
  <div class="pane list-pane" inert={ui.layout === "narrow" && !!selected}>
    <NoteList bind:searchInput />
  </div>

  <main class="pane editor-pane" inert={ui.layout === "narrow" && !selected}>
    <header class="toolbar" data-tauri-drag-region>
      {#if ui.layout === "narrow"}
        <button class="icon-button" onclick={() => notes.select(null)} aria-label="Back to notes">
          <Icon name="chevron-left" size={22} />
        </button>
      {:else}
        {#if selected || ui.focus}
          <button
            class="icon-button"
            class:on={ui.focus}
            onclick={() => (ui.focus = !ui.focus)}
            aria-pressed={ui.focus}
            aria-label={ui.focus ? "Show sidebar and notes" : "Focus on this note"}
            title={ui.focus ? `Show sidebar and notes (${focusKey})` : `Focus on this note (${focusKey})`}
          >
            <Icon name={ui.focus ? "minimize-2" : "maximize-2"} size={16} />
          </button>
        {/if}
      {/if}
      <div class="spacer" data-tauri-drag-region></div>
      {#if selected}
        {#if selected.note.trashed}
          <button class="text-button" onclick={() => notes.restore(selected.note.id)}>
            <Icon name="restore" size={15} /> Restore
          </button>
          <button class="text-button danger" onclick={() => notes.deleteForever(selected.note.id)}>
            Delete forever
          </button>
        {:else}
          {#if canFloat}
            {@const floating = floatingOpen.has(selected.note.id)}
            <button
              class="icon-button"
              class:on={floating}
              onclick={() => toggleFloating(selected.note.id)}
              aria-pressed={floating}
              aria-label={floating ? "Put back from floating window" : "Open in floating window"}
              title={floating ? "Put back in this window" : "Open in a floating window"}
            >
              <Icon name="picture-in-picture-2" size={17} />
            </button>
          {/if}
          {#if !selected.note.locked}
            <button
              class="icon-button"
              onclick={() => lockedNotes.lockNote(selected.note.id)}
              aria-label="Lock note"
              title="Lock with a password"
            >
              <Icon name="lock" size={17} />
            </button>
          {:else if !closed}
            <button
              class="icon-button"
              class:open={lockMenuOpen}
              onclick={openLockMenu}
              aria-label="Locked note, open"
              aria-haspopup="menu"
              title="Locked note, open until you lock it"
            >
              <Icon name="lock-open" size={17} />
            </button>
          {/if}
          {#if !closed}
            <button
              class="icon-button"
              class:open={!!infoAnchor}
              onclick={toggleInfo}
              aria-label="Note info"
              aria-expanded={!!infoAnchor}
              title="Word count and info"
            >
              <Icon name="info" size={17} />
            </button>
            <button
              class="icon-button"
              class:open={shareOpen}
              onclick={openShare}
              aria-label="Share note"
              aria-haspopup="menu"
              title="Share"
            >
              <Icon name="share" size={17} />
            </button>
          {/if}
          <button
            class="icon-button"
            class:on={selected.note.pinned}
            onclick={() => notes.togglePin(selected.note.id)}
            aria-label={selected.note.pinned ? "Unpin note" : "Pin note"}
            title={selected.note.pinned ? "Unpin" : "Pin to top"}
          >
            {#if selected.note.pinned}<Icon name="pin-off" size={17} />{:else}<Icon name="pin" size={17} />{/if}
          </button>
          <button
            class="icon-button"
            onclick={() => notes.trash(selected.note.id)}
            aria-label="Move to trash"
            title="Move to trash"
          >
            <Icon name="trash" size={17} />
          </button>
        {/if}
      {/if}
    </header>

    {#if selected}
      <!-- The editor stays, out of sight, so other notes keep their undo history and place. -->
      <div class="editor-host" hidden={closed}>
        <Editor noteId={selected.note.id} trashed={selected.note.trashed || closed} />
      </div>
      {#if closed}
        {#key selected.note.id}
          <LockedNoteView entry={selected} />
        {/key}
      {/if}
    {:else if notes.loadError}
      <div class="placeholder">
        <Icon name="circle-alert" size={36} strokeWidth={1.25} />
        <p>Your notes couldn't be loaded: {notes.loadError}</p>
      </div>
    {:else if notes.ready}
      <div class="placeholder">
        <Icon name="feather" size={36} strokeWidth={1.25} />
        <p>Select a note, or start a new one.</p>
        <button class="text-button" onclick={() => notes.create()}>New note <kbd>{newNoteKey}</kbd></button>
      </div>
    {/if}
  </main>
</div>

{#if infoAnchor && selected && !closed}
  <NoteInfo entry={selected} anchor={infoAnchor} onclose={closeInfo} />
{/if}

<Settings />
<NotesPasswordDialog />
<ContextMenu />
<IconPicker />

<style>
  .app {
    --sidebar-ms: 320ms;
    --sidebar-slide: var(--sidebar-ms) var(--ease-sheet);
    --sidebar-w: 230px;
    --list-w: 320px;
    position: relative;
    display: grid;
    grid-template-columns: var(--sidebar-w) var(--list-w) minmax(0, 1fr);
    height: 100%;
    overflow: hidden;
  }

  .pane {
    min-width: 0;
    min-height: 0;
  }

  /* Panes paint their own backgrounds, so their dividers sit on them rather than on nothing. */
  .list-pane {
    border-right: 1px solid var(--border);
    background: var(--surface-list);
  }

  .sidebar-pane {
    border-right: 1px solid var(--border);
    background: var(--surface-sidebar);
  }

  /*
   * Wide: three columns; the sidebar column animates closed. The sidebar keeps its width and
   * hugs the column's right edge, so it slides out to the left instead of squashing.
   */
  .app[data-layout="wide"] {
    transition: grid-template-columns var(--sidebar-slide);
  }

  .app[data-layout="wide"]:not(.sidebar-open) {
    grid-template-columns: 0 var(--list-w) minmax(0, 1fr);
  }

  .app[data-layout="wide"] .sidebar-pane {
    display: flex;
    justify-content: flex-end;
    overflow: hidden;
  }

  .app[data-layout="wide"] .sidebar-pane > :global(.sidebar) {
    flex-shrink: 0;
    width: calc(var(--sidebar-w) - 1px);
  }

  .app[data-layout="wide"]:not(.sidebar-open) .sidebar-pane {
    visibility: hidden;
    border-right-color: transparent;
    transition: visibility 0s var(--sidebar-ms), border-color 0s var(--sidebar-ms);
  }

  /* Focus mode: just the note. The list slides away like the sidebar, and so does the sidebar. */
  .app[data-layout="wide"].focus {
    grid-template-columns: 0 0 minmax(0, 1fr);
  }

  .app[data-layout="medium"] {
    transition: grid-template-columns var(--sidebar-slide);
  }

  .app[data-layout="medium"].focus {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  .app:not([data-layout="narrow"]) .list-pane {
    display: flex;
    justify-content: flex-end;
    overflow: hidden;
  }

  .app:not([data-layout="narrow"]) .list-pane > :global(.note-list) {
    flex-shrink: 0;
    width: calc(var(--list-w) - 1px);
  }

  .app.focus .list-pane,
  .app[data-layout="wide"].focus .sidebar-pane {
    visibility: hidden;
    border-right-color: transparent;
    transition: visibility 0s var(--sidebar-ms), border-color 0s var(--sidebar-ms);
  }

  /* Medium & narrow: the sidebar slides in as a drawer. */
  .app:not([data-layout="wide"]) {
    grid-template-columns: var(--list-w) minmax(0, 1fr);
  }

  .app:not([data-layout="wide"]) .sidebar-pane {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 20;
    width: min(var(--sidebar-w), 82vw);
    /* The shadow fades with the slide; otherwise its blur lingers at the edge and pops off at the end. */
    box-shadow: 0 0 40px transparent;
    transform: translateX(-100%);
    transition:
      transform var(--sidebar-slide),
      box-shadow var(--sidebar-slide),
      visibility 0s var(--sidebar-ms);
    visibility: hidden;
  }

  .app:not([data-layout="wide"]).sidebar-open .sidebar-pane {
    box-shadow: var(--shadow-drawer);
    transform: none;
    visibility: visible;
    transition:
      transform var(--sidebar-slide),
      box-shadow var(--sidebar-slide);
  }

  .scrim {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: var(--scrim);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--sidebar-slide);
  }

  .sidebar-open .scrim {
    opacity: 1;
    pointer-events: auto;
  }

  /* Narrow: one pane at a time, like a phone navigation stack. */
  .app[data-layout="narrow"] {
    grid-template-columns: 100% 100%;
  }

  .app[data-layout="narrow"] .list-pane,
  .app[data-layout="narrow"] .editor-pane {
    grid-row: 1;
    transition: transform 320ms var(--ease-sheet);
  }

  .app[data-layout="narrow"] .list-pane {
    grid-column: 1;
    border-right: 0;
  }

  .app[data-layout="narrow"] .editor-pane {
    grid-column: 2;
  }

  .app[data-layout="narrow"].has-selection .list-pane,
  .app[data-layout="narrow"].has-selection .editor-pane {
    transform: translateX(-100%);
  }

  .editor-pane {
    display: flex;
    flex-direction: column;
    background: var(--surface);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--titlebar-h);
    padding: var(--titlebar-pad-top) 12px 0;
    flex-shrink: 0;
  }

  .spacer {
    flex: 1;
    align-self: stretch;
  }

  .editor-host {
    flex: 1;
    min-height: 0;
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding-bottom: var(--titlebar-h);
    color: var(--text-faint);
  }

  .placeholder p {
    margin: 0;
    font-size: 15px;
  }

  kbd {
    margin-left: 6px;
    font-family: inherit;
    font-size: 12px;
    color: var(--text-faint);
  }
</style>
