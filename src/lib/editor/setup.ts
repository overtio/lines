import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdownKeymap, markdownLanguage, pasteURLAsLink } from "@codemirror/lang-markdown";
import { HighlightStyle, Language, ParseContext, syntaxHighlighting } from "@codemirror/language";
import type { Parser } from "@lezer/common";
import { type MarkdownParser, parseCode } from "@lezer/markdown";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Prec, type Extension, type StateCommand } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { cards } from "./cards";
import { codeLanguage } from "./codeLanguages";
import { cursor } from "./cursor";
import { dragBlocks } from "./dragBlocks";
import { fenceInput } from "./fences";
import { find } from "./find.svelte";
import { attachmentBlocks } from "./attachments";
import { formatToolbar, toggleFormat } from "./formatting";
import { listKeymap } from "./lists";
import { livePreview, openAtCursor } from "./livePreview";
import { mathBlocks } from "./math";
import { markdownPaperLink, paperCommands } from "./papers";
import { renderedBlocks } from "./rendered";
import { slashCommands } from "./slashCommands";
import { symbols } from "./symbols";
import { tables } from "./tables";
import { typeTables } from "./typeTables";
import { frontMatterField, missingNotes } from "./objects";
import { markdownOutline, outlineCompartment } from "./outline.svelte";
import { Card, Highlight, Mention, Tag, TexMath, Underline } from "./syntax";
import { t as message } from "../i18n/index.svelte";
import { DEFAULT_LANGUAGE, plugins } from "../plugins/registry.svelte";
import type { MarkdownAddition, NoteLanguage, PaperSource } from "../plugins/types";
import { lineMarkers } from "./markers";
import { hiddenMarkdown } from "./hiddenMarkdown";
import { markdownPageBreaks } from "./pageBreaks";
import { markupMode } from "./markupMode";
import { type MarkdownMode, prefs } from "../prefs.svelte";

/**
 * The parser for a code block's language (```sql, ```ts…). Each language is loaded the first time
 * a note uses it; until then the block shows as plain code.
 */
function codeParser(info: string): Parser | null {
  // ```math is LaTeX, drawn as math (math.ts).
  const name = /\S*/.exec(info)![0].replace(/^math$/i, "latex");
  if (!name) return null;
  const found = codeLanguage(name);
  if (!found) return null;
  return found.support ? found.support.language.parser : ParseContext.getSkippingParser(found.load());
}

/**
 * GFM plus our #tags, ==highlights==, <u>underlines</u>, cards, $math$, @mentions, highlighted code blocks and what
 * plugins add. Built directly rather than through `markdown()`, which would also bundle HTML, CSS
 * and JavaScript parsers up front. Sharing `markdownLanguage.data` keeps list continuation on
 * Enter working.
 */
const linedown = (additions: MarkdownAddition[]) =>
  new Language(
    markdownLanguage.data,
    (markdownLanguage.parser as MarkdownParser).configure([
      Tag,
      Highlight,
      Underline,
      Card,
      TexMath,
      Mention,
      parseCode({ codeParser }),
      ...additions.flatMap((addition) => addition.syntax ?? []),
    ]),
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
  { key: "Mod-u", run: toggleFormat("underline") },
  { key: "Mod-e", run: toggleFormat("code") },
  { key: "Mod-Shift-x", run: toggleFormat("strike") },
  { key: "Mod-Shift-h", run: toggleFormat("highlight") },
  { key: "Mod-Enter", run: toggleTodo },
  // Opens the mention, link or file under the cursor (as ⌘-click does), as Obsidian's ⌥↵ does.
  { key: "Alt-Enter", run: openAtCursor },
]);

/** Code's colors, the theme's. */
export const highlightStyle = HighlightStyle.define([
  { tag: t.processingInstruction, color: "var(--text-faint)" },
  { tag: t.url, color: "var(--text-faint)" },
  { tag: t.contentSeparator, color: "var(--text-faint)" },
  { tag: t.monospace, fontFamily: "var(--font-mono)" },
  // Code blocks; each theme has its own colors for these (app.css, and theme plugins).
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
    padding: "var(--editor-pad-top) var(--editor-pad-x) var(--editor-pad-bottom)",
  },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--text-faint)" },
  // Selections are the browser's own (no drawSelection), tinted with the theme's accent.
  ".cm-content ::selection": { backgroundColor: "var(--selection)" },
  // Other places the selected text appears; neutral, so they don't read as ==highlights==.
  ".cm-selectionMatch": { backgroundColor: "var(--active)" },
  // The find bar's matches (find.svelte.ts), and the one it's on.
  ".cm-searchMatch": { backgroundColor: "var(--accent-soft)", borderRadius: "2px" },
  ".cm-searchMatch-selected, .cm-searchMatch-selected .cm-selectionMatch": {
    backgroundColor: "var(--accent)",
    color: "var(--on-accent)",
  },
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
    cursor: "pointer",
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
  ".cm-completionLabel": { flex: "1 0 auto" },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
  ".cm-completionDetail": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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

/** CodeMirror's own words (what it says to screen readers, its go-to-line box), in the app's language. */
const phrases = EditorState.phrases.of({
  close: message("editor.cm.close"),
  "current match": message("editor.cm.currentMatch"),
  "on line": message("editor.cm.onLine"),
  "replaced $ matches": message("editor.cm.replacedMatches"),
  "replaced match on line $": message("editor.cm.replacedMatchOnLine"),
  "Go to line": message("editor.cm.goToLine"),
  go: message("editor.cm.go"),
  Completions: message("editor.cm.completions"),
  "Control character": message("editor.cm.controlCharacter"),
  "Selection deleted": message("editor.cm.selectionDeleted"),
});

/**
 * What only a Markdown note's editor has: the parser, live preview, blocks, menus and keys, and
 * plugins' additions, with "/paper" for each source of papers; dragging lines if it's on, and
 * hidden Markdown's cursor and keys while it's hidden.
 */
const linedownEditing = (additions: MarkdownAddition[], papers: PaperSource[], mode: MarkdownMode, drag: boolean): Extension => [
  linedown(additions),
  frontMatterField,
  missingNotes,
  pasteURLAsLink,
  tables,
  renderedBlocks,
  mathBlocks,
  typeTables,
  attachmentBlocks,
  markdownPageBreaks,
  cards,
  drag ? dragBlocks : [],
  listKeymap,
  Prec.high(keymap.of(markdownKeymap)),
  // Before live preview, so its marks (a code span, a link) wrap the symbols inside them.
  symbols,
  livePreview,
  mode === "hidden" ? hiddenMarkdown : [],
  slashCommands([...additions.flatMap((addition) => addition.commands ?? []), ...paperCommands(papers, markdownPaperLink)]),
  formatToolbar,
  fenceInput,
  formattingKeymap,
  markdownOutline,
  additions.flatMap((addition) => addition.editor ?? []),
];

/** Markdown as written (Settings → Editor → Show Markdown → Source): its marks faint, what they do to text shown on it. */
const sourceStyle = HighlightStyle.define([
  { tag: t.heading, fontWeight: "700", color: "var(--heading-color)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.special(t.url)], color: "var(--accent)" },
  { tag: t.quote, color: "var(--text-muted)" },
]);

let built: { additions: MarkdownAddition[]; papers: PaperSource[]; mode: MarkdownMode; drag: boolean; editing: Extension } | undefined;

/** A Markdown note's editor (the Markdown plugin's), made again when plugins add something else to Markdown, or its settings change. */
export function markdownEditing(): Extension {
  const { markdown: additions, papers } = plugins;
  const { markdownMode: mode, dragBlocks: drag } = prefs;
  if (built?.additions !== additions || built.papers !== papers || built.mode !== mode || built.drag !== drag) {
    built = { additions, papers, mode, drag, editing: linedownEditing(additions, papers, mode, drag) };
  }
  return built.editing;
}

/** The editing for a note's language: Markdown, LaTeX… (each its plugin's), or none for plain text. */
export const formatCompartment = new Compartment();

/** Each language's editing as last made, so a note opened in it again isn't set up again. */
const made = new WeakMap<NoteLanguage, { editor: Extension; mode: MarkdownMode; editing: Extension }>();

/**
 * A language's own editing, the marks in the margin every language has (markers.ts), and how its
 * markup shows (markupMode.ts): as written, it's only colored.
 */
export function formatEditing(format = DEFAULT_LANGUAGE): Extension {
  const language = plugins.language(format);
  const editor = language.editor();
  const mode = prefs.markdownMode;
  let found = made.get(language);
  if (found?.editor !== editor || found.mode !== mode) {
    const source = mode === "source" ? syntaxHighlighting(sourceStyle) : [];
    found = { editor, mode, editing: [editor, lineMarkers(language), markupMode.of(mode), source] };
    made.set(language, found);
  }
  return found.editing;
}

export const readOnlyCompartment = new Compartment();

export function readOnly(value: boolean): Extension {
  return [EditorState.readOnly.of(value), EditorView.editable.of(!value)];
}

export const spellingCompartment = new Compartment();

/** Whether the system checks a note's spelling, and corrects it as you type (Settings → Editor). */
export const spelling = (on: boolean): Extension =>
  EditorView.contentAttributes.of(on ? { spellcheck: "true", autocorrect: "on" } : { spellcheck: "false", autocorrect: "off" });

/** A note's editor, set up for its language (`format`) from the start. */
export function createExtensions(onChange: () => void, format?: string): Extension[] {
  return [
    history(),
    EditorView.lineWrapping,
    spellingCompartment.of(spelling(prefs.spellcheck)),
    EditorView.contentAttributes.of({
      autocapitalize: "sentences",
      "aria-label": message("editor.note"),
      // A note is in whatever language it's written in, not the app's: unknown, so screen readers
      // and the spellchecker use the device's own languages rather than reading it as French, say.
      lang: "",
    }),
    formatCompartment.of(formatEditing(format)),
    // The note's page, which the paper chosen in Settings → Paper is drawn on (editor.css).
    EditorView.editorAttributes.of({ class: "cm-page" }),
    cursor,
    syntaxHighlighting(highlightStyle),
    find,
    highlightSelectionMatches(),
    placeholder(message("editor.placeholder")),
    phrases,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    readOnlyCompartment.of(readOnly(false)),
    outlineCompartment.of([]),
    theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange();
    }),
  ];
}
