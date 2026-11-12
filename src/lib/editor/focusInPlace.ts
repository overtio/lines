import { type EditorView, ViewPlugin } from "@codemirror/view";

/*
 * A click into a note that isn't focused keeps it where it was. In the Mac app's WebKit, focusing a
 * note's editor (as the first click into a note just opened does) scrolls it to where its cursor
 * last was, though it's asked not to: the note jumped, and CodeMirror, which measures where a press
 * is before focusing the editor and again after, could select from where the press had been before
 * the jump to where it landed. So the press focuses it first, before CodeMirror measures it, and the
 * scroll it had is held a moment, put back if WebKit moves it (one the wheel or trackpad makes is
 * the person's, and ends the hold).
 */

/** How long after focusing a scroll WebKit makes is put back, in ms. */
const HOLD_MS = 250;

export const focusInPlace = ViewPlugin.fromClass(
  class {
    #hold: { top: number; left: number; until: number } | null = null;

    constructor(readonly view: EditorView) {
      // Before CodeMirror's own handling of the press, which would focus it after measuring it.
      view.contentDOM.addEventListener("mousedown", this.down, true);
      view.scrollDOM.addEventListener("scroll", this.scrolled);
      view.scrollDOM.addEventListener("wheel", this.release, { passive: true });
    }

    down = (event: MouseEvent) => {
      const { view } = this;
      if (event.button !== 0 || view.hasFocus) return;
      // In the text, not on what's drawn in it (a table's buttons, a grid), which takes its own presses.
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(".cm-content [contenteditable=false]")) return;
      const { scrollTop: top, scrollLeft: left } = view.scrollDOM;
      this.#hold = { top, left, until: performance.now() + HOLD_MS };
      view.contentDOM.focus({ preventScroll: true });
      this.scrolled();
    };

    scrolled = () => {
      const hold = this.#hold;
      if (!hold) return;
      if (performance.now() > hold.until) return this.release();
      const scroller = this.view.scrollDOM;
      if (Math.abs(scroller.scrollTop - hold.top) > 1) scroller.scrollTop = hold.top;
      if (Math.abs(scroller.scrollLeft - hold.left) > 1) scroller.scrollLeft = hold.left;
    };

    release = () => {
      this.#hold = null;
    };

    destroy() {
      this.view.contentDOM.removeEventListener("mousedown", this.down, true);
      this.view.scrollDOM.removeEventListener("scroll", this.scrolled);
      this.view.scrollDOM.removeEventListener("wheel", this.release);
    }
  },
);
