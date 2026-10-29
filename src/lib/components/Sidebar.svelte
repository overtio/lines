<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { formatDate } from "../format";
  import { lock } from "../lock/lock.svelte";
  import { notes } from "../notes/store.svelte";
  import { isSite } from "../platform";
  import { sync } from "../sync/engine.svelte";
  import type { Filter } from "../notes/types";
  import { ui } from "../ui.svelte";
  import TagTree from "./TagTree.svelte";

  const sections: { filter: Filter; label: string; icon: IconName; count: () => number }[] = [
    { filter: { kind: "all" }, label: "Notes", icon: "notes", count: () => notes.counts.all },
    { filter: { kind: "todo" }, label: "Todo", icon: "square-check", count: () => notes.counts.todo },
    { filter: { kind: "untagged" }, label: "Untagged", icon: "tag", count: () => notes.counts.untagged },
    { filter: { kind: "trash" }, label: "Trash", icon: "trash", count: () => notes.counts.trash },
  ];

  const syncLabel = $derived.by(() => {
    switch (sync.status) {
      case "off":
        return isSite ? "Save to a folder" : "Set up sync";
      case "syncing":
        return "Syncing…";
      case "offline":
        return "Offline";
      case "error":
        return "Sync problem";
      default:
        if (isSite) return sync.lastSynced ? `Saved ${formatDate(sync.lastSynced)}` : "Saving to a folder";
        return sync.lastSynced ? `Synced ${formatDate(sync.lastSynced)}` : "Sync on";
    }
  });

  function choose(filter: Filter) {
    notes.setFilter(filter);
    ui.closeDrawer();
  }
</script>

<nav class="sidebar" aria-label="Library">
  <header class="titlebar" data-tauri-drag-region>
    <button class="icon-button" onclick={() => ui.toggleSidebar()} aria-label="Hide sidebar" title="Hide sidebar">
      <Icon name="panel-left" size={18} />
    </button>
  </header>

  <div class="scroll">
    <ul class="sections">
      {#each sections as section (section.label)}
        {@const active = notes.filter.kind === section.filter.kind}
        <li>
          <button class="row" class:active onclick={() => choose(section.filter)} aria-current={active}>
            <Icon name={section.icon} size={17} strokeWidth={1.75} />
            <span class="label">{section.label}</span>
            {#if section.count()}<span class="count">{section.count()}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>

    {#if notes.tagTree.length}
      <h2 class="heading">Tags</h2>
      <TagTree nodes={notes.tagTree} onchoose={(tag) => choose({ kind: "tag", tag })} />
    {/if}
  </div>

  <footer>
    <button
      class="row sync"
      class:error={sync.status === "error"}
      onclick={() => (ui.settings = "sync")}
      title={sync.error ?? "Sync settings"}
    >
      {#if sync.status === "syncing"}
        <Icon name="loader" size={16} class="spin" />
      {:else if sync.status === "error"}
        <Icon name="cloud-alert" size={16} />
      {:else if isSite && sync.status === "off"}
        <Icon name="folder" size={16} />
      {:else if sync.status === "off" || sync.status === "offline"}
        <Icon name="cloud-off" size={16} />
      {:else}
        <Icon name="cloud-check" size={16} />
      {/if}
      <span class="label">{syncLabel}</span>
    </button>
    {#if lock.enabled}
      <button class="icon-button" onclick={() => lock.lockNow()} aria-label="Lock lines" title="Lock lines">
        <Icon name="lock" size={16} />
      </button>
    {/if}
    <button class="icon-button" onclick={() => (ui.settings = "appearance")} aria-label="Settings" title="Settings">
      <Icon name="settings" size={17} />
    </button>
  </footer>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--text-sidebar);
  }

  .titlebar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: var(--titlebar-h);
    padding: var(--titlebar-pad-top) 10px 0;
    flex-shrink: 0;
  }

  .scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 10px 24px;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    padding: 8px 10px calc(10px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
  }

  footer .sync {
    font-size: 13px;
    color: var(--text-muted);
  }

  footer .sync.error,
  footer .sync.error :global(.icon) {
    color: var(--danger);
  }

  .sections {
    margin-bottom: 18px;
  }

  .heading {
    margin: 0 10px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .sidebar :global(.row) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    color: inherit;
    font-size: 14px;
    text-align: left;
    transition: background-color 120ms ease;
  }

  /* A small gap so neighboring highlights never touch, including nested tags. */
  .sidebar :global(li + li),
  .sidebar :global(li > ul) {
    margin-top: 2px;
  }

  @media (hover: hover) {
    .sidebar :global(.row:hover) {
      background: var(--hover);
    }
  }

  .sidebar :global(.row.active) {
    background: var(--active);
    color: var(--text);
  }

  .sidebar :global(.row .icon) {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .sidebar :global(.row.active .icon) {
    color: var(--accent);
  }

  .sidebar :global(.label) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar :global(.count) {
    font-size: 12px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>
