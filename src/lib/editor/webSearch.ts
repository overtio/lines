import type { EditorView } from "@codemirror/view";
import { type Component, mount, unmount } from "svelte";

/** Where a picker opens, and what it's told when it has closed: `openPicker` gives these. */
export interface Placed {
  x: number;
  y: number;
  onclose: () => void;
}

/**
 * A "/" command's picker of something on the web (WebSearchPicker.svelte): takes the typed command
 * (`from`–`to`) out, and opens `picker` with `props` at the cursor. Closed, the note has the keyboard again.
 */
export function openPicker<Props extends Placed>(view: EditorView, from: number, to: number, picker: Component<Props>, props: Omit<Props, keyof Placed>) {
  view.dispatch({ changes: { from, to }, userEvent: "delete" });
  const at = view.coordsAtPos(from) ?? view.contentDOM.getBoundingClientRect();
  const mounted = mount(picker, {
    target: document.body,
    props: {
      ...props,
      x: at.left,
      y: at.bottom,
      onclose() {
        if (view.dom.isConnected) view.focus();
        // Once the picker has finished closing.
        setTimeout(() => void unmount(mounted));
      },
    } as Props,
  });
}
