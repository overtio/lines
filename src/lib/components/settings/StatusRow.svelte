<script lang="ts">
  // A row in a card saying how something stands (sync, encryption, a lock), with a button at its end.
  import type { Snippet } from "svelte";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";

  type Props = { icon: IconName; tone?: "success" | "danger" | "muted"; spin?: boolean; children: Snippet; action?: Snippet };
  let { icon, tone = "success", spin = false, children, action }: Props = $props();
</script>

<div
  class={[
    "flex min-h-13 items-center gap-3 border-b border-line px-4 py-2.5 text-sm leading-snug last:border-0",
    tone === "danger" ? "text-danger" : "text-muted",
  ]}
>
  <Icon name={icon} size={16} class="shrink-0 {tone === 'success' ? 'text-success' : ''} {spin ? 'animate-spin' : ''}" />
  <span class="min-w-0 flex-1">{@render children()}</span>
  {#if action}{@render action()}{/if}
</div>
