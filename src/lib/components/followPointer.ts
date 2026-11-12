/** How far the pointer goes, pressed, before it's dragging what it pressed. */
const DRAG_START = 4;

export interface Follow {
  /** Each move once it's dragging: the first, past DRAG_START, begins the drag. */
  move(event: PointerEvent, first: boolean): void;
  /** Let go while dragging. */
  drop(): void;
  /** Esc while dragging. */
  cancel(): void;
}

/**
 * Follows the pointer pressed on something (a mouse's or a pen's) as it's dragged, on the window,
 * so it's followed over whatever's under it, until it's let go or Esc is pressed. Returns what
 * stops following it sooner.
 */
export function followPointer(down: PointerEvent, follow: Follow): () => void {
  const [x, y] = [down.clientX, down.clientY];
  let dragging = false;
  const move = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    if (!dragging && Math.hypot(event.clientX - x, event.clientY - y) < DRAG_START) return;
    follow.move(event, !dragging);
    dragging = true;
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    stop();
    if (dragging) follow.drop();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !dragging) return;
    event.preventDefault();
    event.stopPropagation();
    stop();
    follow.cancel();
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("keydown", key, true);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("keydown", key, true);
  return stop;
}
