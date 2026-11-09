<script lang="ts">
  import Icon from "./lib/icons/Icon.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
  import NoteList from "./lib/components/NoteList.svelte";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import NoteInfo from "./lib/components/NoteInfo.svelte";
  import Settings from "./lib/components/settings/Settings.svelte";
  import IconPicker from "./lib/components/IconPicker.svelte";
  import TagPrompt from "./lib/components/TagPrompt.svelte";
  import LockedNoteView from "./lib/components/LockedNoteView.svelte";
  import NotesPasswordDialog from "./lib/components/NotesPasswordDialog.svelte";
  import PdfPreview from "./lib/components/PdfPreview.svelte";
  import PaneResizer from "./lib/components/PaneResizer.svelte";
  import SideNote from "./lib/components/SideNote.svelte";
  import SidebarToggle from "./lib/components/SidebarToggle.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import Button from "./lib/components/ui/Button.svelte";
  import IconButton from "./lib/components/ui/IconButton.svelte";
  import Editor from "./lib/editor/Editor.svelte";
  import { untrack } from "svelte";
  import { speak } from "./lib/a11y";
  import { t } from "./lib/i18n/index.svelte";
  import { lock } from "./lib/lock/lock.svelte";
  import { fileName } from "./lib/notes/export";
  import { lockedNotes } from "./lib/notes/locked.svelte";
  import { isClosed, notes } from "./lib/notes/store.svelte";
  import { plugins } from "./lib/plugins/registry.svelte";
  import { canPrint, copyText, isApple, isNewNoteShortcut, newNoteKey } from "./lib/platform";
  import { saveAndShow } from "./lib/save";
  import { NOTE_MIN, ui, type MenuItem } from "./lib/ui.svelte";
  import { openSettings } from "./lib/windows/settings.svelte";
  import { PANE_WIDTHS, prefs } from "./lib/prefs.svelte";
  import { canFloat, floatingOpen, toggleFloating } from "./lib/windows/floating";
  import { tabs } from "./lib/tabs.svelte";
  import { textSizeKey } from "./lib/textSize";
  import { isDarkPane } from "./lib/themes/show.svelte";
  import { findInPane } from "./lib/editor/find.svelte";

  let searchInput = $state<HTMLInputElement>();

  type Pane = "sidebar" | "list" | "editor";

  /**
   * The panes from left to right, as Settings → Layout puts them: the sidebar outermost on
   * its side, the note list beside the note.
   */
  const order = $derived.by(() => {
    const left: Pane[] = [];
    const right: Pane[] = [];
    (prefs.sidebarSide === "left" ? left : right).push("sidebar");
    (prefs.listSide === "left" ? left : right).push("list");
    return [...left, "editor", ...right.reverse()] as Pane[];
  });

  /**
   * The grid's columns in that order, but for phones (one pane at a time; see the styles). The
   * sidebar is a column only on a wide screen, elsewhere a drawer; a hidden sidebar's column, and
   * in focus mode the side panes', shrink to nothing, so they slide away.
   */
  const grid = $derived.by(() => {
    if (ui.layout === "narrow") return null;
    const panes = order.filter((pane) => pane !== "sidebar" || ui.layout === "wide");
    const width = (pane: Pane) =>
      pane === "editor" ? "minmax(0, 1fr)" : ui.focus || (pane === "sidebar" && !ui.sidebarOpen) ? "0px" : `var(--${pane}-w)`;
    return { areas: `"${panes.join(" ")}"`, columns: panes.map(width).join(" ") };
  });

  /** The pane at the window's left edge, which leaves room for the Mac app's window buttons (app.css). */
  const first = $derived.by((): Pane => {
    if (ui.layout === "narrow") return selected ? "editor" : "list";
    if (ui.layout === "wide" && prefs.sidebarSide === "left" && ui.sidebarOpen && !ui.focus) return "sidebar";
    return prefs.listSide === "left" && !ui.focus ? "list" : "editor";
  });

  // The sidebar and note list are dragged wider or narrower at their inner edges, where they're
  // columns; the note keeps at least NOTE_MIN.
  let windowWidth = $state(innerWidth);
  let resizing = $state(false);
  const sidebarColumn = $derived(ui.layout === "wide" && ui.sidebarOpen && !ui.focus);
  const listColumn = $derived(ui.layout !== "narrow" && !ui.focus);
  /**
   * Their widths as dragged, unless the window has since got too small to leave the note its room:
   * then the sidebar gives way, down to its narrowest, and after it the list.
   */
  const room = $derived(windowWidth - NOTE_MIN);
  const listWidth = $derived(
    Math.max(PANE_WIDTHS.list.min, Math.min(prefs.listWidth, room - (sidebarColumn ? PANE_WIDTHS.sidebar.min : 0))),
  );
  const sidebarWidth = $derived(
    ui.layout === "wide" ? Math.max(PANE_WIDTHS.sidebar.min, Math.min(prefs.sidebarWidth, room - (listColumn ? listWidth : 0))) : prefs.sidebarWidth,
  );
  /** How far the note list's inner edge is from its side of the window: past the sidebar, when that's on the same side. */
  const listOffset = $derived(listWidth + (sidebarColumn && prefs.sidebarSide === prefs.listSide ? sidebarWidth : 0));
  const sidebarMax = $derived(Math.max(PANE_WIDTHS.sidebar.min, Math.min(PANE_WIDTHS.sidebar.max, room - listWidth)));
  const listMax = $derived(Math.max(PANE_WIDTHS.list.min, Math.min(PANE_WIDTHS.list.max, room - (sidebarColumn ? sidebarWidth : 0))));

  const wide = $derived(ui.layout === "wide");
  const narrow = $derived(ui.layout === "narrow");
  const focusMode = $derived(ui.focus && !narrow);

  /*
   * How the panes are laid out (the panes slide in 320ms). Wide and medium: columns in the order
   * `grid` gives. On a wide screen the sidebar column animates closed; the sidebar keeps its width
   * and hugs the column's inner edge, so it slides out to its side instead of squashing, and focus
   * mode slides the note list away the same way. Medium and narrow: the sidebar slides in as a
   * drawer from its side. Narrow: one pane at a time, like a phone's navigation stack. Panes paint
   * their own backgrounds, so their dividers (on a side pane's inner edge) sit on them; a side pane
   * that slides away hides, divider and all, once it's gone.
   */
  const divider = (side: "left" | "right", hidden = false) => [
    side === "left" ? "border-r" : "border-l",
    hidden ? "invisible border-transparent transition-[visibility,border-color] delay-320 duration-0" : "border-line",
  ];
  const sidebarPaneClass = $derived([
    "min-h-0 min-w-0 bg-surface-sidebar",
    wide
      ? [
          "flex overflow-hidden [grid-area:sidebar] *:w-[calc(var(--sidebar-w)_-_1px)] *:shrink-0",
          prefs.sidebarSide === "left" ? "justify-end" : "justify-start",
          divider(prefs.sidebarSide, !ui.sidebarOpen || focusMode),
        ]
      : [
          "absolute inset-y-0 z-20 w-[min(var(--sidebar-w),82vw)]",
          prefs.sidebarSide === "left" ? "left-0" : "right-0",
          divider(prefs.sidebarSide),
          // The shadow fades with the slide; otherwise its blur lingers at the edge and pops off at the end.
          ui.sidebarOpen
            ? "visible translate-x-0 [box-shadow:var(--shadow-drawer)] [transition:translate_320ms_var(--ease-sheet),box-shadow_320ms_var(--ease-sheet)]"
            : [
                "invisible [box-shadow:0_0_40px_transparent] [transition:translate_320ms_var(--ease-sheet),box-shadow_320ms_var(--ease-sheet),visibility_0s_320ms]",
                prefs.sidebarSide === "left" ? "-translate-x-full" : "translate-x-full",
              ],
        ],
  ]);
  /** On a phone, the note list and the note side by side, slid along to the one showing. */
  const stacked = $derived(["row-start-1 transition-[translate] duration-320 ease-sheet", notes.selected && "-translate-x-full"]);
  const listPaneClass = $derived([
    "min-h-0 min-w-0 bg-surface-list",
    narrow
      ? ["col-start-1", stacked]
      : [
          "flex overflow-hidden [grid-area:list] *:w-[calc(var(--list-w)_-_1px)] *:shrink-0",
          prefs.listSide === "left" ? "justify-end" : "justify-start",
          divider(prefs.listSide, focusMode),
        ],
  ]);

  const selected = $derived(notes.selected);
  /** A locked note that isn't open shows the password prompt instead of its text. */
  const closed = $derived(!!selected && isClosed(selected.note));

  const focusKey = isApple ? "⇧⌘\\" : "Ctrl+Shift+\\";

  /** Where there's no note: what to do, or what went wrong. */
  const placeholder = "editor-placeholder flex flex-1 flex-col items-center justify-center gap-3 pb-(--titlebar-h) text-faint";

  let shareOpen = $state(false);
  let lockMenuOpen = $state(false);
  /** The info button, while its panel is open. */
  let infoAnchor = $state<HTMLElement | null>(null);
  let sidebarPane: HTMLElement;
  let listPane: HTMLElement;
  let editorPane: HTMLElement;

  /*
   * Focus follows the sidebar. As a drawer it takes focus when it slides in and gives it back when
   * it goes. As a column, focus moves between its hide button and the show button (in the note
   * list's title bar or the note's toolbar), since each goes away when pressed.
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
        if (drawer || active?.classList.contains("sidebar-toggle")) {
          sidebarPane.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
        }
      } else if (sidebarPane.contains(active) || (beforeDrawer && active === document.body)) {
        const back = beforeDrawer instanceof HTMLElement && beforeDrawer.isConnected ? beforeDrawer : null;
        (back ?? document.querySelector<HTMLElement>(".sidebar-toggle") ?? listPane.querySelector<HTMLElement>(".titlebar button"))?.focus({
          preventScroll: true,
        });
        beforeDrawer = null;
      }
    });
  });

  /*
   * On a phone one pane shows at a time, and the other is inert. Focus moves with them: to the
   * open note's toolbar, and back to its row in the list, unless it's already somewhere that shows.
   * A window resized to or from that narrow hides a pane or a button too, and focus with it.
   */
  let shownId: string | null = null;
  let wasNarrow: boolean | null = null;
  $effect(() => {
    const id = notes.selectedId;
    const narrow = ui.layout === "narrow";
    untrack(() => {
      const previous = shownId;
      const resized = wasNarrow !== null && wasNarrow !== narrow;
      const slid = wasNarrow !== null && narrow && !!id !== !!previous;
      shownId = id;
      wasNarrow = narrow;
      if (!resized && !slid) return;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && active !== document.body && !(narrow && (id ? listPane : editorPane).contains(active))) return;
        const target = id
          ? editorPane.querySelector<HTMLElement>(".toolbar button")
          : (listPane.querySelector<HTMLElement>(`[data-id="${previous}"]`) ?? listPane.querySelector<HTMLElement>('.item[tabindex="0"]'));
        target?.focus({ preventScroll: true });
      });
    });
  });

  /*
   * A note open beside the selected one (SideNote.svelte), where there's room for both. Never the
   * same note in both (neither editor would see the other's typing): selecting the one beside
   * closes it. Trashed or deleted, it goes.
   */
  const beside = $derived.by(() => {
    const entry = ui.side && ui.besideFits && ui.side !== notes.selectedId ? notes.get(ui.side) : undefined;
    return entry && !entry.note.trashed ? entry : null;
  });
  $effect(() => {
    if (ui.side && notes.ready && (ui.side === notes.selectedId || !notes.get(ui.side) || notes.get(ui.side)!.note.trashed)) untrack(() => (ui.side = null));
  });
  /** As wide as dragged, leaving the main note at least NOTE_MIN. */
  const sideMax = $derived(Math.max(PANE_WIDTHS.side.min, Math.min(PANE_WIDTHS.side.max, ui.editorWidth - NOTE_MIN)));
  const sideWidth = $derived(Math.min(prefs.sideWidth, sideMax));

  // Tabs turned off: they go with them.
  $effect(() => {
    if (!prefs.tabs) untrack(() => tabs.clear());
  });

  function toggleInfo(event: MouseEvent) {
    infoAnchor = infoAnchor ? null : (event.currentTarget as HTMLElement);
  }

  function closeInfo() {
    infoAnchor = null;
  }

  /** Share menu under the toolbar button: the system share sheet where there is one, copying, and downloads. */
  function openShare(event: MouseEvent) {
    if (shareOpen) return ui.closeMenu();
    if (!selected) return;
    const { body } = selected.note;
    // Copied and downloaded as what it's written in, even while that language's plugin is off.
    const language = plugins.ownLanguage(selected.note.format);
    const source = language.copyAs?.name ?? language.name;
    const title = selected.meta.title || t("list.untitled");
    const items: MenuItem[] = [];
    if (typeof navigator.share === "function") {
      items.push(
        { label: t("app.shareSheet"), icon: "share", run: () => void navigator.share({ title, text: language.plainText(body) }).catch(() => {}) },
        "separator",
      );
    }
    items.push(
      { label: t("app.copySource", { language: source }), icon: "copy", run: () => copy(language.copyAs?.text(body) ?? body) },
      { label: t("app.copyPlainText"), icon: "file-text", run: () => copy(language.plainText(body)) },
    );
    const filename = fileName(title);
    items.push(
      "separator",
      {
        label: t("app.downloadSource", { language: source }),
        icon: "download",
        run: () => void saveAndShow(`${filename}.${language.extensions[0]}`, async () => new TextEncoder().encode(language.file(body)), `${language.mimeType};charset=utf-8`),
      },
      // Other files it can be, like a spreadsheet's Excel workbook.
      ...(language.exports ?? []).map((download) => ({
        label: download.label,
        icon: download.icon,
        run: () => void saveAndShow(`${filename}.${download.extension}`, () => download.write(body), download.mimeType),
      })),
    );
    const id = selected.note.id;
    items.push(
      "separator",
      { label: t("app.previewPdf"), icon: "eye", run: () => (ui.pdf = { id }) },
      { label: t("app.exportPdf"), icon: "file-down", run: () => (ui.pdf = { id, action: "export" }) },
      { label: t("app.exportPng"), icon: "image", run: () => (ui.pdf = { id, action: "png" }) },
    );
    if (canPrint) items.push({ label: t("print.print"), icon: "printer", run: () => (ui.pdf = { id, action: "print" }) });
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

  /** A dialog over the notes (Settings, a PDF's preview, a password): the window's shortcuts wait for it to close. */
  const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

  /** ⌘Z right after moving a note to the trash brings it back, even from inside the editor; ⌘+ and ⌘− size the text. */
  function onKeydownCapture(event: KeyboardEvent) {
    // A drawing's keys are Excalidraw's (⌘Z undoes a stroke there, not a trashing).
    if ((event.target as HTMLElement).closest?.(".drawing-editor")) return;
    if (textSizeKey(event)) {
      event.stopPropagation();
      return;
    }
    if (modalOpen()) return;
    // ⌘/ (Ctrl+/) lists the keyboard shortcuts, before a note's editor takes it (for comments,
    // which Markdown notes don't use).
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === "/") {
      event.preventDefault();
      event.stopPropagation();
      void openSettings("shortcuts");
      return;
    }
    // ⌘P (Ctrl+P) previews the open note as a PDF, rather than printing the window. In the
    // preview, it prints or saves (PdfPreview.svelte).
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      event.stopPropagation();
      if (selected && !closed) ui.pdf = { id: selected.note.id };
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
   * F6 (⇧F6 back) moves between the sidebar, the note list and the open note, left to right, as
   * in other desktop apps, so the keyboard and screen readers don't have to Tab through every button
   * on the way. Each pane takes focus where it was left: the chosen list, the open note's row, the
   * note's text.
   */
  function cyclePane(back: boolean) {
    const elements = { sidebar: sidebarPane, list: listPane, editor: editorPane };
    const panes = order.map((pane) => elements[pane]).filter((pane) => pane && !pane.inert && pane.offsetParent !== null);
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
    // ⌃⌘L locks lines (Ctrl+Alt+L elsewhere), by key position so other keyboard layouts work too.
    if (event.code === "KeyL" && event.ctrlKey && (isApple ? event.metaKey : event.altKey) && lock.enabled) {
      event.preventDefault();
      void lock.lockNow();
      return;
    }
    if (modalOpen()) return;
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
    } else if (key === "f" && !event.altKey && !event.defaultPrevented && selected && !closed) {
      // ⌘F finds in the open note from anywhere in the window, not only with the cursor in it.
      if (findInPane(editorPane)) event.preventDefault();
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

<!-- `data-sidebar` and `data-first` say which pane leaves room for the Mac app's window buttons (app.css). -->
<div
  class={[
    "app relative grid h-full overflow-hidden",
    narrow ? "grid-cols-[100%_100%]" : "transition-[grid-template-columns] duration-320 ease-sheet",
    // Dragging a pane's edge: the columns follow the pointer at once, and text isn't selected.
    resizing && "cursor-col-resize transition-none! select-none",
  ]}
  data-sidebar={prefs.sidebarSide}
  data-first={first}
  style:--sidebar-w="{sidebarWidth}px"
  style:--list-w="{listWidth}px"
  style:grid-template-areas={grid?.areas}
  style:grid-template-columns={grid?.columns}
>
  <!-- A pane shown in the theme's dark colors (Settings → Theme → Dark panes) has its scheme of its own. -->
  <aside class={sidebarPaneClass} data-pane="sidebar" data-scheme={isDarkPane("sidebar") ? "dark" : undefined} inert={!wide && !ui.sidebarOpen} bind:this={sidebarPane}>
    <Sidebar />
  </aside>

  {#if !wide}
    <button
      class={["absolute inset-0 z-10 bg-scrim transition-opacity duration-320 ease-sheet", ui.sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"]}
      aria-label={t("app.closeSidebar")}
      tabindex="-1"
      onclick={() => (ui.sidebarOpen = false)}
    ></button>
  {/if}

  <!-- On a phone one pane shows at a time; the other is off-screen and out of reach. -->
  <div class={listPaneClass} data-pane="list" data-scheme={isDarkPane("list") ? "dark" : undefined} inert={narrow && !!selected} bind:this={listPane}>
    <NoteList bind:searchInput />
  </div>

  {#if sidebarColumn}
    <PaneResizer
      label={t("app.sidebarWidth")}
      width={sidebarWidth}
      min={PANE_WIDTHS.sidebar.min}
      max={sidebarMax}
      initial={PANE_WIDTHS.sidebar.initial}
      side={prefs.sidebarSide}
      offset={sidebarWidth}
      onresize={(width) => (prefs.sidebarWidth = width)}
      ondrag={(dragging) => (resizing = dragging)}
    />
  {/if}
  {#if listColumn}
    <PaneResizer
      label={t("app.listWidth")}
      width={listWidth}
      min={PANE_WIDTHS.list.min}
      max={listMax}
      initial={PANE_WIDTHS.list.initial}
      side={prefs.listSide}
      offset={listOffset}
      onresize={(width) => (prefs.listWidth = width)}
      ondrag={(dragging) => (resizing = dragging)}
    />
  {/if}

  <main
    class={["editor-pane relative flex min-h-0 min-w-0 bg-surface", narrow ? ["col-start-2", stacked] : "[grid-area:editor]"]}
    inert={narrow && !selected}
    bind:this={editorPane}
    bind:clientWidth={ui.editorWidth}
  >
    <!-- The selected note, and beside it the one opened to the side. -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <header class="toolbar flex h-(--titlebar-h) shrink-0 items-center gap-1 px-3 pt-(--titlebar-pad-top)" data-tauri-drag-region>
        {#if ui.sidebarToggle === "editor" && prefs.sidebarSide === "left"}
          <SidebarToggle />
        {/if}
        {#if narrow}
          <IconButton icon="chevron-left" iconSize={22} label={t("app.backToNotes")} onclick={() => notes.select(null)} />
        {:else if selected || ui.focus}
          <IconButton
            icon={ui.focus ? "minimize-2" : "maximize-2"}
            iconSize={16}
            on={ui.focus}
            label={ui.focus ? t("app.unfocus") : t("app.focus")}
            tooltip={ui.focus ? t("app.unfocusWithKey", { key: focusKey }) : t("app.focusWithKey", { key: focusKey })}
            onclick={() => (ui.focus = !ui.focus)}
          />
        {/if}
        {#if tabs.shown}
          <TabBar />
        {:else}
          <div class="flex-1 self-stretch" data-tauri-drag-region></div>
        {/if}
        {#if selected}
          {#if selected.note.trashed}
            <Button variant="quiet" icon="restore" onclick={() => restore(selected.note.id)}>{t("app.restore")}</Button>
            <Button variant="danger" onclick={() => deleteForever(selected.note.id)}>{t("app.deleteForever")}</Button>
          {:else}
            {#if canFloat}
              {@const floating = floatingOpen.has(selected.note.id)}
              <IconButton
                icon="picture-in-picture-2"
                iconSize={17}
                on={floating}
                label={floating ? t("app.unfloat") : t("app.float")}
                onclick={() => toggleFloating(selected.note.id)}
              />
            {/if}
            {#if !closed}
              <!-- One button, locked or not, so focus stays on it as it changes. -->
              {@const locked = !!selected.note.locked}
              <IconButton
                icon={locked ? "lock-open" : "lock"}
                iconSize={17}
                open={lockMenuOpen}
                label={locked ? t("app.lockedOpen") : t("app.lockNote")}
                aria-haspopup={locked ? "menu" : undefined}
                aria-expanded={locked ? lockMenuOpen : undefined}
                onclick={locked ? openLockMenu : () => lockedNotes.lockNote(selected.note.id)}
              />
              <IconButton icon="info" iconSize={17} open={!!infoAnchor} label={t("app.info")} aria-expanded={!!infoAnchor} onclick={toggleInfo} />
              <IconButton
                icon="share"
                iconSize={17}
                open={shareOpen}
                label={t("app.share")}
                aria-haspopup="menu"
                aria-expanded={shareOpen}
                onclick={openShare}
              />
            {/if}
            <IconButton
              icon={selected.note.pinned ? "pin-off" : "pin"}
              iconSize={17}
              on={selected.note.pinned}
              label={selected.note.pinned ? t("app.unpin") : t("app.pin")}
              onclick={() => togglePin(selected.note.id, selected.note.pinned)}
            />
            <IconButton icon="trash" iconSize={17} label={t("app.trash")} onclick={() => trash(selected.note.id)} />
          {/if}
        {/if}
        {#if ui.sidebarToggle === "editor" && prefs.sidebarSide === "right"}
          <SidebarToggle />
        {/if}
      </header>

      {#if selected}
        <!-- The editor stays, out of sight, so other notes keep their undo history and place. -->
        <div class="min-h-0 flex-1" hidden={closed}>
          <Editor noteId={selected.note.id} trashed={selected.note.trashed || closed} />
        </div>
        {#if closed}
          {#key selected.note.id}
            <LockedNoteView entry={selected} />
          {/key}
        {/if}
      {:else if notes.loadError}
        <div class={placeholder}>
          <Icon name="circle-alert" size={36} strokeWidth={1.25} />
          <p class="m-0 text-md" role="alert">{t("app.loadError", { error: notes.loadError })}</p>
        </div>
      {:else if notes.ready}
        <div class={placeholder}>
          <Icon name="feather" size={36} strokeWidth={1.25} />
          <p class="m-0 text-md">{t("app.noSelection")}</p>
          <Button variant="quiet" onclick={() => notes.create()}>
            {t("list.newNote")} <kbd class="ml-1.5 font-[inherit] text-xs text-faint">{newNoteKey}</kbd>
          </Button>
        </div>
      {/if}
    </div>
    {#if beside}
      <PaneResizer
        label={t("app.sideWidth")}
        width={sideWidth}
        min={PANE_WIDTHS.side.min}
        max={sideMax}
        initial={PANE_WIDTHS.side.initial}
        side="right"
        offset={sideWidth}
        onresize={(width) => (prefs.sideWidth = width)}
        ondrag={(dragging) => (resizing = dragging)}
      />
      <div class="flex min-h-0 shrink-0" style:width="{sideWidth}px">
        <SideNote id={beside.note.id} />
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
    <PdfPreview entry={notes.get(ui.pdf.id)!} action={ui.pdf.action} onclose={() => (ui.pdf = null)} />
  {/key}
{/if}
<ContextMenu />
<IconPicker />
<TagPrompt />
