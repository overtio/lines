<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { isApple } from "../platform";
  import Segmented from "./Segmented.svelte";
  import {
    OPACITY,
    prefs,
    sfSymbolsAvailable,
    THEMES,
    windowLookAvailable,
    type Appearance,
    type IconSet,
    type SwipeDirection,
    type WindowButtons,
  } from "../prefs.svelte";
  import { canFloat } from "../windows/floating";

  const appearances: { id: Appearance; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];
  const floatingAppearances: { id: Appearance | "same"; label: string }[] = [{ id: "same", label: "Same" }, ...appearances];

  const iconSets: { id: IconSet; label: string; disabled?: boolean }[] = [
    { id: "lucide", label: "Lucide" },
    { id: "sf", label: "SF Symbols", disabled: !sfSymbolsAvailable },
  ];
  const previewIcons: IconName[] = ["notes", "tag", "pin", "trash"];

  const swipeDirections: { id: SwipeDirection; label: string }[] = [
    { id: "fingers", label: "Follow fingers" },
    { id: "reversed", label: "Reversed" },
  ];
  const windowButtons: { id: WindowButtons; label: string }[] = [
    { id: "hover", label: "On hover" },
    { id: "always", label: "Always" },
  ];

  /** Only shown where there may be a trackpad. */
  const hasPointer = matchMedia("(any-pointer: fine)").matches;
</script>

<section>
  <h3>Theme</h3>
  <div class="themes" role="radiogroup" aria-label="Theme">
    {#each THEMES as theme (theme.id)}
      {@const [bg, sidebar, text, accent] = theme[prefs.dark ? "dark" : "light"]}
      <button
        role="radio"
        aria-checked={prefs.theme === theme.id}
        class="theme"
        class:active={prefs.theme === theme.id}
        onclick={() => (prefs.theme = theme.id)}
      >
        <span class="preview" style:background={bg} style:color={text}>
          <span class="preview-sidebar" style:background={sidebar}>
            <span class="dot" style:background={accent}></span>
          </span>
          <span class="preview-text">
            <span class="line strong"></span>
            <span class="line"></span>
            <span class="line short" style:background={accent}></span>
          </span>
        </span>
        <span class="name">{theme.name}</span>
      </button>
    {/each}
  </div>
</section>

<section>
  <h3>Appearance</h3>
  <Segmented label="Appearance" options={appearances} value={prefs.appearance} onselect={(id) => (prefs.appearance = id)} />
</section>

{#if isApple}
  <section>
    <h3>Icons</h3>
    <Segmented label="Icons" options={iconSets} value={prefs.icons} onselect={(id) => (prefs.icons = id)}>
      {#snippet content(set)}
        <span class="icon-preview">
          {#if !set.disabled}
            {#each previewIcons as name (name)}<Icon {name} size={15} set={set.id} />{/each}
          {/if}
        </span>
        {set.label}
      {/snippet}
    </Segmented>
    {#if !sfSymbolsAvailable}
      <p class="note">SF Symbols are available in the Mac and iPhone apps.</p>
    {/if}
  </section>
{/if}

{#if windowLookAvailable}
  <section>
    <h3>Main window</h3>
    <label class="slider">
      <span class="label">Opacity</span>
      <input type="range" min={OPACITY.min} max={OPACITY.max} step={OPACITY.step} bind:value={prefs.windowOpacity} />
      <output>{Math.round(prefs.windowOpacity * 100)}%</output>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={prefs.windowBlur} />
      Blur what's behind
    </label>
    <p class="note">Below 100% opacity the desktop shows through the window.</p>
  </section>
{/if}

{#if canFloat}
  <section>
    <h3>Floating notes</h3>
    <div class="row-setting">
      <span class="label">Theme</span>
      <div class="swatches" role="radiogroup" aria-label="Floating notes theme">
        <button
          role="radio"
          aria-checked={prefs.floatingTheme === "same"}
          class="same"
          class:active={prefs.floatingTheme === "same"}
          onclick={() => (prefs.floatingTheme = "same")}
          title="Same as the main window">Same</button
        >
        {#each THEMES as theme (theme.id)}
          {@const [bg, , , accent] = theme[prefs.floatingLook.dark ? "dark" : "light"]}
          <button
            role="radio"
            aria-checked={prefs.floatingTheme === theme.id}
            aria-label={theme.name}
            title={theme.name}
            class="swatch"
            class:active={prefs.floatingTheme === theme.id}
            style:background={bg}
            onclick={() => (prefs.floatingTheme = theme.id)}
          >
            <span style:background={accent}></span>
          </button>
        {/each}
      </div>
    </div>
    <div class="row-setting">
      <span class="label">Appearance</span>
      <Segmented
        label="Floating notes appearance"
        options={floatingAppearances}
        value={prefs.floatingAppearance}
        onselect={(id) => (prefs.floatingAppearance = id)}
      />
    </div>
    <label class="slider">
      <span class="label">Opacity</span>
      <input type="range" min={OPACITY.min} max={OPACITY.max} step={OPACITY.step} bind:value={prefs.floatingOpacity} />
      <output>{Math.round(prefs.floatingOpacity * 100)}%</output>
    </label>
    {#if windowLookAvailable}
      <label class="check">
        <input type="checkbox" bind:checked={prefs.floatingBlur} />
        Blur what's behind
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={prefs.floatingBorder} />
        Border and shadow
      </label>
    {/if}
    <div class="row-setting">
      <span class="label">Window buttons</span>
      <Segmented
        label="Window buttons on floating notes"
        options={windowButtons}
        value={prefs.floatingButtons}
        onselect={(id) => (prefs.floatingButtons = id)}
      />
    </div>
    <p class="note">With “On hover”, close, minimize and zoom appear when the pointer nears the top-left corner.</p>
    <label class="check">
      <input type="checkbox" bind:checked={prefs.floatingOverFullscreen} />
      Show over full-screen apps
    </label>
    <p class="note">Floating notes follow you to every desktop. With this on, they also stay visible over apps in full screen.</p>
  </section>
{/if}

{#if hasPointer}
  <section>
    <h3>Trackpad</h3>
    <Segmented
      label="Trackpad swipe direction"
      options={swipeDirections}
      value={prefs.swipe}
      onselect={(id) => (prefs.swipe = id)}
    />
    <p class="note">
      Swipe a note with two fingers to pin or trash it. Choose which way the note moves when you swipe.
    </p>
  </section>
{/if}

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 10px;
  }

  .theme {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 4px 6px;
    border-radius: 12px;
    text-align: center;
  }

  .theme:hover {
    background: var(--hover);
  }

  .preview {
    display: flex;
    height: 64px;
    overflow: hidden;
    border-radius: 9px;
    box-shadow: inset 0 0 0 1px var(--border);
    transition: box-shadow 120ms ease;
  }

  .theme.active .preview {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .preview-sidebar {
    width: 26%;
    padding: 9px 0 0 7px;
  }

  .dot {
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .preview-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 11px 10px;
  }

  .line {
    height: 4px;
    border-radius: 2px;
    background: currentColor;
    opacity: 0.35;
  }

  .line.strong {
    width: 60%;
    opacity: 0.85;
  }

  .line.short {
    width: 40%;
    opacity: 1;
  }

  .name {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .theme.active .name {
    color: var(--text);
  }

  .icon-preview {
    display: flex;
    gap: 5px;
  }

  .row-setting {
    display: grid;
    grid-template-columns: 136px 1fr;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .swatches button {
    height: 26px;
    border-radius: 13px;
    box-shadow: inset 0 0 0 1px var(--border);
    transition: box-shadow 120ms ease;
  }

  .swatches button.active {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .same {
    padding: 0 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--input);
  }

  .same.active {
    color: var(--text);
  }

  .swatch {
    display: grid;
    place-items: center;
    width: 26px;
  }

  .swatch span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
</style>
