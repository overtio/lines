<script lang="ts">
  import { EditorState, Prec } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { createExtensions, readOnly } from "../editor/setup";
  import { t } from "../i18n/index.svelte";
  import {
    DEFAULT_SPACING,
    FONTS,
    formatPixels,
    prefs,
    sameSpacing,
    SPACING_FIELDS,
    SPACING_PRESETS,
    spokenPixels,
    type Spacing,
  } from "../prefs.svelte";
  import Segmented from "./Segmented.svelte";

  const SAMPLE = t("settings.previewNote");

  let host: HTMLDivElement;
  let view: EditorView | undefined;

  // A read-only copy of the real editor, so the preview is exactly what notes will look like.
  $effect(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: SAMPLE,
        extensions: [createExtensions(() => {}), Prec.highest(readOnly(true))],
      }),
    });
    return () => view?.destroy();
  });

  $effect(() => {
    prefs.watchLayout();
    view?.requestMeasure();
  });

  const preset = $derived(SPACING_PRESETS.find((p) => sameSpacing(p.spacing, prefs.spacing))?.id ?? null);

  function usePreset(spacing: Spacing) {
    prefs.spacing = { ...spacing };
  }
</script>

<div class="preview" bind:this={host} aria-label={t("settings.preview")} role="img"></div>

<section>
  <h3>{t("settings.font")}</h3>
  <Segmented
    label={t("settings.font")}
    options={FONTS.map((font) => ({ id: font.id, label: font.name }))}
    value={prefs.font}
    onselect={(id) => (prefs.font = id)}
    stacked
  >
    {#snippet content(option)}
      <span class="sample" aria-hidden="true" style:font-family={FONTS.find((font) => font.id === option.id)!.family}>Aa</span>
      <span class="font-name">{option.label}</span>
    {/snippet}
  </Segmented>
  <label class="slider">
    <span class="label">{t("settings.textSize")}</span>
    <input type="range" min="14" max="22" step="1" bind:value={prefs.textSize} aria-valuetext={spokenPixels(prefs.textSize)} />
    <!-- Hidden from screen readers, which hear the value from the slider (and would otherwise hear it twice). -->
    <output aria-hidden="true">{formatPixels(prefs.textSize)}</output>
  </label>
</section>

<section>
  <h3>{t("settings.spacing")}</h3>
  <Segmented
    label={t("settings.spacingPreset")}
    options={SPACING_PRESETS.map((p) => ({ id: p.id, label: p.name }))}
    value={preset}
    onselect={(id) => usePreset(SPACING_PRESETS.find((p) => p.id === id)!.spacing)}
  />

  {#each SPACING_FIELDS as field (field.key)}
    <label class="slider">
      <span class="label">{field.label}</span>
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        bind:value={prefs.spacing[field.key]}
        aria-valuetext={(field.spoken ?? field.format)(prefs.spacing[field.key])}
      />
      <output aria-hidden="true">{field.format(prefs.spacing[field.key])}</output>
    </label>
  {/each}

  <footer>
    <span class="note">{preset ? "" : t("settings.customSpacing")}</span>
    <button class="text-button" onclick={() => usePreset(DEFAULT_SPACING)} disabled={preset === "default"}>
      {t("settings.resetSpacing")}
    </button>
  </footer>
</section>

<section>
  <h3>{t("settings.symbols")}</h3>
  <label class="check">
    <input type="checkbox" bind:checked={prefs.symbolsInText} />
    {t("settings.symbolsInText")}
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={prefs.symbolsInCode} />
    {t("settings.symbolsInCode")}
  </label>
  <p class="note">{t("settings.symbolsNote")}</p>
</section>

<style>
  .preview {
    position: sticky;
    top: -17px;
    z-index: 1;
    height: 220px;
    margin: -4px -20px 18px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    overflow: hidden;
    /* Margins and width apply to the real editor; the preview keeps a fixed frame. */
    --editor-width: none;
    --editor-pad-x: 20px;
    --editor-pad-top: 14px;
  }

  .preview :global(.cm-editor) {
    height: 100%;
  }

  .preview :global(.cm-content) {
    padding-bottom: 16px !important;
  }

  .sample {
    font-size: 20px;
    font-weight: 400;
    line-height: 1.3;
  }

  .font-name {
    font-size: 11.5px;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
  }
</style>
