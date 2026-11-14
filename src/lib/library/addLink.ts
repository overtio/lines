import { isolateHistory } from "@codemirror/commands";
import { StateEffect } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { speak } from "../a11y";
import { editedNote } from "../editor/util";
import { t } from "../i18n/index.svelte";
import { mentionOf } from "../notes/properties";
import { notes } from "../notes/store.svelte";
import { withTimeout } from "../pacing";
import type { WebLink } from "../plugins/types";
import { keepCover } from "./covers";
import { type LookupState, LookupWidget } from "./linkNotes";
import { lookUpAny } from "./lookup";
import { libraryNote } from "./note";
import { addedAgain, libraryNoteOf } from "./same";

/*
 * A web link in a note added to the Library from its menu (editor/linkMenu.ts): what it is becomes a
 * library note, and the link a mention of it (`@[Dune: Part Two]`). Only when asked, and only if the
 * link is still where it was, as it was, once it's found: in its editor, as one change ⌘Z takes
 * back; in the note as stored, if it's been closed since. A library note with that link already is
 * mentioned rather than made again.
 */

/** How long the note says a link couldn't be looked up, or that nothing was found. */
const SAID_FOR = 4000;
/** How long a link's lookup may take in all, across the sources it asks (each request gives up sooner). */
const LOOKUP_TIME = 30_000;

/**
 * A link being added: its note, where the link is and its Markdown as it was, what the note says of
 * it, what stops it, and the editor following it through the changes made there, while one's open
 * on its note. Kept here rather than in the editor's state, which stays as it was while its note's
 * closed: reopened, it shows how the lookup's got to now.
 */
interface Adding {
  note: string;
  from: number;
  to: number;
  markdown: string;
  state: LookupState;
  abort: AbortController;
  view: EditorView | null;
}

const addings = new Set<Adding>();

/** An adding changed, for its editor to show. */
const addingChanged = StateEffect.define<null>();

const redraw = (adding: Adding) => adding.view?.dispatch({ effects: addingChanged.of(null) });

/** Stops it, and its note no longer says anything of it. */
function end(adding: Adding) {
  addings.delete(adding);
  adding.abort.abort();
  redraw(adding);
}

/** The note says how it went for a while, and screen readers hear it. */
function say(adding: Adding, state: LookupState, message: string) {
  adding.state = state;
  redraw(adding);
  speak(message);
  setTimeout(() => end(adding), SAID_FOR);
}

/** Adds the link in `view` to the library, and puts a mention of what it is in its place. */
export async function addLink(view: EditorView, link: WebLink) {
  const note = view.state.facet(editedNote);
  if (!note) return;
  const adding: Adding = { note, from: link.from, to: link.to, markdown: link.markdown, state: "looking", abort: new AbortController(), view };
  addings.add(adding);
  redraw(adding);
  speak(t("library.lookingUp"));
  const signal = withTimeout(adding.abort.signal, LOOKUP_TIME);
  try {
    const item = await lookUpAny(link.href, signal);
    if (!addings.has(adding)) return;
    if (!item) return say(adding, "nothing", t("library.nothing"));
    const existing = libraryNoteOf(item) ?? libraryNoteOf({ link: link.href });
    const made = existing ? null : await libraryNote(item, signal);
    if (!addings.has(adding)) return;
    end(adding);
    // Where the link is now: in the editor following it, or else in the note as stored.
    const stored = notes.get(note)?.note;
    const text = adding.view ? adding.view.state.doc.toString() : stored?.body;
    if (!stored || stored.trashed || stored.locked || text?.slice(adding.from, adding.to) !== adding.markdown) return;
    const id = existing?.note.id ?? notes.add(made!.text);
    if (made) void keepCover(made, id);
    if (existing) addedAgain(existing, item);
    // As the note's title reads (what it's found by), not as the source wrote it.
    const title = notes.get(id)?.meta.title || item.title;
    const mention = mentionOf(title);
    if (adding.view) {
      adding.view.dispatch({ changes: { from: adding.from, to: adding.to, insert: mention }, userEvent: "library", annotations: isolateHistory.of("full") });
    } else {
      notes.setText(note, text.slice(0, adding.from) + mention + text.slice(adding.to));
    }
    speak(existing ? t("library.already") : t("library.filled", { title }));
  } catch (error) {
    if (!addings.has(adding)) return;
    console.warn("lines: couldn't add a link to the library", error);
    say(adding, "failed", t("library.failed"));
  }
}

/**
 * Follows the links being added in a note's editor through what's changed there (one changed or
 * gone is no longer added), and shows how each is getting on after it.
 */
export const linkAdds = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(readonly view: EditorView) {
      // Taken up where they were left as the note's opened again.
      const note = view.state.facet(editedNote);
      for (const adding of addings) if (adding.note === note && !adding.view) adding.view = view;
      this.decorations = this.draw();
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        for (const adding of this.own()) {
          adding.from = update.changes.mapPos(adding.from, 1);
          adding.to = update.changes.mapPos(adding.to, -1);
          if (update.state.sliceDoc(adding.from, adding.to) === adding.markdown) continue;
          addings.delete(adding);
          adding.abort.abort();
        }
      }
      if (update.docChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(addingChanged)))) this.decorations = this.draw();
    }

    own() {
      return [...addings].filter((adding) => adding.view === this.view);
    }

    draw() {
      const widgets = this.own().map((adding) => Decoration.widget({ widget: new LookupWidget(adding.state), side: 1 }).range(adding.to));
      return Decoration.set(widgets, true);
    }

    destroy() {
      for (const adding of this.own()) adding.view = null;
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
