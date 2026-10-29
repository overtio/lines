<script lang="ts">
  import { prefs, type IconSet } from "../prefs.svelte";
  import { ICONS, type IconName } from "./icons";

  let {
    name,
    size = 18,
    strokeWidth = 2,
    class: className = "",
    set,
  }: { name: IconName; size?: number; strokeWidth?: number; class?: string; set?: IconSet } = $props();

  const [Lucide, symbol] = $derived(ICONS[name]);
  // Drawn by macOS / iOS on request; see src-tauri/src/sf_symbols.rs.
  const src = $derived(`url("sfsymbol://localhost/${symbol}?size=${size}&scale=${Math.ceil(devicePixelRatio)}")`);
</script>

{#if (set ?? prefs.icons) === "sf"}
  <span class="icon sf-symbol {className}" style:width="{size}px" style:height="{size}px" style:--src={src} aria-hidden="true"
  ></span>
{:else}
  <Lucide {size} {strokeWidth} class="icon {className}" aria-hidden="true" />
{/if}

<style>
  .sf-symbol {
    display: inline-block;
    flex-shrink: 0;
    background-color: currentColor;
    -webkit-mask: var(--src) center / contain no-repeat;
    mask: var(--src) center / contain no-repeat;
  }
</style>
