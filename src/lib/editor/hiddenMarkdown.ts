import { syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, type Extension, findClusterBreak, type Line, Prec, RangeSet } from "@codemirror/state";
import { type Command, EditorView, keymap } from "@codemirror/view";
import { INLINE_STYLES, livePreview } from "./livePreview";
import { frontMatterField } from "./objects";

/*
 * Hidden Markdown (Settings → Editor → Markdown), as in Bear or Notion: what only styles text, its
 * `**`, a heading's `#`, a list's marker, is typed and stays in the note but never shows, even under
 * the cursor (livePreview.ts). So the cursor never stops in it, where typing would break it: it goes
 * over it as over nothing, stays after a line's marks (on a heading's text, never before its `#`),
 * and at either end of styled text, outside it. Backspace and Delete beside marks take the text past
 * them; Backspace at the start of a heading's text makes it text again.
 */

/** Marks hidden next to each other on a line, and where the cursor stops in them (`at`). */
interface Run {
  from: number;
  to: number;
  at: number;
  /** Marks starting the line: its `>`, a list's marker and checkbox, a heading's `#` (from `heading`). */
  lead: boolean;
  heading?: number;
}

/** What live preview draws without looking inside, so its marks show. */
const OPAQUE = new Set(["Table", "Image", "FencedCode", "CodeBlock", "MathBlock", "InlineMath", "Mention", "Tag", "Autolink", "HTMLBlock", "CommentBlock"]);
/** Marks that start a line. */
const LEADS = new Set(["HeaderMark", "QuoteMark", "ListMark", "TaskMarker"]);

/** The runs of hidden marks on `line`. */
function runsOn(state: EditorState, line: Line): Run[] {
  const { doc } = state;
  const front = state.field(frontMatterField, false);
  const inProperties = !!front && line.number <= front.lines;
  const spaceAfter = (pos: number) => (doc.sliceString(pos, pos + 1) === " " ? pos + 1 : pos);
  const leads = new Map<number, { to: number; heading: boolean }>();
  const marks: { from: number; to: number; closing: boolean }[] = [];
  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter(ref) {
      if (OPAQUE.has(ref.name)) return false;
      const parent = ref.node.parent;
      if (!parent || ref.from < line.from || ref.to > line.to) return;
      if (LEADS.has(ref.name)) {
        if (ref.name !== "HeaderMark") leads.set(ref.from, { to: spaceAfter(ref.to), heading: false });
        else if (!parent.name.startsWith("ATXHeading")) return;
        else if (ref.from === parent.from) leads.set(ref.from, { to: spaceAfter(ref.to), heading: true });
        // A heading's closing `#`s, and the space before them.
        else marks.push({ from: doc.sliceString(ref.from - 1, ref.from) === " " ? ref.from - 1 : ref.from, to: ref.to, closing: true });
        return;
      }
      const style = INLINE_STYLES[parent.name];
      if (style && ref.name === style[1]) marks.push({ from: ref.from, to: ref.to, closing: ref.to === parent.to });
    },
  });

  const runs: Run[] = [];
  let lead = line.from;
  let heading: number | undefined;
  for (;;) {
    const at = lead + /^[ \t]*/.exec(doc.sliceString(lead, line.to))![0].length;
    const mark = !inProperties && leads.get(at);
    if (!mark) break;
    if (mark.heading) heading = at;
    lead = mark.to;
  }
  if (lead > line.from) runs.push({ from: line.from, to: lead, at: lead, lead: true, heading });
  // Marks next to each other make one run, which the cursor stops in after those that close
  // styled text, before those that open it: outside both.
  for (const mark of marks.sort((a, b) => a.from - b.from)) {
    const last = runs.at(-1);
    if (last && mark.from <= last.to) {
      if (mark.closing && last.at === last.to) last.at = mark.to;
      last.to = Math.max(last.to, mark.to);
    } else {
      runs.push({ from: mark.from, to: mark.to, at: mark.closing ? mark.to : mark.from, lead: false });
    }
  }
  return runs;
}

const runAt = (state: EditorState, pos: number) => runsOn(state, state.doc.lineAt(pos)).find((run) => run.from <= pos && pos <= run.to);

/** The next character's edge from `pos` on its line, or the next line's start or the last's end. */
function beyond(state: EditorState, pos: number, forward: boolean) {
  const line = state.doc.lineAt(pos);
  if (forward ? pos === line.to : pos === line.from) return Math.max(0, Math.min(state.doc.length, pos + (forward ? 1 : -1)));
  return line.from + findClusterBreak(line.text, pos - line.from, forward);
}

/**
 * Where a cursor at `pos` goes: where it stops in hidden marks it's in. One the arrow keys moved
 * from there across them (`from`) goes on to the character beyond, as they look like nothing. An
 * edit only moves one inside marks, or before a line's, so styled text just typed or ended (`**`
 * after it) isn't left.
 */
function settle(state: EditorState, pos: number, edited: boolean, from?: number) {
  const run = runAt(state, pos);
  if (!run || pos === run.at) return pos;
  if (edited) return run.lead || (run.from < pos && pos < run.to) ? run.at : pos;
  if (run.lead || from !== run.at) return run.at;
  const next = beyond(state, pos > from ? run.to : run.from, pos > from);
  const further = runAt(state, next);
  return further ? further.at : next;
}

/** A selection's end the arrow keys moved (from `from`) only across hidden marks goes on to the character beyond. */
function extend(state: EditorState, head: number, from?: number) {
  const run = runAt(state, head);
  if (!run || from === undefined || from === head || from < run.from || from > run.to) return head;
  return beyond(state, head > from ? run.to : run.from, head > from);
}

/** Keeps each cursor where it stops in hidden marks, and selections from ending on them alone. */
const settleCursors = EditorState.transactionFilter.of((tr) => {
  if ((!tr.selection && !tr.docChanged) || tr.isUserEvent("input.type.compose")) return tr;
  const { state } = tr;
  // An arrow key's step, not a click or a jump.
  const step = !tr.docChanged && tr.isUserEvent("select") && !tr.isUserEvent("select.pointer");
  const before = tr.startState.selection.ranges;
  let moved = false;
  const ranges = state.selection.ranges.map((range, i) => {
    const from = step ? before[i]?.head : undefined;
    const head = range.empty ? settle(state, range.head, tr.docChanged, before[i]?.empty ? from : undefined) : extend(state, range.head, from);
    if (head === range.head) return range;
    moved = true;
    return range.empty ? EditorSelection.cursor(head) : EditorSelection.range(range.anchor, head);
  });
  return moved ? [tr, { selection: EditorSelection.create(ranges, state.selection.mainIndex), sequential: true }] : tr;
});

/** Backspace or Delete beside marks takes the character past them, and the marks too if it's all they styled. */
const deleteBeside =
  (forward: boolean): Command =>
  (view) => {
    const { state } = view;
    const range = state.selection.main;
    if (state.readOnly || state.selection.ranges.length > 1 || !range.empty) return false;
    const pos = range.head;
    const run = runAt(state, pos);
    if (!run) return false;
    if (run.lead && !forward) {
      // At the start of a heading's text, Backspace makes it text: its `#` go. A list's and a quote's
      // marks are Markdown's own Backspace's.
      if (pos !== run.at || run.heading === undefined) return false;
      view.dispatch({ changes: { from: run.heading, to: run.at }, userEvent: "delete.backward", scrollIntoView: true });
      return true;
    }
    if (forward ? pos >= run.to : pos <= run.from) return false;
    const edge = forward ? run.to : run.from;
    const line = state.doc.lineAt(pos);
    if (forward ? edge >= line.to : edge <= line.from) return false;
    const other = beyond(state, edge, forward);
    let [from, to] = forward ? [edge, other] : [other, edge];
    for (let node = syntaxTree(state).resolveInner(from, 1); node.parent; node = node.parent) {
      const style = INLINE_STYLES[node.name];
      if (!style) continue;
      const marks = node.getChildren(style[1]);
      if (marks.length > 1 && marks[0].to === from && marks[marks.length - 1].from === to) [from, to] = [node.from, node.to];
      break;
    }
    const changes = state.changes({ from, to });
    view.dispatch({ changes, selection: { anchor: changes.mapPos(pos) }, userEvent: forward ? "delete.forward" : "delete.backward", scrollIntoView: true });
    return true;
  };

/** ← at the start of a line's text goes to the end of the line before, not into its marks. */
const leftOfMarks: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1 || !range.empty) return false;
  const run = runAt(state, range.head);
  if (!run?.lead || range.head !== run.at) return false;
  if (run.from > 0) view.dispatch({ selection: { anchor: run.from - 1 }, scrollIntoView: true, userEvent: "select" });
  return true;
};

/** Return at the start of a heading's text puts a line above it, rather than leaving its `#` there. */
const lineAboveHeading: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  if (state.readOnly || state.selection.ranges.length > 1 || !range.empty) return false;
  const run = runAt(state, range.head);
  if (!run?.lead || run.heading === undefined || range.head !== run.at || run.at === state.doc.lineAt(run.at).to) return false;
  view.dispatch({ changes: { from: run.from, insert: "\n" }, selection: { anchor: range.head + 1 }, userEvent: "input", scrollIntoView: true });
  return true;
};

/** Hidden Markdown's cursor and keys, over what live preview draws. */
export const hiddenMarkdown: Extension = [
  settleCursors,
  // What's drawn in place of Markdown (a mention, a list's bullet) the cursor goes over in one step.
  EditorView.atomicRanges.of((view) => view.plugin(livePreview)?.atoms ?? RangeSet.empty),
  Prec.highest(
    keymap.of([
      { key: "Backspace", run: deleteBeside(false) },
      { key: "Delete", run: deleteBeside(true) },
      { key: "ArrowLeft", run: leftOfMarks },
      { key: "Enter", run: lineAboveHeading },
    ]),
  ),
];
