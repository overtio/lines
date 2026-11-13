import { isolateHistory } from "@codemirror/commands";
import { type EditorState, StateEffect, type Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { speak } from "../a11y";
import { editedNote } from "../editor/util";
import { t } from "../i18n/index.svelte";
import { notes } from "../notes/store.svelte";
import type { LibraryItem } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { lookUp } from "./lookup";
import { type LibraryNote, libraryNote } from "./note";
import { linkNoteLink } from "./text";

/*
 * A Markdown note that's just a link, filled in with what the link is (docs/library.md): one that's
 * only the link, or a note made just now whose start (`# `, or its properties) has only a link put in
 * it. It's looked up as the link appears or changes: at once when it's pasted or dropped in, or once
 * it's stayed the same a moment while it's typed, so a link half typed isn't. Never as a note opens
 * or syncs, nor for a locked note, nor when the rest of the note changes around the same link.
 * Meanwhile the note says so, quietly; once found, it's written in one change, which one ⌘Z takes
 * back, and only if it's still exactly what was looked up.
 */

/** How long a link typed waits, unchanged, before it's looked up. */
const TYPED_DELAY = 1000;
/** How long the note says a lookup couldn't be done. */
const FAILED_FOR = 4000;
/** Longer than any link and a new note's start: a note this long isn't one, and isn't read through for one. */
const MAX_TEXT = 4096;

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

/** What's found for a note: what it is, or null if nothing is. */
type Find = (signal: AbortSignal) => Promise<LibraryItem | null>;

/** Finds what the note is with `find` once `delay` has passed with its text still `text`, and fills it in. */
function lookUpNote(id: string, text: string, find: Find, delay: number) {
  stop(id);
  const lookup: Lookup = { text, state: "waiting" };
  lookups.set(id, lookup);
  lookup.timer = setTimeout(() => void run(id, lookup, find), delay);
}

/**
 * Fills in a library note just made from what a search said of it (Add to Library), as a note that
 * was a link is filled in: with what `find` finds, its cover kept, while its text is still `text`.
 */
export const completeNote = (id: string, text: string, find: Find) => lookUpNote(id, text, find, 0);

async function run(id: string, lookup: Lookup, find: Find) {
  const current = () => lookups.get(id) === lookup;
  if (!current()) return;
  if ((viewOf(id)?.state.doc.toString() ?? notes.get(id)?.note.body) !== lookup.text) return stop(id);
  const abort = (lookup.abort = new AbortController());
  lookup.state = "looking";
  redraw(id);
  speak(t("library.lookingUp"));
  try {
    const item = await find(abort.signal);
    const note = item && (await libraryNote(item, abort.signal));
    if (!current()) return;
    lookups.delete(id);
    redraw(id);
    if (item && note && fill(id, lookup.text, note)) speak(t("library.filled", { title: item.title }));
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
 * Writes the note as `note` says if it's still `text`, and wasn't locked or trashed meanwhile: in its
 * editor, as one change for ⌘Z to take back; or, if it isn't open now, as it's stored, without
 * taking ⌘Z from whatever's being done meanwhile. Then its cover is kept, and it's filed, out of the
 * Inbox. Whether it was.
 */
function fill(id: string, text: string, note: LibraryNote) {
  const stored = notes.get(id)?.note;
  if (!stored || stored.trashed || stored.locked) return false;
  const view = viewOf(id);
  if (view) {
    if (view.state.doc.toString() !== text) return false;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: note.text },
      selection: { anchor: titleEnd(note.text) },
      userEvent: "library",
      annotations: isolateHistory.of("full"),
    });
  } else {
    if (stored.body !== text) return false;
    notes.setText(id, note.text);
  }
  note.keep().catch((error) => console.warn("lines: couldn't keep a cover", error));
  notes.setInbox([id], false);
  return true;
}

/** Typed, pasted, dropped or deleted: not undone, redone, synced or filled in. */
const byHand = (tr: Transaction) => tr.docChanged && (tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("move"));

/** The link the note `id` is in this state of its editor, if it's one (`linkNoteLink`). */
function linkIn(state: EditorState, id: string) {
  const template = notes.templateOf(id);
  return state.doc.length <= MAX_TEXT ? linkNoteLink(state.doc.toString(), template) : null;
}

/** Where a link's lookup has got to, as the note shows it: looking, couldn't, or (asked for) found nothing. */
export type LookupState = "looking" | "failed" | "nothing";

const SAID = { looking: "library.lookingUp", failed: "library.failed", nothing: "library.nothing" } as const;

/** What the note says while a link is looked up, or when it couldn't be; screen readers hear it from `speak`. */
export class LookupWidget extends WidgetType {
  constructor(readonly state: LookupState) {
    super();
  }
  eq(other: LookupWidget) {
    return other.state === this.state;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-library-lookup is-${this.state}`;
    el.setAttribute("aria-hidden", "true");
    el.textContent = t(SAID[this.state]);
    return el;
  }
}

/** Watches a Markdown note's editor for a link becoming all it is, and shows its lookup. */
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

    /** Looks the note up if what was done by hand made its link appear or changed it; stops looking if it's no longer the same text. */
    edited(id: string, update: ViewUpdate) {
      const link = linkIn(update.state, id);
      if (!link || link === linkIn(update.startState, id) || !prefs.lookUpLinks || notes.get(id)?.note.locked) return stop(id);
      const pasted = update.transactions.some((tr) => tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop"));
      lookUpNote(id, update.state.doc.toString(), (signal) => lookUp(link, signal), pasted ? 0 : TYPED_DELAY);
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
