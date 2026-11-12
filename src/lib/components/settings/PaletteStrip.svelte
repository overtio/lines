<script lang="ts">
  // A palette's colors side by side, each named on hover; screen readers hear the palette's name and
  // its colors', unless it's `decorative`, beside its name.
  import { locale, t } from "../../i18n/index.svelte";
  import type { Palette } from "../../plugins/types";
  import { paletteNames } from "../../themes/names";

  let { palette, decorative = false, class: className }: { palette: Palette; decorative?: boolean; class?: string } = $props();

  const names = $derived(paletteNames(palette));
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
</script>

<span
  role={decorative ? undefined : "img"}
  aria-hidden={decorative || undefined}
  aria-label={decorative ? undefined : t("settings.paletteColors", { name: palette.name, colors: list.format([...names.values()]) })}
  class={["flex h-6 overflow-hidden rounded-md ring-1 ring-line forced-color-adjust-none", className]}
>
  {#each palette.colors as { id, color } (id)}
    <span class="h-full min-w-0 flex-1" style:background={color} title={names.get(id)}></span>
  {/each}
</span>
