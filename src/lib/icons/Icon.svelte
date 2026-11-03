<script lang="ts">
  import { plugins } from "../plugins/registry.svelte";
  import { prefs } from "../prefs.svelte";
  import type { IconName } from "./icons";

  /** One of lines' icons, drawn by the icon set chosen in Settings (or `set`), which comes from a plugin. */
  let {
    name,
    size = 18,
    strokeWidth = 2,
    class: className = "",
    set,
  }: { name: IconName; size?: number; strokeWidth?: number; class?: string; set?: string } = $props();

  const Drawn = $derived(plugins.iconSet(set ?? prefs.icons).component);
</script>

<Drawn {name} {size} {strokeWidth} class="icon {className}" />
