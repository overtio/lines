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
  import { untrack } from "svelte";
  import { slide } from "svelte/transition";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { typeLabel } from "../notes/properties";
  import { notes } from "../notes/store.svelte";
  import { isApple, newNoteKey, reducedMotion } from "../platform";
  import { deletePicked, pinPicked, restorePicked, tagPicked, trashPicked } from "../notes/picked";
  import { ui } from "../ui.svelte";
  import NoteRow from "./NoteRow.svelte";

  let { searchInput = $bindable() }: { searchInput?: HTMLInputElement } = $props();

  const title = $derived.by(() => {
    const f = notes.filter;
    if (f.kind === "tag") return `#${f.tag}`;
    if (f.kind === "type") return typeLabel(f.type);
    return { all: t("sidebar.notes"), todo: t("sidebar.todo"), untagged: t("sidebar.untagged"), trash: t("sidebar.trash") }[f.kind];
  });

  /**
   * The row Tab lands on: the open note's, else the first. The others are reached with the arrow
   * keys, so the list is one stop on the way through the app rather than one per note.
   */
  const tabStop = $derived(
    notes.visible.some((e) => e.note.id === notes.selectedId) ? notes.selectedId : (notes.visible[0]?.note.id ?? null),
  );

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

  let list: HTMLUListElement;
  /** The row that's swiped open, if any. */
  let swipedId = $state<string | null>(null);

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
    const ids = notes.visible.map((e) => e.note.id);
    const index = ids.indexOf(notes.selectedId ?? "");
    let to: number;
    if (event.key === "ArrowDown") to = index + 1;
    else if (event.key === "ArrowUp") to = index - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = ids.length - 1;
    else return;
    event.preventDefault();
    const next = ids[Math.max(0, Math.min(ids.length - 1, to))];
    if (!next) return;
    if (event.shiftKey) notes.pickRange(next);
    else {
      notes.clearPicks();
      notes.select(next);
    }
    list.querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus();
  }
</script>

<section class="note-list" aria-labelledby="note-list-title">
  <header class="titlebar" data-tauri-drag-region>
    {#if !ui.sidebarOpen || ui.layout !== "wide"}
      <button
        class="icon-button"
        onclick={() => ui.toggleSidebar()}
        aria-label={t("list.showSidebar")}
        title={t("list.showSidebar")}
        transition:slide={{ axis: "x", duration: reducedMotion.matches ? 0 : 200 }}
      >
        <Icon name="panel-left" size={18} />
      </button>
    {/if}
    <h1 id="note-list-title" data-tauri-drag-region>{title}</h1>
    {#if notes.filter.kind !== "trash"}
      <button
        class="icon-button"
        onclick={() => notes.create()}
        aria-label={t("list.newNote")}
        title={t("list.newNoteWithKey", { key: newNoteKey })}
      >
        <Icon name="square-pen" size={18} />
      </button>
    {/if}
  </header>

  <div class="search">
    <Icon name="search" size={15} />
    <input
      bind:this={searchInput}
      bind:value={notes.query}
      type="search"
      placeholder={t("list.search")}
      aria-label={t("list.searchLabel")}
      autocomplete="off"
      spellcheck="false"
      onkeydown={(e) => e.key === "Escape" && ((notes.query = ""), e.currentTarget.blur())}
    />
    {#if notes.query}
      <button
        class="clear"
        onclick={() => ((notes.query = ""), searchInput?.focus())}
        aria-label={t("list.clearSearch")}
        title={t("list.clearSearch")}
      >
        <Icon name="x" size={14} />
      </button>
    {/if}
  </div>

  {#if picked.length > 1}
    <div class="picked-bar" role="toolbar" aria-label={t("list.pickedActions")}>
      <span class="count">{t("list.pickedCount", { count: picked.length })}</span>
      {#if inTrash}
        <button class="icon-button" onclick={restorePicked} aria-label={t("list.restore")} title={t("list.restore")}>
          <Icon name="restore" size={16} />
        </button>
        <button class="icon-button danger" onclick={deletePicked} aria-label={t("list.deleteForever")} title={t("list.deleteForever")}>
          <Icon name="trash" size={16} />
        </button>
      {:else}
        {@const pin = picked.some((e) => !e.note.pinned)}
        <button
          class="icon-button"
          onclick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            tagPicked(box.right, box.bottom + 4, "end");
          }}
          aria-label={t("list.addTag")}
          title={t("list.addTag")}
        >
          <Icon name="hash" size={16} />
        </button>
        <button class="icon-button" onclick={pinPicked} aria-label={pin ? t("list.pin") : t("list.unpin")} title={pin ? t("list.pin") : t("list.unpin")}>
          <Icon name={pin ? "pin" : "pin-off"} size={16} />
        </button>
        <button
          class="icon-button danger"
          onclick={() => {
            trashPicked();
            focusList();
          }}
          aria-label={t("list.trash")}
          title={t("list.trash")}
        >
          <Icon name="trash" size={16} />
        </button>
      {/if}
      <button class="icon-button" onclick={() => notes.clearPicks()} aria-label={t("list.clearPicks")} title={t("list.clearPicks")}>
        <Icon name="x" size={16} />
      </button>
    </div>
  {/if}

  {#if notes.filter.kind === "trash" && notes.visible.length}
    <div class="trash-bar">
      <span>{t("list.trashHint")}</span>
      <button onclick={emptyTrash}>{t("list.emptyTrash")}</button>
    </div>
  {/if}

  {#if notes.ready && !notes.visible.length}
    <p class="empty">
      {#if notes.query}{t("list.noMatches", { query: notes.query })}{:else if notes.filter.kind === "trash"}{t(
          "list.trashIsEmpty",
        )}{:else}{t("list.noNotes")}{/if}
    </p>
  {/if}

  <ul class="items" bind:this={list} aria-labelledby="note-list-title" onscroll={() => (swipedId = null)}>
    {#each notes.visible as entry (entry.note.id)}
      {@const id = entry.note.id}
      <NoteRow
        {entry}
        {now}
        selected={id === notes.selectedId}
        picked={notes.picked.has(id)}
        tabbable={id === tabStop}
        open={swipedId === id}
        onswipe={(open) => (swipedId = open ? id : swipedId === id ? null : swipedId)}
        onkeydown={onListKeydown}
      />
    {/each}
  </ul>
</section>

<style>
  /* Several notes picked: how many, and what can be done to them all. */
  .picked-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    margin: 0 12px 8px;
    padding: 4px 4px 4px 12px;
    border-radius: 10px;
    background: var(--input);
  }

  .picked-bar .count {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
  }

  .picked-bar .icon-button {
    width: 30px;
    height: 30px;
  }

  .picked-bar .danger {
    color: var(--danger);
  }

  .note-list {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .titlebar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--titlebar-h);
    padding: var(--titlebar-pad-top) 12px 0 16px;
    flex-shrink: 0;
  }

  h1 {
    flex: 1;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
    margin: 2px 12px 10px;
    color: var(--text-faint);
  }

  .search :global(.icon:first-child) {
    position: absolute;
    left: 10px;
    pointer-events: none;
  }

  .search input {
    width: 100%;
    height: 34px;
    padding: 0 30px 0 32px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: var(--input);
    color: var(--text);
    font-size: 14px;
    outline: none;
    transition: border-color 120ms ease, background-color 120ms ease;
  }

  .search input:focus {
    border-color: var(--accent-soft);
    background: var(--bg);
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  .clear {
    position: absolute;
    right: 5px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: var(--text-faint);
  }

  /* As tall as the field, and wide enough for a finger. */
  @media (pointer: coarse) {
    .search input {
      padding-right: 44px;
    }

    .clear {
      right: 0;
      width: 44px;
      height: 34px;
    }
  }

  .trash-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 0 12px 8px;
    padding: 8px 10px;
    border-radius: 9px;
    background: var(--input);
    font-size: 12px;
    color: var(--text-muted);
  }

  .trash-bar button {
    min-height: 24px;
    margin: -4px 0;
    color: var(--danger);
    font-weight: 600;
    white-space: nowrap;
  }

  @media (pointer: coarse) {
    .trash-bar button {
      min-height: 44px;
      margin: -12px 0;
    }
  }

  .empty {
    margin: 32px 24px;
    text-align: center;
    color: var(--text-faint);
    font-size: 14px;
  }

  .items {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Same inset as the search field, so the rows line up under it. */
    padding: 0 12px 24px;
    outline: none;
  }

  /* A gap between rows, so neighboring highlights stand apart. */
  .items > :global(li + li) {
    padding-top: 6px;
  }

  /* Divider, centered in the gap. Lives on the li because content-visibility clips anything outside it. */
  .items > :global(li + li::before) {
    content: "";
    position: absolute;
    top: 2.5px;
    left: 12px;
    right: 12px;
    height: 1px;
    background: var(--border);
  }

  /* Hidden next to a highlighted, swiped or right-clicked row. */
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
