import { tick } from "svelte";
import type { Attachment } from "svelte/attachments";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";

/*
 * Dragging a row of the sidebar up or down among the others of its list, with a mouse, trackpad or
 * pen (a finger scrolls). As in a note (editor/dragBlocks.ts), the row fades and a line in the accent
 * glides to the gap it'll go into; let go, and `onmove` is told what it's now before (null for the
 * end). A row that stands for more (`whole`: a section's heading, a tag with its nested tags) is
 * measured, faded and placed as the element around it marked `data-reorder-area`. The click that ends a drag doesn't
 * also choose the row. By keyboard, ⌥↑ and ⌥↓ move the
 * focused row past the one above or below, as they move lines in a note.
 */

/** How far the pointer goes before a press becomes a drag, in pixels. */
const DRAG_START = 4;

/** What a row stands for: its area, if it's a whole one's handle (a section's heading), or itself. */
const areaOf = (row: HTMLElement) => (row.dataset.reorderWhole !== undefined && row.closest<HTMLElement>("[data-reorder-area]")) || row;

export function reorderable(list: string, key: string, onmove: (before: string | null) => void, whole = false): Attachment<HTMLElement> {
  return (row) => {
    row.dataset.reorder = list;
    row.dataset.reorderKey = key;
    if (whole) row.dataset.reorderWhole = "";

    function onpointerdown(event: PointerEvent) {
      if (event.button !== 0 || event.pointerType === "touch" || row.querySelector("input")) return;
      const startY = event.clientY;
      // The line is drawn in the sidebar, which may be a drawer that slides (so not fixed to the window).
      const frame = row.closest<HTMLElement>(".sidebar");
      let line: HTMLElement | null = null;
      /** An empty section's words ("Drag rows here"), hidden while the line is in their place. */
      let placeholder: HTMLElement | null = null;
      let dragging = false;
      /** What it'd go before (null: the end); undefined while that's where it is now. */
      let before: string | null | undefined;

      /** Puts the line in the middle of the gap above `next`, or under the last row; none where the row is now. */
      function place(rows: HTMLElement[], next: HTMLElement | undefined, stays: boolean) {
        if (!frame) return;
        if (placeholder) placeholder.style.visibility = "";
        placeholder = null;
        if (stays) {
          if (line) line.hidden = true;
          return;
        }
        const box = frame.getBoundingClientRect();
        const target = areaOf(next ?? rows.at(-1) ?? row).getBoundingClientRect();
        const previous = next && rows[rows.indexOf(next) - 1];
        const above = next ? previous && areaOf(previous).getBoundingClientRect() : target;
        // At either end, as far out as it'd be between two of them: halfway into the space each leaves after it.
        const half = (parseFloat(getComputedStyle(areaOf(next ?? rows.at(-1) ?? row)).marginBottom) || 2) / 2;
        // The end of a section (an empty marker, `data-reorder-end`) is just under what's in it; in an
        // empty one, in place of the words that say so (`data-reorder-placeholder`), which give way to it.
        const end = next?.dataset.reorderEnd !== undefined;
        const words = end ? next?.previousElementSibling : null;
        if (words instanceof HTMLElement && words.dataset.reorderPlaceholder !== undefined) {
          placeholder = words;
          placeholder.style.visibility = "hidden";
        }
        const middle = placeholder?.getBoundingClientRect();
        const y = middle ? middle.top + middle.height / 2 : end ? target.top + 1 : next ? (above ? (above.bottom + target.top) / 2 : target.top - half) : target.bottom + half;
        // A new line starts where it goes, rather than gliding in from the sidebar's corner.
        const fresh = !line;
        line ??= document.createElement("div");
        line.className = "reorder-line";
        line.hidden = false;
        line.style.width = `${target.width}px`;
        line.style.transform = `translate(${target.left - box.left}px, ${y - box.top - 1}px)`;
        if (fresh) frame.append(line);
      }

      function onpointermove(move: PointerEvent) {
        if (!dragging && Math.abs(move.clientY - startY) < DRAG_START) return;
        dragging = true;
        areaOf(row).classList.add("reordering");
        document.documentElement.classList.add("rows-dragging");
        const all = [...document.querySelectorAll<HTMLElement>(`[data-reorder="${CSS.escape(list)}"]`)];
        const rows = all.filter((other) => other !== row);
        const next = rows.find((other) => {
          const box = areaOf(other).getBoundingClientRect();
          return move.clientY < box.top + box.height / 2;
        });
        // Going before the row that's after it now (or to the end, when it's last) is staying put.
        const stays = next === all[all.indexOf(row) + 1];
        before = stays ? undefined : (next?.dataset.reorderKey ?? null);
        place(rows, next, stays);
      }

      function onpointerup() {
        window.removeEventListener("pointermove", onpointermove);
        window.removeEventListener("pointerup", onpointerup);
        window.removeEventListener("keydown", oncancel, true);
        areaOf(row).classList.remove("reordering");
        document.documentElement.classList.remove("rows-dragging");
        line?.remove();
        if (placeholder) placeholder.style.visibility = "";
        if (!dragging) return;
        // The click this press ends in isn't one that chooses the row.
        const swallow = (click: Event) => click.stopPropagation();
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
        if (before !== undefined) onmove(before);
      }

      /** Esc leaves it where it was. */
      function oncancel(key: KeyboardEvent) {
        if (key.key !== "Escape") return;
        key.preventDefault();
        before = undefined;
        onpointerup();
      }

      window.addEventListener("pointermove", onpointermove);
      window.addEventListener("pointerup", onpointerup);
      window.addEventListener("keydown", oncancel, true);
    }

    /** ⌥↑ and ⌥↓: past the row shown above or below, focus staying on it in its new place. */
    function onkeydown(event: KeyboardEvent) {
      const up = event.key === "ArrowUp";
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || (!up && event.key !== "ArrowDown")) return;
      const rows = [...document.querySelectorAll<HTMLElement>(`[data-reorder="${CSS.escape(list)}"]`)];
      const i = rows.indexOf(row);
      if (up ? i <= 0 : i >= rows.length - 1) return;
      event.preventDefault();
      onmove(up ? rows[i - 1].dataset.reorderKey! : (rows[i + 2]?.dataset.reorderKey ?? null));
      // Once the rows are drawn in their new order (not a frame later: frames stall while a window's hidden).
      void tick().then(() => document.querySelector<HTMLElement>(`[data-reorder="${CSS.escape(list)}"][data-reorder-key="${CSS.escape(key)}"]`)?.focus());
      speak(t(up ? "sidebar.movedUp" : "sidebar.movedDown"));
    }

    row.addEventListener("pointerdown", onpointerdown);
    row.addEventListener("keydown", onkeydown);
    return () => {
      row.removeEventListener("pointerdown", onpointerdown);
      row.removeEventListener("keydown", onkeydown);
    };
  };
}
