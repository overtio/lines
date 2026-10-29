<script lang="ts">
  import { noteStats } from "../notes/stats";
  import type { Entry } from "../notes/store.svelte";
  import { dismissable, placeAt } from "../popover";

  /** Counts and dates for a note, in a small panel under the toolbar's info button (`anchor`). */
  let { entry, anchor, onclose }: { entry: Entry; anchor: HTMLElement; onclose: () => void } = $props();

  let el = $state<HTMLDivElement>();

  const stats = $derived(noteStats(entry.note.body));
  const number = new Intl.NumberFormat();
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  // About 230 words a minute.
  const reading = $derived(stats.words ? Math.max(1, Math.round(stats.words / 230)) : 0);

  const rows = $derived([
    ["Words", number.format(stats.words)],
    ["Characters", number.format(stats.characters)],
    ["Sentences", number.format(stats.sentences)],
    ["Paragraphs", number.format(stats.paragraphs)],
    ["Reading time", reading ? `${reading} min` : "—"],
  ]);

  $effect(() => {
    if (!el) return;
    const rect = anchor.getBoundingClientRect();
    placeAt(el, rect.right, rect.bottom + 6, "end");
    return dismissable(() => el, onclose, anchor);
  });
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onclose()} />

<div class="info popover" role="dialog" aria-label="Note info" bind:this={el}>
  <dl>
    {#each rows as [label, value] (label)}
      <dt>{label}</dt>
      <dd>{value}</dd>
    {/each}
  </dl>
  <dl class="dates">
    <dt>Created</dt>
    <dd>{date.format(entry.note.createdAt)}</dd>
    <dt>Edited</dt>
    <dd>{date.format(entry.note.updatedAt)}</dd>
  </dl>
</div>

<style>
  .info {
    min-width: 230px;
    padding: 12px 14px;
    font-size: 13px;
  }

  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 20px;
    margin: 0;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  .dates {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
</style>
