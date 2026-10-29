import type { Attachment } from "svelte/attachments";

/**
 * Calls `handler` when a finger is held still on the element for half a second, since touch
 * screens have no right-click. The click that follows the press is swallowed.
 */
export function longPress(handler: (x: number, y: number) => void): Attachment<HTMLElement> {
  return (node) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start = { x: 0, y: 0 };
    let fired = false;

    const cancel = () => clearTimeout(timer);
    const down = (event: PointerEvent) => {
      cancel();
      fired = false;
      if (event.pointerType === "mouse") return;
      start = { x: event.clientX, y: event.clientY };
      timer = setTimeout(() => {
        fired = true;
        navigator.vibrate?.(10);
        handler(start.x, start.y);
      }, 500);
    };
    const move = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
    };
    const click = (event: MouseEvent) => {
      if (!fired) return;
      fired = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", cancel);
    node.addEventListener("pointercancel", cancel);
    // Android opens its own context menu event on a long press too; one menu is enough.
    node.addEventListener("contextmenu", cancel);
    node.addEventListener("click", click, true);
    return () => {
      cancel();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", cancel);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("contextmenu", cancel);
      node.removeEventListener("click", click, true);
    };
  };
}
