<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { ICONS, TAG_ICON_GROUPS, type IconName } from "../icons/icons";
  import { dismissable, placeAt, takeFocus } from "../popover";
  import { ui } from "../ui.svelte";

  const COLUMNS = 8;

  let el = $state<HTMLDivElement>();
  let query = $state("");

  const picker = $derived(ui.iconPicker);
  const current = $derived(picker?.icon() ?? null);
  const none = $derived(picker?.none?.active() ?? false);
  // Matches Lucide and SF Symbol names, which between them cover the obvious synonyms.
  // Searching shows every match as one group.
  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "-");
    if (!q) return TAG_ICON_GROUPS;
    const matches = TAG_ICON_GROUPS.flatMap((group) => group.icons).filter(
      (name) => name.includes(q) || ICONS[name][1].replace(/\./g, "-").includes(q),
    );
    return [{ name: "", icons: matches }];
  });

  /**
   * The icon Tab lands on: the chosen one, else the first. The others are reached with the arrow
   * keys, so the grid is one stop between the search field and the buttons.
   */
  const tabStop = $derived.by(() => {
    const all = groups.flatMap((group) => group.icons);
    return current && all.includes(current) ? current : all[0];
  });

  $effect(() => {
    const p = ui.iconPicker;
    if (!p || !el) return;
    placeAt(el, p.x, p.y);
    // Focus the current icon rather than the search field, so phones don't pop up the keyboard.
    const selected = el.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    const restore = takeFocus(el, selected ?? el);
    selected?.scrollIntoView({ block: "center" });
    return restore;
  });

  $effect(() => {
    if (ui.iconPicker) return dismissable(() => el, close);
  });

  function close() {
    ui.iconPicker = null;
    query = "";
  }

  function choose(icon: IconName | null) {
    picker?.set(icon);
    close();
  }

  function chooseNone() {
    picker?.none?.set();
    close();
  }

  const label = (name: IconName) => name.replace(/-/g, " ");

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function onSearchKeydown(event: KeyboardEvent) {
    const first = groups[0]?.icons[0];
    if (event.key === "Enter" && first) choose(first);
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      el?.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
    }
  }

  /** Arrow keys move by position, since groups end in partly filled rows; Home and End go to the ends. */
  function onIconKeydown(event: KeyboardEvent) {
    const icons = [...el!.querySelectorAll<HTMLElement>('[role="option"]')];
    const current = event.currentTarget as HTMLElement;
    const index = icons.indexOf(current);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowRight") next = icons[index + 1];
    else if (event.key === "ArrowLeft") next = icons[index - 1];
    else if (event.key === "Home") next = icons[0];
    else if (event.key === "End") next = icons.at(-1);
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const down = event.key === "ArrowDown";
      const { offsetTop: top, offsetLeft: left } = current;
      const rows = icons.filter((icon) => (down ? icon.offsetTop > top : icon.offsetTop < top));
      const rowTop = down ? Math.min(...rows.map((i) => i.offsetTop)) : Math.max(...rows.map((i) => i.offsetTop));
      next = rows
        .filter((icon) => icon.offsetTop === rowTop)
        .sort((a, b) => Math.abs(a.offsetLeft - left) - Math.abs(b.offsetLeft - left))[0];
      if (!next && !down) return el!.querySelector("input")?.focus();
    } else return;
    event.preventDefault();
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  }
</script>

{#if picker}
  <div
    class="picker popover"
    role="dialog"
    aria-label={t("picker.iconFor", { name: picker.label })}
    tabindex="-1"
    style:--columns={COLUMNS}
    bind:this={el}
    {onkeydown}
  >
    <header>
      <span class="target" class:none>
        <Icon name={current ?? picker.fallback} size={15} strokeWidth={1.75} /><span>{picker.label}</span>
      </span>
      <span class="actions">
        {#if picker.none}
          <button class="text-button" onclick={chooseNone} disabled={none}>{t("picker.noIcon")}</button>
        {/if}
        <button class="text-button" onclick={() => choose(null)} disabled={!current && !none}>{t("picker.reset")}</button>
      </span>
    </header>
    <input
      type="search"
      placeholder={t("picker.search")}
      aria-label={t("picker.search")}
      autocomplete="off"
      spellcheck="false"
      bind:value={query}
      onkeydown={onSearchKeydown}
    />
    <div class="scroll">
      <div role="listbox" aria-label={t("picker.icons")}>
        {#each groups as group (group.name)}
          <!-- Shown, but not said: the group around the icons is named after it. -->
          {#if group.name}<div class="group-name" aria-hidden="true">{group.name}</div>{/if}
          <div class="grid" role="group" aria-label={group.name || t("picker.matches")}>
            {#each group.icons as name (name)}
              <button
                role="option"
                tabindex={name === tabStop ? 0 : -1}
                aria-selected={name === current}
                aria-label={label(name)}
                title={label(name)}
                onclick={() => choose(name)}
                onkeydown={onIconKeydown}
              >
                <Icon {name} size={18} strokeWidth={1.75} />
              </button>
            {/each}
          </div>
        {/each}
      </div>
      {#if !groups[0]?.icons.length}
        <p class="empty" role="status">{t("picker.noMatches", { query })}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .picker {
    /* Narrower than its grid on a small phone; the columns then share what room there is. */
    width: min(calc(var(--cell) * var(--columns) + 2px * (var(--columns) - 1) + 20px), calc(100vw - 16px));
    padding: 10px;
    --cell: 34px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: -2px 0 8px 4px;
  }

  .target {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .target > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .target :global(.icon) {
    color: var(--accent);
  }

  .target.none :global(.icon) {
    opacity: 0.35;
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
  }

  header .text-button {
    height: 26px;
    font-size: 12px;
  }

  header .text-button:disabled {
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

  /* A fixed height, so the picker doesn't jump around while searching. */
  .scroll {
    height: min(calc(var(--cell) * 7 + 40px), calc(100dvh - 120px));
    margin: 0 -4px;
    padding: 0 4px;
    overflow: hidden auto;
    overscroll-behavior: contain;
  }

  .group-name {
    margin: 10px 2px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .group-name:first-child {
    margin-top: 2px;
  }

  /* Columns share whatever width is left, so a classic scrollbar never forces sideways scrolling. */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    grid-auto-rows: var(--cell);
    gap: 2px;
  }

  .grid button {
    display: grid;
    place-items: center;
    border-radius: 8px;
    color: var(--text-muted);
  }

  .grid button:hover,
  .grid button:focus-visible {
    background: var(--hover);
    color: var(--text);
    outline: none;
  }

  .grid button[aria-selected="true"] {
    background: var(--accent);
    color: var(--bg);
  }

  /* The chosen icon is already filled in; a ring shows when it has focus too. */
  .grid button[aria-selected="true"]:focus-visible {
    box-shadow:
      0 0 0 2px var(--bg-elevated),
      0 0 0 4px var(--accent);
  }

  .empty {
    margin: 24px 0;
    text-align: center;
    font-size: 13px;
    color: var(--text-faint);
  }

  /* Fingers need bigger targets. */
  @media (pointer: coarse) {
    .picker {
      --cell: 44px;
    }

    header .text-button {
      height: 44px;
    }
  }
</style>
