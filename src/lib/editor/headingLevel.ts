import { isolateHistory } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

/*
 * A heading's level, typed over: `## ` typed at the start of an H1's text (its `# ` hidden there, or
 * not) makes it an H2, `# ` an H1, as typing them on a line of text makes it one, rather than
 * leaving `##` as words in the H1. ⌘Z after leaves them as typed.
 */

/** A heading's marks, and those typed at the start of its text, up to the cursor. */
const TYPED_OVER = /^#{1,6}[ \t]+(#{1,6})$/;

export const headingLevelInput = EditorView.inputHandler.of((view, from, to, text) => {
  const { state } = view;
  if (text !== " " || from !== to || state.readOnly) return false;
  const line = state.doc.lineAt(from);
  const typed = TYPED_OVER.exec(state.sliceDoc(line.from, from))?.[1];
  if (!typed) return false;
  // A heading's, not a code block's comment.
  const node = syntaxTree(state).resolveInner(line.from, 1);
  if (![node.name, node.parent?.name ?? ""].some((name) => name.startsWith("ATXHeading"))) return false;
  view.dispatch({ changes: { from, insert: " " }, selection: { anchor: from + 1 }, userEvent: "input.type" });
  view.dispatch({
    changes: { from: line.from, to: from + 1, insert: `${typed} ` },
    selection: { anchor: line.from + typed.length + 1 },
    annotations: isolateHistory.of("before"),
    userEvent: "input.type",
  });
  return true;
});
