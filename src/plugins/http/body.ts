import { foldGutter, foldKeymap, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { codeLanguage } from "../../lib/editor/codeLanguages";
import { highlightStyle } from "../../lib/editor/setup";
import { t } from "../../lib/i18n/index.svelte";

/*
 * A response's body, in an editor of its own that can't be changed: it draws only the lines in
 * view, so a body of any size is highlighted in full without slowing the note, and JSON's objects
 * and arrays fold. Selecting, ⌘A and ⌘C work in it as in a note.
 */

/** The note's editor styles reach into this one, which sits inside it, so these are a step more specific. */
const theme = EditorView.theme({
  "&.cm-editor": { maxHeight: "min(420px, 60vh)", fontSize: "12px", backgroundColor: "transparent" },
  "&.cm-editor.cm-focused": { outline: "none" },
  "&.cm-editor .cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono)", lineHeight: "1.625" },
  "&.cm-editor .cm-content": { maxWidth: "none", margin: "0", padding: "10px 12px 10px 0" },
  "&.cm-editor .cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--text-faint)" },
  "&.cm-editor .cm-foldGutter .cm-gutterElement": { padding: "0 2px 0 6px", cursor: "pointer" },
  "&.cm-editor .cm-http-fold": { display: "inline-block", width: "1em", textAlign: "center", transition: "opacity 120ms ease" },
  // Open ones show while the pointer's over the gutter; folded ones always.
  "&.cm-editor .cm-http-fold-open": { opacity: "0" },
  "&.cm-editor .cm-gutters:hover .cm-http-fold-open": { opacity: "1" },
  "&.cm-editor .cm-foldPlaceholder": { margin: "0 2px", padding: "0 5px", border: "none", borderRadius: "4px", backgroundColor: "var(--active)", color: "var(--text-muted)" },
});

function marker(open: boolean) {
  const dom = document.createElement("span");
  dom.className = `cm-http-fold ${open ? "cm-http-fold-open" : "cm-http-fold-closed"}`;
  dom.textContent = open ? "⌄" : "›";
  return dom;
}

export interface Shown {
  text: string;
  /** What it's highlighted as: "json", "xml", "html", or "" for plain text. */
  language: string;
}

/** Shows `shown` in `parent`, highlighted once its language has loaded. */
export function bodyView(parent: HTMLElement, shown: Shown) {
  const language = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: shown.text,
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": t("http.body"), "aria-readonly": "true", spellcheck: "false" }),
        language.of([]),
        syntaxHighlighting(highlightStyle),
        foldGutter({ markerDOM: marker }),
        keymap.of(foldKeymap),
        theme,
      ],
    }),
  });
  let loading = 0;
  const load = (name: string) => {
    const run = ++loading;
    const found = name ? codeLanguage(name) : null;
    if (!found) return view.dispatch({ effects: language.reconfigure([]) });
    void found.load().then((support) => run === loading && view.dispatch({ effects: language.reconfigure(support) }));
  };
  load(shown.language);
  return {
    update(next: Shown) {
      if (next.text !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next.text } });
      load(next.language);
    },
    destroy() {
      loading++;
      view.destroy();
    },
  };
}
