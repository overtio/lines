<script lang="ts">
  import { ICONS } from "../../lib/icons/icons";
  import type { IconProps } from "../../lib/plugins/types";

  let { name, size, class: className = "" }: IconProps = $props();

  // Drawn by macOS / iOS on request; see src-tauri/src/sf_symbols.rs.
  const src = $derived(`url("sfsymbol://localhost/${ICONS[name][1]}?size=${size}&scale=${Math.ceil(devicePixelRatio)}")`);
</script>

<span class="sf-symbol {className}" style:width="{size}px" style:height="{size}px" style:--src={src} aria-hidden="true"></span>

<style>
  .sf-symbol {
    display: inline-block;
    flex-shrink: 0;
    background-color: currentColor;
    -webkit-mask: var(--src) center / contain no-repeat;
    mask: var(--src) center / contain no-repeat;
  }
</style>
