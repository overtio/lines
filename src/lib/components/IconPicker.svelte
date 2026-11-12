<script lang="ts">
  import { Popover, RadioGroup } from "bits-ui";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { ICON_WORDS, ICONS, TAG_ICON_GROUPS, type IconName } from "../icons/icons";
  import { PALETTE, type PaletteColor, paletteVar } from "../palette";
  import { pointAt, takeFocus } from "../popover";
  import { ui } from "../ui.svelte";
  import Button from "./ui/Button.svelte";
  import { floating } from "./ui/styles";
  import TextField from "./ui/TextField.svelte";

  let el = $state<HTMLElement | null>(null);
  /** Gives focus back where it was when the picker closes. */
  let restore: (() => void) | undefined;
  let query = $state("");

  const picker = $derived(ui.iconPicker);
  const current = $derived(picker?.icon() ?? null);
  const none = $derived(picker?.none?.active() ?? false);
  const color = $derived(picker?.color?.get() ?? null);
  const inherited = $derived(picker?.color?.inherited);
  /** The color it shows in: its own, or the one it has from the tag it's in. */
  const shown = $derived(color ?? inherited?.color ?? null);
  // Matches Lucide's and SF Symbols' names and the words each is for ("money" finds the banknote).
  // Searching shows every match, once, as one group.
  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return TAG_ICON_GROUPS;
    const found = (name: IconName) => [name, ICONS[name][1], ICON_WORDS[name] ?? ""].join(" ").replace(/[.-]/g, " ").includes(q);
    const matches = [...new Set(TAG_ICON_GROUPS.flatMap((group) => group.icons))].filter(found);
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

  /** It opens at a point: the pointer, or under a row's icon. */
  const anchor = $derived(picker && pointAt(picker.x, picker.y));

  /** Focus goes to the current icon rather than the search field, so phones don't pop up the keyboard. */
  function onOpenAutoFocus(event: Event) {
    event.preventDefault();
    const selected = el!.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    restore = takeFocus(el!, selected ?? el!);
    selected?.scrollIntoView({ block: "center" });
  }

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

<Popover.Root open={!!picker} onOpenChange={(open) => !open && close()}>
  <Popover.Portal>
    <!-- Narrower than its grid of 8 on a small phone; the columns then share what room there is. -->
    <Popover.Content
      bind:ref={el}
      customAnchor={anchor}
      align="start"
      sideOffset={0}
      collisionPadding={8}
      role="dialog"
      aria-label={picker ? t("picker.iconFor", { name: picker.label }) : undefined}
      {onOpenAutoFocus}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restore?.();
      }}
      class="{floating} w-[min(calc(var(--cell)*8+2px*7+20px),calc(100vw-16px))] p-2.5 [--cell:34px] coarse:[--cell:44px]"
    >
      {#if picker}
        <header class="-mt-0.5 mb-2 ml-1 flex items-center justify-between gap-2" style:--look={shown && paletteVar(shown)}>
          <span class="flex min-w-0 items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
            <Icon
              name={current ?? picker.fallback}
              size={15}
              strokeWidth={1.75}
              class="shrink-0 {shown ? 'text-(--look)' : 'text-accent'} {none ? 'opacity-35' : ''}"
            />
            <span class="truncate">{picker.label}</span>
          </span>
          <span class="flex shrink-0 gap-0.5">
            {#if picker.none}
              <Button variant="quiet" onclick={chooseNone} disabled={none}>{t("picker.noIcon")}</Button>
            {/if}
            <Button variant="quiet" onclick={() => choose(null)} disabled={!current && !none}>{t("picker.reset")}</Button>
          </span>
        </header>
        {#if picker.color}
          {@const choose = picker.color.set}
          <!-- Chosen as it's clicked, the picker staying open for an icon too. -->
          <RadioGroup.Root
            value={color ?? "none"}
            onValueChange={(value) => choose(value === "none" ? null : (value as PaletteColor))}
            orientation="horizontal"
            aria-label={t("picker.colors")}
            class="mb-2 flex items-center justify-between px-0.5"
          >
            {#each ["none", ...PALETTE] as const as each (each)}
              {@const name = each !== "none" ? t(`picker.color.${each}`) : inherited ? t("picker.sameAs", { name: `#${inherited.from}` }) : t("picker.noColor")}
              <RadioGroup.Item
                value={each}
                aria-label={name}
                title={name}
                class="grid size-7 place-items-center rounded-full p-1 inset-ring-2 inset-ring-transparent focus-visible:outline-offset-1 data-[state=checked]:inset-ring-(--look) coarse:size-9"
                style="--look: {each !== 'none' ? paletteVar(each) : inherited ? paletteVar(inherited.color) : 'var(--text-muted)'}"
              >
                {#if each === "none" && inherited}
                  <!-- A ring in the color it has from the tag it's in: none of its own. -->
                  <span class="size-full rounded-full inset-ring-[3px] inset-ring-(--look) forced-color-adjust-none" aria-hidden="true"></span>
                {:else if each === "none"}
                  <!-- A ring with a line across it: no color of its own. -->
                  <span class="relative size-full overflow-hidden rounded-full inset-ring-1 inset-ring-(--text-faint)" aria-hidden="true">
                    <span class="absolute top-1/2 left-1/2 h-px w-[140%] -translate-1/2 -rotate-45 bg-faint"></span>
                  </span>
                {:else}
                  <span class="size-full rounded-full bg-(--look) forced-color-adjust-none" aria-hidden="true"></span>
                {/if}
              </RadioGroup.Item>
            {/each}
          </RadioGroup.Root>
        {/if}
        <TextField
          type="search"
          icon="search"
          placeholder={t("picker.search")}
          aria-label={t("picker.search")}
          autocomplete="off"
          spellcheck="false"
          bind:value={query}
          onkeydown={onSearchKeydown}
          class="mb-2 [&_input::-webkit-search-cancel-button]:hidden"
        />
        <!-- A fixed height, so the picker doesn't jump around while searching. -->
        <div class="-mx-1 h-[min(calc(var(--cell)*7+40px),calc(100dvh-120px))] overflow-x-hidden overflow-y-auto overscroll-contain px-1">
          <div role="listbox" aria-label={t("picker.icons")}>
            {#each groups as group (group.name)}
              <!-- Shown, but not said: the group around the icons is named after it. -->
              {#if group.name}
                <div class="mx-0.5 mt-2.5 mb-1 text-2xs font-semibold tracking-wide text-faint uppercase first:mt-0.5" aria-hidden="true">{group.name}</div>
              {/if}
              <!-- Columns share whatever width is left, so a classic scrollbar never forces sideways scrolling. -->
              <div class="grid auto-rows-(--cell) grid-cols-[repeat(8,minmax(0,1fr))] gap-0.5" role="group" aria-label={group.name || t("picker.matches")}>
                {#each group.icons as name (name)}
                  <!-- The chosen icon is already filled in; a ring shows when it has focus too. -->
                  <button
                    role="option"
                    tabindex={name === tabStop ? 0 : -1}
                    aria-selected={name === current}
                    aria-label={label(name)}
                    title={label(name)}
                    onclick={() => choose(name)}
                    onkeydown={onIconKeydown}
                    class={[
                      "grid place-items-center rounded-md outline-none",
                      name === current
                        ? "bg-accent text-on-accent focus-visible:shadow-[0_0_0_2px_var(--bg-elevated),0_0_0_4px_var(--accent)]"
                        : "text-muted hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:text-fg",
                    ]}
                  >
                    <Icon {name} size={18} strokeWidth={1.75} />
                  </button>
                {/each}
              </div>
            {/each}
          </div>
          {#if !groups[0]?.icons.length}
            <p class="m-0 my-6 text-center text-sm text-faint" role="status">{t("picker.noMatches", { query })}</p>
          {/if}
        </div>
      {/if}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
