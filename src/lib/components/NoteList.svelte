<script lang="ts" module>
  /** Today's date, so "Today" and "Yesterday" roll over at midnight, even if the app sits idle. */
  let today = $state(new Date().toDateString());

  function tick() {
    today = new Date().toDateString();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    setTimeout(tick, midnight.getTime() - Date.now() + 1000);
  }
  tick();
  // Timers stall while a laptop sleeps.
  document.addEventListener("visibilitychange", () => (today = new Date().toDateString()));
</script>

<script lang="ts">
  import { flushSync, untrack } from "svelte";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { typeLabel } from "../notes/properties";
  import { notes } from "../notes/store.svelte";
  import { isApple, newNoteKey } from "../platform";
  import { deletePicked, pinPicked, restorePicked, tagPicked, trashPicked } from "../notes/picked";
  import { prefs } from "../prefs.svelte";
  import { ui } from "../ui.svelte";
  import { ListWindow } from "./listWindow.svelte";
  import NoteRow from "./NoteRow.svelte";
  import SidebarToggle from "./SidebarToggle.svelte";
  import IconButton from "./ui/IconButton.svelte";

  let { searchInput = $bindable() }: { searchInput?: HTMLInputElement } = $props();

  const title = $derived.by(() => {
    const f = notes.filter;
    if (f.kind === "tag") return `#${f.tag}`;
    if (f.kind === "type") return typeLabel(f.type);
    return { all: t("sidebar.notes"), todo: t("sidebar.todo"), untagged: t("sidebar.untagged"), trash: t("sidebar.trash") }[f.kind];
  });

  /**
   * Which row Tab lands on: the open note's, else the first. The others are reached with the arrow
   * keys, so the list is one stop on the way through the app rather than one per note.
   */
  const tabStop = $derived(Math.max(0, notes.visible.findIndex((e) => e.note.id === notes.selectedId)));

  // Screen readers hear how many notes a search finds, once typing pauses.
  $effect(() => {
    if (!notes.query.trim()) return;
    const count = notes.visible.length;
    const timer = setTimeout(() => speak(t("list.results", { count })), 700);
    return () => clearTimeout(timer);
  });

  function emptyTrash() {
    void notes.emptyTrash();
    speak(t("list.trashEmptied"));
    // Its button goes with the notes; the search field is what's left to hold focus.
    searchInput?.focus();
  }

  // Only a new day re-renders the rows' dates; a new Date for each edit would redo every row.
  const now = $derived(new Date(today));

  /** The space between rows, where their divider is (the styles below). */
  const ROW_GAP = 6;

  let list: HTMLUListElement;
  /** The row that's swiped open, if any. */
  let swipedId = $state<string | null>(null);

  /**
   * The rows drawn: those in view and some way around, and the one Tab lands on wherever it is, so
   * focus can go to it (Tab, F6, after a note is trashed) and stay on it as the list scrolls.
   */
  const rows = new ListWindow({
    element: () => list,
    items: () => notes.visible,
    key: (entry) => entry.note.id,
    keep: () => tabStop,
    gap: ROW_GAP,
    overscan: 1500,
  });

  // A note opened from elsewhere (a mention, a search, a new note) is shown in the list too.
  $effect(() => {
    const id = notes.selectedId;
    untrack(() => rows.show(notes.visible.findIndex((e) => e.note.id === id)));
  });

  const picked = $derived(notes.pickedEntries);
  const inTrash = $derived(notes.filter.kind === "trash");

  // A new search lets go of the notes picked in the last one.
  $effect(() => {
    void notes.query;
    untrack(() => notes.clearPicks());
  });

  // Screen readers hear how many are picked, once picking pauses.
  $effect(() => {
    const count = picked.length;
    if (count < 2) return;
    const timer = setTimeout(() => speak(t("list.pickedCount", { count })), 400);
    return () => clearTimeout(timer);
  });

  /** Focus on the open note's row, or the row Tab lands on, once the list has redrawn. */
  function focusList() {
    requestAnimationFrame(() => {
      const row = list.querySelector<HTMLElement>(`[data-id="${notes.selectedId}"]`) ?? list.querySelector<HTMLElement>('.item[tabindex="0"]');
      row?.focus({ preventScroll: true });
    });
  }

  /**
   * ↑ and ↓ open the note above or below, Home and End the first and last; with ⇧ they pick every
   * note on the way. ⌘A picks them all, Esc lets them go, and ⌫ moves the picked notes (or the
   * open one) to the Trash.
   */
  function onListKeydown(event: KeyboardEvent) {
    const mod = isApple ? event.metaKey : event.ctrlKey;
    if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      notes.pickAll();
      return;
    }
    if (event.key === "Escape" && notes.picked.size) {
      event.preventDefault();
      notes.clearPicks();
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && !mod && !inTrash) {
      event.preventDefault();
      if (picked.length > 1) trashPicked();
      else if (notes.selectedId) {
        notes.trashMany([notes.selectedId]);
        speak(t("list.didTrash"));
      }
      focusList();
      return;
    }
    const entries = notes.visible;
    const index = entries.findIndex((e) => e.note.id === notes.selectedId);
    let to: number;
    if (event.key === "ArrowDown") to = index + 1;
    else if (event.key === "ArrowUp") to = index - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = entries.length - 1;
    else return;
    event.preventDefault();
    const next = entries[Math.max(0, Math.min(entries.length - 1, to))]?.note.id;
    if (!next) return;
    if (event.shiftKey) notes.pickRange(next);
    else {
      notes.clearPicks();
      notes.select(next);
    }
    // Its row is drawn now, as the one Tab lands on, wherever it is; focus scrolls to it.
    flushSync();
    list.querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus();
  }
</script>

<section class="note-list flex h-full flex-col" aria-labelledby="note-list-title">
  <header class="titlebar flex h-(--titlebar-h) shrink-0 items-center gap-1.5 pt-(--titlebar-pad-top) pr-3 pl-4" data-tauri-drag-region>
    <!-- The sidebar's button, on the sidebar's side. -->
    {#if ui.sidebarToggle === "list" && prefs.sidebarSide === "left"}
      <SidebarToggle />
    {/if}
    <h1 id="note-list-title" class="m-0 min-w-0 flex-1 truncate text-md font-semibold" data-tauri-drag-region>{title}</h1>
    {#if notes.filter.kind !== "trash"}
      <IconButton
        icon="square-pen"
        label={t("list.newNote")}
        tooltip={t("list.newNoteWithKey", { key: newNoteKey })}
        onclick={() => notes.create()}
      />
    {/if}
    {#if ui.sidebarToggle === "list" && prefs.sidebarSide === "right"}
      <SidebarToggle />
    {/if}
  </header>

  <div class="relative mx-3 mt-0.5 mb-2.5 flex items-center text-faint">
    <Icon name="search" size={15} class="pointer-events-none absolute left-2.5" />
    <input
      bind:this={searchInput}
      bind:value={notes.query}
      class="h-[34px] w-full rounded-lg border border-transparent bg-input pr-[30px] pl-8 text-base text-fg outline-none transition-colors focus:border-accent-soft focus:bg-bg coarse:pr-11 [&::-webkit-search-cancel-button]:hidden"
      type="search"
      placeholder={t("list.search")}
      aria-label={t("list.searchLabel")}
      autocomplete="off"
      spellcheck="false"
      onkeydown={(e) => e.key === "Escape" && ((notes.query = ""), e.currentTarget.blur())}
    />
    {#if notes.query}
      <!-- As tall as the field, and wide enough for a finger. -->
      <button
        class="absolute right-[5px] grid size-6 place-items-center rounded-sm text-faint coarse:right-0 coarse:h-[34px] coarse:w-11"
        onclick={() => ((notes.query = ""), searchInput?.focus())}
        aria-label={t("list.clearSearch")}
        title={t("list.clearSearch")}
      >
        <Icon name="x" size={14} />
      </button>
    {/if}
  </div>

  <!-- Several notes picked: how many, and what can be done to them all. -->
  {#if picked.length > 1}
    <div class="mx-3 mb-2 flex items-center gap-0.5 rounded-lg bg-input py-1 pr-1 pl-3" role="toolbar" aria-label={t("list.pickedActions")}>
      <span class="min-w-0 flex-1 truncate text-sm font-semibold">{t("list.pickedCount", { count: picked.length })}</span>
      {#if inTrash}
        <IconButton icon="restore" iconSize={16} label={t("list.restore")} onclick={restorePicked} />
        <IconButton icon="trash" iconSize={16} danger label={t("list.deleteForever")} onclick={deletePicked} />
      {:else}
        {@const pin = picked.some((e) => !e.note.pinned)}
        <IconButton
          icon="hash"
          iconSize={16}
          label={t("list.addTag")}
          onclick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            tagPicked(box.right, box.bottom + 4, "end");
          }}
        />
        <IconButton icon={pin ? "pin" : "pin-off"} iconSize={16} label={pin ? t("list.pin") : t("list.unpin")} onclick={pinPicked} />
        <IconButton
          icon="trash"
          iconSize={16}
          danger
          label={t("list.trash")}
          onclick={() => {
            trashPicked();
            focusList();
          }}
        />
      {/if}
      <IconButton icon="x" iconSize={16} label={t("list.clearPicks")} onclick={() => notes.clearPicks()} />
    </div>
  {/if}

  {#if notes.filter.kind === "trash" && notes.visible.length}
    <div class="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg bg-input px-2.5 py-2 text-xs text-muted">
      <span>{t("list.trashHint")}</span>
      <button class="-my-1 min-h-6 font-semibold whitespace-nowrap text-danger coarse:-my-3 coarse:min-h-11" onclick={emptyTrash}>
        {t("list.emptyTrash")}
      </button>
    </div>
  {/if}

  {#if notes.ready && !notes.visible.length}
    <p class="mx-6 my-8 text-center text-base text-faint">
      {#if notes.query}{t("list.noMatches", { query: notes.query })}{:else if notes.filter.kind === "trash"}{t(
          "list.trashIsEmpty",
        )}{:else}{t("list.noNotes")}{/if}
    </p>
  {/if}

  <!-- The same inset as the search field, so the rows line up under it. The rows not drawn are
       space above and below the drawn ones (the styles below), so it scrolls as far as all of them. -->
  <ul
    class="items relative flex-1 overflow-y-auto overscroll-contain px-3 pb-6 outline-none"
    style:--before="{rows.before}px"
    style:--after="{rows.after}px"
    bind:this={list}
    bind:clientHeight={rows.viewHeight}
    aria-labelledby="note-list-title"
    onscroll={() => {
      swipedId = null;
      rows.scrolled();
    }}
  >
    {#each rows.drawn as { item: entry, index, top } (entry.note.id)}
      {@const id = entry.note.id}
      <NoteRow
        {entry}
        {now}
        {index}
        count={notes.visible.length}
        {top}
        measure={rows.measure(id)}
        selected={id === notes.selectedId}
        picked={notes.picked.has(id)}
        tabbable={index === tabStop}
        open={swipedId === id}
        onswipe={(open) => (swipedId = open ? id : swipedId === id ? null : swipedId)}
        onkeydown={onListKeydown}
      />
    {/each}
  </ul>
</section>

<style>
  /*
   * The space of the rows not drawn. It's in the list's flow, so the browser's scroll anchoring
   * keeps the rows in view still as it changes.
   */
  .items::before,
  .items::after {
    content: "";
    display: block;
  }

  .items::before {
    height: var(--before);
  }

  .items::after {
    height: var(--after);
  }

  /*
   * A gap above every row but the list's first (ROW_GAP), with a divider centered in it, which
   * hides next to a highlighted, swiped or right-clicked row. It's CSS because it depends on the
   * rows beside.
   */
  .items > :global(li:not([aria-posinset="1"])) {
    padding-top: 6px;
  }

  .items > :global(li:not([aria-posinset="1"])::before) {
    content: "";
    position: absolute;
    top: 2.5px;
    left: 12px;
    right: 12px;
    height: 1px;
    background: var(--border);
  }

  .items > :global(li:is(.menu-target, :has(.selected, .swiped))::before),
  .items > :global(li:is(.menu-target, :has(.selected, .swiped)) + li::before) {
    opacity: 0;
  }

  @media (hover: hover) {
    .items > :global(li:has(.item:hover)::before),
    .items > :global(li:has(.item:hover) + li::before) {
      opacity: 0;
    }
  }
</style>
