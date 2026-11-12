<script lang="ts">
  // Settings → Plugins → Paper: a pattern behind the text and a texture under it, their color, size
  // and strength; the backdrop behind the page, the plugin's or a color or picture of yours; the page.
  import { RadioGroup } from "bits-ui";
  import { t } from "../../lib/i18n/index.svelte";
  import Icon from "../../lib/icons/Icon.svelte";
  import { backdrop, chooseBackdropImage, paperBackground, removeBackdropImage } from "../../lib/paper.svelte";
  import { plugins } from "../../lib/plugins/registry.svelte";
  import type { PaperStyle } from "../../lib/plugins/types";
  import { hex, parse } from "../../lib/themes/color";
  import { shownScheme } from "../../lib/themes/show.svelte";
  import { formatPercent, formatPixels, PAGE_OPACITY, PAPER_OPACITY, PAPER_SIZE, prefs, spokenPixels, type PaperColor, type PaperSpacing } from "../../lib/prefs.svelte";
  import Button from "../../lib/components/ui/Button.svelte";
  import Callout from "../../lib/components/ui/Callout.svelte";
  import ColorField from "../../lib/components/ui/ColorField.svelte";
  import FieldGroup from "../../lib/components/ui/FieldGroup.svelte";
  import FieldRow from "../../lib/components/ui/FieldRow.svelte";
  import Segmented from "../../lib/components/ui/Segmented.svelte";
  import Slider from "../../lib/components/ui/Slider.svelte";

  const spacings: { id: PaperSpacing; label: string }[] = [
    { id: "text", label: t("settings.paperSpacingText") },
    { id: "custom", label: t("settings.paperSpacingCustom") },
  ];
  const colors: { id: PaperColor; label: string }[] = [
    { id: "ink", label: t("settings.paperColorTheme") },
    { id: "accent", label: t("settings.color.accent") },
    { id: "custom", label: t("settings.paperColorCustom") },
  ];
  const swatches: Record<PaperColor, string> = $derived({ ink: "var(--ink)", accent: "var(--accent)", custom: prefs.paperCustomColor });
  const pageColors: { id: "theme" | "custom"; label: string }[] = [
    { id: "theme", label: t("settings.paperColorTheme") },
    { id: "custom", label: t("settings.paperColorCustom") },
  ];

  const kinds = $derived([
    { kind: "pattern", title: t("settings.paperPattern"), none: t("settings.paperPlain"), value: prefs.paperPattern, set: (id: string) => (prefs.paperPattern = id) },
    { kind: "texture", title: t("settings.paperTexture"), none: t("settings.paperSmooth"), value: prefs.paperTexture, set: (id: string) => (prefs.paperTexture = id) },
  ]);

  /** A pattern that can be drawn across the page can have a size of its own; ruled lines always follow the text. */
  const spaced = $derived(!!plugins.paperStyle(prefs.paperPattern)?.layers);

  /**
   * A tile's preview: its paper at a small spacing (and line height, for one drawn only per line), in
   * light and dark, of which the page's scheme picks one (the tile's class).
   */
  function preview(style: PaperStyle | undefined) {
    const where = style?.layers ? "page" : "line";
    const light = paperBackground([style], "light", where);
    const dark = paperBackground([style], "dark", where);
    if (!light || !dark) return "";
    return `--paper-step: 9px; line-height: 9px; --tile-light: ${light.image}; --tile-dark: ${dark.image}; background-size: ${light.size}; background-position: ${light.position}`;
  }

  let picker = $state<HTMLInputElement>();
  let imageError = $state<string | null>(null);

  async function pickImage() {
    const file = picker?.files?.[0];
    if (picker) picker.value = "";
    if (!file) return;
    imageError = null;
    try {
      await chooseBackdropImage(file);
    } catch {
      imageError = t("settings.backdropImageError");
    }
  }

  /** A color of its own starts as the theme's page, which its text reads on; Monochrome and Invert change it as they do the theme's. */
  function choosePageColor(id: "theme" | "custom") {
    const theme = plugins.theme(prefs.windowLook.theme);
    const bg = parse(theme[shownScheme(theme).own].bg);
    if (id === "custom" && prefs.pageColor !== "custom" && bg) prefs.pageCustomColor = hex(bg);
    prefs.pageColor = id;
  }

  /** Choosing Image with no picture yet asks for one first. */
  function chooseBackdrop(id: string) {
    if (id === "image" && !backdrop.image) picker?.click();
    else prefs.paperBackdrop = id;
  }

  const TILE =
    "block h-14 rounded-lg inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]";
  const ITEM = "group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover";
  const NAME = "text-xs font-medium text-muted group-data-[state=checked]:text-fg";
  const GRID = "grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2";
</script>

{#if plugins.paperStyles.length}
  {#each kinds as { kind, title, none, value, set } (kind)}
    {@const options = [undefined, ...plugins.paperStyles.filter((style) => style.kind === kind)]}
    <FieldGroup {title} id="paper-{kind}">
      <div class="border-b border-line p-3 last:border-0">
        <!-- One group of radio buttons, so Tab stops once and the arrow keys go through each paper. -->
        <RadioGroup.Root {value} onValueChange={set} aria-labelledby="paper-{kind}" class={GRID}>
          {#each options as option (option?.id ?? "none")}
            <RadioGroup.Item value={option?.id ?? "none"} class={ITEM}>
              <span class="{TILE} bg-bg bg-(image:--tile-light) [:root[data-scheme=dark]_&]:bg-(image:--tile-dark)" style={preview(option)} aria-hidden="true"></span>
              <span class={NAME}>{option?.name ?? none}</span>
            </RadioGroup.Item>
          {/each}
        </RadioGroup.Root>
      </div>
      {#if kind === "pattern" && prefs.paperPattern !== "none"}
        <FieldRow label={t("settings.paperColor")}>
          <Segmented label={t("settings.paperColor")} options={colors} value={prefs.paperColor} onselect={(id) => (prefs.paperColor = id)}>
            {#snippet content(option)}
              <span class="size-2.5 shrink-0 rounded-full inset-ring inset-ring-line" style:background={swatches[option.id]} aria-hidden="true"></span>
              {option.label}
            {/snippet}
          </Segmented>
        </FieldRow>
        {#if prefs.paperColor === "custom"}
          <FieldRow label={t("settings.paperCustomColor")} for="paper-custom-color">
            <ColorField id="paper-custom-color" label={t("settings.paperCustomColor")} value={prefs.paperCustomColor} onchange={(color) => color && (prefs.paperCustomColor = color)} />
          </FieldRow>
        {/if}
        <FieldRow label={t("settings.opacity")}>
          <Slider class="w-60" bind:value={prefs.paperOpacity} {...PAPER_OPACITY} label={t("settings.opacity")} format={formatPercent} />
        </FieldRow>
        {#if spaced}
          <FieldRow label={t("settings.paperSpacing")} note={t("settings.paperSpacingNote")}>
            <Segmented label={t("settings.paperSpacing")} options={spacings} value={prefs.paperSpacing} onselect={(id) => (prefs.paperSpacing = id)} />
          </FieldRow>
          {#if prefs.paperSpacing === "custom"}
            <FieldRow label={t("settings.paperSize")}>
              <Slider class="w-60" bind:value={prefs.paperSize} {...PAPER_SIZE} label={t("settings.paperSize")} format={formatPixels} spoken={spokenPixels} />
            </FieldRow>
          {/if}
        {/if}
      {/if}
    </FieldGroup>
  {/each}
{:else}
  <Callout>{t("settings.paperOff")}</Callout>
{/if}

<FieldGroup title={t("settings.backdrop")} note={t("settings.backdropNote")} id="paper-backdrop">
  <div class="border-b border-line p-3 last:border-0">
    <!-- Bound both ways, so Image cancelled (no picture chosen) doesn't stay checked. -->
    <RadioGroup.Root bind:value={() => prefs.paperBackdrop, chooseBackdrop} aria-labelledby="paper-backdrop" class={GRID}>
      <RadioGroup.Item value="none" class={ITEM}>
        <span class="{TILE} bg-surface" aria-hidden="true"></span>
        <span class={NAME}>{t("settings.backdropNone")}</span>
      </RadioGroup.Item>
      {#each plugins.paperStyles.filter((style) => style.kind === "backdrop") as option (option.id)}
        <RadioGroup.Item value={option.id} class={ITEM}>
          <span class="{TILE} bg-no-repeat bg-(image:--tile-light) [:root[data-scheme=dark]_&]:bg-(image:--tile-dark)" style={preview(option)} aria-hidden="true"></span>
          <span class={NAME}>{option.name}</span>
        </RadioGroup.Item>
      {/each}
      <RadioGroup.Item value="color" class={ITEM}>
        <span class={TILE} style:background={prefs.backdropColor} aria-hidden="true"></span>
        <span class={NAME}>{t("settings.backdropColor")}</span>
      </RadioGroup.Item>
      <RadioGroup.Item value="image" class={ITEM}>
        <span class="{TILE} grid place-items-center bg-surface bg-cover bg-center text-faint" style:background-image={backdrop.image ? `url("${backdrop.image}")` : undefined} aria-hidden="true">
          {#if !backdrop.image}<Icon name="image" size={20} />{/if}
        </span>
        <span class={NAME}>{t("settings.backdropImage")}</span>
      </RadioGroup.Item>
    </RadioGroup.Root>
    <input bind:this={picker} type="file" accept="image/*" class="hidden" onchange={pickImage} />
  </div>
  {#if imageError}
    <div class="border-b border-line p-3 last:border-0"><Callout tone="danger">{imageError}</Callout></div>
  {/if}
  {#if prefs.paperBackdrop === "color"}
    <FieldRow label={t("settings.backdropColor")} for="backdrop-color">
      <ColorField id="backdrop-color" label={t("settings.backdropColor")} value={prefs.backdropColor} onchange={(color) => color && (prefs.backdropColor = color)} />
    </FieldRow>
  {:else if prefs.paperBackdrop === "image"}
    <FieldRow label={t("settings.backdropImage")} note={t("settings.backdropImageNote")}>
      <div class="flex flex-wrap gap-2">
        {#if backdrop.image}<Button variant="quiet" onclick={() => void removeBackdropImage()}>{t("settings.backdropRemove")}</Button>{/if}
        <Button onclick={() => picker?.click()}>{t("settings.backdropChoose")}</Button>
      </div>
    </FieldRow>
  {/if}
</FieldGroup>

{#if prefs.paperBackdrop !== "none"}
  <FieldGroup title={t("settings.page")} note={t("settings.pageNote")}>
    <FieldRow label={t("settings.paperColor")}>
      <Segmented label={t("settings.paperColor")} options={pageColors} value={prefs.pageColor} onselect={choosePageColor} />
    </FieldRow>
    {#if prefs.pageColor === "custom"}
      <FieldRow label={t("settings.pageCustomColor")} note={t("settings.pageCustomColorNote")} for="page-custom-color">
        <ColorField id="page-custom-color" label={t("settings.pageCustomColor")} value={prefs.pageCustomColor} onchange={(color) => color && (prefs.pageCustomColor = color)} />
      </FieldRow>
    {/if}
    <FieldRow label={t("settings.opacity")} note={t("settings.pageOpacityNote")}>
      <Slider class="w-60" bind:value={prefs.pageOpacity} {...PAGE_OPACITY} label={t("settings.opacity")} format={formatPercent} />
    </FieldRow>
  </FieldGroup>
{/if}
