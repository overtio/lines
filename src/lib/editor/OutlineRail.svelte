<script lang="ts">
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { t } from "../i18n/index.svelte";
  import { coarsePointer, reducedMotion } from "../platform";
  import { prefs } from "../prefs.svelte";
  import type { OutlineState } from "./outline.svelte";

  /*
   * The outline's lines, and the card of headings that pointing at them opens (outline.svelte.ts).
   * The heading pointed at, on the lines or in the card, is lit in the card, and the lines swell in
   * a little wave around its line; clicking either goes there. From the keyboard it's one Tab stop,
   * a button that opens the card: ↑ and ↓ move through the headings, Enter goes to one and Esc
   * closes the card. Going to one with the mouse leaves the cursor where it was, as scrolling does.
   */

  let { outline, go }: { outline: OutlineState; go: (index: number, focus: boolean) => void } = $props();

  const id = $props.id();
  /** How long the lines of the three largest levels of heading are, and how many lines there are at most. */
  const DASHES = [14, 10, 6];
  const MOST = 40;
  /** How much longer the line being read is, and the line pointed at, before its wave falls away over its neighbors. */
  const CURRENT = 6;
  const WAVE = 10;

  let nav = $state<HTMLElement>();
  let rail = $state<HTMLButtonElement>();
  let list = $state<HTMLElement>();
  /** The heading pointed at, or focused in the card; -1 for none. */
  let pointed = $state(-1);
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Which side of the note it's on (Settings → General → Layout); its card opens toward the text. */
  const side = $derived(prefs.outlineSide);
  const shown = $derived(outline.room[side] && outline.headings.length > 1);
  /** The note's largest heading, which isn't indented. */
  const top = $derived(Math.min(...outline.headings.map((heading) => heading.level)));
  const depth = (level: number) => Math.min(level - top, DASHES.length - 1);
  /** Headings per line: past `MOST`, each line stands for a run of them, as long as the largest in it. */
  const per = $derived(Math.ceil(outline.headings.length / MOST));
  const dashes = $derived(
    Array.from({ length: Math.ceil(outline.headings.length / per) }, (_, i) =>
      Math.min(...outline.headings.slice(i * per, (i + 1) * per).map((heading) => heading.level)),
    ),
  );
  const lineOf = (index: number) => Math.floor(index / per);
  /** How much longer line `i` is: the one being read a little, and a bell around the one pointed at. */
  const grow = (i: number) =>
    Math.max(
      outline.current >= 0 && i === lineOf(outline.current) ? CURRENT : 0,
      pointed >= 0 ? WAVE * Math.exp(-((i - lineOf(pointed)) ** 2) / 2) : 0,
    );
  const duration = (ms: number) => (reducedMotion.matches ? 0 : ms);

  /** Whether the card of headings is open: closed again whenever the outline hides or shows. */
  let open = $derived.by(() => {
    void shown;
    return false;
  });

  /** After a moment, so the pointer passing over on its way somewhere doesn't open it, and can cross to the card. */
  function later(value: boolean, ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => (open = value), ms);
  }

  const items = () => [...(list?.querySelectorAll<HTMLButtonElement>("button") ?? [])];

  async function openFromKeys() {
    clearTimeout(timer);
    open = true;
    await tick();
    items()[Math.max(0, outline.current)]?.focus();
  }

  /** The line under the mouse, as the first heading it stands for. */
  function pointAt(event: PointerEvent) {
    const first = rail?.firstElementChild?.getBoundingClientRect();
    if (event.pointerType !== "mouse" || !first) return;
    pointed = Math.max(0, Math.min(Math.floor((event.clientY - first.top) / first.height), dashes.length - 1)) * per;
  }

  /** Enter or Space opens the card into the headings; a tap opens or closes it; a click goes to the heading pointed at. */
  function railClick(event: MouseEvent) {
    if (event.detail === 0) void openFromKeys();
    else if (coarsePointer.matches) open = !open;
    else {
      open = true;
      if (pointed >= 0) go(pointed, false);
    }
  }

  function railKeys(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void openFromKeys();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      open = false;
    }
  }

  function listKeys(event: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      all[(to + all.length) % all.length].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      open = false;
      rail?.focus();
    }
  }

  function choose(index: number, fromKeys: boolean) {
    go(index, fromKeys);
    // With a mouse the card stays while it's pointed at, for another heading.
    if (fromKeys || coarsePointer.matches) open = false;
  }

  function onfocusout(event: FocusEvent) {
    if (nav?.contains(event.relatedTarget as Node | null)) return;
    open = false;
    pointed = -1;
  }

  function onpointerleave(event: PointerEvent) {
    if (event.pointerType !== "mouse" || nav?.contains(document.activeElement)) return;
    pointed = -1;
    later(false, 250);
  }

  // A tap or click anywhere else closes it.
  $effect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => !nav?.contains(event.target as Node) && (open = false);
    addEventListener("pointerdown", close, true);
    return () => removeEventListener("pointerdown", close, true);
  });

  // The part being read stays in sight in a long card.
  $effect(() => {
    const item = list?.children[outline.current] as HTMLElement | undefined;
    if (!list || !item) return;
    const { offsetTop, offsetHeight } = item;
    if (offsetTop < list.scrollTop) list.scrollTop = offsetTop;
    else if (offsetTop + offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = offsetTop + offsetHeight - list.clientHeight;
  });
</script>

{#if shown}
  <nav
    class="absolute top-1/2 z-3 -translate-y-1/2 font-ui"
    aria-label={t("editor.outline")}
    style:right={side === "right" ? `${outline.scrollBar + 2}px` : undefined}
    style:left={side === "left" ? "4px" : undefined}
    bind:this={nav}
    onpointerenter={(event) => event.pointerType === "mouse" && later(true, 120)}
    {onpointerleave}
    {onfocusout}
    transition:fade={{ duration: duration(150) }}
  >
    <!-- As wide as its longest line can swell, so the card beside it stays put. -->
    <button
      class={["flex max-h-[60vh] w-9 flex-col overflow-hidden rounded-md px-1.5 py-2 text-faint", side === "right" ? "items-end" : "items-start"]}
      bind:this={rail}
      aria-label={t("editor.outline.headings")}
      aria-expanded={open}
      aria-controls={id}
      onmousedown={(event) => event.preventDefault()}
      onclick={railClick}
      onkeydown={railKeys}
      onpointermove={pointAt}
    >
      <!-- A row for each heading, which close up when there are many. -->
      {#each dashes as level, i}
        {@const current = outline.current >= 0 && i === lineOf(outline.current)}
        <span
          class={[
            "flex min-h-0.5 flex-[0_1_10px] items-center [transition:width_200ms_cubic-bezier(0.2,0.8,0.2,1),color_160ms_ease] before:h-0.5 before:w-full before:rounded-[1px] before:bg-current",
            current ? "text-fg forced-colors:text-[color:Highlight]" : pointed >= 0 && i === lineOf(pointed) && "text-muted",
          ]}
          style:width="{DASHES[depth(level)] + grow(i)}px"
        ></span>
      {/each}
    </button>
    {#if open}
      <ul
        class={[
          "absolute top-1/2 m-0 max-h-[60vh] w-max max-w-[300px] min-w-[200px] -translate-y-1/2 animate-[pop-in_140ms_var(--ease-pop)] list-none overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-menu",
          side === "right" ? "right-[calc(100%+2px)] origin-right" : "left-[calc(100%+2px)] origin-left",
        ]}
        role="list"
        {id}
        bind:this={list}
        out:fade={{ duration: duration(100) }}
      >
        {#each outline.headings as heading, i}
          {@const current = i === outline.current}
          <li>
            <button
              class={[
                "block h-7 w-full overflow-hidden rounded-sm pe-2.5 text-start text-sm text-ellipsis whitespace-nowrap focus-visible:bg-hover focus-visible:outline-none",
                i === pointed && "bg-hover",
                current ? "text-accent forced-colors:text-[color:Highlight]" : i === pointed ? "text-fg" : "text-muted focus-visible:text-fg",
              ]}
              aria-current={current ? "location" : undefined}
              tabindex="-1"
              style:padding-inline-start="{10 + depth(heading.level) * 14}px"
              onmousedown={(event) => event.preventDefault()}
              onclick={(event) => choose(i, event.detail === 0)}
              onkeydown={listKeys}
              onpointerenter={() => (pointed = i)}
              onfocus={() => (pointed = i)}
            >
              {heading.title}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </nav>
{/if}
