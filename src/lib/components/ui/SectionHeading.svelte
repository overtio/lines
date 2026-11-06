<script lang="ts">
  // A group's heading over its card: a title, a note under it, and an action at its end.
  import type { Snippet } from "svelte";

  type Props = { title: string; note?: string | null; action?: Snippet; id?: string; class?: string };
  let { title, note, action, id, class: className }: Props = $props();
</script>

<!-- As tall as a button only when it has one, so headings sit the same distance from their cards. -->
<div class={["mb-2 flex items-end gap-2 px-1", action && "min-h-control", className]}>
  <div class="min-w-0 flex-1">
    <!-- Focusable, so a link elsewhere in Settings can take you to it. -->
    <h3 {id} tabindex="-1" class="m-0 text-sm font-semibold text-fg outline-none">{title}</h3>
    {#if note}<p class="m-0 mt-0.5 text-xs leading-normal text-muted">{note}</p>{/if}
  </div>
  {#if action}{@render action()}{/if}
</div>
