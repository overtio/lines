<script lang="ts">
  import { RadioGroup } from "bits-ui";
  import { t } from "../../i18n/index.svelte";
  import { paperBackground } from "../../paper.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { PaperStyle } from "../../plugins/types";
  import { formatPercent, PAPER_OPACITY, prefs, type PaperColor, type PaperSpacing } from "../../prefs.svelte";
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
</script>

{#if plugins.paperStyles.length}
  {#each kinds as { kind, title, none, value, set } (kind)}
    {@const options = [undefined, ...plugins.paperStyles.filter((style) => style.kind === kind)]}
    <FieldGroup {title} id="paper-{kind}">
      <div class="border-b border-line p-3 last:border-0">
        <!-- One group of radio buttons, so Tab stops once and the arrow keys go through each paper. -->
        <RadioGroup.Root {value} onValueChange={set} aria-labelledby="paper-{kind}" class="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
          {#each options as option (option?.id ?? "none")}
            <RadioGroup.Item value={option?.id ?? "none"} class="group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover">
              <span
                class="block h-14 rounded-lg bg-bg bg-(image:--tile-light) inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText] [:root[data-scheme=dark]_&]:bg-(image:--tile-dark)"
                style={preview(option)}
                aria-hidden="true"
              ></span>
              <span class="text-xs font-medium text-muted group-data-[state=checked]:text-fg">{option?.name ?? none}</span>
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
