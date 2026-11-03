<script lang="ts">
  import { ICONS } from "../../lib/icons/icons";
  import type { IconProps } from "../../lib/plugins/types";

  let { name, size, strokeWidth, class: className = "" }: IconProps = $props();

  const Lucide = $derived(ICONS[name][0]);
</script>

<Lucide {size} {strokeWidth} class={className} aria-hidden="true" />
