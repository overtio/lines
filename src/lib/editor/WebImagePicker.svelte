<script lang="ts">
  import { Popover } from "bits-ui";
  import Button from "../components/ui/Button.svelte";
  import { floating } from "../components/ui/styles";
  import TextField from "../components/ui/TextField.svelte";
  import { t } from "../i18n/index.svelte";
  import { openExternal } from "../platform";
  import { pointAt } from "../popover";
  import type { FoundImage, ImageLibrary } from "./webImages";

  /*
   * A library's pictures to pick from (webImages.ts), at the cursor. It opens on what the library
   * features, and searches as you type. ↵ in the field takes the first picture; ↓ goes into them,
   * the arrow keys move between them and ↵ takes one. More load on scrolling to the end.
   */

  type Props = { library: ImageLibrary; x: number; y: number; onchoose: (image: FoundImage) => void; onclose: () => void };
  let { library, x, y, onchoose, onclose }: Props = $props();

  const COLUMNS = 3;
  /** How long typing pauses before it searches. */
  const PAUSE = 300;

  let open = $state(true);
  let query = $state("");
  let images = $state.raw<FoundImage[]>([]);
  let more = $state(false);
  /** Searching (the pictures shown step back), loading more of them, or neither. */
  let status = $state<"searching" | "loading" | "done" | "failed">("searching");
  /** The picture Tab lands on: the one focused last. */
  let active = $state(0);
  let field = $state<HTMLInputElement>();
  let scroller = $state<HTMLElement>();
  let grid = $state<HTMLElement>();

  /** The words last searched for, the last page found, and whether the last load was of more. */
  let requested = "";
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
      const found = await library.search(requested, next ? page + 1 : 1, request.signal);
      if (request.signal.aborted) return;
      page = next ? page + 1 : 1;
      if (next) {
        // A page can repeat pictures from the one before, when the library has added some since.
        const shown = new Set(images.map((image) => image.id));
        images = [...images, ...found.images.filter((image) => !shown.has(image.id))];
      } else {
        images = found.images;
        active = 0;
        scroller?.scrollTo({ top: 0 });
      }
      more = found.more && found.images.length > 0;
      status = "done";
    } catch (error) {
      if (request.signal.aborted) return;
      console.error(`lines: couldn't search ${library.name}`, error);
      // What was shown isn't for what's typed now; more that didn't load can be tried again below the rest.
      if (!next) images = [];
      status = "failed";
    }
  }

  void load();
  // Nothing more to wait for once it's closed.
  $effect(() => () => {
    clearTimeout(timer);
    controller?.abort();
  });

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(load, PAUSE);
  }

  function choose(image: FoundImage) {
    onchoose(image);
    open = false;
  }

  function onFieldKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      // The first of what's shown, once it's for what's typed; until then, search for it now.
      const current = !timer && query.trim() === requested;
      if (current && (status === "done" || status === "loading")) {
        if (images[0]) choose(images[0]);
      } else if (!current || status === "failed") void load();
    } else if (event.key === "ArrowDown" && images.length) {
      event.preventDefault();
      focusAt(active);
    }
  }

  function focusAt(index: number) {
    const option = grid?.children[index] as HTMLElement | undefined;
    option?.focus();
    option?.scrollIntoView({ block: "nearest" });
  }

  /** The arrow keys move through the grid, ↑ from its first row back to the field; Home and End go to its ends. */
  function onGridKeydown(event: KeyboardEvent) {
    const last = images.length - 1;
    const row = (index: number) => Math.floor(index / COLUMNS);
    let next: number;
    if (event.key === "ArrowRight") next = Math.min(active + 1, last);
    else if (event.key === "ArrowLeft") next = Math.max(active - 1, 0);
    else if (event.key === "ArrowDown") next = row(active) === row(last) ? active : Math.min(active + COLUMNS, last);
    else if (event.key === "ArrowUp") next = active - COLUMNS;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    if (next < 0) field?.focus();
    else focusAt(next);
  }

  /** Loads the next page once the end of the pictures comes into view. */
  function loadsMore(node: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && void load(true), {
      root: scroller,
      rootMargin: "0px 0px 240px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }

  const label = (image: FoundImage) =>
    image.by ? t("editor.images.by", { image: image.alt || t("editor.image"), name: image.by }) : image.alt || t("editor.image");

  const message = $derived(
    status === "searching" || status === "loading"
      ? t("editor.images.searching")
      : status === "failed"
        ? t("editor.images.failed", { name: library.name })
        : images.length
          ? t("editor.images.found", { count: images.length })
          : t("editor.images.none", { query: requested }),
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
      aria-label={t("editor.images.search", { name: library.name })}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        field?.focus();
      }}
      onCloseAutoFocus={(event) => event.preventDefault()}
      class="{floating} flex w-[min(460px,calc(100vw-16px))] flex-col p-2.5"
    >
      <TextField
        bind:input={field}
        bind:value={query}
        type="search"
        icon="search"
        placeholder={t("editor.images.search", { name: library.name })}
        aria-label={t("editor.images.search", { name: library.name })}
        autocomplete="off"
        spellcheck="false"
        {oninput}
        onkeydown={onFieldKeydown}
        class="mb-2 [&_input::-webkit-search-cancel-button]:hidden"
      />
      <!-- A fixed height, so the picker doesn't jump around while searching. -->
      <div bind:this={scroller} class="-mx-1 h-[min(360px,calc(100dvh-150px))] overflow-x-hidden overflow-y-auto overscroll-contain p-1">
        <div bind:this={grid} role="listbox" tabindex="-1" aria-label={library.name} onkeydown={onGridKeydown} class={["grid grid-cols-3 gap-1.5 transition-opacity", status === "searching" && "opacity-50"]}>
          {#each images as image, i (image.id)}
            <button
              role="option"
              aria-selected={i === active}
              tabindex={i === active ? 0 : -1}
              aria-label={label(image)}
              title={label(image)}
              onfocus={() => (active = i)}
              onclick={() => choose(image)}
              style:background-color={image.color}
              class="group relative aspect-4/3 cursor-pointer overflow-hidden rounded-md bg-hover outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <img
                src={image.thumb}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
                onload={(event) => event.currentTarget.setAttribute("data-loaded", "")}
                class="size-full object-cover opacity-0 transition-opacity duration-200 data-loaded:opacity-100"
              />
              {#if image.by}
                <!-- Over the picture, so in white on a shade of it whatever the theme. -->
                <span
                  class="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-[rgb(0_0_0/0.6)] px-2 pt-4 pb-1 text-left text-2xs text-[#fff] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true">{image.by}</span
                >
              {/if}
            </button>
          {/each}
        </div>
        {#if more && status === "done"}
          <div {@attach loadsMore} class="h-px"></div>
        {/if}
        <!-- Said as it changes; shown while there are no pictures, or when more couldn't load. -->
        <p role="status" class={images.length && status !== "failed" ? "sr-only" : "m-0 mt-10 mb-3 text-center text-sm text-faint"}>{message}</p>
        {#if status === "failed"}
          <div class="flex justify-center"><Button variant="secondary" onclick={() => load(loadingMore)}>{t("editor.images.retry")}</Button></div>
        {/if}
      </div>
      <button
        class="mt-2 ml-1 cursor-pointer self-start text-2xs text-faint underline-offset-2 hover:text-muted hover:underline"
        onclick={() => openExternal(library.credit.href)}>{library.credit.text}</button
      >
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
