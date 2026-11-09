<script lang="ts">
  import { Dialog } from "bits-ui";
  import { SvelteSet } from "svelte/reactivity";
  import { tick, type Component } from "svelte";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { ui } from "../../ui.svelte";
  import { closeSettings } from "../../windows/settings.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import NavItem from "../ui/NavItem.svelte";
  import AboutSection from "./AboutSection.svelte";
  import EditorSection from "./EditorSection.svelte";
  import ExportSection from "./ExportSection.svelte";
  import FloatingSection from "./FloatingSection.svelte";
  import GeneralSection from "./GeneralSection.svelte";
  import LayoutSection from "./LayoutSection.svelte";
  import PaperSection from "./PaperSection.svelte";
  import PluginsSection from "./PluginsSection.svelte";
  import PrivacySection from "./PrivacySection.svelte";
  import { sectionList, sections, type Section, type SettingsGroup, type SettingsSection } from "./sections";
  import ShortcutsSection from "./ShortcutsSection.svelte";
  import SyncSection from "./SyncSection.svelte";
  import TextSection from "./TextSection.svelte";
  import CursorSection from "./CursorSection.svelte";
  import MascotSection from "./MascotSection.svelte";
  import ThemeSection from "./ThemeSection.svelte";

  /*
   * Settings: its sections listed down the side, some under a heading (Appearance, Data) that opens
   * and closes, and the one chosen beside them, each a few groups of settings. A dialog over the
   * notes, or in the desktop apps the whole of a window of its own. Narrow, the list and a section
   * take turns: choosing a section opens it, and Back returns.
   */

  /** Shown as the whole of the Settings window (desktop apps) rather than as a dialog. */
  let { windowed = false }: { windowed?: boolean } = $props();

  const all = sections();
  const list = sectionList(all);
  const SHOWN: Record<SettingsSection, Component> = {
    general: GeneralSection,
    theme: ThemeSection,
    paper: PaperSection,
    layout: LayoutSection,
    text: TextSection,
    cursor: CursorSection,
    mascot: MascotSection,
    editor: EditorSection,
    floating: FloatingSection,
    plugins: PluginsSection,
    sync: SyncSection,
    privacy: PrivacySection,
    export: ExportSection,
    shortcuts: ShortcutsSection,
    about: AboutSection,
  };

  const current = $derived(all.find((section) => section.id === ui.settings) ?? all[0]);
  const Shown = $derived(SHOWN[current.id]);
  /** Groups closed in the list. One closed over the section showing stands in for it there. */
  const closed = new SvelteSet<SettingsGroup>();
  /** The closed group the section showing is in, if it is in one. */
  const hiding = $derived(
    list.flatMap((entry) => (entry.kind === "group" && closed.has(entry.id) && entry.sections.includes(current) ? [entry.id] : []))[0],
  );

  /** Focus on the section showing in the list, or the closed group it's in; narrow, with the list hidden, on its title. */
  function focusCurrent() {
    const entry = document.getElementById(hiding ? `settings-group-button-${hiding}` : `settings-nav-${current.id}`);
    if (entry?.checkVisibility()) entry.focus();
    else title?.focus();
  }
  /** Narrow: the list is showing rather than a section. */
  let listing = $state(false);
  /** What had focus before Settings opened, to give it back on closing. */
  let opener: HTMLElement | null = null;
  let body = $state<HTMLElement>();
  let title = $state<HTMLElement>();

  // Each section starts at its top, not where the last one was scrolled to.
  $effect(() => {
    void ui.settings;
    if (body) body.scrollTop = 0;
  });

  // The window starts again on the section it's on (it reloads when lines locks or the language changes).
  $effect(() => {
    if (windowed && ui.settings) history.replaceState(null, "", `?section=${ui.settings}`);
  });

  /** Shows a section; narrow, opens it, with focus on its title once the list has gone. */
  async function openSection(id: SettingsSection) {
    ui.settings = id;
    if (!listing) return;
    listing = false;
    await tick();
    focusCurrent();
  }

  /**
   * One stop for Tab, on the section showing: ↑ and ↓ go through the list (headings too), Home and
   * End to its ends, and Enter or Space opens what's there.
   */
  function moveInList(event: KeyboardEvent) {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nav = (event.currentTarget as HTMLElement).closest("nav")!;
    const items = [...nav.querySelectorAll<HTMLElement>("button")].filter((each) => each.checkVisibility());
    const at = items.indexOf(event.currentTarget as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : Math.min(items.length - 1, Math.max(0, at + step));
    items[next]?.focus();
  }

  /** Narrow, back to the list, with focus on the section that was open. */
  async function showList() {
    listing = true;
    await tick();
    focusCurrent();
  }

  function onOpenChange(open: boolean) {
    if (open) return;
    ui.settings = null;
    listing = false;
  }

  function onOpenAutoFocus(event: Event) {
    event.preventDefault();
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Narrow, opened as a whole (on General) rather than on a section asked for, it starts on the list.
    listing = current.id === "general";
    // The section it opened on, rather than the first thing in it, once the list is showing.
    void tick().then(focusCurrent);
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault();
    // The opener may have gone (a menu item).
    if (opener?.isConnected) opener.focus();
    opener = null;
  }

  /** In the window, Esc or ⌘W (Ctrl+W) closes it, as Esc closes the dialog. */
  function onWindowKeydown(event: KeyboardEvent) {
    const closeKey = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "w";
    if (closeKey || (event.key === "Escape" && !event.defaultPrevented)) {
      event.preventDefault();
      void closeSettings();
    }
  }
</script>

<!-- A section in the list: the one showing is the current page. Narrow, a click (or Enter) opens it, the one showing too. -->
{#snippet item(section: Section)}
  <NavItem
    id="settings-nav-{section.id}"
    icon={section.icon}
    label={section.title}
    active={current.id === section.id}
    aria-current={current.id === section.id ? "page" : undefined}
    tabindex={current.id === section.id ? 0 : -1}
    onclick={() => void openSection(section.id)}
    onkeydown={moveInList}
  />
{/snippet}

{#snippet content()}
  <h2 id="settings-title" class="sr-only">{t("settings.title")}</h2>
  <div class="@container flex min-h-0 flex-1">
    <div
      class={[
        "flex w-56 shrink-0 flex-col border-r border-line bg-sidebar @max-[640px]:w-full @max-[640px]:border-r-0",
        !listing && "@max-[640px]:hidden",
      ]}
    >
      <!-- In the window, the top of the list is its title bar, under the window's buttons: drag it to move the window. -->
      <div class="flex h-13 shrink-0 items-center px-5" data-tauri-drag-region={windowed ? "" : undefined}>
        {#if !windowed}
          <span class="flex-1 text-md font-semibold" aria-hidden="true">{t("settings.title")}</span>
          <IconButton class="hidden @max-[640px]:grid" icon="x" label={t("settings.close")} onclick={() => onOpenChange(false)} />
        {/if}
      </div>
      <nav aria-label={t("settings.sections")} class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ul class="flex flex-col gap-0.5">
          {#each list as entry (entry.kind === "group" ? entry.id : entry.section.id)}
            <li class="flex flex-col gap-0.5">
              {#if entry.kind === "section"}
                {@render item(entry.section)}
              {:else}
                {@const open = !closed.has(entry.id)}
                <NavItem
                  id="settings-group-button-{entry.id}"
                  icon={entry.icon}
                  label={entry.title}
                  active={hiding === entry.id}
                  aria-expanded={open}
                  aria-controls="settings-group-{entry.id}"
                  tabindex={hiding === entry.id ? 0 : -1}
                  onclick={() => (open ? closed.add(entry.id) : closed.delete(entry.id))}
                  onkeydown={moveInList}
                >
                  {#snippet trailing()}
                    <Icon name="chevron-down" size={14} class="shrink-0 transition-transform duration-150 {open ? '' : '-rotate-90'}" />
                  {/snippet}
                </NavItem>
                <ul id="settings-group-{entry.id}" class={["flex flex-col gap-0.5", !open && "hidden"]}>
                  {#each entry.sections as section (section.id)}
                    <li>{@render item(section)}</li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>
    </div>

    <div class={["flex min-w-0 flex-1 flex-col bg-panel", listing && "@max-[640px]:hidden"]}>
      <header class="flex h-13 shrink-0 items-center gap-1 px-3" data-tauri-drag-region={windowed ? "" : undefined}>
        <IconButton class="hidden @max-[640px]:grid" icon="chevron-left" label={t("settings.back")} onclick={showList} />
        <h2 bind:this={title} id="settings-section-title" tabindex="-1" class="m-0 min-w-0 flex-1 truncate px-2 text-md font-semibold outline-none">
          {current.title}
        </h2>
        {#if !windowed}
          <IconButton icon="x" label={t("settings.close")} onclick={() => onOpenChange(false)} />
        {/if}
      </header>
      <!-- Positioned, so text hidden for screen readers (position: absolute) scrolls with it rather than stretching it. -->
      <div bind:this={body} class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain select-text">
        <section aria-labelledby="settings-section-title" class="mx-auto flex max-w-[680px] flex-col gap-7 px-6 pt-1 pb-8 @max-[640px]:px-4">
          {#if current.about}<p class="m-0 -mb-2 px-1 text-sm leading-normal text-muted">{current.about}</p>{/if}
          <Shown />
        </section>
      </div>
    </div>
  </div>
{/snippet}

<svelte:window onkeydown={windowed ? onWindowKeydown : undefined} />

{#if windowed}
  <main class="flex h-dvh overflow-hidden bg-panel text-fg" aria-labelledby="settings-title">
    {@render content()}
  </main>
{:else}
  <Dialog.Root open={!!ui.settings} {onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay class="fixed inset-0 z-40 bg-scrim" />
      <!-- Pinned near the top instead of centered, and one height, so changing sections doesn't make it jump. -->
      <Dialog.Content
        {onOpenAutoFocus}
        {onCloseAutoFocus}
        aria-labelledby="settings-title"
        class="ui-dialog fixed top-[max(16px,9dvh)] left-1/2 z-50 flex h-[min(680px,calc(100dvh-max(16px,9dvh)-16px))] w-[min(900px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-panel text-fg shadow-dialog outline-none animate-pop-in"
      >
        {@render content()}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}
