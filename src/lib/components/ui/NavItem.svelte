<script lang="ts">
  // A row in a list of places: the sidebar's, Settings' sections. Takes the props of whatever it
  // stands in for, such as a tab. Without an icon it's one of a group's, its label in line with the
  // group's.
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";

  type Props = HTMLButtonAttributes & { icon?: IconName; label: string; active?: boolean; trailing?: Snippet };
  let { icon, label, active = false, trailing, class: className, ...rest }: Props = $props();
</script>

<button
  type="button"
  class={[
    "ui-nav-item flex h-8 w-full shrink-0 items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors coarse:h-11",
    !icon && "pl-9",
    active ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
    className,
  ]}
  {...rest}
>
  {#if icon}<Icon name={icon} size={16} class="shrink-0" />{/if}
  <span class="min-w-0 flex-1 truncate">{label}</span>
  {#if trailing}{@render trailing()}{/if}
</button>
