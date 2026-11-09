import { syntaxTree } from "@codemirror/language";
import { Compartment, type EditorState, type Extension, Facet } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { plainLine } from "../notes/stats";
import { reducedMotion } from "../platform";
import type { Side } from "../prefs.svelte";
import { frontMatterField } from "./objects";
import OutlineRail from "./OutlineRail.svelte";

/*
 * The outline (Settings → Layout, off by default): a short line beside the note for each
 * of its headings, darker for the part being read. Pointing at them shows the headings by name;
 * choosing one glides there. A language's editor says where its headings are (`outlineHeadings`);
 * a note in a language that doesn't has no outline.
 */

export interface Heading {
  /** 1 for the largest. */
  level: number;
  title: string;
  /** Where in the note it starts. */
  from: number;
}

type ReadHeadings = (state: EditorState) => Heading[];

/** How a language finds a note's headings, given by its editor: `outlineHeadings.of(read)`. */
export const outlineHeadings = Facet.define<ReadHeadings, ReadHeadings | null>({ combine: (readers) => readers[0] ?? null });

/** Blocks with no headings inside, which aren't looked through. */
const NO_HEADINGS = new Set(["Paragraph", "FencedCode", "CodeBlock", "HTMLBlock", "Table", "LinkReference", "CommentBlock"]);

/** A Markdown note's `#` and underlined headings, after its properties, as far as it's parsed (the rest follows as it is). */
const markdownHeadings: ReadHeadings = (state) => {
  const { doc } = state;
  const front = state.field(frontMatterField, false);
  const after = front ? doc.line(front.lines).to : -1;
  const headings: Heading[] = [];
  syntaxTree(state).iterate({
    enter: ({ name, from }) => {
      if (NO_HEADINGS.has(name)) return false;
      const level = /^(?:ATX|Setext)Heading(\d)$/.exec(name)?.[1];
      if (!level) return;
      // Its first line, without `#`s at either end.
      const title = plainLine(doc.sliceString(from, doc.lineAt(from).to).replace(/^#+|\s#+\s*$/g, "")).trim();
      if (from > after && title) headings.push({ level: Number(level), title, from });
      return false;
    },
  });
  return headings;
};

export const markdownOutline = outlineHeadings.of(markdownHeadings);

/** What the outline shows (OutlineRail.svelte). */
export class OutlineState {
  headings = $state.raw<Heading[]>([]);
  /** The heading of the part being read: the last one near the top, or at the end the last in sight. -1 above the first. */
  current = $state(-1);
  /** Whether there's room for it beside the text, on each side. */
  room = $state<Record<Side, boolean>>({ left: false, right: false });
  /** The scroll bar's width, which it keeps clear of. */
  scrollBar = $state(0);
}

/**
 * Space beside the text the outline needs (on the left, clear of the grip that dragging a line
 * shows there too), and how far below the top a heading it goes to stops.
 */
const ROOM = 36;
const GRIP = 28;
const MARGIN = 8;
/** Where the part being read is, from the top. */
const READING_LINE = 96;
const GLIDE_MS = 360;
const SETTLE_MS = 300;
/** What scrolling by hand starts with, which stops a glide; caught on the way in, before the outline's own keys start one. */
const BY_HAND = ["wheel", "touchstart", "pointerdown", "keydown"];

class OutlineView {
  readonly outline = new OutlineState();
  readonly #component: Record<string, unknown>;
  #glide = 0;

  constructor(readonly view: EditorView) {
    this.#read(view.state);
    this.#component = mount(OutlineRail, { target: view.dom, props: { outline: this.outline, go: (index: number, focus: boolean) => this.go(index, focus) } });
    view.scrollDOM.addEventListener("scroll", this.measure, { passive: true });
    for (const type of BY_HAND) view.dom.addEventListener(type, this.stop, { capture: true, passive: true });
    this.measure();
  }

  update(update: ViewUpdate) {
    const { state, startState } = update;
    if (update.docChanged || syntaxTree(state) !== syntaxTree(startState) || state.facet(outlineHeadings) !== startState.facet(outlineHeadings)) {
      this.#read(state);
    }
    if (update.docChanged || update.geometryChanged || update.viewportChanged) this.measure();
  }

  #read(state: EditorState) {
    this.outline.headings = state.facet(outlineHeadings)?.(state) ?? [];
  }

  measure = () =>
    this.view.requestMeasure({
      key: this,
      read: (view) => {
        const scroller = view.scrollDOM;
        const box = scroller.getBoundingClientRect();
        const content = view.contentDOM;
        const text = content.getBoundingClientRect();
        const style = getComputedStyle(content);
        const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        const reading = view.lineBlockAtHeight((atEnd ? box.bottom - 1 : box.top + READING_LINE) - view.documentTop);
        return {
          room: {
            left: text.left + parseFloat(style.paddingLeft) - box.left >= ROOM + GRIP,
            right: box.left + scroller.clientWidth - (text.right - parseFloat(style.paddingRight)) >= ROOM,
          },
          current: this.outline.headings.filter((heading) => heading.from <= reading.to).length - 1,
          scrollBar: scroller.offsetWidth - scroller.clientWidth,
        };
      },
      write: (measured) => Object.assign(this.outline, measured),
    });

  /** Scrolls to a heading, gliding unless motion is reduced; from the keyboard, the cursor goes there too. */
  go(index: number, focus: boolean) {
    const heading = this.outline.headings[index];
    if (!heading) return;
    const { view } = this;
    const scroller = view.scrollDOM;
    this.stop();
    if (focus) {
      view.dispatch({ selection: { anchor: view.state.doc.lineAt(heading.from).to } });
      view.focus();
    }
    // Where the heading's line goes, read again each frame: lines far off are only estimated until they're drawn.
    const target = () => {
      const top = view.lineBlockAt(heading.from).top + view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop - MARGIN;
      return Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight));
    };
    const duration = reducedMotion.matches ? 0 : GLIDE_MS;
    const start = scroller.scrollTop;
    const began = performance.now();
    let last = NaN;
    let still = 0;
    const step = (now: number) => {
      const t = duration ? Math.min(1, (now - began) / duration) : 1;
      const to = target();
      scroller.scrollTop = start + (to - start) * (1 - (1 - t) ** 3);
      // Once there, a few frames more, until what was just drawn is measured and the heading stays put.
      still = t === 1 && Math.abs(to - last) < 1 ? still + 1 : 0;
      last = to;
      if (still < 2 && now - began < duration + SETTLE_MS) this.#glide = requestAnimationFrame(step);
    };
    this.#glide = requestAnimationFrame(step);
  }

  stop = () => cancelAnimationFrame(this.#glide);

  destroy() {
    this.stop();
    this.view.scrollDOM.removeEventListener("scroll", this.measure);
    for (const type of BY_HAND) this.view.dom.removeEventListener(type, this.stop, { capture: true });
    void unmount(this.#component);
  }
}

/** The outline, while Settings has it on (Editor.svelte). */
export const outlineCompartment = new Compartment();
export const outline: Extension = ViewPlugin.fromClass(OutlineView);
