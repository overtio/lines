<script lang="ts">
  // A group of rows set apart (FieldRow), as a card in a note is.
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props();
</script>

<div class={["rounded-xl border border-card-line bg-card", className]} {...rest}>
  {@render children()}
</div>
