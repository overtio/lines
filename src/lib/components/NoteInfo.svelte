<script lang="ts">
  import { Popover } from "bits-ui";
  import { locale, t } from "../i18n/index.svelte";
  import { type Entry, notes } from "../notes/store.svelte";
  import { DEFAULT_LANGUAGE, plugins } from "../plugins/registry.svelte";
  import { takeFocus } from "../popover";
  import Button from "./ui/Button.svelte";
  import Segmented from "./ui/Segmented.svelte";
  import { floating } from "./ui/styles";

  /**
   * Counts and dates for a note, in a small panel under the toolbar's info button (`anchor`), and
   * what it's written in: Markdown, or another language a plugin adds.
   */
  let { entry, anchor, onclose }: { entry: Entry; anchor: HTMLElement; onclose: () => void } = $props();

  let el = $state<HTMLElement | null>(null);
  /** Gives focus back to the info button when it closes. */
  let restore: (() => void) | undefined;

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

  // Closed by taking it away, so focus goes back then.
  $effect(() => () => restore?.());
</script>

{#snippet facts(rows: string[][], className = "")}
  <dl class="m-0 grid grid-cols-[1fr_auto] gap-x-5 gap-y-1.5 {className}">
    {#each rows as [label, value] (label)}
      <dt class="text-muted">{label}</dt>
      <dd class="tabular m-0 text-right text-fg">{value}</dd>
    {/each}
  </dl>
{/snippet}

<!-- It hangs from the toolbar, which doesn't scroll; and switching the format moves the note under it, so neither closes it. -->
<Popover.Root open onOpenChange={(open) => !open && onclose()}>
  <Popover.Portal>
    <Popover.Content
      bind:ref={el}
      customAnchor={anchor}
      align="end"
      sideOffset={6}
      collisionPadding={8}
      role="dialog"
      aria-label={t("app.info")}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        // Focus moves in, so screen readers read it.
        restore = takeFocus(el!);
      }}
      onCloseAutoFocus={(event) => event.preventDefault()}
      class="{floating} min-w-[230px] px-3.5 py-3 text-sm"
    >
      {#if formats.length > 1 || unshown}
        <div class="mb-3 border-b border-line pb-3">
          {#if formats.length > 1}
            <Segmented label={t("picker.writtenIn")} options={formats} value={format} onselect={(id) => notes.setFormat(entry.note.id, id)} />
          {/if}
          {#if unshown}
            <p class="m-0 max-w-[260px] leading-normal text-muted not-first:mt-2.5">
              {unshown.plugin ? t("picker.languageOff", { language: unshown.name }) : t("picker.languageMissing", { language: unshown.name })}
              {#if unshown.plugin}
                <Button variant="quiet" onclick={() => plugins.setOn(unshown.plugin!, true)}>{t("picker.turnOn")}</Button>
              {/if}
            </p>
          {/if}
        </div>
      {/if}
      {@render facts(rows)}
      {@render facts(
        [
          [t("picker.created"), date.format(entry.note.createdAt)],
          [t("picker.edited"), date.format(entry.note.updatedAt)],
        ],
        "mt-2.5 border-t border-line pt-2.5",
      )}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
