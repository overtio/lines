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
