import { isolateHistory } from "@codemirror/commands";
import { StateEffect, type Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { speak } from "../a11y";
import { editedNote } from "../editor/util";
import { t } from "../i18n/index.svelte";
import { notes } from "../notes/store.svelte";
import { prefs } from "../prefs.svelte";
import { lookUp } from "./lookup";
import { libraryNote } from "./note";
import { linkOnly } from "./text";

/*
 * A Markdown note that's just a link, filled in with what the link is (docs/library.md). It's looked
 * up as its text becomes that link: at once when the link is pasted or dropped in, or once it's
 * stayed the link a moment while it's typed, so a link half typed isn't. Never as a note opens or
 * syncs, nor for a locked note. Meanwhile the note says so, quietly; once found, the note is written
 * in one change, which one ⌘Z takes back, and only if it's still exactly what was looked up.
 */

/** How long a link typed waits, unchanged, before it's looked up. */
const TYPED_DELAY = 1000;
/** How long the note says a lookup couldn't be done. */
const FAILED_FOR = 4000;
/** Longer than any link: a note this long, or of more lines than a link and the space around it, isn't one, and isn't read through for one. */
const MAX_LINK = 4096;
const MAX_LINES = 3;

/** A note's lookup: the text it's for, where it's got to, and what stops it. */
interface Lookup {
  text: string;
  state: "waiting" | "looking" | "failed";
  timer?: ReturnType<typeof setTimeout>;
  abort?: AbortController;
}

/** Each note's lookup, by its id. They go on while the note is closed, and fill it as it's stored. */
const lookups = new Map<string, Lookup>();

/** The editors open on Markdown notes, where a note's lookup shows and its note is filled in. */
const views = new Set<EditorView>();
const viewOf = (id: string) => [...views].find((view) => view.state.facet(editedNote) === id);

/** A note's lookup changed, for its editor to show. */
const lookupChanged = StateEffect.define<null>();

const redraw = (id: string) => viewOf(id)?.dispatch({ effects: lookupChanged.of(null) });

/** Stops the note's lookup, or its wait to start. Its editor, changing as it's stopped, draws it gone. */
function stop(id: string) {
  const lookup = lookups.get(id);
  if (!lookup) return;
  lookups.delete(id);
  clearTimeout(lookup.timer);
  lookup.abort?.abort();
}

/** Looks up the note's link once `delay` has passed with its text still `text`. */
function lookUpNote(id: string, text: string, link: string, delay: number) {
  stop(id);
  const lookup: Lookup = { text, state: "waiting" };
  lookups.set(id, lookup);
  lookup.timer = setTimeout(() => void run(id, lookup, link), delay);
}

async function run(id: string, lookup: Lookup, link: string) {
  const current = () => lookups.get(id) === lookup;
  if (!current()) return;
  if ((viewOf(id)?.state.doc.toString() ?? notes.get(id)?.note.body) !== lookup.text) return stop(id);
  const abort = (lookup.abort = new AbortController());
  lookup.state = "looking";
  redraw(id);
  speak(t("library.lookingUp"));
  try {
    const item = await lookUp(link, abort.signal);
    const body = item && (await libraryNote(item, abort.signal));
    if (!current()) return;
    lookups.delete(id);
    redraw(id);
    if (item && body && fill(id, lookup.text, body)) speak(t("library.filled", { title: item.title }));
  } catch (error) {
    if (abort.signal.aborted || !current()) return;
    console.warn("lines: couldn't look up a link", error);
    lookup.state = "failed";
    redraw(id);
    speak(t("library.failed"));
    lookup.timer = setTimeout(() => {
      if (!current()) return;
      stop(id);
      redraw(id);
    }, FAILED_FOR);
  }
}

/** Where a filled note's title line ends, for the cursor. */
function titleEnd(body: string) {
  const heading = body.indexOf("\n# ");
  const end = heading < 0 ? -1 : body.indexOf("\n", heading + 1);
  return end < 0 ? body.length : end;
}

/**
 * Writes the note as `body` if it's still `text`: in its editor, as one change for ⌘Z to take back,
 * or as it's stored, if it isn't open now (and wasn't trashed or locked meanwhile). Either way it's
 * filed, out of the Inbox. Whether it was.
 */
function fill(id: string, text: string, body: string) {
  const view = viewOf(id);
  if (view) {
    if (view.state.doc.toString() !== text) return false;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: body },
      selection: { anchor: titleEnd(body) },
      userEvent: "library",
      annotations: isolateHistory.of("full"),
    });
  } else {
    const note = notes.get(id)?.note;
    if (!note || note.trashed || note.locked || note.body !== text) return false;
    notes.edit(id, body, t("library.didUndo"));
  }
  notes.setInbox([id], false);
  return true;
}

/** Typed, pasted, dropped or deleted: not undone, redone, synced or filled in. */
const byHand = (tr: Transaction) => tr.docChanged && (tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("move"));

/** What the note says while its link is looked up, or when it couldn't be; screen readers hear it from `speak`. */
class LookupWidget extends WidgetType {
  constructor(readonly state: "looking" | "failed") {
    super();
  }
  eq(other: LookupWidget) {
    return other.state === this.state;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-library-lookup is-${this.state}`;
    el.setAttribute("aria-hidden", "true");
    el.textContent = t(this.state === "looking" ? "library.lookingUp" : "library.failed");
    return el;
  }
}

/** Watches a Markdown note's editor for its text becoming a link, and shows its lookup. */
export const linkLookups = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(readonly view: EditorView) {
      views.add(view);
      this.decorations = this.draw();
    }

    update(update: ViewUpdate) {
      const id = update.state.facet(editedNote);
      if (id && update.transactions.some(byHand)) this.edited(id, update);
      if (update.docChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(lookupChanged)))) this.decorations = this.draw();
    }

    edited(id: string, update: ViewUpdate) {
      const { doc } = update.state;
      const text = doc.length <= MAX_LINK && doc.lines <= MAX_LINES ? doc.toString() : "";
      const link = linkOnly(text);
      if (!link || !prefs.lookUpLinks || notes.get(id)?.note.locked) return stop(id);
      const pasted = update.transactions.some((tr) => tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop"));
      lookUpNote(id, text, link, pasted ? 0 : TYPED_DELAY);
    }

    draw() {
      const id = this.view.state.facet(editedNote);
      const state = id ? lookups.get(id)?.state : undefined;
      if (!state || state === "waiting") return Decoration.none;
      return Decoration.set(Decoration.widget({ widget: new LookupWidget(state), side: 1 }).range(this.view.state.doc.length));
    }

    destroy() {
      views.delete(this.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
