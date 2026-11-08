import { foldGutter, foldKeymap, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { Compartment, EditorState, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { codeLanguage } from "../../lib/editor/codeLanguages";
import { copyButton, destroyCopyButton } from "../../lib/editor/keyValue";
import Icon from "../../lib/icons/Icon.svelte";
import { highlightStyle } from "../../lib/editor/setup";
import { t } from "../../lib/i18n/index.svelte";

/*
 * A response's body, in an editor of its own that can't be changed: it draws only the lines in
 * view, so a body of any size is highlighted in full without slowing the note, and JSON's objects
 * and arrays fold. Selecting, ⌘A and ⌘C work in it as in a note. A JSON value's line has a copy
 * button while it's hovered, and a web address in it a button that sends a request to it.
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
  "&.cm-editor .cm-http-follow": {
    display: "inline-grid",
    placeItems: "center",
    width: "18px",
    height: "18px",
    margin: "-4px 0 -4px 4px",
    padding: "0",
    verticalAlign: "middle",
    border: "none",
    borderRadius: "5px",
    background: "none",
    color: "var(--accent)",
    opacity: "0.55",
    cursor: "pointer",
    transition: "opacity 120ms ease, background-color 120ms ease",
  },
  "&.cm-editor .cm-http-follow:hover": { opacity: "1", backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)" },
  "&.cm-editor .cm-line:hover .cm-http-copy-value": { opacity: "1" },
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
  /** Sends a request to an address in the body, where that's possible. */
  follow?: (url: string) => void;
}

/* Buttons in the body. */

const ADDRESS = /https?:\/\/[^\s"'<>\\]+/g;
/** JSON's values: what a copy button copies. */
const VALUES = new Set(["String", "Number", "True", "False", "Null", "Object", "Array"]);

/** What copying a value gives: a string without its quotes, an object or array as indented JSON. */
function valueText(text: string) {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "string" ? value : typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : text;
  } catch {
    return text;
  }
}

const followIcons = new WeakMap<HTMLElement, Record<string, unknown>>();

/** Send's icon after an address, which sends a request to it. */
class FollowWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly follow: (url: string) => void,
  ) {
    super();
  }
  eq(other: FollowWidget) {
    return other.url === this.url;
  }
  toDOM() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-http-follow";
    button.title = t("http.follow");
    button.setAttribute("aria-label", t("http.followUrl", { url: this.url }));
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => this.follow(this.url));
    followIcons.set(button, mount(Icon, { target: button, props: { name: "send", size: 12, strokeWidth: 2.25 } }));
    return button;
  }
  destroy(dom: HTMLElement) {
    const icon = followIcons.get(dom);
    if (icon) void unmount(icon);
    followIcons.delete(dom);
  }
  ignoreEvent() {
    return true;
  }
}

/** A copy button at the end of a value's line; what it copies is read when it's clicked. */
class CopyValueWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: CopyValueWidget) {
    return other.from === this.from && other.to === this.to;
  }
  toDOM(view: EditorView) {
    return copyButton(() => valueText(view.state.sliceDoc(this.from, this.to)), t("http.copyValue"), "cm-lp-copy cm-http-copy-value");
  }
  destroy(dom: HTMLElement) {
    destroyCopyButton(dom);
  }
  ignoreEvent() {
    return true;
  }
}

/** The buttons in the lines in view: drawn again as it scrolls, and once the JSON's been read. */
function bodyButtons(follow: Shown["follow"]) {
  const draw = (view: EditorView) => {
    const { state } = view;
    const ranges: Range<Decoration>[] = [];
    const lines = new Set<number>();
    for (const { from, to } of view.visibleRanges) {
      if (follow) {
        for (let pos = from; pos <= to; ) {
          const line = state.doc.lineAt(pos);
          for (const match of line.text.matchAll(ADDRESS)) {
            const url = match[0].replace(/[.,;:)\]}]+$/, "");
            let end = line.from + match.index + url.length;
            if (/["']/.test(state.sliceDoc(end, end + 1))) end++;
            ranges.push(Decoration.widget({ widget: new FollowWidget(url, follow), side: 1 }).range(end));
          }
          pos = line.to + 1;
        }
      }
      syntaxTree(state).iterate({
        from,
        to,
        enter: (node) => {
          if (!VALUES.has(node.name) || node.node.parent?.name === "JsonText") return;
          // One to a line, at its end: an object's or array's is on the line it opens on.
          const line = state.doc.lineAt(node.from);
          if (line.to < from || line.to > to || lines.has(line.number)) return;
          lines.add(line.number);
          ranges.push(Decoration.widget({ widget: new CopyValueWidget(node.from, node.to), side: 2 }).range(line.to));
        },
      });
    }
    return Decoration.set(ranges, true);
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = draw(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || syntaxTree(update.state) !== syntaxTree(update.startState)) this.decorations = draw(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
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
        bodyButtons(shown.follow),
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
