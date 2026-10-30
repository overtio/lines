<script lang="ts">
  import { locale, t } from "../i18n/index.svelte";
  import { noteStats } from "../notes/stats";
  import { type Entry, notes } from "../notes/store.svelte";
  import type { NoteFormat } from "../notes/types";
  import { dismissable, placeAt, takeFocus } from "../popover";
  import Segmented from "./Segmented.svelte";

  /**
   * Counts and dates for a note, in a small panel under the toolbar's info button (`anchor`), and
   * what it's written in: Markdown or LaTeX.
   */
  let { entry, anchor, onclose }: { entry: Entry; anchor: HTMLElement; onclose: () => void } = $props();

  let el = $state<HTMLDivElement>();

  const stats = $derived(noteStats(entry.note.body, entry.note.format));
  const formats: { id: NoteFormat; label: string }[] = [
    { id: "markdown", label: "Markdown" },
    { id: "latex", label: "LaTeX" },
  ];
  // In the app's language, as the device writes it (see i18n).
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  // About 230 words a minute.
  const reading = $derived(stats.words ? Math.max(1, Math.round(stats.words / 230)) : 0);

  const rows = $derived([
    [t("picker.words"), number.format(stats.words)],
    [t("picker.characters"), number.format(stats.characters)],
    [t("picker.sentences"), number.format(stats.sentences)],
    [t("picker.paragraphs"), number.format(stats.paragraphs)],
    [t("picker.readingTime"), reading ? t("picker.minutes", { count: reading }) : "—"],
  ]);

  $effect(() => {
    if (!el) return;
    const rect = anchor.getBoundingClientRect();
    placeAt(el, rect.right, rect.bottom + 6, "end");
    // Focus moves in, so screen readers read it, and goes back to the info button when it closes.
    const restore = takeFocus(el);
    // It hangs from the toolbar, which doesn't scroll; and switching the format moves the note under it.
    const stop = dismissable(() => el, onclose, anchor, false);
    return () => {
      stop();
      restore();
    };
  });
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onclose()} />

<div class="info popover" role="dialog" aria-label={t("app.info")} tabindex="-1" bind:this={el}>
  <div class="format">
    <Segmented
      label={t("picker.writtenIn")}
      options={formats}
      value={entry.note.format ?? "markdown"}
      onselect={(format) => notes.setFormat(entry.note.id, format)}
    />
  </div>
  <dl>
    {#each rows as [label, value] (label)}
      <dt>{label}</dt>
      <dd>{value}</dd>
    {/each}
  </dl>
  <dl class="dates">
    <dt>{t("picker.created")}</dt>
    <dd>{date.format(entry.note.createdAt)}</dd>
    <dt>{t("picker.edited")}</dt>
    <dd>{date.format(entry.note.updatedAt)}</dd>
  </dl>
</div>

<style>
  .info {
    min-width: 230px;
    padding: 12px 14px;
    font-size: 13px;
  }

  .format {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
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
