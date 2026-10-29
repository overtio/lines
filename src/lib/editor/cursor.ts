import { EditorSelection } from "@codemirror/state";
import { EditorView, layer, RectangleMarker } from "@codemirror/view";

/*
 * The text cursor, drawn by the editor instead of the browser. WebKit (the Mac and iPhone apps)
 * can leave a copy of its own caret behind, so that one is hidden. Selections stay native.
 * CodeMirror's base theme makes it blink and shows it only while the editor has focus.
 */

const cursorLayer = layer({
  above: true,
  class: "cm-cursorLayer",
  markers(view) {
    const { main } = view.state.selection;
    if (!main.empty) return [];
    // At the end of a line, measure against the text before the cursor, not a button placed after
    // it (a code block's copy button sits in its corner, a value's copy button may be hidden).
    const assoc = main.head === view.state.doc.lineAt(main.head).to ? -1 : main.assoc;
    return RectangleMarker.forRange(view, "cm-cursor cm-cursor-primary", EditorSelection.cursor(main.head, assoc));
  },
  update(update, dom) {
    // Restart the blink, so the cursor is solid while it moves.
    if (update.selectionSet) dom.style.animationName = dom.style.animationName === "cm-blink" ? "cm-blink2" : "cm-blink";
    return update.docChanged || update.selectionSet || update.geometryChanged || update.viewportChanged;
  },
});

export const cursor = [
  cursorLayer,
  EditorView.theme({
    ".cm-content, .cm-line": { caretColor: "transparent !important" },
    ".cm-cursor": { borderLeft: "2px solid var(--accent)", marginLeft: "-1px" },
    ".cm-cursorLayer": { animationDuration: "1.2s" },
  }),
];
