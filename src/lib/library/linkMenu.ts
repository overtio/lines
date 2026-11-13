import { isolateHistory } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { type EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { speak } from "../a11y";
import { copyAddress, openHref } from "../editor/links";
import { editedNote } from "../editor/util";
import { t } from "../i18n/index.svelte";
import { mentionOf, propertyOf } from "../notes/properties";
import { notes } from "../notes/store.svelte";
import { plugins } from "../plugins/registry.svelte";
import { ui } from "../ui.svelte";
import { type LookupState, LookupWidget } from "./linkNotes";
import { lookUp } from "./lookup";
import { libraryNote } from "./note";

/*
 * A link to the web inside a note, added to the library from its menu (right-click, or the menu key
 * on it): what it is becomes a library note, and the link a mention of it (`@[Dune: Part Two]`), one
 * change ⌘Z takes back. Only when asked, and only if the link is still as it was once it's found;
 * a library note with that link already is mentioned rather than made again.
 */

/** How long the note says a link couldn't be looked up, or that nothing was found. */
const SAID_FOR = 4000;

/** A web link in a note: its whole Markdown (`[text](…)`, `<…>` or a bare address), where it is, its address and text. */
interface Link {
  from: number;
  to: number;
  markdown: string;
  href: string;
  text: string;
}

/** What an address is part of, when it's more than a bare one. */
const HOLDERS = new Set(["Link", "Autolink", "Image", "LinkReference"]);

/** The web link at `pos`, if there's one (not an image's). */
export function linkAt(state: EditorState, pos: number): Link | null {
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

/** A link being added, by a number of its own: where it is now (followed through changes) and what the note says of it. */
interface Adding {
  id: number;
  from: number;
  to: number;
  state: LookupState;
}

const setAdding = StateEffect.define<{ id: number; from?: number; to?: number; state: LookupState | null }>();

const adding = StateField.define<Adding[]>({
  create: () => [],
  update(list, tr) {
    let next = tr.docChanged ? list.map((each) => ({ ...each, from: tr.changes.mapPos(each.from, 1), to: tr.changes.mapPos(each.to, -1) })) : list;
    for (const effect of tr.effects) {
      if (!effect.is(setAdding)) continue;
      const { id, state } = effect.value;
      const was = next.find((each) => each.id === id);
      next = next.filter((each) => each.id !== id);
      const from = effect.value.from ?? was?.from;
      const to = effect.value.to ?? was?.to;
      if (state && from !== undefined && to !== undefined) next = [...next, { id, from, to, state }];
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field, (list) => Decoration.set(list.map((each) => Decoration.widget({ widget: new LookupWidget(each.state), side: 1 }).range(each.to)), true)),
});

let added = 0;

/**
 * Adds the link to the library, and puts a mention of what it is in its place: in its editor, if it's
 * still showing the note, as one change; or else in the note as stored. Says how it went, there and
 * to screen readers.
 */
async function addLink(view: EditorView, link: Link) {
  const id = ++added;
  const note = view.state.facet(editedNote);
  /** The editor still showing the note, which says where the lookup's got to after the link. */
  const shown = () => view.dom.isConnected && view.state.facet(editedNote) === note && view.state.field(adding, false) !== undefined;
  const say = (state: LookupState | null) => shown() && view.dispatch({ effects: setAdding.of({ id, state }) });
  const sayFor = (state: LookupState, message: string) => {
    say(state);
    speak(message);
    setTimeout(() => say(null), SAID_FOR);
  };
  view.dispatch({ effects: setAdding.of({ id, from: link.from, to: link.to, state: "looking" }) });
  speak(t("library.lookingUp"));
  // Asked for, it isn't stopped: it goes on while the note's closed, and mentions it there.
  const signal = new AbortController().signal;
  try {
    const item = await lookUp(link.href, signal);
    if (!item) return sayFor("nothing", t("library.nothing"));
    // A note of it there is already, by its link: that's the one mentioned.
    const links = new Set([item.link, link.href]);
    const existing = notes.entries.find(({ note, meta }) => !note.trashed && plugins.libraryKind(meta.type) && links.has(propertyOf(meta.properties, "link")?.value));
    const body = existing ? null : await libraryNote(item, signal);
    const title = existing?.meta.title || item.title;
    const mention = mentionOf(title);
    if (shown()) {
      const at = view.state.field(adding).find((each) => each.id === id);
      if (!at || view.state.sliceDoc(at.from, at.to) !== link.markdown) return say(null);
      if (body) notes.add(body);
      view.dispatch({
        changes: { from: at.from, to: at.to, insert: mention },
        effects: setAdding.of({ id, state: null }),
        userEvent: "library",
        annotations: isolateHistory.of("full"),
      });
    } else {
      const stored = note ? notes.get(note)?.note : undefined;
      if (!stored || stored.trashed || stored.locked || !stored.body.includes(link.markdown)) return;
      if (body) notes.add(body);
      notes.edit(stored.id, stored.body.replace(link.markdown, () => mention), t("library.didUndo"));
    }
    speak(t("library.filled", { title }));
  } catch (error) {
    console.warn("lines: couldn't add a link to the library", error);
    sayFor("failed", t("library.failed"));
  }
}

/** A link's menu (right-click, or the menu key with the cursor on it): open it, copy it, or add it to the library. */
export const linkMenu = [
  adding,
  EditorView.domEventHandlers({
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
      ui.openMenu({
        x: at ? at.left : event.clientX,
        y: at ? at.bottom : event.clientY,
        label: link.text,
        items: [
          { label: t("library.link.open"), icon: "link", run: () => openHref(link.href, link.text, element ?? undefined) },
          { label: t("library.link.copy"), icon: "copy", run: () => copyAddress(link.href, element) },
          ...(view.state.readOnly ? [] : ["separator" as const, { label: t("library.add.title"), icon: "library" as const, run: () => void addLink(view, link) }]),
        ],
        onclose: () => view.focus(),
      });
      return true;
    },
  }),
];
