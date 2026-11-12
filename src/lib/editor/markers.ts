import { syntaxTree } from "@codemirror/language";
import { type ChangeSpec, type EditorState, type Extension, RangeSetBuilder, StateEffect, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, layer, type LayerMarker, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { PALETTE, paletteVar } from "../palette";
import { plugins } from "../plugins/registry.svelte";
import type { LineMarker, MarkerColor, NoteLanguage } from "../plugins/types";
import { markupMode } from "./markupMode";
import { selectedLines, viewSelectionInUse } from "./util";

/*
 * Marks in a note's margin, as a code editor marks the lines changed: the note's own, written at the
 * end of a line in its language's way (`<!-- mark green: to check -->` in Markdown), hidden but on
 * the line being edited; and those plugins add, each source in a lane of its own, further out.
 * Lines next to each other marked alike make one bar.
 */

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Marks written as a comment at a line's end: `mark`, a color unless it's the accent, and what it
 * says, between `open` and `close` (`<!-- mark green: to check -->`). `notAfter` is a character the
 * comment can't follow (LaTeX's `\%` isn't one), and `skip` says where a line's end isn't text (code).
 */
export function commentMarks(open: string, close: string, { notAfter, skip }: { notAfter?: string; skip?: (state: EditorState, pos: number) => boolean } = {}): NoteLanguage["lineMarks"] {
  const names = PALETTE.join("|");
  const before = notAfter ? `(?<!${escape(notAfter)})` : "";
  // The line's last comment (none after it), whose label doesn't run past its end.
  const last = `(?!.*${escape(open)})`;
  const label = close ? `((?:(?!${escape(close)}).)*?)` : "(.*?)";
  const pattern = new RegExp(`\\s*${before}${escape(open)}${last}\\s*mark\\b(?:\\s+(${names}))?\\s*(?::\\s*${label})?\\s*${escape(close)}\\s*$`, "i");
  return {
    read(text) {
      const found = pattern.exec(text);
      return found && { at: found.index, color: (found[1]?.toLowerCase() ?? "accent") as MarkerColor, label: found[2] || undefined };
    },
    skip,
    write: (color, label) => [open, `mark${color && color !== "accent" ? ` ${color}` : ""}${label ? `: ${label}` : ""}`, close].filter(Boolean).join(" "),
  };
}

/** How far left of the text the first lane is, clear of the drag grip, and how far apart lanes are, in px. */
const OFFSET = 30;
const LANE = 6;

/** The note was opened again (Editor.svelte): what it's compared with starts from now. */
export const reopened = StateEffect.define<null>();

/**
 * The note's text when it was opened (kept as it is, which costs nothing), for plugins that compare
 * with it: in every note's editor, outside its format's, so setting that up again doesn't reset it.
 */
export const openedText = StateField.define<Text>({
  create: (state) => state.doc,
  update: (text, tr) => (tr.effects.some((effect) => effect.is(reopened)) ? tr.state.doc : text),
});

/** One of the note's own marks: its line, from its start to its end, where on it it's written, and where its comment starts. */
interface OwnMark {
  line: number;
  end: number;
  at: number;
  start: number;
  color: MarkerColor;
  label?: string;
}

interface Marks {
  /** The note's own marks, in order. */
  own: OwnMark[];
  /** Each plugin's marks, a lane each. */
  theirs: LineMarker[][];
}

/** The note's own marks on the lines `ranges` cover, added to `into` (a line once, however many ranges cover it). */
function readMarks(state: EditorState, language: NoteLanguage, ranges: [number, number][], into: OwnMark[]) {
  const read = language.lineMarks?.read;
  if (!read) return;
  const seen = new Set<number>();
  for (const [from, to] of ranges) {
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      pos = line.to + 1;
      if (seen.has(line.from)) continue;
      seen.add(line.from);
      const mark = read(line.text);
      if (!mark) continue;
      const at = line.from + mark.at;
      const start = at + line.text.slice(mark.at).length - line.text.slice(mark.at).trimStart().length;
      into.push({ line: line.from, end: line.to, at, start, color: mark.color, label: mark.label });
    }
  }
}

/** The plugins' marks, which are asked with the note's whole text: only when there are any. */
function theirMarks(state: EditorState, language: NoteLanguage) {
  const sources = plugins.markerSources;
  if (!sources.length) return [];
  const note = { text: state.doc.toString(), opened: (state.field(openedText, false) ?? state.doc).toString(), format: language.id };
  return sources.map((source) => {
    try {
      return source.markers(note);
    } catch (error) {
      console.error(`lines: the "${source.id}" markers couldn't be worked out`, error);
      return [];
    }
  });
}

/** A lane's marks in order, those next to each other alike joined into one. */
function runs(lane: LineMarker[]) {
  const sorted = lane.map((mark) => ({ ...mark, to: mark.to ?? mark.from })).sort((a, b) => a.from - b.from);
  const joined: typeof sorted = [];
  for (const mark of sorted) {
    const last = joined.at(-1);
    const alike = last && !mark.between && !last.between && last.color === mark.color && last.label === mark.label;
    if (alike && mark.from <= last.to + 1) last.to = Math.max(last.to, mark.to);
    else joined.push(mark);
  }
  return joined;
}

/** A bar beside lines, or a wedge between two. */
class Bar implements LayerMarker {
  constructor(
    readonly left: number,
    readonly top: number,
    readonly height: number,
    readonly color: MarkerColor,
    readonly label: string | undefined,
    readonly between: boolean,
  ) {}

  draw() {
    const bar = document.createElement("div");
    bar.className = this.between ? "cm-marker is-between" : "cm-marker";
    this.place(bar);
    return bar;
  }

  update(bar: HTMLElement, previous: LayerMarker) {
    if (!(previous instanceof Bar) || previous.between !== this.between) return false;
    this.place(bar);
    return true;
  }

  eq(other: LayerMarker): boolean {
    return (
      other instanceof Bar &&
      this.left === other.left &&
      this.top === other.top &&
      this.height === other.height &&
      this.color === other.color &&
      this.label === other.label &&
      this.between === other.between
    );
  }

  private place(bar: HTMLElement) {
    bar.style.left = `${this.left}px`;
    bar.style.top = `${this.top}px`;
    bar.style.height = `${this.height}px`;
    bar.style.setProperty("--marker", paletteVar(this.color));
    if (this.label) bar.title = this.label;
    else bar.removeAttribute("title");
  }
}

/** The note's been read further (what's code may have changed), with or without a change. */
const parsedFurther = (update: ViewUpdate) => syntaxTree(update.startState) !== syntaxTree(update.state);

/** Marks in the margin, and Mark Lines, for notes in `language`. */
export function lineMarkers(language: NoteLanguage): Extension {
  const marks = StateField.define<Marks>({
    create(state) {
      const own: OwnMark[] = [];
      readMarks(state, language, [[0, state.doc.length]], own);
      return { own, theirs: theirMarks(state, language) };
    },
    // Only the lines a change touched are read again; the rest of the note's marks move with it.
    update(value, { docChanged, changes, state, startState }) {
      if (!docChanged) return startState.field(openedText, false) === state.field(openedText, false) ? value : { ...value, theirs: theirMarks(state, language) };
      const before: [number, number][] = [];
      const after: [number, number][] = [];
      changes.iterChangedRanges((fromA, toA, fromB, toB) => {
        before.push([fromA, toA]);
        after.push([fromB, toB]);
      });
      const own = value.own
        .filter((mark) => !before.some(([from, to]) => from <= mark.end && to >= mark.line))
        .map((mark) => ({ ...mark, line: changes.mapPos(mark.line), end: changes.mapPos(mark.end), at: changes.mapPos(mark.at), start: changes.mapPos(mark.start) }));
      readMarks(state, language, after, own);
      return { own: own.sort((a, b) => a.line - b.line), theirs: theirMarks(state, language) };
    },
  });

  /**
   * The note's own marks, but those that aren't (in code, as the note is now). None while the note's
   * format is being set up again, when what draws them may still measure once without them.
   */
  const ownMarks = (state: EditorState) => (state.field(marks, false)?.own ?? []).filter((mark) => !language.lineMarks?.skip?.(state, mark.start));
  /** Where each is written, by its line's start. */
  const writtenOn = (state: EditorState) => new Map(ownMarks(state).map((mark) => [mark.line, mark.at]));

  const hidden = Decoration.replace({});
  /** The note's own marks, hidden but where the cursor is (or anywhere, while the note isn't being edited). */
  const hiding = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged || parsedFurther(update)) this.decorations = this.build(update.view);
      }
      build(view: EditorView) {
        // With the note's markup in sight, they are too.
        const mode = view.state.facet(markupMode);
        if (mode === "source" || mode === "visible") return Decoration.none;
        const written = writtenOn(view.state);
        const { doc } = view.state;
        const selection = viewSelectionInUse(view) ? view.state.selection.ranges : [];
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = doc.lineAt(pos);
            const at = written.get(line.from);
            if (at !== undefined && at < line.to && !selection.some((range) => range.from <= line.to && range.to >= line.from)) builder.add(at, line.to, hidden);
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );

  const bars = layer({
    above: true,
    class: "cm-markers",
    update: (update) => update.docChanged || update.viewportChanged || update.geometryChanged || parsedFurther(update),
    markers(view) {
      const theirs = view.state.field(marks, false)?.theirs ?? [];
      const { doc } = view.state;
      const lanes = [ownMarks(view.state).map((mark) => ({ from: doc.lineAt(mark.line).number, color: mark.color, label: mark.label })), ...theirs];
      const content = view.contentDOM;
      const scroller = view.scrollDOM.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(content).paddingLeft);
      const textLeft = content.getBoundingClientRect().left + pad - scroller.left + view.scrollDOM.scrollLeft;
      const top = view.documentTop - scroller.top + view.scrollDOM.scrollTop;
      // Nearer the text where the margin is narrow (a phone's), so they stay in it.
      const first = Math.min(OFFSET, pad - 6);
      const { from: shownFrom, to: shownTo } = view.viewport;
      const drawn: Bar[] = [];
      lanes.forEach((lane, index) => {
        const left = textLeft - first - index * LANE;
        for (const run of runs(lane)) {
          if (run.between) {
            // Above a line, or below the last for lines taken out at the end.
            const below = run.from > doc.lines;
            const line = doc.line(Math.min(run.from, doc.lines));
            if (line.to < shownFrom || line.from > shownTo) continue;
            const block = view.lineBlockAt(line.from);
            drawn.push(new Bar(left - 2, top + (below ? block.bottom : block.top) - 4, 8, run.color, run.label, true));
            continue;
          }
          const start = doc.line(Math.max(1, Math.min(run.from, doc.lines)));
          const end = doc.line(Math.max(1, Math.min(run.to, doc.lines)));
          if (end.to < shownFrom || start.from > shownTo) continue;
          const first = view.lineBlockAt(start.from);
          const last = view.lineBlockAt(end.from);
          drawn.push(new Bar(left, top + first.top + 1, last.bottom - first.top - 2, run.color, run.label, false));
        }
      });
      return drawn;
    },
  });

  /** Marks the selected lines, or takes their marks away if they all have one. */
  function markLines(view: EditorView) {
    const write = language.lineMarks?.write;
    if (!write || view.state.readOnly) return false;
    const { state } = view;
    const written = writtenOn(state);
    // Lines with text, where a mark would follow it rather than change what the line is (a code fence, a table's row).
    const lines = selectedLines(state).filter((line) => written.has(line.from) || (line.text.trim() && !language.lineMarks?.skip?.(state, line.to)));
    if (!lines.length) return true;
    const unmark = lines.every((line) => written.has(line.from));
    const changes = lines.flatMap((line): ChangeSpec[] => {
      const at = written.get(line.from);
      if (unmark) return [{ from: at!, to: line.to }];
      return at !== undefined ? [] : [{ from: line.to, insert: ` ${write()}` }];
    });
    view.dispatch({ changes, userEvent: unmark ? "delete.mark" : "input.mark" });
    return true;
  }

  return [marks, hiding, bars, keymap.of([{ key: "Mod-Shift-m", run: markLines }])];
}
