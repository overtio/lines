<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { type PaneTree, panesOf } from "../panes";
  import { PANE_MIN, panes } from "../panes.svelte";
  import { panePlace } from "./paneContent";
  import Panes from "./Panes.svelte";

  /*
   * The note's place, split into panes (panes.ts): the open note's (with its toolbar) and others'
   * (SideNote.svelte), side by side and one above another. The line between two can be dragged, or,
   * focused, moved with the arrow keys (a window splitter): ⇧ by more, Enter shares the room evenly.
   * A pane clicked or typed in is the one a note opened beside goes beside.
   *
   * What a pane shows is made once, in App.svelte, and brought into its place here (paneContent.ts).
   */

  let {
    tree,
    path = [],
    ondrag,
  }: {
    tree: PaneTree;
    /** Where this part of the layout is in the whole: each step the index of a child. */
    path?: number[];
    /** A line starts or stops being dragged (the panes don't animate meanwhile). */
    ondrag: (dragging: boolean) => void;
  } = $props();

  let width = $state(0);
  let height = $state(0);

  const row = $derived(!("pane" in tree) && tree.split === "row");
  /** The split's length along its line, in pixels. */
  const length = $derived(row ? width : height);
  const smallest = $derived(row ? PANE_MIN.width : PANE_MIN.height);

  /** The line before the `i`th pane, being dragged: where from, and the two panes' shares then. */
  let drag: { i: number; at: number; before: number; after: number } | null = null;

  /** The two panes' shares, `before` the line given `share`, as far as each can go. */
  function share(i: number, before: number) {
    if ("pane" in tree) return;
    const pair = tree.sizes[i - 1] + tree.sizes[i];
    const least = Math.min(pair / 2, length ? smallest / length : 0);
    const next = Math.min(pair - least, Math.max(least, before));
    panes.resize(path, tree.sizes.map((size, j) => (j === i - 1 ? next : j === i ? pair - next : size)));
  }

  function onpointerdown(event: PointerEvent, i: number) {
    if (event.button !== 0 || "pane" in tree) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { i, at: row ? event.clientX : event.clientY, before: tree.sizes[i - 1], after: tree.sizes[i] };
    ondrag(true);
  }

  function onpointermove(event: PointerEvent) {
    if (!drag || !length) return;
    share(drag.i, drag.before + ((row ? event.clientX : event.clientY) - drag.at) / length);
  }

  function onpointerup() {
    if (!drag) return;
    drag = null;
    ondrag(false);
  }

  function onkeydown(event: KeyboardEvent, i: number) {
    if ("pane" in tree) return;
    const [less, more] = row ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    const step = (event.shiftKey ? 0.1 : 0.02) * (tree.sizes[i - 1] + tree.sizes[i]);
    const before = tree.sizes[i - 1];
    const next = event.key === less ? before - step : event.key === more ? before + step : event.key === "Enter" ? (before + tree.sizes[i]) / 2 : null;
    if (next === null) return;
    event.preventDefault();
    share(i, next);
  }
</script>

{#if "pane" in tree}
  {@const pane = tree.pane}
  <!-- Not a control: it notes the pane used last, as it's clicked or typed in. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="relative flex min-h-0 min-w-0 flex-1" onfocusin={() => (panes.active = pane)} onpointerdown={() => (panes.active = pane)} {@attach panePlace(pane)}>
    {#if panes.dropAt?.pane === pane}
      {@const zone = panes.dropAt.zone}
      <!-- Where what's dragged would go if let go here: half this pane, on that side, or all of it. -->
      <div
        class={[
          "pointer-events-none absolute z-20 rounded-md bg-accent/15 inset-ring-2 inset-ring-accent",
          zone === "left" && "inset-y-1 left-1 w-[calc(50%-4px)]",
          zone === "right" && "inset-y-1 right-1 w-[calc(50%-4px)]",
          zone === "up" && "inset-x-1 top-1 h-[calc(50%-4px)]",
          zone === "down" && "inset-x-1 bottom-1 h-[calc(50%-4px)]",
          zone === "center" && "inset-1",
        ]}
        aria-hidden="true"
      ></div>
    {/if}
  </div>
{:else}
  <div class={["flex min-h-0 min-w-0 flex-1", row ? "flex-row" : "flex-col"]} bind:clientWidth={width} bind:clientHeight={height}>
    {#each tree.children as child, i (panesOf(child)[0])}
      {#if i > 0}
        {@const before = tree.sizes[i - 1]}
        <!-- A focusable separator with a value is ARIA's window splitter. A line, and room around it to
             grab; pointed at, dragged or focused, a line in the accent color over it, as a sidebar's
             edge shows (PaneResizer.svelte). -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class={[
            "relative z-5 shrink-0 touch-none bg-line outline-none before:absolute before:content-['']",
            "after:absolute after:bg-accent after:opacity-0 after:transition-opacity after:delay-100 after:content-[''] forced-colors:after:bg-[Highlight]",
            "hover:after:opacity-100 focus-visible:after:opacity-100 active:after:opacity-100",
            row
              ? "w-px cursor-col-resize before:-inset-x-1 before:inset-y-0 after:inset-y-0 after:-left-px after:w-[3px]"
              : "h-px cursor-row-resize before:inset-x-0 before:-inset-y-1 after:inset-x-0 after:-top-px after:h-[3px]",
          ]}
          role="separator"
          tabindex="0"
          aria-orientation={row ? "vertical" : "horizontal"}
          aria-label={t("app.paneSize")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((before / (before + tree.sizes[i])) * 100)}
          onpointerdown={(event) => onpointerdown(event, i)}
          {onpointermove}
          {onpointerup}
          onpointercancel={onpointerup}
          ondblclick={() => share(i, (before + tree.sizes[i]) / 2)}
          onkeydown={(event) => onkeydown(event, i)}
        ></div>
      {/if}
      <div class="flex min-h-0 min-w-0" style:flex="{tree.sizes[i]} 1 0px">
        <Panes tree={child} path={[...path, i]} {ondrag} />
      </div>
    {/each}
  </div>
{/if}
