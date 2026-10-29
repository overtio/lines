/**
 * Places a floating panel at a point, flipping it left or up near the window edges like a native
 * menu. With `align: "end"` its right edge sits at `x`, e.g. under a toolbar button on the right.
 */
export function placeAt(el: HTMLElement, x: number, y: number, align: "start" | "end" = "start") {
  // Layout size, not getBoundingClientRect, which would include the opening animation's scale.
  const { offsetWidth: width, offsetHeight: height } = el;
  const pad = 8;
  const flipped = align === "end" || x + width + pad > innerWidth ? x - width : x;
  const raised = y + height + pad > innerHeight ? y - height : y;
  // Kept inside the window even where neither side has room (a small phone screen).
  const left = Math.max(pad, Math.min(flipped, innerWidth - width - pad));
  const top = Math.max(pad, Math.min(raised, innerHeight - height - pad));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.transformOrigin = `${left < x ? "right" : "left"} ${top < y ? "bottom" : "top"}`;
}

/**
 * Closes a floating panel on a press outside it, scrolling elsewhere, resizing or switching
 * windows. A press on `anchor` (the button that opened it) is left to that button, which can
 * then toggle the panel. Returns a function that stops listening.
 */
export function dismissable(el: () => HTMLElement | undefined, close: () => void, anchor?: Element | null) {
  const outside = (event: Event) => {
    const target = event.target as Node;
    if (el()?.contains(target) || (event.type === "pointerdown" && anchor?.contains(target))) return;
    close();
  };
  addEventListener("pointerdown", outside, true);
  addEventListener("scroll", outside, true);
  addEventListener("resize", close);
  addEventListener("blur", close);
  return () => {
    removeEventListener("pointerdown", outside, true);
    removeEventListener("scroll", outside, true);
    removeEventListener("resize", close);
    removeEventListener("blur", close);
  };
}

/**
 * Where a context menu opens: at the pointer, or, from the keyboard (menu key or Shift+F10),
 * where there's no pointer, just inside the element's lower left corner.
 */
export function menuPoint(event: MouseEvent, el = event.currentTarget as Element) {
  if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + 16, y: rect.bottom - 6 };
}

/**
 * Moves focus into a panel that just opened. The returned function puts it back where it was
 * when the panel closes, unless it has moved on elsewhere since (a press on another control).
 */
export function takeFocus(el: HTMLElement, target: HTMLElement = el) {
  const previous = document.activeElement;
  target.focus({ preventScroll: true });
  return () => {
    const active = document.activeElement;
    const lost = !active || active === document.body || el.contains(active);
    if (lost && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
  };
}
