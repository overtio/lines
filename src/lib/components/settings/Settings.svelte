<script lang="ts">
  import { Dialog, Tabs } from "bits-ui";
  import { tick, type Component } from "svelte";
  import { t } from "../../i18n/index.svelte";
  import { ui } from "../../ui.svelte";
  import { closeSettings } from "../../windows/settings.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import NavItem from "../ui/NavItem.svelte";
  import AboutSection from "./AboutSection.svelte";
  import AppearanceSection from "./AppearanceSection.svelte";
  import DataSection from "./DataSection.svelte";
  import EditingSection from "./EditingSection.svelte";
  import GeneralSection from "./GeneralSection.svelte";
  import PluginsSection from "./PluginsSection.svelte";
  import PrivacySection from "./PrivacySection.svelte";
  import { sectionOf, sections, type SettingsSection } from "./sections";
  import ShortcutsSection from "./ShortcutsSection.svelte";
  import SyncSection from "./SyncSection.svelte";
  import TextSection from "./TextSection.svelte";
  import WindowsSection from "./WindowsSection.svelte";

  /*
   * Settings: its sections listed down the side, and the one chosen beside them, each a few groups
   * of settings. A dialog over the notes, or in the desktop apps the whole of a window of its own.
   * Narrow, the list and a section take turns: choosing a section opens it, and Back returns.
   */

  /** Shown as the whole of the Settings window (desktop apps) rather than as a dialog. */
  let { windowed = false }: { windowed?: boolean } = $props();

  const all = sections();
  const SHOWN: Record<SettingsSection, Component> = {
    general: GeneralSection,
    appearance: AppearanceSection,
    windows: WindowsSection,
    text: TextSection,
    editing: EditingSection,
    plugins: PluginsSection,
    sync: SyncSection,
    privacy: PrivacySection,
    data: DataSection,
    shortcuts: ShortcutsSection,
    about: AboutSection,
  };

  const current = $derived(all.find((section) => section.id === ui.settings) ?? all[0]);
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

  /** Narrow, opens the section chosen in the list, with focus on its title once the list has gone. */
  async function openSection(item: HTMLElement) {
    if (!listing) return;
    listing = false;
    await tick();
    if (!item.checkVisibility()) title?.focus();
  }

  /** Narrow, back to the list, with focus on the section that was open. */
  async function showList() {
    listing = true;
    await tick();
    document.getElementById(`settings-nav-${current.id}`)?.focus();
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
    void tick().then(() => document.getElementById(`settings-nav-${current.id}`)?.focus());
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

{#snippet content()}
  <h2 id="settings-title" class="sr-only">{t("settings.title")}</h2>
  <Tabs.Root value={current.id} onValueChange={(id) => (ui.settings = sectionOf(id))} orientation="vertical" class="@container flex min-h-0 flex-1">
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
      <Tabs.List aria-label={t("settings.sections")} class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {#each all as section (section.id)}
          <Tabs.Trigger value={section.id} id="settings-nav-{section.id}">
            {#snippet child({ props })}
              <!-- Narrow, the arrow keys go through the list, and a click (or Enter) opens the section, the one already chosen too. -->
              <NavItem
                {...props}
                icon={section.icon}
                label={section.title}
                active={current.id === section.id}
                onclick={(event) => {
                  (props.onclick as ((event: MouseEvent) => void) | undefined)?.(event);
                  void openSection(event.currentTarget);
                }}
              />
            {/snippet}
          </Tabs.Trigger>
        {/each}
      </Tabs.List>
    </div>

    <div class={["flex min-w-0 flex-1 flex-col bg-panel", listing && "@max-[640px]:hidden"]}>
      <header class="flex h-13 shrink-0 items-center gap-1 px-3" data-tauri-drag-region={windowed ? "" : undefined}>
        <IconButton class="hidden @max-[640px]:grid" icon="chevron-left" label={t("settings.back")} onclick={showList} />
        <h2 bind:this={title} tabindex="-1" class="m-0 min-w-0 flex-1 truncate px-2 text-md font-semibold outline-none">{current.title}</h2>
        {#if !windowed}
          <IconButton icon="x" label={t("settings.close")} onclick={() => onOpenChange(false)} />
        {/if}
      </header>
      <!-- Positioned, so text hidden for screen readers (position: absolute) scrolls with it rather than stretching it. -->
      <div bind:this={body} class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain select-text">
        <Tabs.Content value={current.id} class="mx-auto flex max-w-[680px] flex-col gap-7 px-6 pt-1 pb-8 outline-none @max-[640px]:px-4">
          {@const Shown = SHOWN[current.id]}
          {#if current.about}<p class="m-0 -mb-2 px-1 text-sm leading-normal text-muted">{current.about}</p>{/if}
          <Shown />
        </Tabs.Content>
      </div>
    </div>
  </Tabs.Root>
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
        class="fixed top-[max(16px,9dvh)] left-1/2 z-50 flex h-[min(680px,calc(100dvh-max(16px,9dvh)-16px))] w-[min(900px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-panel text-fg shadow-dialog outline-none animate-pop-in"
      >
        {@render content()}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}
