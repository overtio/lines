import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdownKeymap, markdownLanguage, pasteURLAsLink } from "@codemirror/lang-markdown";
import { HighlightStyle, Language, LanguageDescription, ParseContext, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import type { Parser } from "@lezer/common";
import { type MarkdownParser, parseCode } from "@lezer/markdown";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Prec, type Extension, type StateCommand } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { cards } from "./cards";
import { cursor } from "./cursor";
import { dragBlocks } from "./dragBlocks";
import { fenceInput } from "./fences";
import { attachmentBlocks } from "./attachments";
import { formatToolbar, toggleFormat } from "./formatting";
import { listKeymap } from "./lists";
import { livePreview } from "./livePreview";
import { mermaidDiagrams } from "./mermaid";
import { slashCommands } from "./slashCommands";
import { tables } from "./tables";
import { Card, Highlight, Tag } from "./syntax";

/**
 * The parser for a code block's language (```sql, ```ts…). Each language is loaded the first time
 * a note uses it; until then the block shows as plain code.
 */
function codeParser(info: string): Parser | null {
  const name = /\S*/.exec(info)![0];
  const found = name ? LanguageDescription.matchLanguageName(languages, name, true) : null;
  if (!found) return null;
  return found.support ? found.support.language.parser : ParseContext.getSkippingParser(found.load());
}

/**
 * GFM plus our #tags, ==highlights==, cards and highlighted code blocks. Built directly rather
 * than through `markdown()`, which would also bundle HTML, CSS and JavaScript parsers up front.
 * Sharing `markdownLanguage.data` keeps list continuation on Enter working.
 */
const language = new Language(
  markdownLanguage.data,
  (markdownLanguage.parser as MarkdownParser).configure([Tag, Highlight, Card, parseCode({ codeParser })]),
  [],
  "markdown",
);

/** Turn the selected lines into todos, or tick/untick them if they already are. */
const toggleTodo: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  const { doc } = state;
  const changes = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    // A selection that ends at the very start of a line (as a triple click does) stops before it.
    const end = range.to > range.from && doc.lineAt(range.to).from === range.to ? range.to - 1 : range.to;
    for (let n = doc.lineAt(range.from).number; n <= doc.lineAt(end).number; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = doc.line(n);
      // Quote markers and indentation stay; a list marker becomes a checkbox.
      const [, lead, marker = "", box] = /^((?:\s*>\s?)*\s*)([-*+] \[([ xX])\] |[-*+] |\d+[.)] )?/.exec(line.text)!;
      const from = line.from + lead.length;
      if (box) changes.push({ from: from + 3, to: from + 4, insert: box === " " ? "x" : " " });
      else changes.push({ from, to: from + marker.length, insert: "- [ ] " });
    }
  }
  dispatch(state.update({ changes, scrollIntoView: true, userEvent: "input.format" }));
  return true;
};

const formattingKeymap = keymap.of([
  { key: "Mod-b", run: toggleFormat("bold") },
  { key: "Mod-i", run: toggleFormat("italic") },
  { key: "Mod-e", run: toggleFormat("code") },
  { key: "Mod-Shift-x", run: toggleFormat("strike") },
  { key: "Mod-Shift-h", run: toggleFormat("highlight") },
  { key: "Mod-Enter", run: toggleTodo },
]);

const highlightStyle = HighlightStyle.define([
  { tag: t.processingInstruction, color: "var(--text-faint)" },
  { tag: t.url, color: "var(--text-faint)" },
  { tag: t.contentSeparator, color: "var(--text-faint)" },
  { tag: t.monospace, fontFamily: "var(--font-mono)" },
  // Code blocks; each theme has its own colors for these (app.css, themes.css).
  { tag: [t.keyword, t.modifier, t.self, t.operatorKeyword, t.tagName], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit, t.constant(t.variableName)], color: "var(--syn-number)" },
  { tag: [t.comment, t.meta], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName, t.attributeName], color: "var(--syn-function)" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.variableName), t.propertyName], color: "var(--syn-type)" },
  { tag: t.invalid, color: "var(--danger)" },
]);

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--editor-size)",
    backgroundColor: "transparent",
    color: "var(--text)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-text)",
    lineHeight: "var(--editor-line-height)",
    overflowX: "hidden",
    overscrollBehavior: "contain",
  },
  ".cm-content": {
    maxWidth: "var(--editor-width)",
    margin: "0 auto",
    padding: "var(--editor-pad-top) var(--editor-pad-x) 40vh",
  },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--text-faint)" },
  // Selections are the browser's own (no drawSelection), tinted with the theme's accent.
  ".cm-content ::selection": { backgroundColor: "var(--selection)" },
  // Other places the selected text appears; neutral, so they don't read as ==highlights==.
  ".cm-selectionMatch": { backgroundColor: "var(--active)" },
  // The slash command menu, styled like the app's other menus.
  ".cm-tooltip.cm-tooltip-autocomplete": {
    padding: "5px",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    backgroundColor: "var(--bg-elevated)",
    boxShadow: "var(--shadow-menu)",
    fontFamily: "var(--font-ui)",
    fontSize: "13.5px",
    lineHeight: "1.3",
  },
  // A set width with room kept for the scroll bar: WebKit sizes the list to its rows and then
  // takes a classic scroll bar out of that, which cut off the hints on the right.
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    width: "240px",
    minWidth: "0",
    scrollbarGutter: "stable",
    maxHeight: "320px",
    fontFamily: "inherit",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    height: "32px",
    padding: "0 10px",
    borderRadius: "6px",
    color: "var(--text)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--active) !important",
    color: "var(--text) !important",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > completion-section": {
    display: "block",
    margin: "6px 10px 3px",
    padding: "0",
    border: "none",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-faint)",
    opacity: "1",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > completion-section:first-child": { marginTop: "2px" },
  ".cm-slash-icon": { display: "flex", color: "var(--text-muted)" },
  ".cm-completionLabel": { flex: "1" },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
  ".cm-completionDetail": {
    marginLeft: "12px",
    fontFamily: "var(--font-mono)",
    fontSize: "11.5px",
    fontStyle: "normal",
    color: "var(--text-faint)",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-elevated)",
    color: "var(--text)",
    borderColor: "var(--border) !important",
  },
});

export const readOnlyCompartment = new Compartment();

export function readOnly(value: boolean): Extension {
  return [EditorState.readOnly.of(value), EditorView.editable.of(!value)];
}

export function createExtensions(onChange: () => void): Extension[] {
  return [
    history(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      spellcheck: "true",
      autocorrect: "on",
      autocapitalize: "sentences",
      "aria-label": "Note",
    }),
    language,
    pasteURLAsLink,
    tables,
    mermaidDiagrams,
    attachmentBlocks,
    cards,
    cursor,
    dragBlocks,
    listKeymap,
    Prec.high(keymap.of(markdownKeymap)),
    syntaxHighlighting(highlightStyle),
    livePreview,
    slashCommands,
    formatToolbar,
    fenceInput,
    search({ top: true }),
    highlightSelectionMatches(),
    placeholder("Start writing…"),
    formattingKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    readOnlyCompartment.of(readOnly(false)),
    theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange();
    }),
  ];
}
