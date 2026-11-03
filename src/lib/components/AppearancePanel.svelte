<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { plugins } from "../plugins/registry.svelte";
  import Segmented from "./Segmented.svelte";
  import {
    formatPercent,
    OPACITY,
    prefs,
    windowLookAvailable,
    type Appearance,
    type Contrast,
    type SwipeDirection,
    type WindowButtons,
  } from "../prefs.svelte";
  import { canFloat } from "../windows/floating";
  import { LANGUAGES, languageChoice, setLanguage, type LanguageChoice, t } from "../i18n/index.svelte";
  import { notes } from "../notes/store.svelte";

  const appearances: { id: Appearance; label: string }[] = [
    { id: "system", label: t("settings.appearanceSystem") },
    { id: "light", label: t("settings.appearanceLight") },
    { id: "dark", label: t("settings.appearanceDark") },
  ];
  const contrasts: { id: Contrast; label: string }[] = [
    { id: "system", label: t("settings.appearanceSystem") },
    { id: "standard", label: t("settings.contrastStandard") },
    { id: "more", label: t("settings.contrastMore") },
  ];
  const floatingAppearances: { id: Appearance | "same"; label: string }[] = [
    { id: "same", label: t("settings.floatingSame") },
    ...appearances,
  ];

  /** Icon sets from the plugins turned on; one that can't work here (SF Symbols on the web) shows why. */
  const iconSets = $derived(
    plugins.all
      .filter((plugin) => plugins.isOn(plugin))
      .flatMap((plugin) =>
        (plugin.contributes.iconSets ?? []).map(({ id, name }) => ({
          id,
          label: name,
          disabled: !plugins.isActive(plugin),
          availability: plugin.available === false ? plugin.availability : undefined,
        })),
      ),
  );
  const iconsUnavailable = $derived(iconSets.flatMap((set) => set.availability ?? []));
  const previewIcons: IconName[] = ["notes", "tag", "pin", "trash"];

  const swipeDirections: { id: SwipeDirection; label: string }[] = [
    { id: "fingers", label: t("settings.swipeFingers") },
    { id: "reversed", label: t("settings.swipeReversed") },
  ];
  const windowButtons: { id: WindowButtons; label: string }[] = [
    { id: "hover", label: t("settings.windowButtonsHover") },
    { id: "always", label: t("settings.windowButtonsAlways") },
  ];

  const themes = $derived(plugins.themes);
  const themeIds = $derived(themes.map((theme) => theme.id));
  // The accessibility themes come after the others, under their own heading, in the same group.
  const themeGroups = $derived([themes.filter((theme) => !theme.accessible), themes.filter((theme) => theme.accessible)]);
  const floatingThemeIds = $derived(["same", ...themeIds]);
  // What shows: the theme chosen, or Lines while the chosen one's plugin is off.
  const theme = $derived(plugins.theme(prefs.theme).id);
  const floatingTheme = $derived(prefs.floatingTheme === "same" ? "same" : plugins.theme(prefs.floatingTheme).id);

  /**
   * Arrow keys move the choice in a group of radio buttons, wrapping around, as native ones do; Tab
   * reaches only the chosen one (Segmented does the same for its options).
   */
  function moveChoice<T extends string>(event: KeyboardEvent, ids: readonly T[], current: T, choose: (id: T) => void) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = ids[(ids.indexOf(current) + step + ids.length) % ids.length];
    choose(next);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus();
  }

  /** Only shown where there may be a trackpad. */
  const hasPointer = matchMedia("(any-pointer: fine)").matches;

  const languages: { id: LanguageChoice; label: string }[] = [
    { id: "system", label: t("settings.languageSystem") },
    ...LANGUAGES.map(({ id, name }) => ({ id, label: name })),
  ];

  /** Starts lines again in the language chosen, once what's typed is saved. */
  async function chooseLanguage(choice: LanguageChoice) {
    if (choice === languageChoice) return;
    await notes.flush();
    setLanguage(choice);
  }
</script>

<section>
  <h3>{t("settings.language")}</h3>
  <Segmented label={t("settings.language")} options={languages} value={languageChoice} onselect={chooseLanguage} />
  <p class="note">{t("settings.languageNote")}</p>
</section>

<section>
  <h3>{t("settings.theme")}</h3>
  <!-- One group of radio buttons, so Tab stops once and the arrow keys go through every theme. -->
  <div
    class="themes"
    role="radiogroup"
    tabindex="-1"
    aria-label={t("settings.theme")}
    onkeydown={(event) => moveChoice(event, themeIds, theme, (id) => (prefs.theme = id))}
  >
    {#each themeGroups as group, index (index)}
      {#if index > 0 && group.length}
        <h4 class="theme-group">{t("settings.themesAccessibility")}</h4>
      {/if}
      <div class="theme-grid">
        {#each group as option (option.id)}
          {@const { bg, "bg-sidebar": sidebar, text, accent } = option[prefs.dark ? "dark" : "light"]}
          <button
            role="radio"
            data-id={option.id}
            aria-checked={theme === option.id}
            tabindex={theme === option.id ? 0 : -1}
            class="theme"
            class:active={theme === option.id}
            onclick={() => (prefs.theme = option.id)}
          >
            <span class="preview" style:background={bg} style:color={text} aria-hidden="true">
              <span class="preview-sidebar" style:background={sidebar}>
                <span class="dot" style:background={accent}></span>
              </span>
              <span class="preview-text">
                <span class="line strong"></span>
                <span class="line"></span>
                <span class="line short" style:background={accent}></span>
              </span>
            </span>
            <span class="name">{option.name}</span>
          </button>
        {/each}
      </div>
    {/each}
  </div>
  <p class="note">{t("settings.themesAccessibilityNote")}</p>
</section>

<section>
  <h3>{t("settings.appearance")}</h3>
  <Segmented label={t("settings.appearance")} options={appearances} value={prefs.appearance} onselect={(id) => (prefs.appearance = id)} />
</section>

<section>
  <h3>{t("settings.contrast")}</h3>
  <Segmented label={t("settings.contrast")} options={contrasts} value={prefs.contrast} onselect={(id) => (prefs.contrast = id)} />
  <p class="note">{t("settings.contrastNote")}</p>
</section>

{#if iconSets.length > 1}
  <section>
    <h3>{t("settings.icons")}</h3>
    <Segmented label={t("settings.icons")} options={iconSets} value={plugins.iconSet(prefs.icons).id} onselect={(id) => (prefs.icons = id)}>
      {#snippet content(set)}
        <span class="icon-preview">
          {#if !set.disabled}
            {#each previewIcons as name (name)}<Icon {name} size={15} set={set.id} />{/each}
          {/if}
        </span>
        {set.label}
      {/snippet}
    </Segmented>
    {#each iconsUnavailable as availability (availability)}
      <p class="note">{availability}</p>
    {/each}
  </section>
{/if}

{#if windowLookAvailable}
  <section>
    <h3>{t("settings.mainWindow")}</h3>
    <label class="slider">
      <span class="label">{t("settings.opacity")}</span>
      <input
        type="range"
        min={OPACITY.min}
        max={OPACITY.max}
        step={OPACITY.step}
        bind:value={prefs.windowOpacity}
        aria-valuetext={formatPercent(prefs.windowOpacity)}
      />
      <!-- Hidden from screen readers, which hear the value from the slider (and would otherwise hear it twice). -->
      <output aria-hidden="true">{formatPercent(prefs.windowOpacity)}</output>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={prefs.windowBlur} />
      {t("settings.blur")}
    </label>
    <p class="note">{t("settings.opacityNote")}</p>
  </section>
{/if}

{#if canFloat}
  <section>
    <h3>{t("settings.floatingNotes")}</h3>
    <div class="row-setting">
      <span class="label">{t("settings.theme")}</span>
      <div
        class="swatches"
        role="radiogroup"
        tabindex="-1"
        aria-label={t("settings.floatingTheme")}
        onkeydown={(event) => moveChoice(event, floatingThemeIds, floatingTheme, (id) => (prefs.floatingTheme = id))}
      >
        <button
          role="radio"
          data-id="same"
          aria-checked={floatingTheme === "same"}
          tabindex={floatingTheme === "same" ? 0 : -1}
          class="same"
          class:active={floatingTheme === "same"}
          onclick={() => (prefs.floatingTheme = "same")}
          title={t("settings.floatingSameTitle")}>{t("settings.floatingSame")}</button
        >
        {#each themes as option (option.id)}
          {@const { bg, accent } = option[prefs.floatingLook.dark ? "dark" : "light"]}
          <button
            role="radio"
            data-id={option.id}
            aria-checked={floatingTheme === option.id}
            tabindex={floatingTheme === option.id ? 0 : -1}
            aria-label={option.name}
            title={option.name}
            class="swatch"
            class:active={floatingTheme === option.id}
            style:background={bg}
            onclick={() => (prefs.floatingTheme = option.id)}
          >
            <span style:background={accent}></span>
          </button>
        {/each}
      </div>
    </div>
    <div class="row-setting">
      <span class="label">{t("settings.appearance")}</span>
      <Segmented
        label={t("settings.floatingAppearance")}
        options={floatingAppearances}
        value={prefs.floatingAppearance}
        onselect={(id) => (prefs.floatingAppearance = id)}
      />
    </div>
    <label class="slider">
      <span class="label">{t("settings.opacity")}</span>
      <input
        type="range"
        min={OPACITY.min}
        max={OPACITY.max}
        step={OPACITY.step}
        bind:value={prefs.floatingOpacity}
        aria-valuetext={formatPercent(prefs.floatingOpacity)}
      />
      <output aria-hidden="true">{formatPercent(prefs.floatingOpacity)}</output>
    </label>
    {#if windowLookAvailable}
      <label class="check">
        <input type="checkbox" bind:checked={prefs.floatingBlur} />
        {t("settings.blur")}
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={prefs.floatingBorder} />
        {t("settings.floatingBorder")}
      </label>
    {/if}
    <div class="row-setting">
      <span class="label">{t("settings.windowButtons")}</span>
      <Segmented
        label={t("settings.windowButtonsLabel")}
        options={windowButtons}
        value={prefs.floatingButtons}
        onselect={(id) => (prefs.floatingButtons = id)}
      />
    </div>
    <p class="note">{t("settings.windowButtonsNote", { onHover: t("settings.windowButtonsHover") })}</p>
    <label class="check">
      <input type="checkbox" bind:checked={prefs.floatingOverFullscreen} />
      {t("settings.overFullscreen")}
    </label>
    <p class="note">{t("settings.overFullscreenNote")}</p>
  </section>
{/if}

{#if hasPointer}
  <section>
    <h3>{t("settings.trackpad")}</h3>
    <Segmented
      label={t("settings.swipeDirection")}
      options={swipeDirections}
      value={prefs.swipe}
      onselect={(id) => (prefs.swipe = id)}
    />
    <p class="note">{t("settings.swipeNote")}</p>
  </section>
{/if}

<style>
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 10px;
  }

  /* Like the row labels below, so it reads as part of Theme rather than a section of its own. */
  .theme-group {
    margin: 16px 0 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
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

  /* Forced colors (Windows' contrast themes): the previews show each theme's own colors, and the chosen one an outline for its ring. */
  @media (forced-colors: active) {
    .preview,
    .swatch {
      forced-color-adjust: none;
    }

    .theme.active .preview {
      outline: 2px solid HighlightText;
    }

    .swatches button.active {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
