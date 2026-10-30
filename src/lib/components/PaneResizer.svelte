<script lang="ts">
  import { t } from "../i18n/index.svelte";

  /*
   * The edge between two panes, dragged to resize the one on its left (a window splitter). From
   * the keyboard it's a Tab stop: ← and → resize by 10 px (⇧ by 50), Home and End go to the
   * narrowest and widest, and Enter or a double-click puts the pane back to its usual width.
   */

  let {
    label,
    width,
    min,
    max,
    initial,
    left,
    onresize,
    ondrag,
  }: {
    /** What it resizes, for screen readers ("Sidebar width"). */
    label: string;
    width: number;
    min: number;
    max: number;
    initial: number;
    /** Where it sits, from the window's left edge. */
    left: number;
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

  function onpointermove(event: PointerEvent) {
    if (start) set(start.width + event.clientX - start.x);
  }

  function end() {
    if (!start) return;
    start = null;
    ondrag(false);
  }

  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 50 : 10;
    const next: Record<string, number> = { ArrowLeft: width - step, ArrowRight: width + step, Home: min, End: max, Enter: initial };
    if (!(event.key in next)) return;
    event.preventDefault();
    set(next[event.key]);
  }
</script>

<!-- A focusable separator with a value is ARIA's window splitter, which is interactive. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="resizer"
  role="separator"
  tabindex="0"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={width}
  aria-valuemin={min}
  aria-valuemax={max}
  title={t("app.resizeHint")}
  style:left="{left}px"
  {onpointerdown}
  {onpointermove}
  onpointerup={end}
  onpointercancel={end}
  onlostpointercapture={end}
  ondblclick={() => set(initial)}
  {onkeydown}
></div>

<style>
  .resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 5;
    width: 9px;
    margin-left: -5px;
    cursor: col-resize;
    touch-action: none;
  }

  /* A line in the accent color while it's pointed at, dragged or focused. */
  .resizer::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 3px;
    background: var(--accent);
    opacity: 0;
    transition: opacity 0.15s 0.1s;
  }

  .resizer:hover::after,
  .resizer:active::after,
  .resizer:focus-visible::after {
    opacity: 1;
  }

  .resizer:focus-visible {
    outline: none;
  }

  @media (forced-colors: active) {
    .resizer::after {
      background: Highlight;
    }
  }
</style>
