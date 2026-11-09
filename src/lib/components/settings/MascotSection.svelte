<script lang="ts">
  // Settings → Mascot: a companion to keep you company as you write, or none; how big it is, and
  // whether it talks. Each shown as itself, in its pixel art.
  import { RadioGroup } from "bits-ui";
  import { t } from "../../i18n/index.svelte";
  import { frame } from "../../mascot/draw";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Mascot } from "../../plugins/types";
  import { MASCOT_SIZES, prefs } from "../../prefs.svelte";
  import { hex, mix, parse } from "../../themes/color";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Switch from "../ui/Switch.svelte";

  const SIZE_NAMES = { small: "settings.mascotSmall", medium: "settings.mascotMedium", large: "settings.mascotLarge" } as const;
  const sizes = MASCOT_SIZES.map((id) => ({ id, label: t(SIZE_NAMES[id]) }));
  const heading = $props.id();

  /** Draws `mascot` standing, in the theme's accent, into the canvas it's attached to. */
  const portrait = (mascot: Mascot) => (canvas: HTMLCanvasElement) => {
    void prefs.windowLook;
    const color = parse(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    const accent = color ? hex(color) : undefined;
    const art = frame(mascot, "stand", { accent, accentDark: color ? hex(mix(color, { r: 0, g: 0, b: 0, a: 1 }, 0.28)) : undefined });
    canvas.width = art.width;
    canvas.height = art.height;
    canvas.getContext("2d")!.drawImage(art, 0, 0);
  };

  const TILE =
    "grid h-20 place-items-center rounded-lg bg-bg inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]";
</script>

<FieldGroup title={t("settings.mascot")} note={t("settings.mascotNote")} id={heading}>
  <div class="p-3">
    <RadioGroup.Root value={plugins.mascots.some((m) => m.id === prefs.mascot) ? prefs.mascot : "none"} onValueChange={(id) => (prefs.mascot = id)} aria-labelledby={heading} class="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
      <RadioGroup.Item value="none" class="group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover">
        <span class="{TILE} text-faint" aria-hidden="true">—</span>
        <span class="text-xs font-medium text-muted group-data-[state=checked]:text-fg">{t("settings.mascotNone")}</span>
      </RadioGroup.Item>
      {#each plugins.mascots as mascot (mascot.id)}
        <RadioGroup.Item value={mascot.id} title={mascot.description} class="group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover">
          <span class={TILE} aria-hidden="true">
            <canvas class="h-12 [image-rendering:pixelated]" {@attach portrait(mascot)}></canvas>
          </span>
          <span class="text-xs font-medium text-muted group-data-[state=checked]:text-fg">{mascot.name}</span>
        </RadioGroup.Item>
      {/each}
    </RadioGroup.Root>
  </div>
  {#if prefs.mascot !== "none"}
    <FieldRow label={t("settings.mascotSize")}>
      <Segmented label={t("settings.mascotSize")} options={sizes} value={prefs.mascotSize} onselect={(id) => (prefs.mascotSize = id)} />
    </FieldRow>
    <FieldRow label={t("settings.mascotTalks")} note={t("settings.mascotTalksNote")}>
      <Switch label={t("settings.mascotTalks")} checked={prefs.mascotTalks} onchange={(on) => (prefs.mascotTalks = on)} />
    </FieldRow>
  {/if}
</FieldGroup>
