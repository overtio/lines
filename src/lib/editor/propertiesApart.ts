import { closeCompletion } from "@codemirror/autocomplete";
import { redo, undo } from "@codemirror/commands";
import { getSearchQuery, searchPanelOpen } from "@codemirror/search";
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
import { BlockType, Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { prefs, type PropertiesPlace } from "../prefs.svelte";
import { frontMatterField, heldProperties, objectsChanged } from "./objects";
import { copyOnSelectCompartment, propertiesEditing, readOnlyCompartment, spellingCompartment } from "./setup";
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

const placeFacet = Facet.define<Place, Place>({ combine: (places) => places[0] ?? "right" });

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
    if (tr.docChanged || tr.selection) {
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

const decorations = EditorView.decorations.compute(["doc", apart, placeFacet], (state) => {
  const end = drawnEnd(state);
  if (end < 0) return Decoration.none;
  const ranges: Range<Decoration>[] = [hidden.range(0, end)];
  if (state.facet(placeFacet) === "bottom") {
    ranges.push(Decoration.widget({ widget: new Room(state.field(apart).height), block: true, side: 1 }).range(state.doc.length));
  }
  return Decoration.set(ranges);
});

/** Typed, pasted, deleted or moved in the note's text. */
const EDITS = ["input", "delete", "move"];

/**
 * The line break between the properties and the text, which Backspace at the start of the text
 * would take, joining its first line to their closing `---` out of sight: it does nothing there.
 */
const keepBreak = EditorState.transactionFilter.of((tr) => {
  const end = drawnEnd(tr.startState);
  if (end < 0 || !EDITS.some((event) => tr.isUserEvent(event))) return tr;
  let joins = false;
  tr.changes.iterChangedRanges((from, to) => (joins ||= from <= end && to > end));
  return joins ? {} : tr;
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

interface Layout {
  room: boolean;
  /** Where the properties go in the scroller, scrolled with the note. */
  top: number;
  left: number;
  width: number;
  /** For after the text: how much room to keep there. */
  height: number;
}

/** Focuses `view` once the update it's in is done. */
const focusLater = (view: EditorView) => queueMicrotask(() => view.dom.isConnected && view.focus());

class PropertiesPane {
  pane: EditorView | null = null;
  readonly host = document.createElement("div");
  readonly #resized = new ResizeObserver(() => this.measure());
  #layout: Layout | null = null;
  #gone = false;

  constructor(readonly view: EditorView) {
    for (const el of [view.scrollDOM, view.contentDOM, this.host]) this.#resized.observe(el);
    if (drawnEnd(view.state) >= 0) this.open();
    this.measure();
  }

  update(update: ViewUpdate) {
    const { state, startState } = update;
    if (state.facet(placeFacet) !== startState.facet(placeFacet)) {
      this.close();
      this.#layout = null;
    }
    const end = drawnEnd(state);
    if (end < 0) this.close();
    else if (!this.pane) this.open();
    else this.follow(update, end);
    // The cursor goes where the selection is: the note's put in the properties (undo, `/properties`,
    // the closing `---` typed), or the properties' out of them (undo, Enter at their end).
    if (this.pane) {
      if (update.view.hasFocus && inProperties(state, end)) focusLater(this.pane);
      else if (this.pane.hasFocus && !inProperties(state, end)) focusLater(update.view);
    }
    if (update.geometryChanged || update.viewportChanged || end !== drawnEnd(startState)) this.measure();
  }

  open() {
    const { view } = this;
    const end = drawnEnd(view.state);
    const place = view.state.facet(placeFacet);
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
    if (this.#layout) this.place(this.#layout);
    else this.host.style.opacity = "0";
    view.scrollDOM.append(this.host);
  }

  /** Drawn in the note again, the properties keep the cursor that was in them. */
  close() {
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
    if (!pane || down !== (view.state.facet(placeFacet) === "bottom")) return false;
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
    if (!pane || down === (view.state.facet(placeFacet) === "bottom")) return false;
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

  measure = () => {
    if (this.#gone || (this.#layout && this.view.state.field(apart).end < 0)) return;
    this.view.requestMeasure({ key: this, read: (view) => this.read(view), write: (layout) => this.write(layout) });
  };

  read(view: EditorView): Layout {
    const place = view.state.facet(placeFacet);
    const scroller = view.scrollDOM;
    const box = scroller.getBoundingClientRect();
    const text = textColumn(view);
    const style = getComputedStyle(view.dom);
    const size = parseFloat(style.fontSize);
    // In the scroller's own coordinates, so they scroll with the note.
    const x = (left: number) => left - box.left + scroller.scrollLeft;
    const y = (top: number) => top + view.documentTop - box.top + scroller.scrollTop;
    if (place === "bottom") {
      const block = view.lineBlockAt(view.state.doc.length);
      const rows = typeof block.type === "number" ? [block] : block.type.filter((part) => part.type === BlockType.Text);
      return { room: true, top: y(rows[rows.length - 1].bottom) + size, left: x(text.left), width: text.right - text.left, height: Math.ceil(this.host.offsetHeight + size) };
    }
    // Over a backdrop, outside the note's page (the text column's padding), on a card of their own
    // with half the room between pages around their text (editor.css), and that room around it.
    const page = parseFloat(style.getPropertyValue("--page-gap"));
    const gap = page ? text.left - view.contentDOM.getBoundingClientRect().left + page * 1.5 : GAP;
    const edge = (page ? page * 1.5 : EDGE) + (prefs.outline && prefs.outlineSide === place ? OUTLINE : 0);
    const free = (place === "right" ? box.left + scroller.clientWidth - text.right : text.left - box.left) - gap - edge;
    const width = Math.min(free, WIDEST * size);
    const left = place === "right" ? text.right + gap : text.left - gap - width;
    const first = view.lineBlockAt(Math.max(0, view.state.field(apart).end + 1));
    return { room: width >= NARROWEST * size, top: y(first.top), left: x(left), width, height: 0 };
  }

  write(layout: Layout) {
    if (this.#gone) return;
    this.#layout = layout;
    this.place(layout);
    const { room, height } = this.view.state.field(apart);
    if (layout.room !== room || layout.height !== height) {
      queueMicrotask(() => !this.#gone && this.view.state.field(apart, false) && this.view.dispatch({ effects: measured.of(layout) }));
    }
  }

  place({ top, left, width }: Layout) {
    Object.assign(this.host.style, { top: `${top}px`, left: `${left}px`, width: `${width}px`, opacity: "" });
  }

  destroy() {
    this.#gone = true;
    this.#resized.disconnect();
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

/** The properties' keys: out into the note's text, and its undo and redo (the history is the note's). */
const paneKeys = (owner: PropertiesPane) =>
  Prec.high(
    keymap.of([
      { key: "ArrowUp", run: () => owner.leave(false) },
      { key: "ArrowDown", run: () => owner.leave(true) },
      { key: "Mod-z", run: () => undo(owner.view), preventDefault: true },
      { key: "Mod-y", mac: "Mod-Shift-z", run: () => redo(owner.view), preventDefault: true },
      { linux: "Ctrl-Shift-z", run: () => redo(owner.view), preventDefault: true },
    ]),
  );

const drawnApart: Extension = [apart, heldLines, decorations, keepBreak, keepOut, scrollHandler, noteKeys, panes];
const places = new Map<Place, Extension>();

/** A note's properties where Settings → Layout puts them: at its top as they are, or apart from its text (Editor.svelte). */
export function propertiesApart(place: PropertiesPlace): Extension {
  if (place === "top") return [];
  let found = places.get(place);
  if (!found) places.set(place, (found = [placeFacet.of(place), drawnApart]));
  return found;
}
