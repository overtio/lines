import { closeCompletion } from "@codemirror/autocomplete";
import { redo, undo } from "@codemirror/commands";
import { getSearchQuery, searchKeymap, searchPanelOpen } from "@codemirror/search";
import {
  Annotation,
  type ChangeSpec,
  EditorSelection,
  EditorState,
  type Extension,
  Facet,
  type Line,
  Prec,
  type Range,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import type { PropertiesPlace, Side } from "../prefs.svelte";
import { frontMatterField, heldProperties, objectsChanged } from "./objects";
import { copyOnSelectCompartment, formatCompartment, propertiesEditing, readOnlyCompartment, spellingCompartment } from "./setup";
import { symbolsChanged } from "./symbols";
import { changesBetween } from "./util";

/*
 * A note's properties drawn apart from its text (Settings → Layout → Properties): beside it, on its
 * left or right, or after its last line. They're still the front matter at the note's start, as
 * files, sync and other apps have them; only where they're drawn changes. They get an editor of
 * their own over the same text, as CodeMirror's split view does, but only its start: positions are
 * the same in both, so what's typed in them goes into the note, as one with its history, and the
 * note's own changes there (undo, sync, find's replace) come back to them. The note hides those
 * lines meanwhile. The arrows move between the two as if the properties were next in line. Beside
 * the text, they need room there: without it (a narrow window, a phone, a pane beside another) they
 * show at the top as they would anyway.
 */

type Place = Exclude<PropertiesPlace, "top">;

interface Placing {
  place: Place;
  /** The side the outline's on, which they keep clear of there; null with it off. */
  outline: Side | null;
}

const placing = Facet.define<Placing, Placing>({ combine: (values) => values[0] ?? { place: "right", outline: null } });
const placeOf = (state: EditorState) => state.facet(placing).place;

/** A change the properties' editor passed on to the note's. */
const fromPane = Annotation.define<true>();
/** A change the note's editor passed on to the properties'. */
const fromNote = Annotation.define<true>();

/** What was measured: whether there's room beside the text, and the room the properties take after it. */
const measured = StateEffect.define<{ room: boolean; height: number }>();

interface Apart {
  /** Where the note's properties end (their closing `---` line's end), or -1 for none to draw apart. */
  end: number;
  /** Whether there's room for them beside the text (after it there always is). */
  room: boolean;
  /** How tall they are after the text, with the space above them. */
  height: number;
}

/** Where the note's properties end, if it has them, and a line after them for its text; else -1. */
function endOf(state: EditorState) {
  const front = state.field(frontMatterField, false);
  return front && front.lines < state.doc.lines ? state.doc.line(front.lines).to : -1;
}

/**
 * Where the properties end, kept while the cursor's in them though they aren't properties for a
 * moment (a key half typed isn't a `key: value` line yet), so they don't jump to the top and back.
 */
function held(end: number, tr: Transaction) {
  if (end < 0) return -1;
  const { doc, selection } = tr.state;
  const to = tr.changes.mapPos(end, 1);
  return selection.main.to <= to && doc.line(1).text.startsWith("---") && doc.sliceString(to, to + 1) === "\n" ? to : -1;
}

const apart = StateField.define<Apart>({
  // Room is measured once the note is drawn; until then there's taken to be some.
  create: (state) => ({ end: endOf(state), room: true, height: 0 }),
  update(value, tr) {
    let { end, room, height } = value;
    for (const effect of tr.effects) if (effect.is(measured)) ({ room, height } = effect.value);
    // Another language (LaTeX, code), whose editor reads no properties, or Markdown again.
    if (tr.reconfigured) end = endOf(tr.state);
    else if (tr.docChanged || tr.selection) {
      const found = endOf(tr.state);
      end = found >= 0 ? found : held(end, tr);
    }
    return end === value.end && room === value.room && height === value.height ? value : { end, room, height };
  },
});

/** Where the properties drawn apart end, or -1 while they aren't (there are none, or no room). */
function drawnEnd(state: EditorState) {
  const { end, room } = state.field(apart);
  return room ? end : -1;
}

/** The lines of the properties held apart while they aren't properties for a moment, which the note's title is after (livePreview.ts). */
const heldLines = heldProperties.compute([apart, frontMatterField], (state) => {
  const end = drawnEnd(state);
  return end >= 0 && !state.field(frontMatterField, false) ? state.doc.lineAt(end).number : 0;
});

/** Whether the cursor (the main selection, all of it) is in the properties drawn apart. */
const inProperties = (state: EditorState, end = drawnEnd(state)) => state.selection.main.to <= end;

/** The room kept after the note's last line for its properties. */
class Room extends WidgetType {
  constructor(readonly height: number) {
    super();
  }
  eq(other: Room) {
    return other.height === this.height;
  }
  get estimatedHeight() {
    return this.height;
  }
  toDOM() {
    const el = document.createElement("div");
    el.style.height = `${this.height}px`;
    return el;
  }
  updateDOM(el: HTMLElement) {
    el.style.height = `${this.height}px`;
    return true;
  }
}

const hidden = Decoration.replace({ block: true });

const decorations = EditorView.decorations.compute(["doc", apart, placing], (state) => {
  const end = drawnEnd(state);
  if (end < 0) return Decoration.none;
  const ranges: Range<Decoration>[] = [hidden.range(0, end)];
  if (placeOf(state) === "bottom") {
    // After anything else drawn below the last line (a diagram, under its code).
    ranges.push(Decoration.widget({ widget: new Room(state.field(apart).height), block: true, side: 1000 }).range(state.doc.length));
  }
  return Decoration.set(ranges);
});

/** Typed, deleted or moved in the note's text. */
const EDITS = ["input", "delete", "move"];

/**
 * The line break between the properties and the text, which Backspace at the start of the text
 * would take, joining its first line to their closing `---` out of sight: what's deleted keeps it
 * (Backspace there does nothing), and a line isn't moved over it. Find's Replace replaces as asked.
 */
const keepBreak = EditorState.transactionFilter.of((tr) => {
  const end = drawnEnd(tr.startState);
  if (end < 0 || !tr.docChanged || !EDITS.some((event) => tr.isUserEvent(event)) || tr.isUserEvent("input.replace")) return tr;
  const kept: ChangeSpec[] = [];
  let joins = false;
  tr.changes.iterChanges((from, to, _fromB, _toB, insert) => {
    if (from > end || to <= end) return kept.push({ from, to, insert });
    joins = true;
    kept.push({ from, to: end, insert }, { from: end + 1, to: Math.max(end + 1, to) });
  });
  if (!joins) return tr;
  if (tr.isUserEvent("move")) return {};
  const changes = tr.startState.changes(kept);
  return { changes, selection: tr.startState.selection.map(changes), userEvent: tr.annotation(Transaction.userEvent), scrollIntoView: tr.scrollIntoView };
});

/** The cursor moved by keys or the pointer in the note stays in its text, out of the properties hidden there. */
const keepOut = EditorState.transactionFilter.of((tr) => {
  const end = drawnEnd(tr.startState);
  if (end < 0 || !tr.selection || !tr.isUserEvent("select") || tr.isUserEvent("select.search")) return tr;
  const start = tr.changes.mapPos(end + 1);
  const { ranges, mainIndex } = tr.selection;
  if (ranges.every((range) => range.from >= start)) return tr;
  const clamp = (pos: number) => Math.max(pos, start);
  return [tr, { selection: EditorSelection.create(ranges.map((range) => EditorSelection.range(clamp(range.anchor), clamp(range.head))), mainIndex), sequential: true }];
});

/** Found or undone in the properties: they're scrolled into view where they're drawn (`follow`), not the note to where they're hidden. */
const scrollHandler = EditorView.scrollHandler.of((view, range) => range.to <= drawnEnd(view.state));

const setMatches = StateEffect.define<DecorationSet>();
const match = Decoration.mark({ class: "cm-searchMatch" });
const selectedMatch = Decoration.mark({ class: "cm-searchMatch cm-searchMatch-selected" });

/** The find bar's matches in the properties: the note's editor finds them, but draws them only in itself. */
const matches = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setMatches)) return effect.value;
    return value.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function matchesIn(state: EditorState, end: number) {
  const query = getSearchQuery(state);
  if (!searchPanelOpen(state) || !query.valid) return Decoration.none;
  const { from, to } = state.selection.main;
  const found: Range<Decoration>[] = [];
  const cursor = query.getCursor(state, 0, end);
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    const at = next.value;
    if (at.from < at.to) found.push((at.from === from && at.to === to ? selectedMatch : match).range(at.from, at.to));
  }
  return Decoration.set(found);
}

/** Where `view`'s text column is across the screen, inside its padding. */
function textColumn(view: EditorView) {
  const box = view.contentDOM.getBoundingClientRect();
  const style = getComputedStyle(view.contentDOM);
  return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
}

/** How far into `view`'s text column the cursor is, across. */
function across(view: EditorView) {
  const left = textColumn(view).left;
  return (view.coordsAtPos(view.state.selection.main.head)?.left ?? left) - left;
}

/** The position on `line`'s first row (or its last) in `view`, `offset` px into its text column. */
function along(view: EditorView, line: Line, last: boolean, offset: number) {
  const row = view.coordsAtPos(last ? line.to : line.from, last ? -1 : 1);
  const pos = row && view.posAtCoords({ x: textColumn(view).left + offset, y: (row.top + row.bottom) / 2 }, false);
  return pos ?? (last ? line.to : line.from);
}

/** Space between the text and the properties beside it, clear of the line grip and the marks on the left. */
const GAP = 48;
/** Kept clear at the scroller's edge, and as well where the outline is on that side. */
const EDGE = 16;
const OUTLINE = 44;
/** How narrow properties beside the text can be, and how wide they get, in the text's ems. */
const NARROWEST = 16;
const WIDEST = 22;
/** How narrow the text gets to make room for them, in its ems (unless it's chosen narrower): a comfortable measure still. */
const READABLE = 30;

interface Layout {
  room: boolean;
  /** Where the properties go in the scroller, scrolled with the note. */
  top: number;
  left: number;
  width: number;
  /** For after the text: how much room to keep there. */
  height: number;
  /** Beside the text: where its column (with its padding) goes in the scroller, and how wide it is. */
  text?: { left: number; width: number };
}

/** Focuses `view` once the update it's in is done. */
const focusLater = (view: EditorView) => queueMicrotask(() => view.dom.isConnected && view.focus());

class PropertiesPane {
  pane: EditorView | null = null;
  readonly host = document.createElement("div");
  /**
   * Laid out again, with the editor's own measuring (so in step with its lines, and never while the
   * browser is still resizing things), when the scroller is resized (the window, a pane), or the
   * text's width or their height changes.
   */
  readonly #resized = new ResizeObserver(() => this.measure());
  /** The note's width, its margins or the text's size changed (Settings → Typography), on the page's root. */
  readonly #restyled = new MutationObserver(() => this.measure());
  #layout: Layout | null = null;
  /** Where the note's text is laid beside the properties, as last set ("" where it isn't). */
  #text = "";
  /** The cursor in the note's text, last, for it to go back to from the properties. */
  #inText: EditorSelection | null = null;
  #gone = false;

  constructor(readonly view: EditorView) {
    // The scroller's whole box, which a scroll bar coming and going leaves as it is.
    this.#resized.observe(view.scrollDOM, { box: "border-box" });
    for (const el of [view.contentDOM, this.host]) this.#resized.observe(el);
    this.#restyled.observe(document.documentElement, { attributeFilter: ["style"] });
    view.contentDOM.addEventListener("focus", this.#noteFocused);
    // Beside the text, whether there's room is known before an editor's made for them, which would
    // only go again where there isn't (a narrow window, a phone).
    if (placeOf(view.state) !== "bottom") this.write(this.read(view));
    if (drawnEnd(view.state) >= 0 && this.#layout?.room !== false) this.open();
    this.measure();
  }

  update(update: ViewUpdate) {
    const { state, startState } = update;
    const moved = placeOf(state) !== placeOf(startState);
    // Made again for another place, or when the note's editing is (Show Markdown, plugins).
    if (moved || formatCompartment.get(state) !== formatCompartment.get(startState)) {
      const focused = this.pane?.hasFocus;
      this.close();
      if (moved) this.#layout = null;
      if (focused && drawnEnd(state) >= 0) queueMicrotask(() => this.pane?.focus());
    }
    const end = drawnEnd(state);
    if (end < 0) this.close();
    else if (!this.pane) this.open();
    else this.follow(update, end);
    const inside = inProperties(state, end);
    this.#inText = inside ? (this.#inText && update.docChanged ? this.#inText.map(update.changes) : this.#inText) : state.selection;
    // The cursor goes where a change puts it: into the properties by the note's own (undo,
    // `/properties`, the closing `---` typed), or out of them (Enter at their end, undo). Focus
    // moved by itself (Tab, a tap) stays where it went.
    if (this.pane && update.transactions.some((tr) => tr.selection || tr.docChanged)) {
      if (inside && update.view.hasFocus) focusLater(this.pane);
      else if (!inside && this.pane.hasFocus) focusLater(update.view);
    }
    if (update.geometryChanged || update.viewportChanged || end !== drawnEnd(startState) || state.facet(placing) !== startState.facet(placing)) this.measure();
  }

  /**
   * The note's text focused with its cursor in the properties (once what focused it is done, a click
   * having put it where it clicked): from them (⇧Tab), the cursor goes back into the text; from
   * anywhere else (Find closed, F6), focus goes on into them.
   */
  #noteFocused = (event: FocusEvent) => {
    const from = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    setTimeout(() => {
      const { view, pane } = this;
      const end = drawnEnd(view.state);
      if (this.#gone || !pane || !view.hasFocus || !inProperties(view.state, end)) return;
      if (from && pane.dom.contains(from)) view.dispatch({ selection: this.#inText ?? EditorSelection.cursor(end + 1) });
      else pane.focus();
    });
  };

  /** The properties focused by themselves (Tab, a tap): the note's cursor is theirs, for undo and Find to start from. */
  #paneFocused = () =>
    queueMicrotask(() => {
      const { view, pane } = this;
      if (pane?.hasFocus && !pane.state.selection.eq(view.state.selection)) view.dispatch({ selection: pane.state.selection, annotations: fromPane.of(true), filter: false });
    });

  open() {
    const { view } = this;
    const end = drawnEnd(view.state);
    const place = placeOf(view.state);
    this.host.className = place === "bottom" ? "cm-props-apart" : "cm-props-apart is-beside";
    this.pane = new EditorView({
      state: EditorState.create({
        doc: view.state.doc.sliceString(0, end),
        selection: inProperties(view.state, end) ? view.state.selection : undefined,
        extensions: [
          propertiesEditing(view.state),
          paneKeys(this),
          matches,
          EditorView.editorAttributes.of({ class: place === "bottom" ? "cm-props cm-props-after" : "cm-props cm-props-beside" }),
        ],
      }),
      parent: this.host,
      dispatchTransactions: (trs, pane) => this.fromPane(trs, pane),
    });
    this.pane.contentDOM.addEventListener("focus", this.#paneFocused);
    // Out of sight and out of reach until they're where they go.
    if (this.#layout) this.place(this.#layout);
    else Object.assign(this.host.style, { opacity: "0", pointerEvents: "none" });
    view.scrollDOM.append(this.host);
  }

  /** Drawn in the note again, the properties keep the cursor that was in them; its text goes back to where it was. */
  close() {
    this.layText(undefined);
    const { pane } = this;
    if (!pane) return;
    this.pane = null;
    if (pane.hasFocus && !this.#gone) focusLater(this.view);
    pane.destroy();
    this.host.remove();
  }

  /** What's done in the properties is done in the note, its cursor too, without its filters (the properties' own ran). */
  fromPane(trs: readonly Transaction[], pane: EditorView) {
    pane.update(trs);
    for (const tr of trs) {
      if (tr.annotation(fromNote) || (!tr.docChanged && !tr.selection)) continue;
      const changes: ChangeSpec[] = [];
      tr.changes.iterChanges((from, to, _fromB, _toB, insert) => changes.push({ from, to, insert }));
      this.view.dispatch({
        changes,
        selection: tr.state.selection,
        annotations: fromPane.of(true),
        // Not the pointer's selecting, which has an editor draw the selection, and take focus to.
        userEvent: tr.isUserEvent("select.pointer") ? undefined : tr.annotation(Transaction.userEvent),
        filter: false,
      });
      // Typed there, the menus (`/`, `@`) open in the properties' editor, and not in the note's as well.
      closeCompletion(this.view);
    }
  }

  /** The note's own changes in the properties, its cursor put there, what it draws again and how: the properties follow. */
  follow(update: ViewUpdate, end: number) {
    const pane = this.pane!;
    const { state, startState } = update;
    if (update.docChanged) {
      const text = state.doc.sliceString(0, end);
      const shown = pane.state.doc.toString();
      if (shown !== text) pane.dispatch({ changes: changesBetween(shown, text), annotations: fromNote.of(true), filter: false });
    }

    const own = update.transactions.filter((tr) => !tr.annotation(fromPane));
    const selected = own.some((tr) => tr.selection) && inProperties(state, end);
    const effects: StateEffect<unknown>[] = own.flatMap((tr) => tr.effects.filter((effect) => effect.is(objectsChanged) || effect.is(symbolsChanged)));
    for (const compartment of [readOnlyCompartment, spellingCompartment, copyOnSelectCompartment]) {
      const value = compartment.get(state);
      if (value !== compartment.get(startState)) effects.push(compartment.reconfigure(value ?? []));
    }
    const searching = searchPanelOpen(state) || searchPanelOpen(startState);
    if (searching && (update.docChanged || update.selectionSet || getSearchQuery(state) !== getSearchQuery(startState) || searchPanelOpen(state) !== searchPanelOpen(startState))) {
      effects.push(setMatches.of(matchesIn(state, end)));
    }
    if (selected || effects.length) {
      pane.dispatch({ selection: selected ? state.selection : undefined, scrollIntoView: selected, effects, annotations: fromNote.of(true) });
    }
  }

  /**
   * ↑ from the text's first line goes into the properties beside it, onto their last line; ↓ from
   * its last line, into those after it, onto their first. Their own `---` lines are passed over.
   */
  enter(down: boolean) {
    const { view, pane } = this;
    if (!pane || down !== (placeOf(view.state) === "bottom")) return false;
    const { state } = view;
    const range = state.selection.main;
    const leaving = down
      ? view.moveToLineBoundary(range, true, true).head === state.doc.length
      : view.moveVertically(range, false).head <= drawnEnd(state);
    if (!leaving) return false;
    const { doc } = pane.state;
    const lines = pane.state.field(frontMatterField, false)?.lines ?? doc.lines + 1;
    const line = doc.line(down ? Math.min(2, doc.lines) : Math.max(1, lines - 1));
    pane.dispatch({ selection: { anchor: along(pane, line, !down, across(view)) }, scrollIntoView: true, userEvent: "select" });
    pane.focus();
    return true;
  }

  /** ↓ from the properties beside the text goes into its first line; ↑ from those after it, into its last. */
  leave(down: boolean) {
    const { view, pane } = this;
    if (!pane || down === (placeOf(view.state) === "bottom")) return false;
    const { doc } = pane.state;
    const range = pane.state.selection.main;
    const lines = pane.state.field(frontMatterField, false)?.lines ?? doc.lines + 1;
    const moved = pane.moveVertically(range, down).head;
    const to = doc.lineAt(moved).number;
    // Still among the properties: moved, and not onto a `---` line.
    if (moved !== range.head && (down ? to <= lines - 1 : to >= 2)) return false;
    const note = view.state.doc;
    const line = down ? note.lineAt(drawnEnd(view.state) + 1) : note.line(note.lines);
    view.dispatch({ selection: { anchor: along(view, line, !down, across(pane)) }, scrollIntoView: true, userEvent: "select" });
    view.focus();
    return true;
  }

  /** Lays them out with the editor's next measuring: while there are properties, or once to begin with. */
  measure() {
    if (this.#gone || (this.#layout && this.view.state.field(apart).end < 0)) return;
    this.view.requestMeasure({ key: this, read: (view) => this.read(view), write: (layout) => this.write(layout) });
  }

  read(view: EditorView): Layout {
    const place = placeOf(view.state);
    const scroller = view.scrollDOM;
    const box = scroller.getBoundingClientRect();
    const style = getComputedStyle(view.dom);
    const size = parseFloat(style.fontSize);
    // Down the scroller's own content, so they scroll with the note (it doesn't scroll across).
    const y = (top: number) => top + view.documentTop - box.top + scroller.scrollTop;
    if (place === "bottom") {
      // Where the room kept for them starts, after the last line and all that's drawn with it (a
      // table, a picture, a diagram under its code).
      const text = textColumn(view);
      const block = view.lineBlockAt(view.state.doc.length);
      const room = typeof block.type === "number" ? undefined : block.type.find((part) => part.widget instanceof Room);
      return { room: true, top: y(room?.top ?? block.bottom) + size, left: text.left - box.left, width: text.right - text.left, height: Math.ceil(this.host.offsetHeight + size) };
    }
    // Beside it, the text and the properties are a two-column page, centred in the scroller (its
    // whole width, so a scroll bar coming and going doesn't move them). Short of room, they're as
    // narrow as they go, and then the text narrows, down to a comfortable measure; past that they're
    // at the top. Over a backdrop, the text's page and their card (editor.css) are what's centred,
    // the room between pages around and between them.
    const pad = parseFloat(getComputedStyle(view.contentDOM).paddingLeft);
    const page = parseFloat(style.getPropertyValue("--page-gap")) || 0;
    const outline = view.state.facet(placing).outline === place ? OUTLINE : 0;
    const gap = page ? pad + page * 1.5 : GAP;
    const margin = page ? page + outline : Math.max(pad, EDGE + outline);
    /** Between the text and its page's edge, and between them and their card's. */
    const inset = page ? { text: pad, them: page / 2 } : { text: 0, them: 0 };
    const room = box.width - 2 * margin - inset.text - inset.them - gap;
    const chosen = Math.min(parseFloat(style.getPropertyValue("--editor-width")) || Infinity, box.width - 2 * page) - 2 * pad;
    const width = Math.min(Math.max(room - chosen, NARROWEST * size), WIDEST * size);
    const narrowed = Math.min(chosen, room - width);
    const start = (box.width - (inset.text + narrowed + gap + width + inset.them)) / 2;
    const textLeft = place === "right" ? start + inset.text : start + inset.them + width + gap;
    const first = view.lineBlockAt(Math.max(0, view.state.field(apart).end + 1));
    return {
      room: narrowed >= Math.min(chosen, READABLE * size),
      top: y(first.top),
      left: place === "right" ? textLeft + narrowed + gap : start + inset.them,
      width,
      height: 0,
      text: { left: textLeft - pad, width: narrowed + 2 * pad },
    };
  }

  write(layout: Layout) {
    if (this.#gone) return;
    this.#layout = layout;
    this.place(layout);
    const { end, room, height } = this.view.state.field(apart);
    this.layText(layout.room && end >= 0 ? layout.text : undefined);
    if (layout.room !== room || layout.height !== height) {
      queueMicrotask(() => !this.#gone && this.view.state.field(apart, false) && this.view.dispatch({ effects: measured.of(layout) }));
    }
  }

  place({ top, left, width }: Layout) {
    Object.assign(this.host.style, { top: `${top}px`, left: `${left}px`, width: `${width}px`, opacity: "", pointerEvents: "" });
  }

  /** The note's text column beside the properties (editor.css), or where it goes without them; measured again once it moves. */
  layText(text: Layout["text"]) {
    const laid = text ? `${text.left} ${text.width}` : "";
    if (laid === this.#text) return;
    this.#text = laid;
    const { scrollDOM } = this.view;
    for (const [name, px] of [["--props-text-left", text?.left], ["--props-text-width", text?.width]] as const) {
      if (px === undefined) scrollDOM.style.removeProperty(name);
      else scrollDOM.style.setProperty(name, `${px}px`);
    }
    scrollDOM.toggleAttribute("data-props-beside", !!text);
    this.view.requestMeasure();
  }

  destroy() {
    this.#gone = true;
    this.view.contentDOM.removeEventListener("focus", this.#noteFocused);
    this.#resized.disconnect();
    this.#restyled.disconnect();
    this.close();
  }
}

const panes = ViewPlugin.fromClass(PropertiesPane);

const noteKeys = Prec.high(
  keymap.of([
    { key: "ArrowUp", run: (view) => view.plugin(panes)?.enter(false) ?? false },
    { key: "ArrowDown", run: (view) => view.plugin(panes)?.enter(true) ?? false },
  ]),
);

/** The properties' keys: out into the note's text, and its undo and redo and find bar (the note's, as its history is). */
const paneKeys = (owner: PropertiesPane) =>
  Prec.high(
    keymap.of([
      { key: "ArrowUp", run: () => owner.leave(false) },
      { key: "ArrowDown", run: () => owner.leave(true) },
      { key: "Mod-z", run: () => undo(owner.view), preventDefault: true },
      { key: "Mod-y", mac: "Mod-Shift-z", run: () => redo(owner.view), preventDefault: true },
      { linux: "Ctrl-Shift-z", run: () => redo(owner.view), preventDefault: true },
      ...searchKeymap
        .filter((binding) => binding.key !== "Mod-d")
        .map(({ run, shift, ...binding }) => ({ ...binding, run: run && (() => run(owner.view)), shift: shift && (() => shift(owner.view)) })),
    ]),
  );

const drawnApart: Extension = [apart, heldLines, decorations, keepBreak, keepOut, scrollHandler, noteKeys, panes];
const placings = new Map<string, Extension>();

/**
 * A note's properties where Settings → Layout puts them: at its top as they are, or apart from its
 * text, clear of the outline on `outline`'s side (null with it off) (Editor.svelte).
 */
export function propertiesApart(place: PropertiesPlace, outline: Side | null): Extension {
  if (place === "top") return [];
  const key = `${place} ${outline}`;
  let found = placings.get(key);
  if (!found) placings.set(key, (found = [placing.of({ place, outline }), drawnApart]));
  return found;
}
