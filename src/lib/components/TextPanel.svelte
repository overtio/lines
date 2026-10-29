<script lang="ts">
  import { EditorState, Prec } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { createExtensions, readOnly } from "../editor/setup";
  import {
    DEFAULT_SPACING,
    FONTS,
    prefs,
    sameSpacing,
    SPACING_FIELDS,
    SPACING_PRESETS,
    type Spacing,
  } from "../prefs.svelte";
  import Segmented from "./Segmented.svelte";

  const SAMPLE = `# Weekend in the mountains

A slow morning, then the farmers market. Pick up bread, cheese and something green for dinner.

Leave by noon to beat the traffic.

## Packing
- [x] Book the cabin
- [ ] Rain jackets
- [ ] Trail map`;

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

<div class="preview" bind:this={host} aria-label="Preview" role="img"></div>

<section>
  <h3>Font</h3>
  <Segmented
    label="Font"
    options={FONTS.map((font) => ({ id: font.id, label: font.name }))}
    value={prefs.font}
    onselect={(id) => (prefs.font = id)}
    stacked
  >
    {#snippet content(option)}
      <span class="sample" style:font-family={FONTS.find((font) => font.id === option.id)!.family}>Aa</span>
      <span class="font-name">{option.label}</span>
    {/snippet}
  </Segmented>
  <label class="slider">
    <span class="label">Text size</span>
    <input type="range" min="14" max="22" step="1" bind:value={prefs.textSize} />
    <output>{prefs.textSize}px</output>
  </label>
</section>

<section>
  <h3>Spacing</h3>
  <Segmented
    label="Spacing preset"
    options={SPACING_PRESETS.map((p) => ({ id: p.id, label: p.name }))}
    value={preset}
    onselect={(id) => usePreset(SPACING_PRESETS.find((p) => p.id === id)!.spacing)}
  />

  {#each SPACING_FIELDS as field (field.key)}
    <label class="slider">
      <span class="label">{field.label}</span>
      <input type="range" min={field.min} max={field.max} step={field.step} bind:value={prefs.spacing[field.key]} />
      <output>{field.format(prefs.spacing[field.key])}</output>
    </label>
  {/each}

  <footer>
    <span class="note">{preset ? "" : "Custom spacing, saved on this device."}</span>
    <button class="text-button" onclick={() => usePreset(DEFAULT_SPACING)} disabled={preset === "default"}>
      Reset to default
    </button>
  </footer>
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
