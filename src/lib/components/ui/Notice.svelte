<script lang="ts">
  // A bar floating over the bottom of the window: what's going on, or was just done, and buttons
  // for what can be done about it, kept beside it however long it is.
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { floating } from "./styles";

  let { children, actions, class: className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet; actions: Snippet } = $props();
</script>

<div
  class={[
    floating,
    "fixed bottom-4 left-1/2 flex w-max max-w-[min(36rem,calc(100vw-32px))] -translate-x-1/2 items-center gap-3 py-1.5 pr-1.5 pl-3.5 text-sm text-fg",
    className,
  ]}
  {...rest}
>
  <span class="line-clamp-2 min-w-0">{@render children()}</span>
  <div class="flex shrink-0 items-center gap-1">{@render actions()}</div>
</div>
