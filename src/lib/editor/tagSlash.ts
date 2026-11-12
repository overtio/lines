import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { TAG_CHAR } from "../notes/tags";

/**
 * A tag left ending in `/` (`#work/`, typed on the way to a nested tag, and drawn as a tag in `work`
 * meanwhile, syntax.ts) loses the slash once the cursor leaves it, in the same step, so one undo
 * brings both back. Not while the cursor's still in it, nor once something follows the slash.
 */
export const dropTagSlash = EditorState.transactionFilter.of((tr) => {
  const before = tr.startState.selection;
  if (!tr.selection || before.ranges.length > 1 || !before.main.empty || tr.isUserEvent("undo") || tr.isUserEvent("redo")) return tr;
  const node = syntaxTree(tr.startState).resolveInner(before.main.head, -1);
  const tag = node.name === "Tag" ? node : node.parent?.name === "Tag" ? node.parent : null;
  if (!tag) return tr;
  const slashes = /\/+$/.exec(tr.startState.sliceDoc(tag.from, tag.to))?.[0].length;
  if (!slashes) return tr;
  // Where it is after this step, and whether it still ends in the slash, with the cursor gone from it.
  const from = tr.changes.mapPos(tag.from, 1);
  const end = tr.changes.mapPos(tag.to, -1);
  const doc = tr.newDoc;
  const next = doc.sliceString(end, end + 2);
  if (doc.sliceString(end - slashes, end) !== "/".repeat(slashes) || (next && TAG_CHAR.test(String.fromCodePoint(next.codePointAt(0)!)))) return tr;
  const head = tr.newSelection.main.head;
  if (tr.newSelection.ranges.length === 1 && head > from && head <= end) return tr;
  return [tr, { changes: { from: end - slashes, to: end }, sequential: true }];
});
