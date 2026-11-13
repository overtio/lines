<script lang="ts">
  import { EditorState, Prec } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { createExtensions, readOnly } from "../../editor/setup";
  import { t } from "../../i18n/index.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import {
    DEFAULT_SPACING,
    formatPixels,
    HEADING_COLORS,
    type HeadingColor,
    NOTE_WIDTH,
    NOTE_WIDTHS,
    prefs,
    sameSpacing,
    SPACING_FIELDS,
    SPACING_PRESETS,
    spokenPixels,
    TEXT_SIZE,
    type Spacing,
  } from "../../prefs.svelte";
  import { noteFonts } from "../../themes/fonts.svelte";
  import { canDraw } from "../../themes/installedFonts";
  import Button from "../ui/Button.svelte";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Slider from "../ui/Slider.svelte";
  import Switch from "../ui/Switch.svelte";
  import FontPicker from "./FontPicker.svelte";

  const SAMPLE = t("settings.previewNote");
  const fonts = $derived(noteFonts());
  /** The installed font chosen isn't on this device (a preset's, or settings from another computer). */
  const missing = $derived(!!prefs.installedFont && !canDraw(prefs.installedFont));

  function chooseFont(id: string) {
    prefs.font = id;
    prefs.installedFont = "";
  }

  // "text" is the theme's colors for each level, by its first name (prefs.svelte.ts).
  const HEADING_COLOR_NAMES = { text: "settings.headingColorTheme", accent: "settings.color.accent", custom: "settings.paperColorCustom" } as const;
  const headingColors = HEADING_COLORS.map((id) => ({ id, label: t(HEADING_COLOR_NAMES[id]) }));
  const headingSwatches: Record<HeadingColor, string> = $derived({ text: "var(--text-h1, var(--text))", accent: "var(--accent)", custom: prefs.headingCustomColor });

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

  const widths = [...NOTE_WIDTHS.map(({ id, name }) => ({ id, label: name })), { id: "full", label: t("settings.widthFull") }];
  const width = $derived(prefs.fullWidth ? "full" : (NOTE_WIDTHS.find((choice) => choice.width === prefs.noteWidth)?.id ?? null));

  function chooseWidth(id: string) {
    prefs.fullWidth = id === "full";
    const choice = NOTE_WIDTHS.find((each) => each.id === id);
    if (choice) prefs.noteWidth = choice.width;
  }
</script>

<!-- Kept in sight while the settings under it scroll. Margins and width apply to the real editor; the preview keeps a fixed frame. -->
<div class="sticky top-0 z-10 -my-2 bg-panel py-2">
  <div
    class="h-[200px] overflow-hidden rounded-xl border border-card-line bg-bg [--editor-pad-top:14px] [--editor-pad-x:20px] [--editor-width:none] [&_.cm-content]:pb-4! [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-hidden"
    bind:this={host}
    aria-label={t("settings.preview")}
    role="img"
  ></div>
</div>

<FieldGroup title={t("settings.fontFamily")}>
  <FieldRow label={t("settings.fontRecommended")} stacked>
    <Segmented
      class="w-full"
      label={t("settings.fontRecommended")}
      options={fonts.map((font) => ({ id: font.id, label: font.id === "system" ? (plugins.style(prefs.style)?.font?.name ?? font.name) : font.name }))}
      value={prefs.installedFont ? null : prefs.font}
      onselect={chooseFont}
      stacked
      columns={4}
    >
      {#snippet content(option)}
        <span class="text-[20px] leading-[1.3] font-normal" aria-hidden="true" style:font-family={fonts.find((font) => font.id === option.id)!.family}>Aa</span>
        <span class="text-xs leading-tight">{option.label}</span>
      {/snippet}
    </Segmented>
  </FieldRow>
  <FieldRow label={t("settings.fontInstalled")} note={missing ? t("settings.fontMissing", { name: prefs.installedFont }) : t("settings.fontInstalledNote")}>
    <FontPicker class="w-60" label={t("settings.fontInstalled")} value={prefs.installedFont} onchange={(family) => (prefs.installedFont = family)} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.fontSize")}>
  <FieldRow label={t("settings.textSize")}>
    <Slider class="w-60" bind:value={prefs.textSize} {...TEXT_SIZE} label={t("settings.textSize")} format={formatPixels} spoken={spokenPixels} />
  </FieldRow>
</FieldGroup>

<FieldGroup>
  <FieldRow label={t("settings.headingColor")}>
    <Segmented label={t("settings.headingColor")} options={headingColors} value={prefs.headingColor} onselect={(id) => (prefs.headingColor = id)}>
      {#snippet content(option)}
        <span class="size-2.5 shrink-0 rounded-full inset-ring inset-ring-line" style:background={headingSwatches[option.id]} aria-hidden="true"></span>
        {option.label}
      {/snippet}
    </Segmented>
  </FieldRow>
  {#if prefs.headingColor === "custom"}
    <FieldRow label={t("settings.paperCustomColor")} for="heading-custom-color">
      <ColorField id="heading-custom-color" label={t("settings.paperCustomColor")} value={prefs.headingCustomColor} onchange={(color) => color && (prefs.headingCustomColor = color)} />
    </FieldRow>
  {/if}
</FieldGroup>

<FieldGroup title={t("settings.ligatures")} note={t("settings.symbolsNote")}>
  <FieldRow label={t("settings.symbolsInText")}>
    <Switch label={t("settings.symbolsInText")} checked={prefs.symbolsInText} onchange={(on) => (prefs.symbolsInText = on)} />
  </FieldRow>
  <FieldRow label={t("settings.symbolsInCode")}>
    <Switch label={t("settings.symbolsInCode")} checked={prefs.symbolsInCode} onchange={(on) => (prefs.symbolsInCode = on)} />
  </FieldRow>
</FieldGroup>

<FieldGroup>
  <FieldRow label={t("settings.noteWidth")} note={t("settings.noteWidthNote")}>
    <Segmented label={t("settings.noteWidth")} options={widths} value={width} onselect={chooseWidth} />
  </FieldRow>
  <FieldRow label={t("settings.width")}>
    <!-- Dragging it from Full goes back to a width. -->
    <Slider
      class="w-60"
      bind:value={prefs.noteWidth}
      {...NOTE_WIDTH}
      label={t("settings.width")}
      format={(value) => (prefs.fullWidth ? t("settings.widthFull") : formatPixels(value))}
      spoken={(value) => (prefs.fullWidth ? t("settings.widthFull") : spokenPixels(value))}
      oninput={() => (prefs.fullWidth = false)}
    />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.spacing")} note={preset ? null : t("settings.customSpacing")}>
  {#snippet action()}
    <Button variant="quiet" onclick={() => usePreset(DEFAULT_SPACING)} disabled={preset === "default"}>{t("settings.resetSpacing")}</Button>
  {/snippet}
  <FieldRow label={t("settings.spacingPreset")}>
    <Segmented
      label={t("settings.spacingPreset")}
      options={SPACING_PRESETS.map((p) => ({ id: p.id, label: p.name }))}
      value={preset}
      onselect={(id) => usePreset(SPACING_PRESETS.find((p) => p.id === id)!.spacing)}
    />
  </FieldRow>
  {#each SPACING_FIELDS as field (field.key)}
    <FieldRow label={field.label}>
      <Slider
        class="w-60"
        bind:value={prefs.spacing[field.key]}
        min={field.min}
        max={field.max}
        step={field.step}
        label={field.label}
        format={field.format}
        spoken={field.spoken}
      />
    </FieldRow>
  {/each}
</FieldGroup>
