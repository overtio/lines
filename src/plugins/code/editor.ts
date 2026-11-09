import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, indentOnInput, type LanguageDescription } from "@codemirror/language";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { lazyLanguage } from "../../lib/editor/lazyLanguage";

/**
 * A code note's editor: its programming language highlighted in the theme's colors (loaded the
 * first time a note in it opens), line numbers, a fixed-width font across the whole width
 * (editor.css), and what a code editor does as you type: indenting, closing brackets, showing the
 * one that matches. No spelling or autocorrect, which code has no use for.
 */
export function codeEditing(description: LanguageDescription): Extension {
  return [
    EditorView.editorAttributes.of({ class: "cm-code-note" }),
    Prec.high(EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" })),
    lazyLanguage(description),
    lineNumbers(),
    highlightActiveLineGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
  ];
}
