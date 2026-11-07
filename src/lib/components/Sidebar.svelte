<script lang="ts">
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
  import { prefs } from "../prefs.svelte";
  import { sync } from "../sync/engine.svelte";
  import type { Filter } from "../notes/types";
  import { ui } from "../ui.svelte";
  import { openSettings } from "../windows/settings.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import SidebarRow from "./SidebarRow.svelte";
  import TagTree from "./TagTree.svelte";
  import { GITHUB_MARK, REPO, VERSION } from "../release";

  const sections: { filter: Filter; label: string; icon: IconName; count: () => number }[] = [
    { filter: { kind: "all" }, label: t("sidebar.notes"), icon: "notes", count: () => notes.counts.all },
    { filter: { kind: "todo" }, label: t("sidebar.todo"), icon: "square-check", count: () => notes.counts.todo },
    { filter: { kind: "untagged" }, label: t("sidebar.untagged"), icon: "tag", count: () => notes.counts.untagged },
    { filter: { kind: "trash" }, label: t("sidebar.trash"), icon: "trash", count: () => notes.counts.trash },
  ];

  const syncIcon = $derived.by((): IconName => {
    if (sync.status === "syncing") return "loader";
    if (sync.status === "error") return "cloud-alert";
    if (isSite && sync.status === "off") return "folder";
    return sync.status === "off" || sync.status === "offline" ? "cloud-off" : "cloud-check";
  });

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

  /** Renames the type, if it was given a new name; from the keyboard, focus goes back to its row. */
  function finishTypeRename(refocus = false) {
    const from = renamingType;
    renamingType = null;
    if (!from) return;
    const to = typeDraft.trim();
    let type = from;
    if (to && to.toLowerCase() !== from) {
      notes.renameType(from, to);
      typeIcons.rename(from, to.toLowerCase());
      type = to.toLowerCase();
    }
    if (refocus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.sidebar [data-type="${CSS.escape(type)}"]`)?.focus());
  }

  /** Only what a type can be called: letters, digits, spaces, `-` and `_`. */
  function onTypeInput(event: Event & { currentTarget: HTMLInputElement }) {
    event.currentTarget.value = typeDraft = event.currentTarget.value.replace(/[^\p{L}\p{N} _-]/gu, "");
  }

  function onTypeRenameKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") typeDraft = renamingType ?? "";
    finishTypeRename(true);
  }

  const heading = "mx-2.5 mt-0 mb-1.5 text-2xs font-semibold tracking-[0.04em] text-faint uppercase";

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

<nav class="sidebar flex h-full flex-col text-fg-sidebar" aria-label={t("sidebar.label")}>
  <!-- Its hide button is on its inner edge, by the note list or the note. -->
  <header
    class={[
      "titlebar flex h-(--titlebar-h) shrink-0 items-center px-2.5 pt-(--titlebar-pad-top)",
      prefs.sidebarSide === "right" ? "justify-start" : "justify-end",
    ]}
    data-tauri-drag-region
  >
    <IconButton icon={prefs.sidebarSide === "left" ? "panel-left" : "panel-right"} label={t("sidebar.hide")} onclick={() => ui.toggleSidebar()} />
  </header>

  <div class="flex-1 overflow-y-auto overscroll-contain px-2.5 pt-1 pb-6">
    <!-- A small gap between rows, so neighboring highlights never touch. -->
    <ul class="mb-4.5 flex flex-col gap-0.5">
      {#each sections as section (section.label)}
        <li>
          <SidebarRow
            icon={section.icon}
            iconSize={17}
            label={section.label}
            count={section.count()}
            active={notes.filter.kind === section.filter.kind}
            onclick={() => choose(section.filter)}
          />
        </li>
      {/each}
    </ul>

    {#if notes.types.length}
      <h2 class={heading} id="sidebar-types">{t("sidebar.types")}</h2>
      <ul class="mb-4.5 flex flex-col gap-0.5" aria-labelledby="sidebar-types">
        {#each notes.types as { type, count } (type)}
          <li>
            <SidebarRow
              icon={typeIcons.get(type)}
              label={typeLabel(type)}
              {count}
              active={notes.filter.kind === "type" && notes.filter.type === type}
              marked={typeMenuFor === type || ui.iconPicker?.key === `type:${type}`}
              rename={renamingType === type
                ? { value: typeDraft, "aria-label": t("sidebar.typeName"), oninput: onTypeInput, onkeydown: onTypeRenameKeydown, onblur: () => finishTypeRename() }
                : undefined}
              data-type={type}
              onclick={() => choose({ kind: "type", type })}
              oncontextmenu={(event) => onTypeContextMenu(event, type)}
              {@attach longPress((x, y) => showTypeMenu(type, x, y))}
            />
          </li>
        {/each}
      </ul>
    {/if}

    {#if notes.tagTree.length}
      <h2 class={heading} id="sidebar-tags">{t("sidebar.tags")}</h2>
      <TagTree nodes={notes.tagTree} onchoose={(tag) => choose({ kind: "tag", tag })} labelledby="sidebar-tags" />
    {/if}
  </div>

  <!-- That this is an early version (and which), and where its source is. -->
  <div class="flex shrink-0 items-center justify-between gap-2 pt-1 pr-2.5 pb-1.5 pl-4">
    <!-- A quiet badge: it's there to be read once, not to shout. -->
    <span
      class="tabular cursor-default rounded-sm border border-line px-[7px] py-0.5 text-2xs font-semibold tracking-[0.02em] text-faint"
      title={t("sidebar.alphaHint")}
    >
      {t("sidebar.alpha", { version: VERSION })}<span class="sr-only">. {t("sidebar.alphaHint")}</span>
    </span>
    <button
      class="touch-target grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg [&_svg]:size-4"
      onclick={() => openExternal(REPO)}
      aria-label={t("sidebar.source")}
      title={t("sidebar.source")}
    >
      {@html GITHUB_MARK}
    </button>
  </div>

  <footer class="flex shrink-0 items-center gap-1 border-t border-line px-2.5 pt-2 pb-[calc(10px_+_env(safe-area-inset-bottom))]">
    <!-- Takes the room the buttons beside it leave; a long label (other languages) is cut short, not them. -->
    <SidebarRow
      class={["min-w-0 flex-1", sync.status === "error" ? "text-danger" : "text-muted"]}
      icon={syncIcon}
      iconClass={sync.status === "error" ? "shrink-0 text-danger" : sync.status === "syncing" ? "shrink-0 animate-spin text-muted" : undefined}
      label={syncLabel}
      onclick={() => void openSettings("sync")}
      title={sync.error ?? t("sidebar.syncSettings")}
    />
    {#if lock.enabled}
      <IconButton icon="lock" iconSize={16} label={t("sidebar.lock")} onclick={() => lock.lockNow()} />
    {/if}
    <IconButton icon="settings" iconSize={17} label={t("sidebar.settings")} onclick={() => void openSettings()} />
  </footer>
</nav>
