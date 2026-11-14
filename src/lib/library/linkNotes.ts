import { isolateHistory } from "@codemirror/commands";
import { type EditorState, StateEffect, type Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { speak } from "../a11y";
import { editedNote } from "../editor/util";
import { t } from "../i18n/index.svelte";
import { type Entry, notes } from "../notes/store.svelte";
import type { LibraryItem } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { lookUp } from "./lookup";
import { keepCover } from "./covers";
import { type LibraryNote, libraryNote } from "./note";
import { addedAgain, libraryNoteOf } from "./same";
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
/** How long the note says a lookup couldn't be done, or found nothing. */
const SAID_FOR = 4000;
/** Longer than any link and a new note's start: a note this long isn't one, and isn't read through for one. */
const MAX_TEXT = 4096;

/** How a note's looked up: asked for (it says when nothing's found); made just now for it; and whether what the Library has already is looked for. */
interface Asking {
  asked?: boolean;
  fresh?: boolean;
  dedupe?: boolean;
}

/**
 * A note's lookup: the text it's for, where it's got to, how it was asked for, what stops it; and
 * the note there already it offers to open, and whether it offers to merge what was typed into it.
 */
interface Lookup extends Asking {
  text: string;
  state: "waiting" | LookupState;
  timer?: ReturnType<typeof setTimeout>;
  abort?: AbortController;
  open?: string;
  merge?: boolean;
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
function lookUpNote(id: string, text: string, find: Find, delay: number, asking: Asking) {
  stop(id);
  const lookup: Lookup = { text, state: "waiting", ...asking };
  lookups.set(id, lookup);
  lookup.timer = setTimeout(() => void run(id, lookup, find), delay);
}

/**
 * Fills in a library note from what `find` finds, as a note that was a link is filled in, its cover
 * kept, while its text is still `text`: one just made from what a search said of it (Add to
 * Library: `fresh`, and what the Library has already is looked for once it's found), or a resource
 * asked to be looked up. Asked for, it says when nothing's found.
 */
export const completeNote = (id: string, text: string, find: Find, { fresh = false } = {}) => lookUpNote(id, text, find, 0, { asked: true, fresh, dedupe: fresh });

async function run(id: string, lookup: Lookup, find: Find) {
  const current = () => lookups.get(id) === lookup;
  if (!current()) return;
  // A link changed meanwhile is another lookup's; what was asked for is found however it's typed into.
  if (!lookup.asked && (viewOf(id)?.state.doc.toString() ?? notes.get(id)?.note.body) !== lookup.text) return stop(id);
  const abort = (lookup.abort = new AbortController());
  lookup.state = "looking";
  redraw(id);
  speak(t("library.lookingUp"));
  try {
    const item = await find(abort.signal);
    if (!current()) return;
    // What the Library has already, by what was found: its note, rather than another.
    const there = item && lookup.dedupe ? libraryNoteOf(item, id) : undefined;
    if (there) return alreadyThere(id, lookup, there, item!);
    const note = item && (await libraryNote(item, abort.signal));
    if (!current()) return;
    if (!item && lookup.asked) return say(id, lookup, "nothing");
    lookups.delete(id);
    redraw(id);
    if (item && note && fill(id, lookup.text, note)) speak(t("library.filled", { title: item.title }));
  } catch (error) {
    if (abort.signal.aborted || !current()) return;
    console.warn("lines: couldn't look up a link", error);
    say(id, lookup, "failed");
  }
}

/** What's in `now` that wasn't in `made`, line by line: what was typed into a note since lines wrote it. */
function typedSince(made: string, now: string) {
  const left = new Map<string, number>();
  for (const line of made.split("\n")) left.set(line, (left.get(line) ?? 0) + 1);
  const typed = now.split("\n").filter((line) => {
    const count = left.get(line) ?? 0;
    left.set(line, count - 1);
    return count <= 0;
  });
  return typed.join("\n").trim();
}

/** Opens a note with the keyboard in it where filling one leaves it, at its title's end: never at its start, before its properties. */
export function openNote(id: string) {
  notes.pendingFocus = id;
  notes.select(id);
}

/**
 * What a note was looked up as is in the Library already, as `there`. A note made just now for it
 * (Add to Library's, a new note a link was pasted into), with nothing in it but what lines put there,
 * goes to the Trash; if it's the one being written in, `there` opens in its place. One typed into
 * meanwhile stays, saying so, with Open and Merge (what was typed goes to `there`, and it to the
 * Trash): nothing typed is lost, and no copy is kept without saying. Either way it's added again.
 * Any other note (one of long ago made a link by hand, a pinned one) is left as it is, saying so,
 * with Open; it wasn't added, so nothing's counted, and it's left if it changes meanwhile.
 */
function alreadyThere(id: string, lookup: Lookup, there: Entry, item: LibraryItem) {
  const stored = notes.get(id)?.note;
  const now = viewOf(id)?.state.doc.toString() ?? stored?.body ?? "";
  const made = lookup.fresh && stored && !stored.pinned && !stored.locked && !stored.icon && !stored.color;
  if (!made) {
    if (now !== lookup.text) return stop(id);
    lookup.open = there.note.id;
    return say(id, lookup, "already", { lasting: true });
  }
  addedAgain(there, item);
  if (!typedSince(lookup.text, now)) {
    stop(id);
    const open = notes.selectedId === id;
    notes.trash(id);
    if (open) openNote(there.note.id);
    return tell(there.note.id, "already");
  }
  lookup.open = there.note.id;
  lookup.merge = true;
  say(id, lookup, "already", { lasting: true });
}

/** Moves what was typed into the note `id` to the end of the one the Library has of what it is, opened, and the note to the Trash. */
function merge(id: string) {
  const lookup = lookups.get(id);
  const there = lookup?.open ? notes.get(lookup.open) : undefined;
  if (!lookup || !there) return;
  const typed = typedSince(lookup.text, viewOf(id)?.state.doc.toString() ?? notes.get(id)?.note.body ?? "");
  stop(id);
  if (typed) notes.setText(there.note.id, (body) => `${body.trimEnd()}\n\n${typed}\n`);
  notes.trash(id);
  openNote(there.note.id);
  speak(t("library.merged", { title: there.meta.title }));
}

/** The note `id` says `state` for a moment (that what was added is in the Library already), and screen readers hear it. */
export function tell(id: string, state: "already") {
  stop(id);
  const lookup: Lookup = { text: "", state: "waiting" };
  lookups.set(id, lookup);
  say(id, lookup, state);
}

/** The note says how its lookup ended, for a moment, or (`lasting`) until it's written in, and screen readers hear it. */
function say(id: string, lookup: Lookup, state: "failed" | "nothing" | "already", { lasting = false } = {}) {
  lookup.state = state;
  redraw(id);
  speak(t(SAID[state]));
  if (lasting) return;
  lookup.timer = setTimeout(() => {
    if (lookups.get(id) !== lookup) return;
    stop(id);
    redraw(id);
  }, SAID_FOR);
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
  void keepCover(note, id);
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

/** Where a link's lookup has got to, as the note shows it: looking, couldn't, (asked for) found nothing, or found what the Library has already. */
export type LookupState = "looking" | "failed" | "nothing" | "already";

const SAID = { looking: "library.lookingUp", failed: "library.failed", nothing: "library.nothing", already: "library.already" } as const;

/**
 * What the note says while a link is looked up, or when it couldn't be, or that what it is is in the
 * Library already, with a button opening that note (`open`), and one merging the note `merging`
 * into it; screen readers hear it from `speak`.
 */
export class LookupWidget extends WidgetType {
  constructor(
    readonly state: LookupState,
    readonly open?: string,
    readonly merging?: string,
  ) {
    super();
  }
  eq(other: LookupWidget) {
    return other.state === this.state && other.open === this.open && other.merging === this.merging;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-library-lookup is-${this.state}`;
    const said = el.appendChild(document.createElement("span"));
    said.setAttribute("aria-hidden", "true");
    said.textContent = t(SAID[this.state]);
    const button = (text: string, label: string, onclick: () => void) => {
      const button = el.appendChild(document.createElement("button"));
      button.type = "button";
      button.className = "cm-library-open";
      button.textContent = text;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", onclick);
    };
    const { open, merging } = this;
    if (open) button(t("library.openIt"), t("library.openItLabel"), () => openNote(open));
    if (open && merging) button(t("library.merge"), t("library.mergeLabel"), () => merge(merging));
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

    /**
     * Looks the note up if what was done by hand made its link appear or changed it; stops looking if
     * it's no longer the same text. What was asked for (Add to Library's) goes on, to be checked
     * against the Library once it's found, and so does an offer to merge what's typed into the one there.
     */
    edited(id: string, update: ViewUpdate) {
      const lookup = lookups.get(id);
      if (lookup?.asked || lookup?.merge) return;
      const link = linkIn(update.state, id);
      if (!link || link === linkIn(update.startState, id) || !prefs.lookUpLinks || notes.get(id)?.note.locked) return stop(id);
      const pasted = update.transactions.some((tr) => tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop"));
      lookUpNote(id, update.state.doc.toString(), (signal) => lookUp(link, signal), pasted ? 0 : TYPED_DELAY, { fresh: notes.templateOf(id) !== undefined, dedupe: true });
    }

    draw() {
      const id = this.view.state.facet(editedNote);
      const lookup = id ? lookups.get(id) : undefined;
      if (!lookup || lookup.state === "waiting") return Decoration.none;
      return Decoration.set(Decoration.widget({ widget: new LookupWidget(lookup.state, lookup.open, (lookup.merge && id) || undefined), side: 1 }).range(this.view.state.doc.length));
    }

    destroy() {
      views.delete(this.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
