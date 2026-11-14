import { type EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import EpisodePlay from "../components/EpisodePlay.svelte";
import { frontMatterField } from "../editor/objects";
import { editedNote } from "../editor/util";
import { frontMatter, propertyOf, typeOf } from "../notes/properties";
import { isWeb } from "./episodes";

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

/** An `episode` note's `audio` property, if it's a link to its sound: as the editor has the note. */
export function episodeAudio(state: EditorState) {
  // As the editor read the properties when the note last changed (objects.ts), rather than again: read
  // here only where it doesn't (null there is a note without properties).
  const field = state.field(frontMatterField, false);
  const front = field === undefined ? frontMatter(state.doc.sliceString(0, Math.min(state.doc.length, 10_000))) : field;
  if (!front || typeOf(front.properties) !== "episode") return null;
  const audio = propertyOf(front.properties, "audio");
  return audio && isWeb(audio.value.trim()) ? audio : null;
}

function decorations(state: EditorState): DecorationSet {
  const note = state.facet(editedNote);
  const audio = note && episodeAudio(state);
  if (!note || !audio) return Decoration.none;
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
