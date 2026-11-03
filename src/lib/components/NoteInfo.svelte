<script lang="ts">
  import { locale, t } from "../i18n/index.svelte";
  import { type Entry, notes } from "../notes/store.svelte";
  import { DEFAULT_LANGUAGE, plugins } from "../plugins/registry.svelte";
  import { dismissable, placeAt, takeFocus } from "../popover";
  import Segmented from "./Segmented.svelte";

  /**
   * Counts and dates for a note, in a small panel under the toolbar's info button (`anchor`), and
   * what it's written in: Markdown, or another language a plugin adds.
   */
  let { entry, anchor, onclose }: { entry: Entry; anchor: HTMLElement; onclose: () => void } = $props();

  let el = $state<HTMLDivElement>();

  const format = $derived(entry.note.format ?? DEFAULT_LANGUAGE);
  const stats = $derived(plugins.language(format).stats(entry.note.body));
  const formats = $derived(plugins.languages.map(({ id, name }) => ({ id, label: name })));
  /** The note's language when its plugin is off, or not on this device: it shows as plain text. */
  const unshown = $derived.by(() => {
    if (formats.some((option) => option.id === format)) return null;
    const plugin = plugins.pluginOf(format);
    return { name: plugin ? plugins.ownLanguage(format).name : format, plugin: plugin?.available === false ? undefined : plugin };
  });
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
  {#if formats.length > 1 || unshown}
    <div class="format">
      {#if formats.length > 1}
        <Segmented label={t("picker.writtenIn")} options={formats} value={format} onselect={(id) => notes.setFormat(entry.note.id, id)} />
      {/if}
      {#if unshown}
        <p class="unshown">
          {unshown.plugin ? t("picker.languageOff", { language: unshown.name }) : t("picker.languageMissing", { language: unshown.name })}
          {#if unshown.plugin}
            <button class="text-button" onclick={() => plugins.setOn(unshown.plugin!, true)}>{t("picker.turnOn")}</button>
          {/if}
        </p>
      {/if}
    </div>
  {/if}
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

  .unshown {
    max-width: 260px;
    margin: 0;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .unshown:not(:first-child) {
    margin-top: 10px;
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
