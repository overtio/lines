import { type Extension, StateEffect } from "@codemirror/state";
import { EditorView, layer, RectangleMarker, ViewPlugin, WidgetType } from "@codemirror/view";
import { t } from "../i18n/index.svelte";
import { isPageBreak } from "../notes/pageBreak";
import { arrowsInto, drawnBlock, drawnBlocks, isEditing } from "./util";

/*
 * Page breaks (notes/pageBreak.ts), where a printed note or its PDF goes on to a new page. Over a
 * backdrop (Settings → Paper) they split the note's page in two, as Craft's do; otherwise they're a
 * dashed line, named.
 */

export class PageBreakWidget extends WidgetType {
  /** `preview`: drawn below its line while that's edited, rather than in its place. */
  constructor(readonly preview: boolean) {
    super();
  }
  eq(other: WidgetType) {
    return other instanceof PageBreakWidget && other.preview === this.preview;
  }
  toDOM() {
    const dom = document.createElement("div");
    dom.className = this.preview ? "cm-page-break is-preview" : "cm-page-break";
    dom.setAttribute("role", "separator");
    dom.setAttribute("aria-label", t("editor.pageBreak"));
    // The gap between pages, which the page layer leaves out.
    const gap = document.createElement("div");
    gap.className = "cm-page-break-gap";
    gap.setAttribute("aria-hidden", "true");
    gap.textContent = t("editor.pageBreak");
    dom.append(gap);
    return dom;
  }
  // A click puts the cursor on it, which shows what's written.
  ignoreEvent() {
    return false;
  }
}

/** A page break drawn at `from`–`to`, its line: below it while it's edited (`editing`), else in its place. */
export const pageBreakAt = (from: number, to: number, editing: boolean) => drawnBlock(new PageBreakWidget(editing), from, to, editing);

const backdropChanged = StateEffect.define<null>();

/** A backdrop chosen or taken away (paper.svelte.ts), which moves the page in CSS alone, unseen by the editor. */
const watchBackdrop = ViewPlugin.define((view) => {
  const observer = new MutationObserver(() => view.dispatch({ effects: backdropChanged.of(null) }));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-backdrop"] });
  return { destroy: () => observer.disconnect() };
});

/**
 * The note's page as a card for each stretch of it between page breaks, drawn here rather than by
 * editor.css alone (`cm-paged`) so it can have gaps; only over a backdrop.
 */
const pages = layer({
  above: false,
  class: "cm-page-layer",
  update: (update) =>
    update.docChanged || update.viewportChanged || update.geometryChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(backdropChanged))),
  markers(view) {
    // Only the main window's note pane has the backdrop, which the page is drawn over.
    if (!document.documentElement.hasAttribute("data-backdrop") || !view.dom.closest(".editor-pane")) return [];
    const scroller = view.scrollDOM.getBoundingClientRect();
    const content = view.contentDOM.getBoundingClientRect();
    const left = content.left - scroller.left + view.scrollDOM.scrollLeft;
    const at = (top: number) => top - scroller.top + view.scrollDOM.scrollTop;
    // From the note's top to its first page break, from each to the next, and from the last to the end.
    const edges = [at(content.top)];
    for (const gap of view.contentDOM.querySelectorAll(".cm-page-break-gap")) {
      const rect = gap.getBoundingClientRect();
      edges.push(at(rect.top), at(rect.bottom));
    }
    edges.push(at(content.bottom));
    const cards: RectangleMarker[] = [];
    for (let i = 0; i < edges.length; i += 2) {
      const place = [i === 0 && "is-first", i === edges.length - 2 && "is-last"].filter(Boolean).join(" ");
      cards.push(new RectangleMarker(`cm-page-card ${place}`.trim(), left, edges[i], content.width, edges[i + 1] - edges[i]));
    }
    return cards;
  },
});

/** A note's page drawn with its page breaks, for languages that have them. */
export const pagedNote: Extension = [EditorView.editorAttributes.of({ class: "cm-paged" }), pages, watchBackdrop];

/** A Markdown note's page breaks, at its top level: drawn in place of their line, or below it while it's edited. */
const markdownBreaks = drawnBlocks(
  (state, node) => {
    if (node.name !== "CommentBlock" && node.name !== "HTMLBlock") return null;
    const line = state.doc.lineAt(node.from);
    if (!isPageBreak(line.text)) return null;
    return pageBreakAt(line.from, line.to, isEditing(state, line.from, line.to));
  },
  { inside: ["Document"] },
);

export const markdownPageBreaks: Extension = [markdownBreaks, arrowsInto(markdownBreaks), pagedNote];
