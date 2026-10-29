import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorSelection, type EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { toggleFormat } from "./formatting";
import { ancestors, hasText } from "./util";

/*
 * Typing help for code blocks (```) and cards (:::): typing an opening fence adds its closing
 * one, typing ` or : with text selected puts the text in a code block or a card, and quotes
 * typed in code stay straight.
 */

interface Block {
  /** The syntax node it parses as, and what its closing fence looks like. */
  node: string;
  closer: RegExp;
}

const BLOCKS: Record<string, Block> = {
  "`": { node: "FencedCode", closer: /^\s*(`{3,}|~{3,})\s*$/ },
  ":": { node: "Card", closer: /^\s*:{3,}\s*$/ },
};

/** Code, where these characters are just text. */
const CODE = new Set(["FencedCode", "CodeBlock", "InlineCode"]);

function inCode(state: EditorState, pos: number) {
  for (const node of ancestors(state, pos, -1)) {
    if (CODE.has(node.name)) return true;
  }
  return false;
}

/** The block of `type` that starts on line `lineFrom`, if one does. */
function blockAt(state: EditorState, type: string, lineFrom: number): SyntaxNode | null {
  const line = state.doc.lineAt(lineFrom);
  const tree = ensureSyntaxTree(state, Math.min(state.doc.length, line.to + 1), 50) ?? syntaxTree(state);
  for (let node: SyntaxNode | null = tree.resolveInner(line.to, -1); node; node = node.parent) {
    if (node.name === type && state.doc.lineAt(node.from).number === line.number) return node;
  }
  return null;
}

/** Typing the third ` or : of an opening fence adds the closing fence on the line below. */
function closeFence(view: EditorView, from: number, to: number, text: string) {
  const block = BLOCKS[text];
  const { state } = view;
  const line = state.doc.lineAt(from);
  const typed = line.text.slice(0, from - line.from) + text + line.text.slice(to - line.from);
  const fence = /^(\s*)(`{3}|:{3})$/.exec(typed);
  if (!fence || to !== line.to || inCode(state, line.from)) return false;
  const tr = state.update({ changes: { from, to, insert: text }, selection: { anchor: from + 1 } });
  // Only an opening fence with nothing to close it. A fence that closes a block above, or pairs
  // with a closing fence further down, is left as it is.
  const opened = blockAt(tr.state, block.node, line.from);
  if (!opened) return false;
  const last = tr.state.doc.lineAt(opened.to);
  if (last.number > line.number && block.closer.test(last.text)) return false;
  view.dispatch({
    changes: { from, to, insert: `${text}\n${fence[1]}${fence[2]}` },
    selection: { anchor: from + 1 },
    userEvent: "input.type",
  });
  return true;
}

/** Puts the selected lines in a block between `open` and `close` lines, keeping them selected. */
function wrapLines(view: EditorView, open: string, close: string, spaced: boolean) {
  const { state } = view;
  const { doc } = state;
  const { from, to } = state.selection.main;
  const first = doc.lineAt(from);
  // A selection that ends at the very start of a line (as a triple click does) stops before it.
  const last = doc.lineAt(to > from && doc.lineAt(to).from === to ? to - 1 : to);
  // Blank lines around a card keep it a card in other Markdown apps too.
  const before = spaced && hasText(doc, first.number - 1) ? "\n" : "";
  const after = spaced && hasText(doc, last.number + 1) ? "\n" : "";
  const changes = state.changes([
    { from: first.from, insert: `${before}${open}\n` },
    { from: last.to, insert: `\n${close}${after}` },
  ]);
  view.dispatch({
    changes,
    selection: EditorSelection.range(changes.mapPos(first.from, 1), changes.mapPos(last.to, -1)),
    scrollIntoView: true,
    userEvent: "input.type",
  });
  return true;
}

/**
 * ` or : typed over a selection. ` makes inline code within a line, else a code block; : makes
 * a card of whole lines, and otherwise just replaces the selection like any other character.
 */
function wrapSelection(view: EditorView, text: string) {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1 || inCode(state, range.from)) return false;
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  const multiline = first.number !== last.number;
  if (text === "`") return multiline ? wrapLines(view, "```", "```", false) : toggleFormat("code")(view);
  const wholeLine = range.from === first.from && range.to === last.to;
  return (multiline || wholeLine) && wrapLines(view, "::: card", ":::", true);
}

/**
 * Quotes and dashes stay straight in code. macOS turns " into “ ” and -- into — as you type
 * (Edit → Substitutions), which is nice in prose but breaks code.
 */
function straightInCode(view: EditorView, from: number, to: number, text: string) {
  if (!/[“”‘’—–]/.test(text) || !inCode(view.state, from)) return false;
  const replaced = view.state.sliceDoc(from, to);
  const straight = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, (dash) => (replaced.includes("-") ? replaced.replace(/[^-]/g, "") || "-" : dash));
  view.dispatch({
    changes: { from, to, insert: straight },
    selection: { anchor: from + straight.length },
    userEvent: "input.type",
  });
  return true;
}

export const fenceInput = EditorView.inputHandler.of((view, from, to, text) => {
  if (view.state.readOnly) return false;
  if (straightInCode(view, from, to, text)) return true;
  if (!(text in BLOCKS)) return false;
  const range = view.state.selection.main;
  if (!range.empty && range.from === from && range.to === to) return wrapSelection(view, text);
  return closeFence(view, from, to, text);
});
