<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { notes } from "../notes/store.svelte";
  import { menuPoint } from "../popover";
  import { tabs } from "../tabs.svelte";
  import { ui, type MenuItem } from "../ui.svelte";

  /*
   * The tabs (tabs.svelte.ts), in the note's toolbar between its buttons; the space around them
   * moves the window, as the toolbar does. From the keyboard they're one Tab stop: ← and → open
   * the one beside, Home and End the first and last, Delete closes one and Enter keeps a preview.
   */

  let bar = $state<HTMLElement>();

  // Picking a note opens it in a tab, and deleting or trashing one closes it.
  $effect(() => {
    void notes.selectedId;
    void notes.entries;
    void notes.ready;
    untrack(() => tabs.follow());
  });

  // The open tab, when it's off to one side of a full bar.
  $effect(() => {
    const id = notes.selectedId;
    void tabs.list;
    if (id) bar?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  const BAR = "mx-1.5 flex min-w-0 flex-1 items-center gap-0.5 self-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  const titleOf = (id: string) => notes.get(id)?.meta.title || t("list.untitled");

  function showMenu(event: MouseEvent, id: string, preview: boolean) {
    event.preventDefault();
    const { x, y } = menuPoint(event);
    const items: MenuItem[] = [];
    if (preview) items.push({ label: t("app.keepTab"), icon: "pin", run: () => tabs.keep(id) });
    items.push({ label: t("app.closeTab"), icon: "x", run: () => tabs.close(id) });
    if (tabs.list.length > 1) items.push({ label: t("app.closeOtherTabs"), run: () => tabs.closeOthers(id) });
    ui.openMenu({ x, y, label: titleOf(id), items });
  }

  /** After the bar redraws, focus goes to the open tab, or to the note list once the last has closed. */
  const focusOpen = () =>
    requestAnimationFrame(() =>
      (bar?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? document.querySelector<HTMLElement>('.note-list .item[tabindex="0"]'))?.focus(),
    );

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const id = target.closest<HTMLElement>(".tab")?.dataset.id;
    if (!id || target.getAttribute("role") !== "tab") return;
    const ids = tabs.list.map((tab) => tab.id);
    const at = ids.indexOf(id);
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: ids.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      notes.select(ids[(to + ids.length) % ids.length]);
      focusOpen();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      tabs.close(id);
      focusOpen();
    } else if (event.key === "Enter") {
      tabs.keep(id);
    }
  }
</script>

<!-- The bar scrolls sideways when the tabs can't shrink further, without showing a scroll bar. -->
{#if tabs.list.length}
  <div class={BAR} role="tablist" tabindex="-1" aria-label={t("app.tabs")} data-tauri-drag-region bind:this={bar} {onkeydown}>
    {#each tabs.list as tab (tab.id)}
      {@const entry = notes.get(tab.id)}
      {#if entry}
        {@const open = tab.id === notes.selectedId}
        {@const title = entry.meta.title || t("list.untitled")}
        <!-- As wide as its title, up to a point; many tabs shrink together before the bar scrolls. -->
        <div
          class={[
            "tab group flex h-[30px] max-w-[200px] min-w-[72px] flex-[0_1_auto] items-center rounded-md transition-colors",
            open ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
          ]}
          data-id={tab.id}
          role="none"
        >
          <button
            class="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-[inherit] pr-0.5 pl-2.5 text-left text-sm font-medium"
            role="tab"
            aria-selected={open}
            aria-keyshortcuts="Delete"
            aria-label={tab.preview ? t("app.tabPreview", { title }) : title}
            tabindex={open ? 0 : -1}
            title={tab.preview ? t("app.tabPreviewHint", { title }) : title}
            onclick={() => notes.select(tab.id)}
            ondblclick={() => tabs.keep(tab.id)}
            onauxclick={(event) => event.button === 1 && tabs.close(tab.id)}
            oncontextmenu={(event) => showMenu(event, tab.id, tab.preview)}
          >
            {#if entry.note.icon}<Icon name={entry.note.icon} size={14} />{/if}
            <!-- In italics while it's only a preview, until it's kept. -->
            <span class={["truncate", tab.preview && "italic"]}>{title}</span>
          </button>
          <!-- From the keyboard, Delete closes a tab, as screen readers hear from the tab; this button takes no focus. -->
          <button
            class={[
              "mr-[5px] grid size-5 shrink-0 place-items-center rounded-sm text-faint transition-opacity group-hover:opacity-100 hover:bg-hover hover:text-fg coarse:opacity-100",
              open ? "opacity-100" : "opacity-0",
            ]}
            tabindex="-1"
            aria-hidden="true"
            title={t("app.closeTab")}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => tabs.close(tab.id)}
          >
            <Icon name="x" size={12} strokeWidth={2.25} />
          </button>
        </div>
      {/if}
    {/each}
  </div>
{:else}
  <div class={BAR} data-tauri-drag-region></div>
{/if}
