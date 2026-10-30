<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { t } from "../i18n/index.svelte";
  import { ui, type SettingsTab } from "../ui.svelte";
  import AboutPanel from "./AboutPanel.svelte";
  import AppearancePanel from "./AppearancePanel.svelte";
  import DataPanel from "./DataPanel.svelte";
  import PrivacyPanel from "./PrivacyPanel.svelte";
  import ShortcutsPanel from "./ShortcutsPanel.svelte";
  import SyncPanel from "./SyncPanel.svelte";
  import TextPanel from "./TextPanel.svelte";
  import { closeSettings } from "../windows/settings.svelte";

  /** Shown as the whole of the Settings window (desktop apps) rather than as a dialog. */
  let { windowed = false }: { windowed?: boolean } = $props();

  let dialog = $state<HTMLDialogElement>();
  /** What had focus before Settings opened, to give it back on closing. */
  let opener: HTMLElement | null = null;

  const tabs: { id: SettingsTab; label: string; icon: IconName }[] = [
    { id: "theme", label: t("settings.tabTheme"), icon: "palette" },
    { id: "text", label: t("settings.tabText"), icon: "type" },
    { id: "data", label: t("settings.tabData"), icon: "hard-drive" },
    { id: "shortcuts", label: t("shortcuts.tab"), icon: "keyboard" },
    { id: "about", label: t("settings.tabAbout"), icon: "info" },
  ];

  $effect(() => {
    if (!dialog) return;
    if (ui.settings && !dialog.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      // The tab it opened on, rather than whatever the browser picks first.
      document.getElementById(`settings-tab-${ui.settings}`)?.focus();
    } else if (!ui.settings && dialog.open) dialog.close();
  });

  let body = $state<HTMLElement>();

  // Each tab starts at its top, not where the last one was scrolled to.
  $effect(() => {
    void ui.settings;
    if (body) body.scrollTop = 0;
  });

  // The window starts again on the tab it's on (it reloads when lines locks or the language changes).
  $effect(() => {
    if (windowed && ui.settings) history.replaceState(null, "", `?tab=${ui.settings}`);
  });

  /** In the window, Esc or ⌘W (Ctrl+W) closes it, as Esc closes the dialog. */
  function onWindowKeydown(event: KeyboardEvent) {
    const closeKey = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "w";
    if (closeKey || (event.key === "Escape" && !event.defaultPrevented)) {
      event.preventDefault();
      void closeSettings();
    }
  }

  /** On the backdrop: an event there lands on the dialog itself, outside its box. */
  function onBackdrop(event: MouseEvent) {
    if (!dialog || event.target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  }

  /** Pressed on the backdrop, so a click there closes Settings (not a selection dragged out of it). */
  let pressedOutside = false;

  function onpointerdown(event: PointerEvent) {
    pressedOutside = onBackdrop(event);
  }

  function onclick(event: MouseEvent) {
    if (pressedOutside && onBackdrop(event)) ui.settings = null;
    pressedOutside = false;
  }

  function onclose() {
    ui.settings = null;
    // Not every browser gives focus back by itself; the opener may also have gone (a menu item).
    if (opener?.isConnected) opener.focus();
    opener = null;
  }

  /** Arrow keys move between tabs, as in a native tab bar; Home and End go to the first and last. */
  function onTabKeydown(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === ui.settings);
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = tabs[(target + tabs.length) % tabs.length];
    ui.settings = next.id;
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  }

  const FOCUSABLE = "button, input, select, textarea, a[href], [tabindex]";

  /**
   * Tab wraps around inside Settings instead of leaving it: the page behind is out of reach while
   * it's open, and the Mac app's web view would otherwise send focus nowhere.
   */
  function onDialogKeydown(event: KeyboardEvent) {
    if (event.key !== "Tab" || !dialog) return;
    const stops = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled && element.getClientRects().length > 0,
    );
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#snippet content()}
  <h2 id="settings-title" class="visually-hidden">{t("settings.title")}</h2>
  <!-- In the window, the row of tabs is its title bar: drag it (not a tab) to move the window. -->
  <header data-tauri-drag-region={windowed ? "" : undefined}>
    <div class="tabs" role="tablist" tabindex="-1" onkeydown={onTabKeydown}>
      {#each tabs as tab (tab.id)}
        <button
          role="tab"
          id="settings-tab-{tab.id}"
          aria-controls="settings-panel"
          aria-selected={ui.settings === tab.id}
          tabindex={ui.settings === tab.id ? 0 : -1}
          class:active={ui.settings === tab.id}
          onclick={() => (ui.settings = tab.id)}
        >
          <Icon name={tab.icon} size={15} />
          <span class="tab-label">{tab.label}</span>
        </button>
      {/each}
    </div>
    {#if !windowed}
      <button class="icon-button close" onclick={() => (ui.settings = null)} aria-label={t("settings.close")} title={t("settings.close")}>
        <Icon name="x" size={18} />
      </button>
    {/if}
  </header>

  <div class="body" bind:this={body} role="tabpanel" id="settings-panel" aria-labelledby="settings-tab-{ui.settings}">
    {#if ui.settings === "theme"}
      <AppearancePanel />
    {:else if ui.settings === "text"}
      <TextPanel />
    {:else if ui.settings === "data"}
      <section aria-labelledby="settings-sync">
        <h3 id="settings-sync" tabindex="-1">{t("settings.sync")}</h3>
        <SyncPanel />
      </section>
      <PrivacyPanel />
      <DataPanel />
    {:else if ui.settings === "shortcuts"}
      <ShortcutsPanel />
    {:else if ui.settings === "about"}
      <AboutPanel />
    {/if}
  </div>
{/snippet}

<svelte:window onkeydown={windowed ? onWindowKeydown : undefined} />

{#if windowed}
  <main class="window" aria-labelledby="settings-title">
    {@render content()}
  </main>
{:else}
  <dialog bind:this={dialog} {onclose} {onpointerdown} {onclick} onkeydown={onDialogKeydown} aria-modal="true" aria-labelledby="settings-title">
    {@render content()}
  </dialog>
{/if}

<style>
  dialog {
    width: min(680px, calc(100vw - 32px));
    /* Pinned near the top instead of centered, so switching tabs doesn't make it jump. */
    margin: max(16px, 9dvh) auto auto;
    max-height: calc(100dvh - max(16px, 9dvh) - 16px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--shadow-dialog);
    user-select: text;
    -webkit-user-select: text;
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
    /* Only the panel scrolls, never the dialog around it (a second scrollbar). */
    overflow: hidden;
  }

  dialog::backdrop {
    background: var(--scrim);
  }

  /* The Settings window: the panels fill it, and only they scroll. */
  .window {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    overflow: hidden;
    background: var(--bg-elevated);
    color: var(--text);
    user-select: text;
    -webkit-user-select: text;
  }

  .window header {
    padding: 14px 20px 0;
  }

  /* The Mac app draws its window buttons over the top left corner. */
  :global([data-platform="mac-app"]) .window header {
    padding: 14px 20px 0 84px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 12px 0 20px;
  }

  /* Tabs that don't fit on one row (six of them, or longer names in other languages) wrap to a second rather than being cut off. */
  .tabs {
    display: flex;
    flex-wrap: wrap;
    min-width: 0;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--input);
  }

  .tabs button {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 11px;
    border-radius: 8px;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .tabs button.active {
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--shadow-segment);
  }

  .body {
    /* Shrinks to the dialog, so it scrolls; positioned, so text hidden for screen readers
       (position: absolute) scrolls with it rather than stretching the dialog. */
    flex: 1;
    min-height: 0;
    position: relative;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px 20px 20px;
  }

  /* Shared by the panels. */
  .body :global(section + section) {
    margin-top: 22px;
  }

  .body :global(h3) {
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .body :global(.primary) {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 16px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 13px;
    font-weight: 600;
  }

  .body :global(button:disabled) {
    opacity: var(--disabled-opacity);
  }

  /* A labelled slider with its value on the right. */
  .body :global(.slider) {
    display: grid;
    grid-template-columns: 136px 1fr 48px;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .body :global(.slider input) {
    width: 100%;
    accent-color: var(--accent);
  }

  .body :global(.slider output) {
    text-align: right;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 480px) {
    .body :global(.slider) {
      grid-template-columns: 1fr 48px;
    }

    .body :global(.slider .label) {
      grid-column: 1 / -1;
      margin-bottom: -6px;
    }
  }

  /* Explanations, and the fainter small print under a setting. */
  .body :global(.prose),
  .body :global(.note) {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .body :global(.prose) {
    margin-bottom: 12px;
  }

  .body :global(.note) {
    color: var(--text-faint);
  }

  .body :global(section > .note) {
    margin-top: 8px;
  }

  /* An error (or success) after an action, such as connecting or importing. */
  .body :global(.message) {
    margin: 0;
    padding: 9px 12px;
    border-radius: 9px;
    font-size: 13px;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }

  .body :global(.message.ok) {
    background: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  /* A form's buttons: Disconnect and the like on the left, the rest pushed right from `.push`. */
  .body :global(.form-footer) {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .body :global(.form-footer .push) {
    margin-left: auto;
  }

  /* A checkbox with its label. */
  .body :global(.check) {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    font-size: 13px;
    color: var(--text);
  }

  .body :global(.check input) {
    accent-color: var(--accent);
  }

  /* Touch screens: targets big enough for a finger. */
  @media (pointer: coarse) {
    .tabs button {
      height: 44px;
    }

    .close {
      width: 44px;
      height: 44px;
    }

    .body :global(.text-button),
    .body :global(.primary) {
      min-height: 44px;
    }

    .body :global(.check) {
      min-height: 44px;
      margin-top: 4px;
    }
  }

  /* Small screens: tabs show just their icons. */
  @media (max-width: 600px) {
    .tabs .tab-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .tabs button {
      padding: 0 11px;
    }
  }
</style>
