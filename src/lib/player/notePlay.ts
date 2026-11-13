import { type EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import EpisodePlay from "../components/EpisodePlay.svelte";
import { editedNote } from "../editor/util";
import { frontMatter, propertyOf, typeOf } from "../notes/properties";

/*
 * An `episode` note's Play button, before its `audio` property's link (EpisodePlay.svelte),
 * in a Markdown note's editor: what the note plays is read from the note as the store has it.
 */

/** Each button's component, to unmount with it. */
const played = new WeakMap<HTMLElement, ReturnType<typeof mount>>();

class PlayWidget extends WidgetType {
  constructor(readonly note: string) {
    super();
  }

  eq(other: PlayWidget) {
    return other.note === this.note;
  }

  toDOM() {
    const dom = document.createElement("span");
    dom.className = "cm-episode-play-wrap";
    played.set(dom, mount(EpisodePlay, { target: dom, props: { note: this.note } }));
    return dom;
  }

  destroy(dom: HTMLElement) {
    const component = played.get(dom);
    if (component) void unmount(component);
  }

  ignoreEvent() {
    return true;
  }
}

function decorations(state: EditorState): DecorationSet {
  const note = state.facet(editedNote);
  const front = note ? frontMatter(state.doc.sliceString(0, Math.min(state.doc.length, 10_000))) : null;
  if (!note || !front || typeOf(front.properties) !== "episode") return Decoration.none;
  const audio = propertyOf(front.properties, "audio");
  if (!audio || !/^https?:\/\//i.test(audio.value.trim())) return Decoration.none;
  // Before the link, clear of the copy button a value has at its end.
  const line = state.doc.line(audio.line);
  const value = line.from + /^[^:]*:[ \t]*/.exec(line.text)![0].length;
  return Decoration.set(Decoration.widget({ widget: new PlayWidget(note), side: -1 }).range(value));
}

export const episodePlay = StateField.define<DecorationSet>({
  create: decorations,
  update: (value, transaction) => (transaction.docChanged ? decorations(transaction.state) : value),
  provide: (field) => EditorView.decorations.from(field),
});
