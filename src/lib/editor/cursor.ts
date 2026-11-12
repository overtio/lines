import { EditorSelection, StateEffect } from "@codemirror/state";
import { EditorView, layer, RectangleMarker, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/*
 * The text cursor, drawn by the editor instead of the browser. WebKit (the Mac and iPhone apps)
 * can leave a copy of its own caret behind, so that one is hidden. Selections stay native.
 * CodeMirror's base theme makes it blink and shows it only while the editor has focus.
 *
 * How it looks is Settings → Cursor's (cursors.svelte.ts), as the page's attributes: its shape (a
 * bar, a thick one, a block or an underline, measured here as wide as the character it's on), its
 * color, blink and glow (editor.css), and what it does moving and typing (below): a trail stretched
 * from where it was to where it is, as some terminals draw, or sparks.
 */

/** The page's attributes the cursor's look is in, which draw it again when they change. */
const LOOK = ["data-caret-shape", "data-caret-width", "data-caret-motion", "data-caret-effect"];
const lookChanged = StateEffect.define<null>();
const root = document.documentElement.dataset;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** How far past hidden markup (`**`, a link's address) to look for the character drawn next. */
const HIDDEN_REACH = 400;

/**
 * How wide the character drawn at `pos` is, for a block or underline over it: up to the next
 * position drawn further along, past markup that's hidden (none wide), as before the `**` of bold.
 * With none after it on its row (the end of a line), the one before it, in the same type: a
 * heading's cursor as wide as a heading's letter; after a space, as wide as a letter would be. On
 * an empty line too.
 */
function characterWidth(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  const here = pos < line.to && view.coordsAtPos(pos, 1);
  if (here) {
    for (let next = pos + 1; next <= Math.min(line.to, pos + HIDDEN_REACH); next++) {
      const at = view.coordsAtPos(next, -1);
      // Wrapped onto the next line: the character's the last of its row.
      if (!at || at.top !== here.top) break;
      if (at.left > here.left) return at.left - here.left;
    }
  }
  const end = view.coordsAtPos(pos, -1);
  if (end) {
    for (let before = pos - 1; before >= Math.max(line.from, pos - HIDDEN_REACH); before--) {
      const at = view.coordsAtPos(before, 1);
      if (!at || at.top !== end.top) break;
      if (at.left < end.left) {
        const width = end.left - at.left;
        return /\s/.test(view.state.doc.sliceString(before, before + 1)) ? Math.max(width, letterWidth(view, pos)) : width;
      }
    }
  }
  return letterWidth(view, pos);
}

const measure = document.createElement("canvas").getContext("2d");
const letters = new Map<string, number>();

/** How wide a letter (an `n`) is in the type at `pos`, as big as a heading's, on screen. */
function letterWidth(view: EditorView, pos: number) {
  const { node } = view.domAtPos(pos);
  const element = node instanceof Element ? node : node.parentElement;
  const fallback = view.defaultCharacterWidth;
  if (!element || !measure) return fallback;
  const style = getComputedStyle(element);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  let width = letters.get(font);
  if (width === undefined) {
    measure.font = font;
    width = measure.measureText("n").width;
    letters.set(font, width);
  }
  return width || fallback;
}

/** How thick an underline cursor is: thicker under bigger text, as an underline is. */
const underline = (height: number) => Math.max(2, Math.round(height / 14));

/** The primary cursor, in the shape chosen: CodeMirror's bar, or a box as wide as the character. */
function caret(view: EditorView, className: string) {
  const { main } = view.state.selection;
  if (!main.empty) return undefined;
  // At the end of a line, measure against the text before the cursor, not a button placed after
  // it (a code block's copy button sits in its corner, a value's copy button may be hidden).
  const assoc = main.head === view.state.doc.lineAt(main.head).to ? -1 : main.assoc;
  const [bar] = RectangleMarker.forRange(view, className, EditorSelection.cursor(main.head, assoc));
  if (!bar) return undefined;
  const shape = root.caretShape;
  if (shape !== "block" && shape !== "underline") return bar;
  const width = root.caretWidth === "even" ? letterWidth(view, main.head) : characterWidth(view, main.head);
  if (shape === "block") return new RectangleMarker(className, bar.left, bar.top, width, bar.height);
  const thick = underline(bar.height);
  return new RectangleMarker(className, bar.left, bar.top + bar.height - thick, width, thick);
}

const cursorLayer = layer({
  above: true,
  class: "cm-cursorLayer",
  markers(view) {
    const marker = caret(view, "cm-cursor cm-cursor-primary");
    return marker ? [marker] : [];
  },
  update(update, dom) {
    // Restart the blink, so the cursor is solid while it moves.
    if (update.selectionSet) dom.style.animationName = dom.style.animationName === "cm-blink" ? "cm-blink2" : "cm-blink";
    return update.docChanged || update.selectionSet || update.geometryChanged || update.viewportChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(lookChanged)));
  },
});

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The four corners of a box, top left first, clockwise. */
const corners = (box: Box): [number, number][] => [
  [box.left, box.top],
  [box.right, box.top],
  [box.right, box.bottom],
  [box.left, box.bottom],
];

/** The convex hull of points (Andrew's monotone chain), each kept with what it came with. */
function hull<T extends { x: number; y: number }>(points: T[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: T, a: T, b: T) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: T[]) => {
    const out: T[] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

/** Moving the cursor stretches it from where it was to where it is, then it snaps back to its size. */
function trail(into: HTMLElement, from: Box, to: Box) {
  const points = hull([
    ...corners(from).map(([x, y], corner) => ({ x, y, corner, old: true })),
    ...corners(to).map(([x, y], corner) => ({ x, y, corner, old: false })),
  ]);
  if (points.length < 3) return;
  const left = Math.min(from.left, to.left);
  const top = Math.min(from.top, to.top);
  const target = corners(to);
  const polygon = (list: [number, number][]) => `polygon(${list.map(([x, y]) => `${x - left}px ${y - top}px`).join(", ")})`;
  const smear = document.createElement("div");
  smear.className = "cm-caret-trail";
  Object.assign(smear.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(from.right, to.right) - left}px`, height: `${Math.max(from.bottom, to.bottom) - top}px` });
  into.append(smear);
  smear
    .animate(
      [
        { clipPath: polygon(points.map((point) => [point.x, point.y])), opacity: 0.75 },
        { clipPath: polygon(points.map((point) => (point.old ? target[point.corner] : [point.x, point.y]))), opacity: 0.35 },
      ],
      { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    )
    .finished.then(() => smear.remove(), () => smear.remove());
}

/** A few sparks fly up from the cursor, at a key typed. */
function sparks(into: HTMLElement, at: Box) {
  if (into.childElementCount > 60) return;
  for (let i = 0; i < 5; i++) {
    const spark = document.createElement("div");
    spark.className = "cm-caret-spark";
    spark.style.left = `${(at.left + at.right) / 2}px`;
    spark.style.top = `${at.top + (at.bottom - at.top) * 0.55}px`;
    into.append(spark);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const distance = 12 + Math.random() * 24;
    spark
      .animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.2)`, opacity: 0 },
        ],
        { duration: 360 + Math.random() * 240, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      )
      .finished.then(() => spark.remove(), () => spark.remove());
  }
}

/** The trail and sparks, drawn over the text in a layer of their own; and the look's changes, told to the cursor. */
const effects = ViewPlugin.fromClass(
  class {
    readonly dom: HTMLElement;
    readonly #observer: MutationObserver;
    #last: Box | undefined;

    constructor(readonly view: EditorView) {
      this.dom = view.scrollDOM.appendChild(document.createElement("div"));
      this.dom.className = "cm-caretEffects";
      this.dom.setAttribute("aria-hidden", "true");
      this.#observer = new MutationObserver(() => view.dispatch({ effects: lookChanged.of(null) }));
      this.#observer.observe(document.documentElement, { attributes: true, attributeFilter: LOOK });
    }

    update(update: ViewUpdate) {
      const trails = root.caretMotion === "trail";
      const sparkles = root.caretEffect === "sparks";
      if ((!trails && !sparkles) || reducedMotion.matches || !update.view.hasFocus) {
        this.#last = undefined;
        return;
      }
      if (!update.selectionSet && !update.docChanged) return;
      const typed = update.transactions.some((tr) => tr.isUserEvent("input.type"));
      const moved = update.transactions.some((tr) => tr.isUserEvent("select") || tr.isUserEvent("input") || tr.isUserEvent("delete"));
      update.view.requestMeasure({
        key: this,
        // Where the cursor is drawn: this layer is at the same place in the scroller as the cursor's.
        read: (view): Box | undefined => {
          const marker = caret(view, "");
          if (!marker) return undefined;
          const left = marker.width === null ? marker.left - 1 : marker.left;
          return { left, top: marker.top, right: left + (marker.width ?? 2), bottom: marker.top + marker.height };
        },
        write: (box) => {
          if (!box) return;
          const last = this.#last;
          this.#last = box;
          if (trails && moved && last && Math.hypot(box.left - last.left, box.top - last.top) > 2) trail(this.dom, last, box);
          if (sparkles && typed) sparks(this.dom, box);
        },
      });
    }

    destroy() {
      this.#observer.disconnect();
      this.dom.remove();
    }
  },
);

/** Where the cursor is, for a mascot (lib/mascot/) to sit by, in the window's coordinates. */
export interface CaretPlace {
  x: number;
  top: number;
  bottom: number;
  /** Where the text on the cursor's line (as it wraps) ends, and on the three lines above it, nearest first. */
  lineEnd: number;
  above: { end: number; top: number }[];
  /** The text column's edges, and the part of the editor in view. */
  textLeft: number;
  textRight: number;
  left: number;
  right: number;
  viewTop: number;
  viewBottom: number;
}

/**
 * Says where the cursor is as it moves, or the note scrolls, while a mascot is out (`data-mascot`):
 * a window event, `lines:caret`, with its place, or none once the editor loses focus. An editor
 * without the keyboard (a note open beside, Settings' preview) says nothing.
 */
const report = ViewPlugin.define(
  (view) => {
    const send = (place: CaretPlace | null) => dispatchEvent(new CustomEvent("lines:caret", { detail: place }));
    const measure = () =>
      view.requestMeasure({
        key: report,
        read: (): CaretPlace | null | undefined => {
          if (!view.hasFocus) return undefined;
          const { main } = view.state.selection;
          if (!main.empty) return null;
          const at = view.coordsAtPos(main.head, main.assoc || 1) ?? view.coordsAtPos(main.head, -1);
          const end = view.coordsAtPos(view.moveToLineBoundary(main, true, true).head, -1);
          if (!at) return null;
          const above: CaretPlace["above"] = [];
          for (let from = main, n = 0; n < 3; n++) {
            const up = view.moveVertically(from, false);
            if (up.head === from.head) break;
            const end = view.coordsAtPos(view.moveToLineBoundary(up, true, true).head, -1);
            if (end) above.push({ end: end.right, top: end.top });
            from = up;
          }
          const content = view.contentDOM.getBoundingClientRect();
          const style = getComputedStyle(view.contentDOM);
          const shown = view.scrollDOM.getBoundingClientRect();
          return {
            x: at.left,
            top: at.top,
            bottom: at.bottom,
            lineEnd: Math.max(end?.right ?? at.left, at.left),
            above,
            textLeft: content.left + parseFloat(style.paddingLeft),
            textRight: content.right - parseFloat(style.paddingRight),
            left: shown.left,
            right: shown.right,
            viewTop: shown.top,
            viewBottom: shown.bottom,
          };
        },
        write: (place) => place !== undefined && send(place),
      });
    return {
      measure,
      update(update: ViewUpdate) {
        if (!("mascot" in root)) return;
        if (update.focusChanged && !update.view.hasFocus) send(null);
        else if (update.selectionSet || update.docChanged || update.geometryChanged || update.focusChanged) measure();
      },
    };
  },
  {
    eventObservers: {
      scroll() {
        if ("mascot" in root) this.measure();
      },
    },
  },
);

export const cursor = [
  cursorLayer,
  effects,
  report,
  EditorView.theme({
    ".cm-content, .cm-line": { caretColor: "transparent !important" },
    ".cm-cursorLayer": { animationDuration: "1.2s" },
  }),
];
