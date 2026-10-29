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
  import { slide } from "svelte/transition";
  import Icon from "../icons/Icon.svelte";
  import { notes } from "../notes/store.svelte";
  import { newNoteKey } from "../platform";
  import { ui } from "../ui.svelte";
  import NoteRow from "./NoteRow.svelte";

  let { searchInput = $bindable() }: { searchInput?: HTMLInputElement } = $props();

  const title = $derived.by(() => {
    const f = notes.filter;
    if (f.kind === "tag") return `#${f.tag}`;
    return { all: "Notes", todo: "Todo", untagged: "Untagged", trash: "Trash" }[f.kind];
  });

  // Only a new day re-renders the rows' dates; a new Date for each edit would redo every row.
  const now = $derived(new Date(today));

  let list: HTMLUListElement;
  /** The row that's swiped open, if any. */
  let swipedId = $state<string | null>(null);

  function onListKeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const ids = notes.visible.map((e) => e.note.id);
    const index = ids.indexOf(notes.selectedId ?? "");
    const next = ids[Math.max(0, Math.min(ids.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    notes.select(next);
    list.querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus();
  }
</script>

<section class="note-list" aria-label={title}>
  <header class="titlebar" data-tauri-drag-region>
    {#if !ui.sidebarOpen || ui.layout !== "wide"}
      <button
        class="icon-button"
        onclick={() => ui.toggleSidebar()}
        aria-label="Show sidebar"
        title="Show sidebar"
        transition:slide={{ axis: "x", duration: 200 }}
      >
        <Icon name="panel-left" size={18} />
      </button>
    {/if}
    <h1 data-tauri-drag-region>{title}</h1>
    {#if notes.filter.kind !== "trash"}
      <button class="icon-button" onclick={() => notes.create()} aria-label="New note" title="New note ({newNoteKey})">
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
      placeholder="Search"
      aria-label="Search notes"
      autocomplete="off"
      spellcheck="false"
      onkeydown={(e) => e.key === "Escape" && ((notes.query = ""), e.currentTarget.blur())}
    />
    {#if notes.query}
      <button class="clear" onclick={() => (notes.query = "")} aria-label="Clear search"><Icon name="x" size={14} /></button>
    {/if}
  </div>

  {#if notes.filter.kind === "trash" && notes.visible.length}
    <div class="trash-bar">
      <span>Notes in the trash can be restored.</span>
      <button onclick={() => notes.emptyTrash()}>Empty trash</button>
    </div>
  {/if}

  {#if notes.ready && !notes.visible.length}
    <p class="empty">
      {#if notes.query}No notes match “{notes.query}”.{:else if notes.filter.kind === "trash"}Trash is empty.{:else}No notes yet.{/if}
    </p>
  {/if}

  <ul class="items" bind:this={list} onscroll={() => (swipedId = null)}>
    {#each notes.visible as entry (entry.note.id)}
      {@const id = entry.note.id}
      <NoteRow
        {entry}
        {now}
        selected={id === notes.selectedId}
        open={swipedId === id}
        onswipe={(open) => (swipedId = open ? id : swipedId === id ? null : swipedId)}
        onkeydown={onListKeydown}
      />
    {/each}
  </ul>
</section>

<style>
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
    right: 6px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    color: var(--text-faint);
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
    color: var(--danger);
    font-weight: 600;
    white-space: nowrap;
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
