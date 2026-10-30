<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { formatDate } from "../format";
  import { t } from "../i18n/index.svelte";
  import { lock } from "../lock/lock.svelte";
  import { typeLabel } from "../notes/properties";
  import { notes } from "../notes/store.svelte";
  import { typeIcons } from "../notes/tagIcons.svelte";
  import { menuPoint } from "../popover";
  import { longPress } from "../longPress";
  import { isSite, openExternal } from "../platform";
  import { sync } from "../sync/engine.svelte";
  import type { Filter } from "../notes/types";
  import { ui } from "../ui.svelte";
  import { openSettings } from "../windows/settings.svelte";
  import TagTree from "./TagTree.svelte";
  import { GITHUB_MARK, REPO, VERSION } from "../release";

  const sections: { filter: Filter; label: string; icon: IconName; count: () => number }[] = [
    { filter: { kind: "all" }, label: t("sidebar.notes"), icon: "notes", count: () => notes.counts.all },
    { filter: { kind: "todo" }, label: t("sidebar.todo"), icon: "square-check", count: () => notes.counts.todo },
    { filter: { kind: "untagged" }, label: t("sidebar.untagged"), icon: "tag", count: () => notes.counts.untagged },
    { filter: { kind: "trash" }, label: t("sidebar.trash"), icon: "trash", count: () => notes.counts.trash },
  ];

  const syncLabel = $derived.by(() => {
    switch (sync.status) {
      case "off":
        return isSite ? t("sidebar.saveToFolder") : t("sidebar.setUpSync");
      case "syncing":
        return t("sidebar.syncing");
      case "offline":
        return t("sidebar.offline");
      case "error":
        return t("sidebar.syncProblem");
      default:
        if (isSite) return sync.lastSynced ? t("sidebar.savedAt", { date: formatDate(sync.lastSynced) }) : t("sidebar.savingToFolder");
        return sync.lastSynced ? t("sidebar.syncedAt", { date: formatDate(sync.lastSynced) }) : t("sidebar.syncOn");
    }
  });

  function choose(filter: Filter) {
    notes.setFilter(filter);
    ui.closeDrawer();
  }

  /** The type whose menu is open, outlined like a right-clicked note. */
  let typeMenuFor = $state<string | null>(null);
  /** The type being renamed in place, and the name typed so far. */
  let renamingType = $state<string | null>(null);
  let typeDraft = $state("");

  function finishTypeRename() {
    const from = renamingType;
    renamingType = null;
    const to = typeDraft.trim();
    if (!from || !to || to.toLowerCase() === from) return;
    notes.renameType(from, to);
    typeIcons.rename(from, to.toLowerCase());
  }

  /** Only what a type can be called: letters, digits, spaces, `-` and `_`. */
  function onTypeInput(event: Event & { currentTarget: HTMLInputElement }) {
    event.currentTarget.value = typeDraft = event.currentTarget.value.replace(/[^\p{L}\p{N} _-]/gu, "");
  }

  function onTypeRenameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      if (event.key === "Escape") typeDraft = renamingType ?? "";
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  const focusAndSelect = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };

  function showTypeMenu(type: string, x: number, y: number) {
    typeMenuFor = type;
    ui.openMenu({
      x,
      y,
      label: typeLabel(type),
      items: [
        {
          label: t("sidebar.rename"),
          icon: "pencil",
          run: () => {
            renamingType = type;
            typeDraft = type;
          },
        },
        {
          label: t("sidebar.changeIcon"),
          icon: "smile",
          run: () =>
            (ui.iconPicker = {
              key: `type:${type}`,
              label: typeLabel(type),
              fallback: typeIcons.get(type),
              icon: () => typeIcons.chosen(type) ?? null,
              set: (icon) => typeIcons.set(type, icon),
              x,
              y,
            }),
        },
      ],
      onclose: () => (typeMenuFor = null),
    });
  }

  function onTypeContextMenu(event: MouseEvent, type: string) {
    event.preventDefault();
    // Android also fires this after a long press, when the menu is already up.
    if (typeMenuFor === type) return;
    const { x, y } = menuPoint(event);
    showTypeMenu(type, x, y);
  }
</script>

<nav class="sidebar" aria-label={t("sidebar.label")}>
  <header class="titlebar" data-tauri-drag-region>
    <button class="icon-button" onclick={() => ui.toggleSidebar()} aria-label={t("sidebar.hide")} title={t("sidebar.hide")}>
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

    {#if notes.types.length}
      <h2 class="heading" id="sidebar-types">{t("sidebar.types")}</h2>
      <ul class="types" aria-labelledby="sidebar-types">
        {#each notes.types as { type, count } (type)}
          {@const active = notes.filter.kind === "type" && notes.filter.type === type}
          <li>
            {#if renamingType === type}
              <div class="row renaming">
                <Icon name={typeIcons.get(type)} size={16} strokeWidth={1.75} />
                <input
                  class="label"
                  value={typeDraft}
                  aria-label={t("sidebar.typeName")}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  oninput={onTypeInput}
                  onkeydown={onTypeRenameKeydown}
                  onblur={finishTypeRename}
                  {@attach focusAndSelect}
                />
              </div>
            {:else}
              <button
                class="row"
                class:active
                class:menu-target={typeMenuFor === type || ui.iconPicker?.key === `type:${type}`}
                onclick={() => choose({ kind: "type", type })}
                oncontextmenu={(event) => onTypeContextMenu(event, type)}
                {@attach longPress((x, y) => showTypeMenu(type, x, y))}
                aria-current={active}
              >
                <Icon name={typeIcons.get(type)} size={16} strokeWidth={1.75} />
                <span class="label">{typeLabel(type)}</span>
                <span class="count">{count}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if notes.tagTree.length}
      <h2 class="heading" id="sidebar-tags">{t("sidebar.tags")}</h2>
      <TagTree nodes={notes.tagTree} onchoose={(tag) => choose({ kind: "tag", tag })} labelledby="sidebar-tags" />
    {/if}
  </div>

  <!-- That this is an early version (and which), and where its source is. -->
  <div class="release">
    <span class="stage" title={t("sidebar.alphaHint")}>
      {t("sidebar.alpha", { version: VERSION })}<span class="visually-hidden">. {t("sidebar.alphaHint")}</span>
    </span>
    <button class="icon-button github" onclick={() => openExternal(REPO)} aria-label={t("sidebar.source")} title={t("sidebar.source")}>
      {@html GITHUB_MARK}
    </button>
  </div>

  <footer>
    <button
      class="row sync"
      class:error={sync.status === "error"}
      onclick={() => void openSettings("data")}
      title={sync.error ?? t("sidebar.syncSettings")}
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
      <button class="icon-button" onclick={() => lock.lockNow()} aria-label={t("sidebar.lock")} title={t("sidebar.lock")}>
        <Icon name="lock" size={16} />
      </button>
    {/if}
    <button class="icon-button" onclick={() => void openSettings("theme")} aria-label={t("sidebar.settings")} title={t("sidebar.settings")}>
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

  .release {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
    padding: 4px 10px 6px 16px;
  }

  /* A quiet badge: it's there to be read once, not to shout. */
  .stage {
    padding: 2px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
    cursor: default;
  }

  .github {
    width: 28px;
    height: 28px;
    color: var(--text-faint);
  }

  .github:hover {
    color: var(--text);
  }

  .github :global(svg) {
    width: 16px;
    height: 16px;
  }

  /* Takes the room the buttons beside it leave; a long label (other languages) is cut short, not them. */
  footer .sync {
    flex: 1;
    width: auto;
    min-width: 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  footer .sync.error,
  footer .sync.error :global(.icon) {
    color: var(--danger);
  }

  .sections,
  .types {
    margin-bottom: 18px;
  }

  .types .row {
    -webkit-touch-callout: none;
  }

  .row.menu-target {
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .renaming {
    box-shadow: inset 0 0 0 2px var(--accent-soft);
    background: var(--bg);
  }

  .renaming input {
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    outline: none;
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

  /* With increased contrast, a count on the chosen row keeps 4.5:1 over its darker background. */
  :global(:root[data-contrast="more"]) .sidebar :global(.row.active .count) {
    color: var(--text-muted);
  }

  .sidebar :global(.count) {
    font-size: 12px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  /* Fingers need bigger targets. */
  @media (pointer: coarse) {
    .sidebar :global(.row) {
      height: 44px;
    }
  }
</style>
