<script lang="ts">
  // A browser's bookmarks as the Library's resources (lib/library/bookmarks.ts), in Settings: the
  // files to import, chosen here (Settings → Library) or in Export and Import (`files`); what
  // importing them would do, before anything's written; then the import, and what it did
  // (ImportStep.svelte). Rows of the card of its group.
  import { onMount, untrack } from "svelte";
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import { type BookmarksInput, libraryLinks } from "../../library/bookmarkImport";
  import { planImport, readBookmarks } from "../../library/bookmarks";
  import { imports } from "../../imports/imports.svelte";
  import type { ImportFile } from "../../plugins/types";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";
  import CardBlock from "./CardBlock.svelte";
  import ImportStep from "./ImportStep.svelte";

  let { files, onclose }: { files?: ImportFile[]; onclose?: () => void } = $props();

  const ID = "bookmarks";
  const list = (names: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(names);

  let picker = $state<HTMLInputElement>();
  let importButton = $state<HTMLElement>();
  let reading = $state(false);
  /** The files chosen here, read; or those chosen in Export and Import. */
  let chosen = $state.raw<ImportFile[] | null>(untrack(() => files) ?? null);

  const read = $derived((chosen ?? []).map(({ name, text }) => ({ name, bookmarks: readBookmarks(text) })));
  const unreadable = $derived(read.filter((file) => !file.bookmarks).map((file) => file.name));
  const bookmarks = $derived(read.flatMap((file) => file.bookmarks ?? []));
  const name = $derived(list(read.filter((file) => file.bookmarks).map((file) => file.name)));
  /** What importing them would do, with the library as it was when they were chosen; worked out again as they're imported. */
  const plan = $derived(planImport(bookmarks, untrack(libraryLinks)));
  let folderTags = $state(false);

  const found = $derived(t("library.bookmarks.found", { count: bookmarks.length, name }));
  /** What's left out, and why: each reason there are some for. */
  const leftOut = $derived((["there", "repeated", "other"] as const).flatMap((why) => (plan[why] ? [t(`library.bookmarks.${why}`, { count: plan[why] })] : [])));
  const lines = $derived([found, ...leftOut, ...(plan.add.length ? [] : [t("library.bookmarks.imported", { count: 0, there: plan.there })])]);
  /** Asked about, or imported from here before (Settings closed and opened again meanwhile). */
  const shown = $derived(bookmarks.length > 0 || (!files && imports.state?.id === ID));

  onMount(() => {
    if (files) {
      imports.clear(ID);
      if (bookmarks.length) speak(found);
    }
  });

  async function bookmarksChosen() {
    const picked = [...(picker?.files ?? [])];
    if (picker) picker.value = "";
    if (!picked.length) return;
    reading = true;
    imports.clear(ID);
    chosen = await Promise.all(picked.map(async (file) => ({ name: file.name, text: await file.text() })));
    reading = false;
    if (bookmarks.length) speak(found);
  }

  function close() {
    chosen = null;
    imports.clear(ID);
    if (onclose) onclose();
    else importButton?.focus();
  }

  const input = (): BookmarksInput => ({ bookmarks: $state.snapshot(bookmarks), folderTags });
</script>

{#if !files}
  <CardBlock class="items-start">
    <Button icon="import" busy={reading} disabled={reading} onclick={() => picker?.click()} {@attach (button: HTMLElement) => void (importButton = button)}>
      {reading ? t("library.bookmarks.reading") : t("library.bookmarks.import")}
    </Button>
    <input bind:this={picker} type="file" multiple accept=".html,.htm,.json,text/html,application/json" class="hidden" onchange={bookmarksChosen} />
  </CardBlock>
{/if}
{#if unreadable.length}
  <CardBlock>
    <Callout tone="danger" class="w-full">{t("library.bookmarks.unreadable", { name: list(unreadable) })}</Callout>
  </CardBlock>
{/if}
{#if shown}
  {#key chosen}
    <ImportStep
      id={ID}
      {lines}
      action={plan.add.length ? t("library.bookmarks.start", { count: plan.add.length }) : undefined}
      onimport={() => imports.start(ID, input())}
      oncancel={close}
      result={(done) => t("library.bookmarks.imported", { count: done.added, there: plan.there })}
      undone={(undone) => t("library.bookmarks.undone", { count: undone.trashed })}
    >
      {#snippet options()}
        {#if plan.add.length}
          <FieldRow label={t("library.bookmarks.folderTags")} note={t("library.bookmarks.folderTagsNote")}>
            <Switch label={t("library.bookmarks.folderTags")} checked={folderTags} onchange={(on) => (folderTags = on)} />
          </FieldRow>
        {/if}
      {/snippet}
    </ImportStep>
  {/key}
{/if}
