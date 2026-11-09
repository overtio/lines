<script lang="ts">
  import { RadioGroup } from "bits-ui";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { backdrop, chooseBackdropImage, paperBackground } from "../../paper.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { PaperStyle } from "../../plugins/types";
  import { formatPercent, PAGE_OPACITY, PAPER_OPACITY, prefs, type PaperColor, type PaperSpacing } from "../../prefs.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Slider from "../ui/Slider.svelte";

  const spacings: { id: PaperSpacing; label: string }[] = [
    { id: "small", label: t("settings.paperSmall") },
    { id: "medium", label: t("settings.paperMedium") },
    { id: "large", label: t("settings.paperLarge") },
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

  /** The pattern chosen draws its own spacing: ruled lines are each a line of text apart. */
  const spaced = $derived(prefs.paperPattern !== "none" && !plugins.paperStyle(prefs.paperPattern)?.perLine);

  /**
   * A tile's preview: its paper at a small spacing (and line height, for a pattern drawn per line), in
   * light and dark, of which the page's scheme picks one (the tile's class).
   */
  function preview(style: PaperStyle | undefined) {
    const light = paperBackground([style], "light");
    const dark = paperBackground([style], "dark");
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
        {/if}
      {/if}
    </FieldGroup>
  {/each}
{:else}
  <Callout>{t("settings.paperOff")}</Callout>
{/if}

<FieldGroup title={t("settings.backdrop")} note={t("settings.backdropNote")} id="paper-backdrop">
  <div class="border-b border-line p-3 last:border-0">
    <RadioGroup.Root value={prefs.paperBackdrop} onValueChange={chooseBackdrop} aria-labelledby="paper-backdrop" class={GRID}>
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
      <Button onclick={() => picker?.click()}>{t("settings.backdropChoose")}</Button>
    </FieldRow>
  {/if}
</FieldGroup>

{#if prefs.paperBackdrop !== "none"}
  <FieldGroup title={t("settings.page")} note={t("settings.pageNote")}>
    <FieldRow label={t("settings.paperColor")}>
      <Segmented label={t("settings.paperColor")} options={pageColors} value={prefs.pageColor} onselect={(id) => (prefs.pageColor = id)} />
    </FieldRow>
    {#if prefs.pageColor === "custom"}
      <FieldRow label={t("settings.pageCustomColor")} for="page-custom-color">
        <ColorField id="page-custom-color" label={t("settings.pageCustomColor")} value={prefs.pageCustomColor} onchange={(color) => color && (prefs.pageCustomColor = color)} />
      </FieldRow>
    {/if}
    <FieldRow label={t("settings.opacity")} note={t("settings.pageOpacityNote")}>
      <Slider class="w-60" bind:value={prefs.pageOpacity} {...PAGE_OPACITY} label={t("settings.opacity")} format={formatPercent} />
    </FieldRow>
  </FieldGroup>
{/if}
