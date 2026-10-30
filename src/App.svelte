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
  import PdfPreview from "./lib/components/PdfPreview.svelte";
  import PaneResizer from "./lib/components/PaneResizer.svelte";
  import Editor from "./lib/editor/Editor.svelte";
  import { untrack } from "svelte";
  import { speak } from "./lib/a11y";
  import { t } from "./lib/i18n/index.svelte";
  import { lock } from "./lib/lock/lock.svelte";
  import { lockedNotes } from "./lib/notes/locked.svelte";
  import { isClosed, notes } from "./lib/notes/store.svelte";
  import { latexDocument } from "./lib/notes/latex";
  import { plainText } from "./lib/notes/stats";
  import { copyText, downloadText, isApple, isNewNoteShortcut, isTauri, newNoteKey } from "./lib/platform";
  import { ui, type MenuItem } from "./lib/ui.svelte";
  import { PANE_WIDTHS, prefs } from "./lib/prefs.svelte";
  import { canFloat, floatingOpen, toggleFloating } from "./lib/windows/floating";

  let searchInput = $state<HTMLInputElement>();

  // The sidebar and note list are dragged wider or narrower at their right edges, where they're
  // columns; the note keeps at least NOTE_MIN.
  const NOTE_MIN = 360;
  let windowWidth = $state(innerWidth);
  let resizing = $state(false);
  const sidebarColumn = $derived(ui.layout === "wide" && ui.sidebarOpen && !ui.focus);
  const listColumn = $derived(ui.layout !== "narrow" && !ui.focus);
  const sidebarMax = $derived(Math.max(PANE_WIDTHS.sidebar.min, Math.min(PANE_WIDTHS.sidebar.max, windowWidth - prefs.listWidth - NOTE_MIN)));
  const listMax = $derived(
    Math.max(PANE_WIDTHS.list.min, Math.min(PANE_WIDTHS.list.max, windowWidth - (sidebarColumn ? prefs.sidebarWidth : 0) - NOTE_MIN)),
  );

  const selected = $derived(notes.selected);
  /** A locked note that isn't open shows the password prompt instead of its text. */
  const closed = $derived(!!selected && isClosed(selected.note));

  const focusKey = isApple ? "⇧⌘\\" : "Ctrl+Shift+\\";

  let shareOpen = $state(false);
  let lockMenuOpen = $state(false);
  /** The info button, while its panel is open. */
  let infoAnchor = $state<HTMLElement | null>(null);
  let sidebarPane: HTMLElement;
  let listPane: HTMLElement;
  let editorPane: HTMLElement;

  /*
   * Focus follows the sidebar. As a drawer it takes focus when it slides in and gives it back when
   * it goes. As a column, focus moves between its hide button and the list's show button, since
   * each goes away when pressed.
   */
  let beforeDrawer: Element | null = null;
  let firstRun = true;
  $effect(() => {
    const open = ui.sidebarOpen;
    const drawer = ui.layout !== "wide";
    untrack(() => {
      if (firstRun) return void (firstRun = false);
      const active = document.activeElement;
      if (open) {
        if (drawer) beforeDrawer = active;
        if (drawer || listPane.querySelector(".titlebar")?.contains(active)) {
          sidebarPane.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
        }
      } else if (sidebarPane.contains(active) || (beforeDrawer && active === document.body)) {
        const back = beforeDrawer instanceof HTMLElement && beforeDrawer.isConnected ? beforeDrawer : null;
        (back ?? listPane.querySelector<HTMLElement>(".titlebar button"))?.focus({ preventScroll: true });
        beforeDrawer = null;
      }
    });
  });

  /*
   * On a phone one pane shows at a time, and the other is inert. Focus moves with them: to the
   * open note's toolbar, and back to its row in the list, unless it's already somewhere that shows.
   */
  let shownId: string | null = null;
  let firstShown = true;
  $effect(() => {
    const id = notes.selectedId;
    const narrow = ui.layout === "narrow";
    untrack(() => {
      const previous = shownId;
      shownId = id;
      if (firstShown) return void (firstShown = false);
      if (!narrow || !!id === !!previous) return;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && active !== document.body && !(id ? listPane : editorPane).contains(active)) return;
        const target = id
          ? editorPane.querySelector<HTMLElement>(".toolbar button")
          : (listPane.querySelector<HTMLElement>(`[data-id="${previous}"]`) ?? listPane.querySelector<HTMLElement>('.item[tabindex="0"]'));
        target?.focus({ preventScroll: true });
      });
    });
  });

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
    const { body, format } = selected.note;
    const latex = format === "latex";
    const title = selected.meta.title || t("list.untitled");
    const items: MenuItem[] = [];
    if (typeof navigator.share === "function") {
      items.push(
        { label: t("app.shareSheet"), icon: "share", run: () => void navigator.share({ title, text: plainText(body, format) }).catch(() => {}) },
        "separator",
      );
    }
    items.push(
      { label: latex ? t("app.copyLatex") : t("app.copyMarkdown"), icon: "copy", run: () => copy(body) },
      { label: t("app.copyPlainText"), icon: "file-text", run: () => copy(plainText(body, format)) },
    );
    // Browsers save downloads; the native apps need their own save dialog for this, so it's web-only for now.
    if (!isTauri) {
      const filename = title.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || t("list.untitled");
      items.push(
        "separator",
        latex
          ? { label: t("app.downloadLatex"), icon: "download", run: () => downloadText(`${filename}.tex`, latexDocument(body)) }
          : { label: t("app.downloadMarkdown"), icon: "download", run: () => downloadText(`${filename}.md`, body) },
      );
    }
    const id = selected.note.id;
    items.push(
      "separator",
      { label: t("app.previewPdf"), icon: "eye", run: () => (ui.pdf = { id, save: false }) },
      { label: t("app.exportPdf"), icon: "printer", run: () => (ui.pdf = { id, save: true }) },
      { label: t("app.exportPng"), icon: "image", run: () => (ui.pdf = { id, save: false, png: true }) },
    );
    const anchor = event.currentTarget as HTMLElement;
    const rect = anchor.getBoundingClientRect();
    shareOpen = true;
    ui.openMenu({ x: rect.right, y: rect.bottom + 6, align: "end", anchor, label: t("app.share"), items, onclose: () => (shareOpen = false) });
  }

  /** Copying shows nothing, so screen readers are told it happened. */
  async function copy(text: string) {
    await copyText(text);
    speak(t("list.copied"));
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
      label: t("app.lockedOpen"),
      items: [
        { label: t("list.lockNow"), icon: "lock", run: () => void lockedNotes.close() },
        { label: t("list.removeLock"), icon: "lock-open", run: () => void notes.removeLock(id) },
      ],
      onclose: () => (lockMenuOpen = false),
    });
  }

  /** ⌘Z right after moving a note to the trash brings it back, even from inside the editor. */
  function onKeydownCapture(event: KeyboardEvent) {
    // A drawing's keys are Excalidraw's (⌘Z undoes a stroke there, not a trashing).
    if ((event.target as HTMLElement).closest?.(".drawing-editor")) return;
    // ⌘/ (Ctrl+/) lists the keyboard shortcuts, before a note's editor takes it (for comments,
    // which Markdown notes don't use).
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === "/") {
      event.preventDefault();
      event.stopPropagation();
      ui.settings = "shortcuts";
      return;
    }
    // ⌘P (Ctrl+P) previews the open note as a PDF, rather than printing the window. In the
    // preview, it prints or saves (PdfPreview.svelte).
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "p" && !ui.pdf) {
      event.preventDefault();
      event.stopPropagation();
      if (selected && !closed) ui.pdf = { id: selected.note.id, save: false };
      return;
    }
    const target = event.target as HTMLElement;
    if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "z") return;
    if (target.matches("input, textarea")) return;
    if (!notes.undoTrash()) return;
    speak(t("list.didRestore"));
    event.preventDefault();
    // Keeps the editor from also undoing its last change.
    event.stopPropagation();
  }

  /*
   * The toolbar's note actions. The buttons go away with what they act on, so focus moves to the
   * note list (rather than being lost), and screen readers hear what happened.
   */
  function trash(id: string) {
    notes.trash(id);
    speak(t("list.didTrash"));
    focusList();
  }

  function restore(id: string) {
    notes.restore(id);
    speak(t("list.didRestore"));
    focusList();
  }

  function deleteForever(id: string) {
    void notes.deleteForever(id);
    speak(t("list.didDelete"));
    focusList();
  }

  function togglePin(id: string, pinned: boolean) {
    notes.togglePin(id);
    speak(pinned ? t("list.didUnpin") : t("list.pinned"));
  }

  /** Once the list has redrawn: its row that takes focus, or else its search field. */
  function focusList() {
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>('.note-list .item[tabindex="0"]');
      (row ?? searchInput)?.focus({ preventScroll: !row });
    });
  }

  /**
   * F6 (⇧F6 back) moves between the sidebar, the note list and the open note, as in other desktop
   * apps, so the keyboard and screen readers don't have to Tab through every button on the way.
   * Each pane takes focus where it was left: the chosen list, the open note's row, the note's text.
   */
  function cyclePane(back: boolean) {
    const panes = [sidebarPane, listPane, editorPane].filter((pane) => pane && !pane.inert && pane.offsetParent !== null);
    if (!panes.length) return;
    const current = panes.findIndex((pane) => pane.contains(document.activeElement));
    const next = panes[(current + (back ? -1 : 1) + panes.length) % panes.length];
    const target =
      next === sidebarPane
        ? next.querySelector<HTMLElement>(".row.active, .row")
        : next === listPane
          ? (next.querySelector<HTMLElement>('.items [tabindex="0"]') ?? next.querySelector<HTMLElement>('input[type="search"]'))
          : next.querySelector<HTMLElement>(".cm-content") ?? next.querySelector<HTMLElement>("button");
    target?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "F6" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      cyclePane(event.shiftKey);
      return;
    }
    // Esc closes the sidebar drawer from inside it.
    if (event.key === "Escape" && !event.defaultPrevented && ui.layout !== "wide" && ui.sidebarOpen && sidebarPane.contains(event.target as Node)) {
      event.preventDefault();
      ui.sidebarOpen = false;
      return;
    }
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

<svelte:window onkeydown={onKeydown} onkeydowncapture={onKeydownCapture} bind:innerWidth={windowWidth} />

<div
  class="app"
  data-layout={ui.layout}
  class:sidebar-open={ui.sidebarOpen}
  class:has-selection={!!selected}
  class:focus={ui.focus && ui.layout !== "narrow"}
  class:resizing
  style:--sidebar-w="{prefs.sidebarWidth}px"
  style:--list-w="{prefs.listWidth}px"
>
  <aside class="pane sidebar-pane" inert={ui.layout !== "wide" && !ui.sidebarOpen} bind:this={sidebarPane}>
    <Sidebar />
  </aside>

  {#if ui.layout !== "wide"}
    <button class="scrim" aria-label={t("app.closeSidebar")} tabindex="-1" onclick={() => (ui.sidebarOpen = false)}></button>
  {/if}

  <!-- On a phone one pane shows at a time; the other is off-screen and out of reach. -->
  <div class="pane list-pane" inert={ui.layout === "narrow" && !!selected} bind:this={listPane}>
    <NoteList bind:searchInput />
  </div>

  {#if sidebarColumn}
    <PaneResizer
      label={t("app.sidebarWidth")}
      width={prefs.sidebarWidth}
      min={PANE_WIDTHS.sidebar.min}
      max={sidebarMax}
      initial={PANE_WIDTHS.sidebar.initial}
      left={prefs.sidebarWidth}
      onresize={(width) => (prefs.sidebarWidth = width)}
      ondrag={(dragging) => (resizing = dragging)}
    />
  {/if}
  {#if listColumn}
    <PaneResizer
      label={t("app.listWidth")}
      width={prefs.listWidth}
      min={PANE_WIDTHS.list.min}
      max={listMax}
      initial={PANE_WIDTHS.list.initial}
      left={(sidebarColumn ? prefs.sidebarWidth : 0) + prefs.listWidth}
      onresize={(width) => (prefs.listWidth = width)}
      ondrag={(dragging) => (resizing = dragging)}
    />
  {/if}

  <main class="pane editor-pane" inert={ui.layout === "narrow" && !selected} bind:this={editorPane}>
    <header class="toolbar" data-tauri-drag-region>
      {#if ui.layout === "narrow"}
        <button class="icon-button" onclick={() => notes.select(null)} aria-label={t("app.backToNotes")} title={t("app.backToNotes")}>
          <Icon name="chevron-left" size={22} />
        </button>
      {:else}
        {#if selected || ui.focus}
          <button
            class="icon-button"
            class:on={ui.focus}
            onclick={() => (ui.focus = !ui.focus)}
            aria-label={ui.focus ? t("app.unfocus") : t("app.focus")}
            title={ui.focus ? t("app.unfocusWithKey", { key: focusKey }) : t("app.focusWithKey", { key: focusKey })}
          >
            <Icon name={ui.focus ? "minimize-2" : "maximize-2"} size={16} />
          </button>
        {/if}
      {/if}
      <div class="spacer" data-tauri-drag-region></div>
      {#if selected}
        {#if selected.note.trashed}
          <button class="text-button" onclick={() => restore(selected.note.id)}>
            <Icon name="restore" size={15} /> {t("app.restore")}
          </button>
          <button class="text-button danger" onclick={() => deleteForever(selected.note.id)}>
            {t("app.deleteForever")}
          </button>
        {:else}
          {#if canFloat}
            {@const floating = floatingOpen.has(selected.note.id)}
            <button
              class="icon-button"
              class:on={floating}
              onclick={() => toggleFloating(selected.note.id)}
              aria-label={floating ? t("app.unfloat") : t("app.float")}
              title={floating ? t("app.unfloat") : t("app.float")}
            >
              <Icon name="picture-in-picture-2" size={17} />
            </button>
          {/if}
          {#if !selected.note.locked}
            <button
              class="icon-button"
              onclick={() => lockedNotes.lockNote(selected.note.id)}
              aria-label={t("app.lockNote")}
              title={t("app.lockNote")}
            >
              <Icon name="lock" size={17} />
            </button>
          {:else if !closed}
            <button
              class="icon-button"
              class:open={lockMenuOpen}
              onclick={openLockMenu}
              aria-label={t("app.lockedOpen")}
              aria-haspopup="menu"
              aria-expanded={lockMenuOpen}
              title={t("app.lockedOpen")}
            >
              <Icon name="lock-open" size={17} />
            </button>
          {/if}
          {#if !closed}
            <button
              class="icon-button"
              class:open={!!infoAnchor}
              onclick={toggleInfo}
              aria-label={t("app.info")}
              aria-expanded={!!infoAnchor}
              title={t("app.info")}
            >
              <Icon name="info" size={17} />
            </button>
            <button
              class="icon-button"
              class:open={shareOpen}
              onclick={openShare}
              aria-label={t("app.share")}
              aria-haspopup="menu"
              aria-expanded={shareOpen}
              title={t("app.share")}
            >
              <Icon name="share" size={17} />
            </button>
          {/if}
          <button
            class="icon-button"
            class:on={selected.note.pinned}
            onclick={() => togglePin(selected.note.id, selected.note.pinned)}
            aria-label={selected.note.pinned ? t("app.unpin") : t("app.pin")}
            title={selected.note.pinned ? t("app.unpin") : t("app.pin")}
          >
            {#if selected.note.pinned}<Icon name="pin-off" size={17} />{:else}<Icon name="pin" size={17} />{/if}
          </button>
          <button
            class="icon-button"
            onclick={() => trash(selected.note.id)}
            aria-label={t("app.trash")}
            title={t("app.trash")}
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
        <p role="alert">{t("app.loadError", { error: notes.loadError })}</p>
      </div>
    {:else if notes.ready}
      <div class="placeholder">
        <Icon name="feather" size={36} strokeWidth={1.25} />
        <p>{t("app.noSelection")}</p>
        <button class="text-button" onclick={() => notes.create()}>
          {t("list.newNote")} <kbd>{newNoteKey}</kbd>
        </button>
      </div>
    {/if}
  </main>
</div>

{#if infoAnchor && selected && !closed}
  <NoteInfo entry={selected} anchor={infoAnchor} onclose={closeInfo} />
{/if}

<Settings />
<NotesPasswordDialog />
{#if ui.pdf && notes.get(ui.pdf.id)}
  {#key ui.pdf}
    <PdfPreview entry={notes.get(ui.pdf.id)!} save={ui.pdf.save} png={ui.pdf.png} onclose={() => (ui.pdf = null)} />
  {/key}
{/if}
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

  /* Dragging a pane's edge: the columns follow the pointer at once, and text isn't selected. */
  .app.resizing {
    transition: none !important;
    user-select: none;
    cursor: col-resize;
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
