<script lang="ts">
  import { t } from "../i18n/index.svelte";

  /*
   * A side pane's inner edge, dragged to resize it (a window splitter); the pane is on the window's
   * left or right (`side`). From the keyboard it's a Tab stop: ← and → move the edge by 10 px (⇧ by
   * 50), Home and End go to the narrowest and widest, and Enter or a double-click puts the pane back
   * to its usual width.
   */

  let {
    label,
    width,
    min,
    max,
    initial,
    side,
    offset,
    onresize,
    ondrag,
  }: {
    /** What it resizes, for screen readers ("Sidebar width"). */
    label: string;
    width: number;
    min: number;
    max: number;
    initial: number;
    /** The side of the window the pane is on, and how far from that side its inner edge is. */
    side: "left" | "right";
    offset: number;
    onresize: (width: number) => void;
    /** A drag starts or ends (the panes don't animate while it's on). */
    ondrag: (dragging: boolean) => void;
  } = $props();

  let start: { x: number; width: number } | null = null;

  const set = (value: number) => onresize(Math.round(Math.min(max, Math.max(min, value))));

  function onpointerdown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      // Moves keep coming here when the pointer outruns the thin edge.
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the drag still follows moves over the edge.
    }
    start = { x: event.clientX, width };
    ondrag(true);
  }

  /** Moving the edge right makes a pane on the left wider, and one on the right narrower. */
  const grows = $derived(side === "left" ? 1 : -1);

  function onpointermove(event: PointerEvent) {
    if (start) set(start.width + grows * (event.clientX - start.x));
  }

  function end() {
    if (!start) return;
    start = null;
    ondrag(false);
  }

  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 50 : 10;
    const next: Record<string, number> = { ArrowLeft: width - grows * step, ArrowRight: width + grows * step, Home: min, End: max, Enter: initial };
    if (!(event.key in next)) return;
    event.preventDefault();
    set(next[event.key]);
  }
</script>

<!-- A focusable separator with a value is ARIA's window splitter, which is interactive. Centered on
     the edge, it shows a line in the accent color while it's pointed at, dragged or focused. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class={[
    "absolute inset-y-0 z-5 w-[9px] cursor-col-resize touch-none outline-none",
    side === "right" ? "-mr-1" : "-ml-[5px]",
    "after:absolute after:inset-y-0 after:left-[3px] after:w-[3px] after:bg-accent after:opacity-0 after:transition-opacity after:delay-100 forced-colors:after:bg-[Highlight]",
    "hover:after:opacity-100 focus-visible:after:opacity-100 active:after:opacity-100",
  ]}
  role="separator"
  tabindex="0"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={width}
  aria-valuemin={min}
  aria-valuemax={max}
  title={t("app.resizeHint")}
  style:left={side === "left" ? `${offset}px` : undefined}
  style:right={side === "right" ? `${offset}px` : undefined}
  {onpointerdown}
  {onpointermove}
  onpointerup={end}
  onpointercancel={end}
  onlostpointercapture={end}
  ondblclick={() => set(initial)}
  {onkeydown}
></div>
