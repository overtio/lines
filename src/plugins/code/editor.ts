import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, indentOnInput, type LanguageDescription } from "@codemirror/language";
import { Compartment, type Extension, Prec } from "@codemirror/state";
import { EditorView, highlightActiveLineGutter, keymap, lineNumbers, ViewPlugin } from "@codemirror/view";

/**
 * A code note's editor: its programming language highlighted in the theme's colors (loaded the
 * first time a note in it opens), line numbers, a fixed-width font across the whole width
 * (editor.css), and what a code editor does as you type: indenting, closing brackets, showing the
 * one that matches. No spelling or autocorrect, which code has no use for.
 */
export function codeEditing(description: LanguageDescription): Extension {
  const syntax = new Compartment();
  const loading = description.support
    ? []
    : ViewPlugin.define((view) => {
        let open = true;
        void description.load().then((support) => {
          if (open) view.dispatch({ effects: syntax.reconfigure(support) });
        });
        return { destroy: () => (open = false) };
      });
  return [
    EditorView.editorAttributes.of({ class: "cm-code-note" }),
    Prec.high(EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" })),
    syntax.of(description.support ?? []),
    loading,
    lineNumbers(),
    highlightActiveLineGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
  ];
}
