<script lang="ts">
  // What a card holds that isn't one setting (FieldRow): a form, a row of buttons, a message.
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props();
</script>

<div class={["flex flex-col gap-3 border-b border-line px-4 py-3 last:border-0", className]} {...rest}>
  {@render children()}
</div>
