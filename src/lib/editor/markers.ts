import { type ChangeSpec, type EditorState, type Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, layer, type LayerMarker, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { plugins } from "../plugins/registry.svelte";
import type { LineMarker, MarkerColor, NoteLanguage } from "../plugins/types";

/*
 * Marks in a note's margin, as a code editor marks the lines changed: the note's own, written at the
 * end of a line in its language's way (`<!-- mark green: to check -->` in Markdown), hidden but on
 * the line being edited; and those plugins add, each source in a lane of its own, further out.
 * Lines next to each other marked alike make one bar.
 */

/** Each color as the theme has it. */
export const MARKER_COLORS: Record<MarkerColor, string> = {
  accent: "var(--accent)",
  red: "var(--danger)",
  orange: "var(--callout-warning)",
  yellow: "var(--highlight-base)",
  green: "var(--success)",
  blue: "var(--callout-info)",
  purple: "var(--callout-question)",
  gray: "var(--text-faint)",
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Marks written as a comment at a line's end: `mark`, a color unless it's the accent, and what it
 * says, between `open` and `close` (`<!-- mark green: to check -->`). `notAfter` is a character the
 * comment can't follow (LaTeX's `\%` isn't one), and `skip` says where a line's end isn't text (code).
 */
export function commentMarks(open: string, close: string, { notAfter, skip }: { notAfter?: string; skip?: (state: EditorState, pos: number) => boolean } = {}): NoteLanguage["lineMarks"] {
  const names = Object.keys(MARKER_COLORS).join("|");
  const before = notAfter ? `(?<!${escape(notAfter)})` : "";
  // The line's last comment (none after it), whose label doesn't run past its end.
  const last = `(?!.*${escape(open)})`;
  const label = close ? `((?:(?!${escape(close)}).)*?)` : "(.*?)";
  const pattern = new RegExp(`\\s*${before}${escape(open)}${last}\\s*mark\\b(?:\\s+(${names}))?\\s*(?::\\s*${label})?\\s*${escape(close)}\\s*$`, "i");
  return {
    read(state, line) {
      const found = pattern.exec(line.text);
      if (!found) return null;
      const start = line.from + found.index + found[0].length - found[0].trimStart().length;
      if (skip?.(state, start)) return null;
      return { at: found.index, color: (found[1]?.toLowerCase() ?? "accent") as MarkerColor, label: found[2] || undefined };
    },
    write: (color, label) => [open, `mark${color && color !== "accent" ? ` ${color}` : ""}${label ? `: ${label}` : ""}`, close].filter(Boolean).join(" "),
  };
}

/** How far left of the text the first lane is, clear of the drag grip, and how far apart lanes are, in px. */
const OFFSET = 30;
const LANE = 6;

/** The note's text when it was opened, for plugins that compare with it. */
const opened = StateField.define<string>({ create: (state) => state.doc.toString(), update: (text) => text });

interface Marks {
  /** The note's own marks, then each plugin's. */
  lanes: LineMarker[][];
  /** Where each of the note's own marks is written, by line number: from there to the line's end. */
  written: Map<number, number>;
}

function marksOf(state: EditorState, language: NoteLanguage): Marks {
  const written = new Map<number, number>();
  const own: LineMarker[] = [];
  const read = language.lineMarks?.read;
  if (read) {
    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n);
      const mark = read(state, line);
      if (!mark) continue;
      written.set(n, line.from + mark.at);
      own.push({ from: n, color: mark.color, label: mark.label });
    }
  }
  const note = { text: state.doc.toString(), opened: state.field(opened), format: language.id };
  const theirs = plugins.markerSources.map((source) => {
    try {
      return source.markers(note);
    } catch (error) {
      console.error(`lines: the "${source.id}" markers couldn't be worked out`, error);
      return [];
    }
  });
  return { lanes: [own, ...theirs], written };
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
    bar.style.setProperty("--marker", MARKER_COLORS[this.color]);
    if (this.label) bar.title = this.label;
    else bar.removeAttribute("title");
  }
}

/** Marks in the margin, and Mark Lines, for notes in `language`. */
export function lineMarkers(language: NoteLanguage): Extension {
  const marks = StateField.define<Marks>({
    create: (state) => marksOf(state, language),
    update: (value, transaction) => (transaction.docChanged ? marksOf(transaction.state, language) : value),
  });

  const hidden = Decoration.replace({});
  /** The note's own marks, hidden but where the cursor is (or anywhere, while the note isn't being edited). */
  const hiding = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged) this.decorations = this.build(update.view);
      }
      build(view: EditorView) {
        const { written } = view.state.field(marks);
        const { doc } = view.state;
        const selection = view.hasFocus ? view.state.selection.ranges : [];
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = doc.lineAt(pos);
            const at = written.get(line.number);
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
    update: (update) => update.docChanged || update.viewportChanged || update.geometryChanged,
    markers(view) {
      const { lanes } = view.state.field(marks);
      const { doc } = view.state;
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
    const { written } = state.field(marks);
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
      for (let n = state.doc.lineAt(range.from).number; n <= state.doc.lineAt(range.to).number; n++) lines.add(n);
    }
    const unmark = [...lines].every((n) => written.has(n));
    const changes = [...lines].flatMap((n): ChangeSpec[] => {
      const line = state.doc.line(n);
      if (unmark) return [{ from: written.get(n)!, to: line.to }];
      return written.has(n) ? [] : [{ from: line.to, insert: (line.length ? " " : "") + write() }];
    });
    view.dispatch({ changes, userEvent: unmark ? "delete.mark" : "input.mark" });
    return true;
  }

  return [opened, marks, hiding, bars, keymap.of([{ key: "Mod-Shift-m", run: markLines }])];
}
