<script module lang="ts">
  import type { PictureSource } from "../plugins/types";

  /** Each source's categories, asked for once while lines runs. */
  const known = new Map<string, Promise<string[]>>();

  function categoriesOf(source: PictureSource) {
    let categories = known.get(source.id);
    if (!categories) {
      categories = source.categories();
      known.set(source.id, categories);
      // Asked for again next time, rather than failing until lines restarts.
      categories.catch(() => known.delete(source.id));
    }
    return categories;
  }

  /** The category last shown from each source, which it opens on next time. */
  const KEY = "lines.pictures";

  function remembered(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
    } catch {
      return {};
    }
  }

  function remember(source: PictureSource, category: string) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...remembered(), [source.id]: category }));
    } catch {
      // Storage that can't be written: it opens on the first category next time.
    }
  }
</script>

<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { speak } from "../a11y";
  import { insertPicture } from "../editor/attachments";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { loadImage } from "../net";
  import { coarsePointer, openExternal } from "../platform";
  import type { Picture } from "../plugins/types";
  import { dismissable, gridStep, placeAt, takeFocus } from "../popover";
  import { ui } from "../ui.svelte";

  /** Two rows of three. */
  const COUNT = 6;

  type Shown = { category: string } | { search: string };

  let el = $state<HTMLDivElement>();
  let query = $state("");
  let categories = $state<string[]>([]);
  let shown = $state<Shown | null>(null);
  let pictures = $state<Picture[]>([]);
  let status = $state<"loading" | "ready" | "failed">("loading");
  /** The picture whose credit shows under the others: the one pointed at or focused. */
  let current = $state<Picture | null>(null);
  const loaded = new SvelteSet<string>();
  const broken = new SvelteSet<string>();
  /** Counts what's been asked for, so only the latest answer shows. */
  let asked = 0;

  const pick = $derived(ui.picturePicker);
  const source = $derived(pick?.source);
  const typed = $derived(query.trim().toLowerCase());
  const matching = $derived(typed ? categories.filter((category) => category.includes(typed)) : categories);
  /** What's typed, to search for, when the source can search and it isn't one of the categories. */
  const searchable = $derived(source?.search && typed.length > 1 && !categories.includes(typed) ? query.trim() : null);
  const chosen = $derived(shown && "category" in shown ? shown.category : null);
  const credited = $derived(pictures.some((picture) => picture.credit));

  $effect(() => {
    const p = ui.picturePicker;
    if (!p || !el) return;
    placeAt(el, p.x, p.y);
    // The search field, except on phones, where it would pop up the keyboard.
    const restore = takeFocus(el, coarsePointer.matches ? el : el.querySelector("input")!);
    void open(p.source);
    return restore;
  });

  $effect(() => {
    if (ui.picturePicker) return dismissable(() => el, close);
  });

  function close() {
    ui.picturePicker = null;
    asked++;
    query = "";
    categories = [];
    shown = null;
    pictures = [];
    current = null;
    loaded.clear();
    broken.clear();
  }

  async function open(from: PictureSource) {
    status = "loading";
    try {
      const list = await categoriesOf(from);
      if (ui.picturePicker?.source !== from) return;
      categories = list;
      const last = remembered()[from.id];
      if (list.length) await show({ category: list.includes(last) ? last : list[0] });
    } catch (error) {
      console.error(`lines: couldn't reach ${from.name}`, error);
      if (ui.picturePicker?.source === from) status = "failed";
    }
  }

  /** Shows pictures from a category or a search, new ones each time. */
  async function show(what: Shown) {
    if (!source) return;
    const ask = ++asked;
    shown = what;
    status = "loading";
    if ("category" in what) remember(source, what.category);
    try {
      const found = "category" in what ? await source.pictures(what.category, COUNT) : await source.search!(what.search, COUNT);
      if (ask !== asked) return;
      pictures = found.slice(0, COUNT);
      status = "ready";
      speak(pictures.length ? t("pictures.shown", { count: pictures.length }) : t("pictures.none"));
    } catch (error) {
      if (ask !== asked) return;
      console.error(`lines: couldn't reach ${source.name}`, error);
      status = "failed";
    }
  }

  const retry = () => (source && !categories.length ? open(source) : shown && show(shown));

  /** What a picture is of, as its alt text: its category, and the anime or artist it's from. */
  function alt(picture: Picture) {
    if (!shown || !("category" in shown)) return picture.credit ?? shown?.search ?? "";
    return picture.credit ? `${shown.category} (${picture.credit})` : shown.category;
  }

  function choose(picture: Picture) {
    const p = ui.picturePicker;
    if (!p) return;
    const text = alt(picture);
    close();
    insertPicture(p.view, p.pos, picture.url, text);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const tabStop = (selector: string) => el?.querySelector<HTMLElement>(`${selector} [tabindex="0"]`);

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      const category = matching.find((each) => each === typed) ?? matching[0];
      if (category) void show({ category });
      else if (searchable) void show({ search: searchable });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      tabStop(".categories")?.focus();
    }
  }

  /**
   * Arrow keys move through a grid by position. Up from the categories' first row goes to the search
   * field, down from their last to the pictures, and up from the pictures' first row back to them.
   */
  function moveIn(selector: string, above: () => HTMLElement | null | undefined, below?: () => HTMLElement | null | undefined) {
    return (event: KeyboardEvent) => {
      const items = [...el!.querySelectorAll<HTMLElement>(`${selector} [role="option"]`)];
      let next = gridStep(event.key, items, event.currentTarget as HTMLElement);
      if (next === undefined) return;
      event.preventDefault();
      if (next === null) next = event.key === "ArrowUp" ? above() : event.key === "ArrowDown" ? below?.() : null;
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };
  }

  const onCategoryKeydown = moveIn(
    ".categories",
    () => el?.querySelector("input"),
    () => tabStop(".pictures"),
  );
  const onPictureKeydown = moveIn(".pictures", () => tabStop(".categories"));
</script>

{#if pick && source}
  <div
    class="picker popover"
    role="dialog"
    aria-label={t("pictures.from", { name: source.name })}
    tabindex="-1"
    bind:this={el}
    {onkeydown}
  >
    <header>
      <button class="source" title={t("pictures.site", { name: source.name })} onclick={() => openExternal(source.site)}>
        <Icon name={source.icon} size={15} strokeWidth={1.75} /><span>{source.name}</span>
      </button>
      <button
        class="icon-button"
        aria-label={t("pictures.more")}
        title={t("pictures.more")}
        disabled={!shown}
        onclick={() => shown && show(shown)}
      >
        <Icon name="refresh" size={15} strokeWidth={1.75} />
      </button>
    </header>
    <input
      type="search"
      placeholder={t("pictures.search")}
      aria-label={t("pictures.search")}
      autocomplete="off"
      spellcheck="false"
      bind:value={query}
      onkeydown={onSearchKeydown}
    />
    <div class="categories" role="listbox" aria-label={t("pictures.categories")}>
      {#each matching as category, i (category)}
        <button
          role="option"
          tabindex={category === chosen || (!matching.includes(chosen ?? "") && i === 0) ? 0 : -1}
          aria-selected={category === chosen}
          onclick={() => show({ category })}
          onkeydown={onCategoryKeydown}>{category}</button
        >
      {/each}
      {#if searchable}
        <button
          role="option"
          tabindex={matching.length ? -1 : 0}
          aria-selected={!!shown && "search" in shown && shown.search === searchable}
          onclick={() => show({ search: searchable })}
          onkeydown={onCategoryKeydown}
        >
          <Icon name="search" size={12} strokeWidth={2} />{t("pictures.searchFor", { query: searchable })}
        </button>
      {:else if typed && !matching.length && categories.length}
        <p class="empty">{t("pictures.noMatches", { query: query.trim() })}</p>
      {/if}
    </div>
    <div class="pictures" class:dim={status === "loading" && pictures.length > 0} aria-busy={status === "loading"}>
      {#if status === "failed"}
        <div class="failed" role="alert">
          <p>{t("pictures.failed", { name: source.name })}</p>
          <button class="text-button" onclick={retry}>{t("pictures.retry")}</button>
        </div>
      {:else if status === "loading" && !pictures.length}
        {#each { length: COUNT } as _, i (i)}<span class="tile"></span>{/each}
      {:else if status === "ready" && !pictures.length}
        <p class="empty">{t("pictures.none")}</p>
      {:else}
        <div class="grid" role="listbox" aria-label={t("pictures.pictures")}>
          {#each pictures as picture, i (picture.url)}
            <button
              role="option"
              class="tile"
              tabindex={i === 0 ? 0 : -1}
              aria-selected="false"
              aria-label={alt(picture)}
              onclick={() => choose(picture)}
              onkeydown={onPictureKeydown}
              onpointerenter={() => (current = picture)}
              onfocus={() => (current = picture)}
            >
              {#if broken.has(picture.url)}
                <Icon name="image" size={18} strokeWidth={1.5} />
              {:else}
                <img
                  alt=""
                  decoding="async"
                  class:loaded={loaded.has(picture.url)}
                  onload={() => loaded.add(picture.url)}
                  {@attach (img) => loadImage(img, picture.url, () => broken.add(picture.url))}
                />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    {#if credited}
      <!-- Each picture's button says its credit to screen readers already. -->
      <p class="credit" aria-hidden="true">{current?.credit ?? ""}</p>
    {/if}
  </div>
{/if}

<style>
  .picker {
    width: min(368px, calc(100vw - 16px));
    padding: 10px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: -2px 0 8px;
  }

  .source {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    height: 26px;
    padding: 0 4px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .source span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .source :global(.icon) {
    color: var(--accent);
  }

  .source:hover {
    background: var(--hover);
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    color: var(--text-muted);
  }

  .icon-button:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .icon-button:disabled {
    opacity: 0.4;
  }

  input {
    width: 100%;
    height: 30px;
    margin-bottom: 8px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--input);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent-soft);
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  /* Three rows of categories and a glimpse of the next, a fixed height so the pictures don't move while searching. */
  .categories {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 4px;
    height: 100px;
    margin: 0 -4px 8px;
    padding: 0 4px;
    overflow: hidden auto;
    overscroll-behavior: contain;
  }

  .categories button {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 9px;
    border-radius: 13px;
    background: var(--hover);
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .categories button:hover {
    color: var(--text);
  }

  .categories button[aria-selected="true"] {
    background: var(--accent);
    color: var(--bg);
  }

  .categories button[aria-selected="true"]:focus-visible {
    box-shadow:
      0 0 0 2px var(--bg-elevated),
      0 0 0 4px var(--accent);
  }

  .pictures,
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .pictures {
    transition: opacity 150ms;
  }

  .pictures.dim {
    opacity: 0.5;
  }

  /* The pictures' own grid takes the place of the placeholders, in the same columns. */
  .grid {
    grid-column: 1 / -1;
  }

  .tile {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    background: var(--hover);
    color: var(--text-faint);
  }

  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 200ms;
  }

  .tile img.loaded {
    opacity: 1;
  }


  button.tile:focus-visible {
    outline-offset: -2px;
  }

  .failed,
  .pictures > .empty {
    display: grid;
    grid-column: 1 / -1;
    place-items: center;
    align-content: center;
    gap: 6px;
    aspect-ratio: 3 / 2;
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: var(--text-faint);
  }

  .failed p {
    margin: 0;
  }

  .categories .empty {
    margin: 4px 2px;
    font-size: 12.5px;
    color: var(--text-faint);
  }

  .credit {
    height: 16px;
    margin: 6px 2px 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 12px;
    color: var(--text-faint);
  }

  /* Windows' contrast themes drop backgrounds, which are all that outline these. */
  @media (forced-colors: active) {
    .categories button,
    .tile {
      border: 1px solid CanvasText;
    }
  }

  /* Fingers need bigger targets. */
  @media (pointer: coarse) {
    .categories {
      height: 124px;
    }

    .categories button {
      height: 32px;
      border-radius: 16px;
    }

    .icon-button,
    .source {
      height: 44px;
    }

    .icon-button {
      width: 44px;
    }
  }
</style>
