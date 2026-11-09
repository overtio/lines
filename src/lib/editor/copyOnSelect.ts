import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
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

/** A press of the main button in the note, then its release anywhere: what it selected is copied. */
const copying = EditorView.domEventHandlers({
  pointerdown(event, view) {
    if (event.button !== 0) return false;
    // On the window, as the release goes up past the document, where the editor has taken it.
    addEventListener("mouseup", () => copySelection(view), { once: true });
    return false;
  },
});

export const copyOnSelect = (on: boolean): Extension => (on ? copying : []);
