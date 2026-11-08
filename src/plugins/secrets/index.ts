import { type EditorState, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { MarkdownConfig } from "@lezer/markdown";
import { mount, unmount } from "svelte";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { el } from "../../lib/print/parts";
import Secret from "./Secret.svelte";

/*
 * Secrets in Markdown notes (docs/secrets.md): `{{github}}` outside code is a secret, kept in a
 * locked note of type `secrets` (lib/notes/secrets.svelte.ts), and drawn as its name and dots, to
 * show for a moment or copy. The note only ever holds its name: other Markdown apps, exports,
 * printing and copying the note show `{{github}}`, or the name and dots.
 */

const OPEN_BRACE = 123;
/** A secret's name, as properties name them. */
const SECRET_AT = /\{\{([\p{L}_][\p{L}\p{N}_.-]*)\}\}/uy;

const syntax: MarkdownConfig = {
  defineNodes: [{ name: "Secret", style: tags.special(tags.variableName) }],
  parseInline: [
    {
      name: "Secret",
      parse(cx, next, pos) {
        if (next !== OPEN_BRACE || cx.char(pos + 1) !== OPEN_BRACE) return -1;
        SECRET_AT.lastIndex = 0;
        const match = SECRET_AT.exec(cx.slice(pos, Math.min(cx.end, pos + 120)));
        return match ? cx.addElement(cx.elt("Secret", pos, pos + match[0].length)) : -1;
      },
    },
  ],
};

const nameOf = (text: string) => text.slice(2, -2);

const mounted = new WeakMap<HTMLElement, Record<string, unknown>>();

class SecretWidget extends WidgetType {
  constructor(readonly name: string) {
    super();
  }
  eq(other: SecretWidget) {
    return other.name === this.name;
  }
  toDOM() {
    const dom = document.createElement("span");
    dom.className = "cm-secret-wrap";
    mounted.set(dom, mount(Secret, { target: dom, props: { name: this.name } }));
    return dom;
  }
  destroy(dom: HTMLElement) {
    const component = mounted.get(dom);
    if (component) void unmount(component);
    mounted.delete(dom);
  }
  // Its buttons are its own; a click elsewhere on it puts the cursor there, showing `{{name}}`.
  ignoreEvent(event: Event) {
    return event.target instanceof Element && !!event.target.closest("button");
  }
}

/** Whether the cursor or a selection touches `from`–`to`, so the secret shows as written. */
const touched = (state: EditorState, from: number, to: number) => state.selection.ranges.some((range) => range.from <= to && range.to >= from);

const source = Decoration.mark({ class: "cm-secret-source" });

function draw(view: EditorView) {
  const { state } = view;
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    // Most notes have none: looked for only where there's a `{{`.
    if (!state.sliceDoc(from, to).includes("{{")) continue;
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "Secret") return;
        if (touched(state, node.from, node.to)) ranges.push(source.range(node.from, node.to));
        else ranges.push(Decoration.replace({ widget: new SecretWidget(nameOf(state.sliceDoc(node.from, node.to))) }).range(node.from, node.to));
      },
    });
  }
  return Decoration.set(ranges, true);
}

const secretsInNotes = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = draw(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged || syntaxTree(update.state) !== syntaxTree(update.startState)) {
        this.decorations = draw(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export const secrets = (): Plugin => ({
  id: "secrets",
  name: t("plugins.secrets"),
  description: t("plugins.secrets.description"),
  icon: "key",
  enabledByDefault: true,
  contributes: {
    markdown: [
      {
        syntax,
        editor: secretsInNotes,
        commands: [
          {
            ...named("editor.slash.secret"),
            hint: "{{…}}",
            icon: "key",
            section: SECTIONS.insert,
            apply: insert("{{|}}"),
          },
        ],
        // On paper, its name and dots, never its value.
        print: { Secret: (node, doc) => el("span", "doc-secret", `${nameOf(doc.slice(node.from, node.to))} ••••••`) },
      },
    ],
  },
});
