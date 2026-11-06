<script lang="ts">
  import { RadioGroup } from "bits-ui";
  import { t } from "../../i18n/index.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import { formatPercent, OPACITY, prefs, windowLookAvailable, type Appearance, type WindowButtons } from "../../prefs.svelte";
  import { canFloat } from "../../windows/floating";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Slider from "../ui/Slider.svelte";
  import Switch from "../ui/Switch.svelte";

  const floatingAppearances: { id: Appearance | "same"; label: string }[] = [
    { id: "same", label: t("settings.floatingSame") },
    { id: "system", label: t("settings.appearanceSystem") },
    { id: "light", label: t("settings.appearanceLight") },
    { id: "dark", label: t("settings.appearanceDark") },
  ];
  const windowButtons: { id: WindowButtons; label: string }[] = [
    { id: "hover", label: t("settings.windowButtonsHover") },
    { id: "always", label: t("settings.windowButtonsAlways") },
  ];

  const floatingTheme = $derived(prefs.floatingTheme === "same" ? "same" : plugins.theme(prefs.floatingTheme).id);

  /** A swatch's ring when chosen; in forced colors, an outline instead. */
  const swatch =
    "h-[26px] rounded-full inset-ring inset-ring-line transition-shadow data-[state=checked]:ring-2 data-[state=checked]:ring-accent data-[state=checked]:inset-ring-0 forced-colors:data-[state=checked]:outline-2 forced-colors:data-[state=checked]:outline-offset-2 forced-colors:data-[state=checked]:outline-[Highlight]";
</script>

{#if windowLookAvailable}
  <FieldGroup title={t("settings.mainWindow")}>
    <FieldRow label={t("settings.opacity")} note={t("settings.opacityNote")}>
      <Slider class="w-60" bind:value={prefs.windowOpacity} {...OPACITY} label={t("settings.opacity")} format={formatPercent} />
    </FieldRow>
    <FieldRow label={t("settings.blur")}>
      <Switch label={t("settings.blur")} checked={prefs.windowBlur} onchange={(on) => (prefs.windowBlur = on)} />
    </FieldRow>
  </FieldGroup>
{/if}

{#if canFloat}
  <FieldGroup title={t("settings.floatingNotes")}>
    <FieldRow label={t("settings.theme")} stacked>
      <RadioGroup.Root
        value={floatingTheme}
        onValueChange={(id) => (prefs.floatingTheme = id)}
        aria-label={t("settings.floatingTheme")}
        class="flex flex-wrap items-center gap-1.5"
      >
        <RadioGroup.Item
          value="same"
          title={t("settings.floatingSameTitle")}
          class="{swatch} bg-input px-2.5 text-xs font-medium text-muted data-[state=checked]:text-fg"
        >
          {t("settings.floatingSame")}
        </RadioGroup.Item>
        {#each plugins.themes as option (option.id)}
          {@const { bg, accent } = option[prefs.floatingLook.dark ? "dark" : "light"]}
          <!-- In forced colors each swatch keeps its theme's colors. -->
          <RadioGroup.Item
            value={option.id}
            aria-label={option.name}
            title={option.name}
            class="{swatch} grid w-[26px] place-items-center forced-color-adjust-none"
            style="background: {bg}"
          >
            <span class="size-2 rounded-full" style:background={accent}></span>
          </RadioGroup.Item>
        {/each}
      </RadioGroup.Root>
    </FieldRow>
    <FieldRow label={t("settings.mode")}>
      <Segmented
        label={t("settings.floatingAppearance")}
        options={floatingAppearances}
        value={prefs.floatingAppearance}
        onselect={(id) => (prefs.floatingAppearance = id)}
      />
    </FieldRow>
    <FieldRow label={t("settings.opacity")}>
      <Slider class="w-60" bind:value={prefs.floatingOpacity} {...OPACITY} label={t("settings.opacity")} format={formatPercent} />
    </FieldRow>
    {#if windowLookAvailable}
      <FieldRow label={t("settings.blur")}>
        <Switch label={t("settings.blur")} checked={prefs.floatingBlur} onchange={(on) => (prefs.floatingBlur = on)} />
      </FieldRow>
      <FieldRow label={t("settings.floatingBorder")}>
        <Switch label={t("settings.floatingBorder")} checked={prefs.floatingBorder} onchange={(on) => (prefs.floatingBorder = on)} />
      </FieldRow>
    {/if}
    <FieldRow label={t("settings.windowButtons")} note={t("settings.windowButtonsNote", { onHover: t("settings.windowButtonsHover") })}>
      <Segmented
        label={t("settings.windowButtonsLabel")}
        options={windowButtons}
        value={prefs.floatingButtons}
        onselect={(id) => (prefs.floatingButtons = id)}
      />
    </FieldRow>
    <FieldRow label={t("settings.overFullscreen")} note={t("settings.overFullscreenNote")}>
      <Switch
        label={t("settings.overFullscreen")}
        checked={prefs.floatingOverFullscreen}
        onchange={(on) => (prefs.floatingOverFullscreen = on)}
      />
    </FieldRow>
  </FieldGroup>
{/if}
