<script lang="ts" generics="T extends { id: string }">
  import { Popover } from "bits-ui";
  import type { Snippet } from "svelte";
  import Button from "../components/ui/Button.svelte";
  import { floating } from "../components/ui/styles";
  import TextField from "../components/ui/TextField.svelte";
  import { t } from "../i18n/index.svelte";
  import { openExternal } from "../platform";
  import type { SearchPage } from "../plugins/types";
  import { pointAt } from "../popover";

  /*
   * Something on the web to search and pick from, at the cursor: pictures (WebImagePicker.svelte),
   * papers (PaperPicker.svelte), things for the library (AddToLibrary.svelte, under its button). It
   * opens on what `search` finds for nothing typed (what a library
   * features, or `hint`), and searches as you type. ↵ in the field takes the first result; ↓ goes
   * into them, the arrow keys move between them (`columns` to a row) and ↵ takes one. More load on
   * scrolling to the end.
   */

  type Props = {
    /** What's searched, as it's known: "Unsplash", "arXiv". */
    name: string;
    /** What the picker and its field are called, if not "Search <name>". */
    title?: string;
    /** Said under the results, linking to what's searched. */
    credit?: { text: string; href: string; title?: string };
    /** Above the field: what to search in, say. */
    header?: Snippet;
    /** Under the results, beside the credit: another way to go on. */
    footer?: Snippet;
    search: (query: string, page: number, signal: AbortSignal) => Promise<SearchPage<T>>;
    /** Shown while nothing's typed and nothing's found for it. */
    hint?: string;
    /** How many results to a row, for the arrow keys. */
    columns: number;
    /** What a screen reader says for a result, and its tooltip. */
    label: (item: T) => string;
    /** A result, drawn inside its button. */
    item: Snippet<[T]>;
    /** Classes for the list of results, and for each result's button. */
    listClass: string;
    itemClass: string;
    /** The popover's width, as a Tailwind class. */
    widthClass: string;
    x: number;
    y: number;
    onchoose: (item: T) => void;
    onclose: () => void;
  };
  let { name, title, credit, header, footer, search, hint, columns, label, item, listClass, itemClass, widthClass, x, y, onchoose, onclose }: Props = $props();
  const named = $derived(title ?? t("editor.web.search", { name }));

  /** How long typing pauses before it searches. */
  const PAUSE = 300;

  let open = $state(true);
  let query = $state("");
  let items = $state.raw<T[]>([]);
  let more = $state(false);
  /** Searching (the results shown step back), loading more of them, or neither. */
  let status = $state<"searching" | "loading" | "done" | "failed">("searching");
  /** The result Tab lands on: the one focused last. */
  let active = $state(0);
  let field = $state<HTMLInputElement>();
  let scroller = $state<HTMLElement>();
  let list = $state<HTMLElement>();
  /** The words last searched for. */
  let requested = $state("");

  /** The last page found, and whether the last load was of more. */
  let page = 0;
  let loadingMore = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load(next = false) {
    clearTimeout(timer);
    timer = undefined;
    controller?.abort();
    const request = (controller = new AbortController());
    requested = query.trim();
    loadingMore = next;
    status = next ? "loading" : "searching";
    try {
      const found = await search(requested, next ? page + 1 : 1, request.signal);
      if (request.signal.aborted) return;
      page = next ? page + 1 : 1;
      if (next) {
        // A page can repeat results from the one before, when the library has added some since.
        const shown = new Set(items.map((each) => each.id));
        items = [...items, ...found.items.filter((each) => !shown.has(each.id))];
      } else {
        items = found.items;
        active = 0;
        scroller?.scrollTo({ top: 0 });
      }
      more = found.more && found.items.length > 0;
      status = "done";
    } catch (error) {
      if (request.signal.aborted) return;
      console.error(`lines: couldn't search ${name}`, error);
      // What was shown isn't for what's typed now; more that didn't load can be tried again below the rest.
      if (!next) items = [];
      status = "failed";
    }
  }

  void load();

  /** Searches again for what's typed, now: what's searched has changed (another kind of thing to find). */
  export function searchAgain() {
    void load();
  }

  /** Closes it, something other than a result chosen (a footer's button). */
  export function close() {
    open = false;
  }

  // Nothing more to wait for once it's closed.
  $effect(() => () => {
    clearTimeout(timer);
    controller?.abort();
  });

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(load, PAUSE);
  }

  function choose(chosen: T) {
    onchoose(chosen);
    open = false;
  }

  function onFieldKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      // The first of what's shown, once it's for what's typed; until then, search for it now.
      const current = !timer && query.trim() === requested;
      if (current && (status === "done" || status === "loading")) {
        if (items[0]) choose(items[0]);
      } else if (!current || status === "failed") void load();
    } else if (event.key === "ArrowDown" && items.length) {
      event.preventDefault();
      focusAt(active);
    }
  }

  function focusAt(index: number) {
    const option = list?.children[index] as HTMLElement | undefined;
    option?.focus();
    option?.scrollIntoView({ block: "nearest" });
  }

  /** The arrow keys move through the results, ↑ from the first row back to the field; Home and End go to their ends. */
  function onListKeydown(event: KeyboardEvent) {
    const last = items.length - 1;
    const row = (index: number) => Math.floor(index / columns);
    let next: number;
    if (event.key === "ArrowRight" && columns > 1) next = Math.min(active + 1, last);
    else if (event.key === "ArrowLeft" && columns > 1) next = Math.max(active - 1, 0);
    else if (event.key === "ArrowDown") next = row(active) === row(last) ? active : Math.min(active + columns, last);
    else if (event.key === "ArrowUp") next = active - columns;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    if (next < 0) field?.focus();
    else focusAt(next);
  }

  /** Loads the next page once the end of the results comes into view. */
  function loadsMore(node: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && void load(true), {
      root: scroller,
      rootMargin: "0px 0px 240px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }

  const message = $derived(
    status === "searching" || status === "loading"
      ? t("editor.web.searching")
      : status === "failed"
        ? t("editor.web.failed", { name })
        : items.length
          ? t("editor.web.found", { count: items.length })
          : !requested && hint
            ? hint
            : t("editor.web.none", { query: requested }),
  );
</script>

<Popover.Root bind:open onOpenChangeComplete={(opened) => !opened && onclose()}>
  <Popover.Portal>
    <Popover.Content
      customAnchor={pointAt(x, y)}
      side="bottom"
      align="start"
      sideOffset={6}
      collisionPadding={8}
      role="dialog"
      aria-label={named}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        field?.focus();
      }}
      onCloseAutoFocus={(event) => event.preventDefault()}
      class="{floating} flex {widthClass} max-h-(--bits-floating-available-height) flex-col p-2.5"
    >
      {@render header?.()}
      <TextField
        bind:input={field}
        bind:value={query}
        type="search"
        icon="search"
        placeholder={named}
        aria-label={named}
        autocomplete="off"
        spellcheck="false"
        {oninput}
        onkeydown={onFieldKeydown}
        class="mb-2 [&_input::-webkit-search-cancel-button]:hidden"
      />
      <!-- A fixed height, so the picker doesn't jump around while searching. -->
      <div bind:this={scroller} class="-mx-1 h-[min(360px,calc(100dvh-150px))] overflow-x-hidden overflow-y-auto overscroll-contain p-1">
        <div bind:this={list} role="listbox" tabindex="-1" aria-label={name} onkeydown={onListKeydown} class={[listClass, "transition-opacity", status === "searching" && "opacity-50"]}>
          {#each items as each, i (each.id)}
            <button
              role="option"
              aria-selected={i === active}
              tabindex={i === active ? 0 : -1}
              aria-label={label(each)}
              title={label(each)}
              onfocus={() => (active = i)}
              onclick={() => choose(each)}
              class="{itemClass} cursor-pointer outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {@render item(each)}
            </button>
          {/each}
        </div>
        {#if more && status === "done"}
          <div {@attach loadsMore} class="h-px"></div>
        {/if}
        <!-- Said as it changes; shown while there are no results, or when more couldn't load. -->
        <p role="status" class={items.length && status !== "failed" ? "sr-only" : "m-0 mt-10 mb-3 px-4 text-center text-sm text-faint"}>{message}</p>
        {#if status === "failed"}
          <div class="flex justify-center"><Button variant="secondary" onclick={() => load(loadingMore)}>{t("editor.web.retry")}</Button></div>
        {/if}
      </div>
      {#if credit || footer}
        <div class="mt-2 flex items-center gap-3">
          {#if credit}
            <button
              class="ml-1 min-w-0 cursor-pointer text-left text-2xs text-faint underline-offset-2 hover:text-muted hover:underline"
              title={credit.title}
              onclick={() => openExternal(credit.href)}>{credit.text}</button
            >
          {/if}
          {@render footer?.()}
        </div>
      {/if}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
