import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { t } from "../i18n/index.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { WebLink } from "../plugins/types";
import { ui } from "../ui.svelte";
import { copyAddress, openHref } from "./links";

/*
 * A web link's menu in a Markdown note (right-click it, or the menu key with the cursor on it): open
 * it, copy its address, and what plugins do with links (`linkActions`: add it to the Library).
 */

/** What an address is part of, when it's more than a bare one. */
const HOLDERS = new Set(["Link", "Autolink", "Image", "LinkReference"]);

/** The web link at `pos`, if there's one (not an image's). */
export function linkAt(state: EditorState, pos: number): WebLink | null {
  for (const side of [1, -1] as const) {
    for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); node; node = node.parent) {
      if (node.name === "Image") break;
      const bare = node.name === "URL" && !HOLDERS.has(node.parent?.name ?? "");
      if (!bare && node.name !== "Link" && node.name !== "Autolink") continue;
      const url = bare ? node : node.getChild("URL");
      const href = url ? state.sliceDoc(url.from, url.to) : "";
      if (!/^https?:\/\/\S/i.test(href)) return null;
      const marks = node.getChildren("LinkMark");
      const text = node.name === "Link" && marks.length > 1 ? state.sliceDoc(marks[0].to, marks[1].from) : href;
      return { from: node.from, to: node.to, markdown: state.sliceDoc(node.from, node.to), href, text };
    }
  }
  return null;
}

export const linkMenu = EditorView.domEventHandlers({
  contextmenu(event, view) {
    const fromKeys = !event.clientX && !event.clientY;
    const pos = fromKeys ? view.state.selection.main.head : view.posAtCoords({ x: event.clientX, y: event.clientY });
    const link = pos === null ? null : linkAt(view.state, pos);
    // A selection reaching past it is the system's to copy; one inside it (WebKit selects the word right-clicked) isn't.
    const { main } = view.state.selection;
    if (!link || (!main.empty && (main.from < link.from || main.to > link.to))) return false;
    event.preventDefault();
    const at = fromKeys ? view.coordsAtPos(link.to) : null;
    const element = (event.target as Element).closest<HTMLElement>(".cm-lp-link");
    const actions = plugins.linkActions.filter((action) => !(action.edits && view.state.readOnly));
    ui.openMenu({
      x: at ? at.left : event.clientX,
      y: at ? at.bottom : event.clientY,
      label: link.text,
      items: [
        { label: t("editor.link.open"), icon: "link", run: () => openHref(link.href, link.text, element ?? undefined) },
        { label: t("editor.link.copy"), icon: "copy", run: () => copyAddress(link.href, element) },
        ...(actions.length ? ["separator" as const] : []),
        ...actions.map((action) => ({ label: action.label, icon: action.icon, run: () => action.run(view, link) })),
      ],
      onclose: () => view.focus(),
    });
    return true;
  },
});
