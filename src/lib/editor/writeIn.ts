import type { EditorState, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editedNote } from "./util";

/*
 * Each pane's editor (panes.ts: MAIN, or a side note's id), so what's written from outside a note
 * (Take Notes, a quote from a transcript) goes into the note open in the pane it's meant for, as if
 * typed there, and in no other.
 */

const editors = new Map<string, () => EditorView | undefined>();

/** Makes a pane's editor one to write in; returns what stops that. */
export function paneEditor(pane: string, view: () => EditorView | undefined) {
  editors.set(pane, view);
  return () => {
    if (editors.get(pane) === view) editors.delete(pane);
  };
}

/** The note open in a pane's editor, if one is. */
export const openIn = (pane: string) => editors.get(pane)?.()?.state.facet(editedNote) ?? null;

/**
 * Writes in note `id` where it's open in `pane`, what `edit` makes of it, as if typed (⌘Z takes it
 * back), and puts the cursor there. Whether it could: the note open there, and not read-only.
 */
export function writeIn(pane: string, id: string, edit: (state: EditorState) => TransactionSpec): boolean {
  const view = editors.get(pane)?.();
  if (!view || view.state.facet(editedNote) !== id || view.state.readOnly) return false;
  view.dispatch(edit(view.state));
  view.focus();
  // Once the note's pane is laid out: just opened, on a phone it slides in only now.
  requestAnimationFrame(() => view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "center" }) }));
  return true;
}
