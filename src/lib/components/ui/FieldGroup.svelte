<script lang="ts">
  // A group of settings: its heading, and a card with a row for each (FieldRow).
  import type { Snippet } from "svelte";
  import Card from "./Card.svelte";
  import SectionHeading from "./SectionHeading.svelte";

  type Props = {
    title?: string;
    note?: string | null;
    /** A button at the end of the heading. */
    action?: Snippet;
    /** The heading's id, to move focus to it. */
    id?: string;
    children: Snippet;
  };
  let { title, note, action, id, children }: Props = $props();
</script>

<section aria-label={title}>
  {#if title}<SectionHeading {title} {note} {action} {id} />{/if}
  <Card>{@render children()}</Card>
</section>
