<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import WebSearchPicker from "../editor/WebSearchPicker.svelte";
  import { addBlank, addToLibrary } from "../library/adding";
  import { lookUp } from "../library/lookup";
  import { shelves } from "../library/shelves.svelte";
  import { linkOnly } from "../library/text";
  import { plugins } from "../plugins/registry.svelte";
  import type { LibraryItem, SearchPage } from "../plugins/types";
  import Button from "./ui/Button.svelte";
  import Segmented from "./ui/Segmented.svelte";
  import LibraryCover from "./LibraryCover.svelte";

  /*
   * Add to Library, under the Library's + in the sidebar: one field, to search the catalogs for a kind
   * of thing (the shelves a source can search: Books, Movies, Shows, Music, Podcasts, Papers) or to
   * paste a link to look up; or Blank, to fill one in by hand. What's chosen is a new note, opened.
   */

  let { x, y, onclose }: { x: number; y: number; onclose: () => void } = $props();

  /** What a search found, and whether it's whole (a link looked up) or only as much as a search says. */
  interface Found {
    id: string;
    item: LibraryItem;
    whole: boolean;
  }

  /** The kinds a source can search for, by shelf, each with the sources that do. */
  const searchable = $derived(
    shelves.all.flatMap((shelf) => {
      const asked = shelf.kinds.flatMap((kind) => plugins.librarySources.filter((source) => source.search && source.searches?.includes(kind.type)).map((source) => ({ kind, source })));
      return asked.length ? [{ shelf, asked }] : [];
    }),
  );
  let chosen = $state(shelves.all[0]?.key ?? "");
  const current = $derived(searchable.find(({ shelf }) => shelf.key === chosen) ?? searchable[0]);

  let picker = $state<{ searchAgain(): void; close(): void }>();

  async function search(query: string, page: number, signal: AbortSignal): Promise<SearchPage<Found>> {
    const text = query.trim();
    if (!text || page > 1) return { items: [], more: false };
    const link = linkOnly(text);
    if (link) {
      const item = await lookUp(link, signal);
      return { items: item ? [{ id: link, item, whole: true }] : [], more: false };
    }
    const asked = current?.asked ?? [];
    const answers = await Promise.allSettled(asked.map(({ kind, source }) => source.search!(kind.type, text, signal)));
    signal.throwIfAborted();
    // Nothing found because every source failed (offline) is a failure; one failing, the others' results.
    if (answers.length && answers.every((answer) => answer.status === "rejected")) throw (answers[0] as PromiseRejectedResult).reason;
    const items = answers.flatMap((answer) => (answer.status === "fulfilled" ? answer.value : []));
    return { items: items.map((item, i) => ({ id: `${i}:${item.link ?? item.title}`, item, whole: false })), more: false };
  }

  /** Who made it and when, as its kind's rows say (`Frank Herbert · 1965`), or what the catalog says it is. */
  function about(item: LibraryItem) {
    const subtitle = plugins.libraryKind(item.type)?.subtitle ?? [];
    const said = subtitle.flatMap((key) => item.properties.find(([each]) => each === key)?.[1] ?? []).join(" · ");
    return said || item.description || "";
  }

  /** The sources the kind chosen is searched in, as they're known: "Open Library". */
  const names = $derived([...new Set(current?.asked.map(({ source }) => source.name))].join(", "));

  const label = ({ item }: Found) => [item.title, about(item)].filter(Boolean).join(", ");
</script>

<WebSearchPicker
  bind:this={picker}
  name={current?.shelf.label ?? ""}
  title={t("library.add.title")}
  {search}
  hint={names ? t("library.add.hint", { names }) : t("library.add.hintLink")}
  columns={1}
  {label}
  listClass="flex flex-col gap-0.5"
  itemClass="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-hover focus-visible:bg-hover"
  widthClass="w-[min(520px,calc(100vw-16px))]"
  {x}
  {y}
  onchoose={({ item, whole }) => addToLibrary(item, whole)}
  {onclose}
>
  {#snippet header()}
    {#if searchable.length > 1}
      <Segmented
        class="mb-2"
        label={t("library.add.kind")}
        options={searchable.map(({ shelf }) => ({ id: shelf.key, label: shelf.label }))}
        value={current?.shelf.key ?? null}
        onselect={(key) => {
          chosen = key;
          picker?.searchAgain();
        }}
      />
    {/if}
  {/snippet}
  {#snippet item({ item }: Found)}
    {@const kind = plugins.libraryKind(item.type)}
    {#if kind}<LibraryCover src={item.cover} {kind} small />{/if}
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-sm font-medium text-fg">{item.title}</span>
      <span class="truncate text-xs text-muted">{about(item)}</span>
    </span>
  {/snippet}
  {#snippet footer()}
    {#if current}
      <Button
        class="ml-auto"
        variant="quiet"
        onclick={() => {
          addBlank(current.shelf.key);
          picker?.close();
        }}>{t("library.add.blank")}</Button
      >
    {/if}
  {/snippet}
</WebSearchPicker>
