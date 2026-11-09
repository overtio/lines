import type { Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { copyText } from "../platform";

/*
 * Settings → Editor → Copy what you select: text selected in a note with the pointer (dragged over,
 * a word double-clicked, a line triple-clicked, a selection stretched with ⇧-click) is copied once
 * the button's let go, wherever that is, as a terminal does. What's copied is what ⌘C copies: the
 * note's text. Selecting with the keys copies nothing, so the clipboard isn't changed at every step.
 */

function copySelection(view: EditorView) {
  const { state } = view;
  const text = state.selection.ranges
    .filter((range) => !range.empty)
    .map((range) => state.sliceDoc(range.from, range.to))
    .join(state.lineBreak);
  if (!text) return;
  void copyText(text);
  speak(t("editor.copied"));
}

/**
 * A press of the main button in the note, then its release anywhere: what the pointer selected
 * meanwhile is copied. A press that selected nothing (a click following a link or opening a mention)
 * copies nothing, nor one that ended in dragging text away.
 */
const copying = ViewPlugin.fromClass(
  class {
    #press: AbortController | undefined;
    #selected = false;

    constructor(readonly view: EditorView) {}

    update(update: ViewUpdate) {
      if (this.#press && update.transactions.some((tr) => tr.isUserEvent("select.pointer"))) this.#selected = true;
    }

    pressed(event: PointerEvent) {
      this.#press?.abort();
      if (event.button !== 0) return;
      this.#selected = false;
      const press = (this.#press = new AbortController());
      const done = (copy: boolean) => {
        press.abort();
        if (this.#press === press) this.#press = undefined;
        if (copy && this.#selected) copySelection(this.view);
      };
      // On the window, and the mouse's release rather than the pointer's: it comes after the editor's own, which sets the selection last.
      window.addEventListener("mouseup", () => done(true), { signal: press.signal });
      window.addEventListener("pointercancel", () => done(false), { signal: press.signal });
      window.addEventListener("dragstart", () => done(false), { signal: press.signal });
    }

    destroy() {
      this.#press?.abort();
    }
  },
  {
    eventObservers: {
      pointerdown(event) {
        this.pressed(event);
      },
    },
  },
);

export const copyOnSelect = (on: boolean): Extension => (on ? copying : []);
