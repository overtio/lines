import type { EditorView } from "@codemirror/view";
import { t } from "../i18n/index.svelte";
import { coarsePointer } from "../platform";

/*
 * A block's buttons (a drawing's pencil, a diagram's or a table's convert button) sit in a bar down
 * the right side of what it draws, from its top, as its resize handle sits past its corner. Where
 * there's no room beside it, before the note's edge or a card's, they go inside its top right corner
 * (editor.css).
 */

/** The room the bar takes beside a block: its 6px gap, a 30px button, and a little before the edge. */
const BESIDE = 6 + 30 + 4;

const watches = new WeakMap<HTMLElement, ResizeObserver>();

/** Whether there's room for the bar beside `target`, in `block`: in a card, one card's padding past the block. */
function fitsBeside(block: HTMLElement, target: Element) {
  const depth = Number(block.style.getPropertyValue("--card-depth"));
  const scroller = block.closest(".cm-scroller");
  if (!scroller) return false;
  const edge = depth
    ? block.getBoundingClientRect().right + parseFloat(getComputedStyle(block).marginRight) / depth
    : scroller.getBoundingClientRect().left + scroller.clientLeft + scroller.clientWidth;
  return edge - target.getBoundingClientRect().right >= BESIDE;
}

/** A bar for `block`'s buttons, beside `target`: the part of it that's drawn, or all of it. */
export function actionBar(block: HTMLElement, target: Element = block) {
  const bar = document.createElement("span");
  bar.className = "cm-lp-actions";
  keepBeside(bar, block, target);
  return bar;
}

/** Keeps a bar beside `target` as it and the note change size: when it's drawn again, say. */
export function keepBeside(bar: HTMLElement, block: HTMLElement, target: Element) {
  watches.get(bar)?.disconnect();
  const watch = new ResizeObserver(() => bar.classList.toggle("is-inside", !fitsBeside(block, target)));
  watch.observe(block);
  watch.observe(target);
  watches.set(bar, watch);
}

/** Stops keeping a bar in place, when its block goes. */
export function dropBar(bar: HTMLElement) {
  watches.get(bar)?.disconnect();
  watches.delete(bar);
}

/** How a block's resize handle resizes what it draws. */
interface Resizing<T extends Element> {
  /** What's drawn, once it's there. */
  target: () => T | null;
  min: number;
  max: () => number;
  /** Shows it at a width, while it's dragged. */
  show: (target: T, width: number) => void;
  /** Writes its width into the note, or takes it out (null). */
  write: (width: number | null) => void;
}

/**
 * The handle on the bottom right corner of what `block` draws (an image, a diagram): dragged, it
 * makes that wider or narrower, keeping its shape; double-clicked, back to its own size. From the
 * keyboard, the width is the number after the bar in its Markdown.
 */
export function resizeHandle<T extends Element>(view: EditorView, block: HTMLElement, className: string, resizing: Resizing<T>) {
  const handle = document.createElement("span");
  handle.className = `cm-lp-resize ${className}`;
  handle.title = coarsePointer.matches ? "" : t("editor.image.resizeHint");
  handle.setAttribute("aria-hidden", "true");
  handle.addEventListener("pointerdown", (event) => {
    const target = resizing.target();
    if (event.button !== 0 || view.state.readOnly || !target) return;
    // No mousedown follows, so the editor doesn't select the block or show its Markdown.
    event.preventDefault();
    event.stopPropagation();
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: moves over the handle still resize.
    }
    const max = resizing.max();
    const start = target.getBoundingClientRect().width;
    const x = event.clientX;
    let width = start;
    block.classList.add("is-resizing");
    const move = (moved: PointerEvent) => {
      width = Math.round(Math.min(max, Math.max(resizing.min, start + moved.clientX - x)));
      resizing.show(target, width);
      view.requestMeasure();
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      block.classList.remove("is-resizing");
      if (Math.abs(width - start) >= 1) resizing.write(width);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
  handle.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!view.state.readOnly) resizing.write(null);
  });
  return handle;
}
