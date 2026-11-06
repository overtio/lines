<script lang="ts">
  // A one-line field (text, password, search, number), one height (h-control), with an optional
  // icon in front and something at its end (a count). Its label is the `aria-label`, or a <label>
  // pointing at its `id`. Focus draws a 2px accent ring (3:1 against any background); `aria-invalid`
  // a red border.
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";

  type Props = Omit<HTMLInputAttributes, "value"> & { value?: string | number | null; icon?: IconName; input?: HTMLInputElement; trailing?: Snippet };
  let { value = $bindable(), icon, input = $bindable(), trailing, class: className, ...rest }: Props = $props();
</script>

<span
  class={[
    "flex h-control min-w-0 items-center gap-2 rounded-md border border-transparent bg-input px-2.5 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent has-[input:disabled]:opacity-45 has-[input[aria-invalid=true]]:not-focus-within:border-danger",
    className,
  ]}
>
  {#if icon}<Icon name={icon} size={15} class="shrink-0 text-faint" />{/if}
  <input
    bind:this={input}
    bind:value
    class="tabular h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-sm text-fg outline-none placeholder:text-faint"
    {...rest}
  />
  {#if trailing}{@render trailing()}{/if}
</span>
