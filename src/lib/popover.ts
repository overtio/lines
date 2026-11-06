/** A point for a floating panel (Bits UI's `customAnchor`) to open at, such as where a menu was asked for. */
export const pointAt = (x: number, y: number) => ({ getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) });

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
 * Remembers where focus is as a panel opens. The returned function puts it back there when the
 * panel closes, unless it has moved on elsewhere since (a press on another control).
 */
export function returnFocus(panel?: HTMLElement | null) {
  const previous = document.activeElement;
  return () => {
    const active = document.activeElement;
    const lost = !active || active === document.body || !!panel?.contains(active);
    if (lost && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
  };
}

/** Moves focus into a panel that just opened, and returns the function that gives it back (`returnFocus`). */
export function takeFocus(el: HTMLElement, target: HTMLElement = el) {
  const back = returnFocus(el);
  target.focus({ preventScroll: true });
  return back;
}
