<script lang="ts">
  // A browser's bookmarks as the Library's resources (lib/library/bookmarks.ts), in Settings: what
  // importing them would do, before anything's written; doing it, a batch at a time; and what it
  // did, which can be taken back while it's shown. Rows of the card it's in (Library, or Export and Import).
  import { onMount, untrack } from "svelte";
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { type Imported, importBookmarks, libraryLinks, undoImport } from "../../library/bookmarkImport";
  import { planImport, readBookmarks } from "../../library/bookmarks";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";
  import CardBlock from "./CardBlock.svelte";

  let { files, onclose }: { files: { name: string; text: string }[]; onclose: () => void } = $props();

  const list = (names: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
  const number = (count: number) => count.toLocaleString(locale);

  const read = $derived(files.map(({ name, text }) => ({ name, bookmarks: readBookmarks(text) })));
  const unreadable = $derived(read.filter((file) => !file.bookmarks).map((file) => file.name));
  const bookmarks = $derived(read.flatMap((file) => file.bookmarks ?? []));
  const name = $derived(list(read.filter((file) => file.bookmarks).map((file) => file.name)));

  /** What importing them would do, with the library as it was when they were chosen; again as they're imported. */
  let plan = $derived(planImport(bookmarks, untrack(libraryLinks)));
  let folderTags = $state(false);
  let step = $state<"asking" | "importing" | "done" | "undone">("asking");
  let done = $state(0);
  let imported = $state.raw<Imported | null>(null);
  let removed = $state(0);

  /** What's left out, and why: each reason there are some for. */
  const leftOut = $derived((["there", "repeated", "other"] as const).flatMap((why) => (plan[why] ? [t(`library.bookmarks.${why}`, { count: plan[why] })] : [])));
  const result = $derived(t("library.bookmarks.imported", { count: imported?.size ?? 0, there: plan.there }));

  onMount(() => {
    if (bookmarks.length) speak(t("library.bookmarks.found", { count: bookmarks.length, name }));
  });

  async function start() {
    plan = planImport(bookmarks, libraryLinks());
    step = "importing";
    done = 0;
    imported = await importBookmarks(plan.add, { folderTags }, (count) => (done = count));
    step = "done";
    speak(result);
  }

  async function undo() {
    if (!imported) return;
    removed = await undoImport(imported);
    imported = null;
    step = "undone";
    speak(t("library.bookmarks.undone", { count: removed }));
  }

  const focus = (element: HTMLElement) => element.focus();
</script>

{#if unreadable.length}
  <CardBlock>
    <Callout tone="danger" class="w-full">{t("library.bookmarks.unreadable", { name: list(unreadable) })}</Callout>
  </CardBlock>
{/if}
{#if bookmarks.length}
  {#if step === "asking"}
    <CardBlock>
      <div class="flex flex-col gap-1">
        <p class="m-0 text-sm leading-normal text-fg">{t("library.bookmarks.found", { count: bookmarks.length, name })}</p>
        {#each leftOut as line (line)}
          <p class="m-0 text-xs leading-normal text-muted">{line}</p>
        {/each}
      </div>
    </CardBlock>
    {#if plan.add.length}
      <FieldRow label={t("library.bookmarks.folderTags")} note={t("library.bookmarks.folderTagsNote")}>
        <Switch label={t("library.bookmarks.folderTags")} checked={folderTags} onchange={(on) => (folderTags = on)} />
      </FieldRow>
    {/if}
    <CardBlock class="flex-row flex-wrap items-center gap-1.5">
      {#if plan.add.length}
        <Button variant="primary" icon="import" onclick={start} {@attach focus}>{t("library.bookmarks.start", { count: plan.add.length })}</Button>
      {:else}
        <p class="m-0 mr-auto text-sm leading-normal text-muted">{result}</p>
      {/if}
      <Button variant="quiet" onclick={onclose} {@attach (button: HTMLElement) => void (plan.add.length || button.focus())}>{t("settings.cancel")}</Button>
    </CardBlock>
  {:else if step === "importing"}
    <CardBlock class="gap-1.5 outline-none" role="status" tabindex={-1} {@attach focus}>
      <progress class="w-full accent-accent" max={plan.add.length} value={done} aria-label={t("library.bookmarks.importing", { done: number(done), count: number(plan.add.length) })}></progress>
      <p class="m-0 text-xs leading-normal text-muted">{t("library.bookmarks.importing", { done: number(done), count: number(plan.add.length) })}</p>
    </CardBlock>
  {:else}
    <!-- Taken back, focus is here, where Undo was. -->
    <CardBlock class="flex-row flex-wrap items-center gap-x-2 gap-y-1.5 outline-none" tabindex={-1} {@attach (block: HTMLElement) => void (step === "undone" && block.focus())}>
      <p class="m-0 flex min-w-0 flex-1 items-center gap-2 text-sm leading-normal text-muted" role="status">
        <Icon name="check" size={15} class="shrink-0 text-success" />
        {step === "done" ? result : t("library.bookmarks.undone", { count: removed })}
      </p>
      {#if step === "done"}
        <Button variant="quiet" class="-my-1" onclick={undo} {@attach focus}>{t("library.bookmarks.undo")}</Button>
      {/if}
    </CardBlock>
  {/if}
{/if}
