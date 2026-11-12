import { EditorView } from "@codemirror/view";
import { inCode } from "./fences";
import { selectedLines } from "./util";

/*
 * `>` typed over selected text quotes it, as `>` typed at the start of a line does, rather than
 * typing over it: each line the selection touches gets `> ` in front (a blank one `>`, so the
 * quote stays one), quoted once more if it's quoted already, and the text stays selected. In code
 * it's typed as any other key. ⌘Z takes it back.
 */
export const quoteInput = EditorView.inputHandler.of((view, _from, _to, text) => {
  const { state } = view;
  if (text !== ">" || state.readOnly || state.selection.ranges.every((range) => range.empty)) return false;
  if (state.selection.ranges.some((range) => inCode(state, range.from) || inCode(state, range.to))) return false;
  const changes = selectedLines(state).map((line) => ({ from: line.from, insert: line.text.trim() ? "> " : ">" }));
  view.dispatch({ changes, userEvent: "input.format", scrollIntoView: true });
  return true;
});
