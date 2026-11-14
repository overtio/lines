<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import { onMount, untrack } from "svelte";
  import { speak } from "../a11y";
  import type { KeptBook } from "../books/books";
  import { reading } from "../books/reading.svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { lock } from "../lock/lock.svelte";
  import { getAttachment, whenArrived } from "../notes/attachments";
  import type { Entry } from "../notes/store.svelte";
  import { isApple } from "../platform";
  import { plugins } from "../plugins/registry.svelte";
  import type { BookFlow, BookPlace, Reading } from "../plugins/types";
  import { prefs } from "../prefs.svelte";
  import { ui } from "../ui.svelte";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import Segmented from "./ui/Segmented.svelte";
  import TextField from "./ui/TextField.svelte";
  import { floating, option } from "./ui/styles";

  /*
   * A book kept with a note, read in the note's place (docs/library.md#books-you-keep): its
   * reader plugin draws it (`bookReaders`), and around it lines puts its contents, search, pages or
   * scrolling, a PDF's colors, keeping a quote, and how far through it is. The keys turn its pages
   * (← goes on in a right-to-left book), and the rest go on to lines' shortcuts; what's chosen and
   * ⌘⇧H (as highlighting in a note) keeps it as a quote in the note, with a link back.
   */

  let { entry, book }: { entry: Entry; book: KeptBook } = $props();

  /** A place gone to this much past what's been read (contents, a search) is skipped to: reading on from there doesn't count. */
  const SKIP = 0.02;
  /** The most a search lists. */
  const MATCHES = 50;

  const id = untrack(() => entry.note.id);
  const reader = untrack(() => plugins.bookReader(book.name));
  let root: HTMLDivElement;
  let host: HTMLDivElement;
  let opened = $state<Reading | null>(null);
  let status = $state<"loading" | "missing" | "failed" | "open">("loading");
  let place = $state<BookPlace | null>(null);
  /** How far the book's been read, and whether the place shown was skipped to, past that. */
  let furthest = 0;
  let skipped = false;
  let chosen = $state(false);
  let query = $state("");
  let searching = $state(false);
  let found = $state<{ label: string; matches: { at: string; excerpt: string }[] }[] | null>(null);
  let contentsOpen = $state(false);
  let contentsButton = $state<HTMLElement>();
  let searchField = $state<HTMLInputElement>();
  const quoteKey = isApple ? "⌘⇧H" : "Ctrl+Shift+H";
  const narrow = $derived(ui.layout === "narrow");

  const FLOWS = [
    { id: "paginated", label: t("books.paginated"), icon: "columns-2" },
    { id: "scrolled", label: t("books.scrolled"), icon: "rows-2" },
  ] as const;

  /** Keys that turn pages: paginated, the arrows, Page Up and Down and the space bar; scrolled, the arrows to the sides, as scrolling does the rest. */
  function onkey(event: KeyboardEvent): boolean {
    if (!opened || event.altKey) return false;
    const mod = isApple ? event.metaKey : event.ctrlKey;
    if (mod && event.shiftKey && event.key.toLowerCase() === "h") {
      keepQuote();
      return true;
    }
    if (event.ctrlKey || event.metaKey) return false;
    const paginated = prefs.bookFlow === "paginated";
    const [on, back] = opened.rtl ? ["ArrowLeft", "ArrowRight"] : ["ArrowRight", "ArrowLeft"];
    const forward = event.key === on || (paginated && (event.key === "PageDown" || event.key === "ArrowDown" || (event.key === " " && !event.shiftKey)));
    const backward = event.key === back || (paginated && (event.key === "PageUp" || event.key === "ArrowUp" || (event.key === " " && event.shiftKey)));
    if (!forward && !backward) return false;
    opened.turn(forward);
    return true;
  }

  /**
   * Keys pressed in the book's own document (an EPUB's frame): those that turn pages turn them, and
   * the rest go on to lines (⌘Z, ⌘⇧F…) as if pressed here.
   */
  function keydown(event: KeyboardEvent): boolean {
    if (onkey(event)) return true;
    const { key, code, ctrlKey, metaKey, shiftKey, altKey, repeat } = event;
    const passed = new KeyboardEvent("keydown", { key, code, ctrlKey, metaKey, shiftKey, altKey, repeat, bubbles: true, cancelable: true, composed: true });
    host.dispatchEvent(passed);
    return passed.defaultPrevented;
  }

  /** Keys anywhere in the reader, but in its field and buttons, which keep theirs (all but ⌘⇧H). */
  function onDocumentKeydown(event: KeyboardEvent) {
    const target = event.target as Element;
    if (!root?.contains(target)) return;
    if (target.closest("input, button, [role=radio]") && !(event.shiftKey && event.key.toLowerCase() === "h")) return;
    if (onkey(event)) event.preventDefault();
  }

  function moved(next: BookPlace, read: boolean) {
    // Reading on from what's been read counts; from a place skipped to, not until it's back.
    if (!read || next.progress <= furthest + SKIP) skipped = next.progress > furthest + SKIP;
    if (read && !skipped) furthest = Math.max(furthest, next.progress);
    place = next;
    reading.keep(id, book.name, next, furthest);
  }

  function keepQuote() {
    const selection = opened?.selection();
    if (!selection?.text.trim()) return;
    reading.quote(id, book, selection.text, selection, t("books.didUndoQuote"));
    speak(t("books.quoteKept", { place: selection.label }));
    // Back to the book, to read on.
    opened?.focus();
  }

  function go(at: string, mark?: string) {
    opened?.go(at, mark);
    opened?.focus();
  }

  let controller: AbortController | null = null;

  /** Searches the book, its matches listed under the chapters or pages they're in. */
  async function search() {
    const words = query.trim();
    if (!opened || !words) return;
    controller?.abort();
    const current = (controller = new AbortController());
    searching = true;
    try {
      const matches = await opened.search(words, MATCHES, current.signal);
      speak(t("books.found", { count: matches.length }));
      const groups: NonNullable<typeof found> = [];
      for (const match of matches) {
        const last = groups.at(-1);
        if (last?.label === match.label) last.matches.push(match);
        else groups.push({ label: match.label, matches: [match] });
      }
      found = groups;
    } catch (error) {
      if (!current.signal.aborted) console.error("lines: couldn't search the book", error);
    } finally {
      if (controller === current) searching = false;
    }
  }

  function setFlow(flow: BookFlow) {
    prefs.bookFlow = flow;
    opened?.setFlow(flow);
  }

  function setThemeColors(on: boolean) {
    prefs.bookThemeColors = on;
    opened?.setThemeColors?.(on);
  }

  onMount(() => {
    let gone = false;
    let shown: Reading | null = null;
    let cancel: (() => void) | undefined;
    const show = async () => {
      const [data] = await Promise.all([getAttachment(book.name), reading.load()]);
      if (gone) return;
      if (!data) {
        status = "missing";
        cancel = whenArrived(book.name, () => void show());
        return;
      }
      const position = reading.positionOf(id, book.name);
      furthest = Math.max(position?.furthest ?? 0, reading.progressIn(id));
      place = position?.place ?? null;
      try {
        shown = await reader!.open(host, {
          data,
          title: untrack(() => entry.meta.title),
          at: reading.open?.at ?? position?.place.at,
          flow: prefs.bookFlow,
          themeColors: prefs.bookThemeColors,
          moved,
          selected: (yes) => (chosen = yes),
          keydown,
          active: () => lock.active(),
        });
        if (gone) return shown.destroy();
        opened = shown;
        status = "open";
        shown.focus();
      } catch (error) {
        console.error("lines: couldn't open the book", error);
        status = "failed";
      }
    };
    void show();
    const resized = new ResizeObserver(() => shown?.layout());
    resized.observe(host);
    return () => {
      gone = true;
      cancel?.();
      resized.disconnect();
      controller?.abort();
      shown?.destroy();
      reading.record(id);
      void reading.save();
    };
  });

  // A quote's link followed while the book's open here goes to its place.
  let followed = untrack(() => reading.open);
  $effect(() => {
    const open = reading.open;
    if (!opened || open === followed || open?.note !== id || !open.at) return;
    followed = open;
    untrack(() => go(open.at!));
  });

  $effect(() => {
    prefs.watchLayout();
    void prefs.theme;
    untrack(() => opened?.layout());
  });
</script>

<svelte:document onkeydown={onDocumentKeydown} />

<div class="flex min-h-0 flex-1 flex-col" role="region" aria-label={entry.meta.title} bind:this={root}>
  <div class="flex shrink-0 items-center gap-1.5 px-3 pb-2">
    <IconButton
      icon="list"
      iconSize={17}
      label={t("books.contents")}
      open={contentsOpen}
      aria-haspopup="menu"
      aria-expanded={contentsOpen}
      disabled={!opened?.contents.length}
      onclick={(event) => {
        contentsButton = event.currentTarget;
        contentsOpen = !contentsOpen;
      }}
    />
    <TextField
      class="min-w-0 flex-1 sm:max-w-64"
      type="search"
      icon="search"
      placeholder={narrow ? t("books.searchShort") : t("books.search")}
      aria-label={t("books.search")}
      aria-busy={searching}
      disabled={!opened}
      bind:value={query}
      bind:input={searchField}
      onkeydown={(event) => {
        if (event.key === "Enter") void search();
      }}
    />
    <div class="hidden flex-1 sm:block"></div>
    <Segmented options={FLOWS} value={prefs.bookFlow} label={t("books.flow")} onselect={setFlow} class="shrink-0 flex-nowrap!">
      {#snippet content(flow)}
        <Icon name={flow.icon!} size={15} />
        {#if narrow}<span class="sr-only">{flow.label}</span>{:else}{flow.label}{/if}
      {/snippet}
    </Segmented>
    {#if opened?.setThemeColors}
      <IconButton
        icon="paintbrush"
        iconSize={17}
        on={prefs.bookThemeColors}
        aria-pressed={prefs.bookThemeColors}
        label={t("books.themeColors")}
        onclick={() => setThemeColors(!prefs.bookThemeColors)}
      />
    {/if}
    {#if narrow}
      <IconButton icon="text-quote" iconSize={17} disabled={!chosen} label={t("books.keepQuote")} tooltip={t("books.keepQuoteWithKey", { key: quoteKey })} onclick={keepQuote} />
    {:else}
      <Button variant="quiet" icon="text-quote" disabled={!chosen} title={t("books.keepQuoteWithKey", { key: quoteKey })} onclick={keepQuote}>{t("books.keepQuote")}</Button>
    {/if}
  </div>

  <div class="relative min-h-0 flex-1 overflow-hidden bg-surface text-fg" bind:this={host}>
    {#if status !== "open"}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-faint" role={status === "loading" ? "status" : "alert"}>
        <Icon name={status === "loading" ? "loader" : "circle-alert"} size={36} strokeWidth={1.25} class={status === "loading" ? "animate-spin" : undefined} />
        <p class="m-0 text-md">{status === "loading" ? t("books.opening") : status === "missing" ? t("books.missing") : t("books.failed")}</p>
      </div>
    {/if}
  </div>

  <div class="flex h-9 shrink-0 items-center gap-2 px-3 text-xs text-faint">
    <!-- Left and right as the pages go: in a right-to-left book, left is the next page. -->
    <IconButton icon="chevron-left" iconSize={16} label={opened?.rtl ? t("books.next") : t("books.previous")} disabled={!opened} onclick={() => opened?.turn(!!opened.rtl)} />
    <span class="min-w-0 flex-1 truncate" aria-live="polite">{place?.label ?? ""}</span>
    {#if place}
      <span class="h-[3px] w-24 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <span class="block h-full rounded-full bg-accent" style:width="{Math.round(place.progress * 100)}%"></span>
      </span>
      <span class="tabular w-9 text-right">{t("books.percent", { percent: Math.floor(place.progress * 100) })}</span>
    {/if}
    <IconButton icon="chevron-right" iconSize={16} label={opened?.rtl ? t("books.previous") : t("books.next")} disabled={!opened} onclick={() => opened?.turn(!opened.rtl)} />
  </div>
</div>

<!-- The contents, nested as the book's are, by indent. -->
<DropdownMenu.Root bind:open={contentsOpen}>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      customAnchor={contentsButton}
      align="start"
      sideOffset={6}
      collisionPadding={8}
      aria-label={t("books.contents")}
      class="{floating} max-h-[min(70vh,var(--bits-dropdown-menu-content-available-height))] w-[min(360px,calc(100vw-16px))] overflow-y-auto p-[5px]"
    >
      {#each opened?.contents ?? [] as chapter, i (i)}
        <DropdownMenu.Item class="{option} h-auto! min-h-row py-1.5 whitespace-normal!" style="padding-inline-start: {10 + chapter.depth * 16}px" onSelect={() => go(chapter.at)}>
          {chapter.label}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<!-- A search's matches, under the chapter or page each is in, as much as fits. -->
<DropdownMenu.Root bind:open={() => !!found, (open) => !open && (found = null)}>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      customAnchor={searchField}
      align="start"
      sideOffset={6}
      collisionPadding={8}
      aria-label={t("books.found", { count: found?.reduce((sum, group) => sum + group.matches.length, 0) ?? 0 })}
      class="{floating} max-h-[min(60vh,var(--bits-dropdown-menu-content-available-height))] w-[min(420px,calc(100vw-16px))] overflow-y-auto p-[5px]"
    >
      {#each found ?? [] as group, i (i)}
        <DropdownMenu.Group>
          <DropdownMenu.GroupHeading class="truncate px-2.5 pt-2 pb-1 text-xs font-semibold text-muted">{group.label}</DropdownMenu.GroupHeading>
          {#each group.matches as match, j (j)}
            <DropdownMenu.Item class="{option} h-auto! py-1.5 whitespace-normal!" onSelect={() => go(match.at, query.trim())}>
              <span class="line-clamp-3 text-sm">{match.excerpt}</span>
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Group>
      {:else}
        <DropdownMenu.Item class={option} disabled>{t("books.nothingFound")}</DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
