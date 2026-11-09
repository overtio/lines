import { type EditorState, type Extension, Prec, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { t } from "../../lib/i18n/index.svelte";
import { TAG_NAME } from "../../lib/notes/tags";
import { plugins } from "../../lib/plugins/registry.svelte";
import Grid from "./Grid.svelte";
import { NoteSheet, sheets, sheetText } from "./state.svelte";

/*
 * A spreadsheet note in the editor: its title line as a heading, its tags drawn as tags, and in
 * place of its cells' CSV a grid to work in (Grid.svelte). The editor keeps the text, so undo,
 * sync and saving work as for any note.
 */

const grids = new WeakMap<HTMLElement, { grid: ReturnType<typeof mount>; sheet: NoteSheet; view: EditorView }>();

class GridWidget extends WidgetType {
  constructor(
    /** What works out formulas, so turning it on or off draws the grid again. */
    readonly formulas = plugins.formulas?.id,
  ) {
    super();
  }
  eq(other: GridWidget) {
    return other.formulas === this.formulas;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-sheet";
    const sheet = new NoteSheet(view, view.state);
    sheets.set(view, sheet);
    grids.set(dom, { grid: mount(Grid, { target: dom, props: { sheet, view } }), sheet, view });
    return dom;
  }
  destroy(dom: HTMLElement) {
    const mounted = grids.get(dom);
    if (!mounted) return;
    if (sheets.get(mounted.view) === mounted.sheet) sheets.delete(mounted.view);
    void unmount(mounted.grid);
  }
  get estimatedHeight() {
    return 480;
  }
  ignoreEvent() {
    return true;
  }
}

class Placeholder extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-sheet-placeholder";
    span.textContent = t("sheet.title");
    return span;
  }
}

const TAG = new RegExp(`(^|\\s)(#${TAG_NAME})`, "gu");
const titleLine = Decoration.line({ class: "cm-lp-h cm-lp-h1 cm-lp-title", attributes: { role: "heading", "aria-level": "1" } });
const tagMark = Decoration.mark({ class: "cm-lp-tag" });
const placeholder = Decoration.widget({ widget: new Placeholder(), side: 1 });

function build(state: EditorState): DecorationSet {
  const { doc } = state;
  const head = doc.line(1);
  const decos: Range<Decoration>[] = [titleLine.range(head.from)];
  if (!head.text.trim()) decos.push(placeholder.range(head.to));
  for (const match of head.text.matchAll(TAG)) {
    const from = head.from + match.index + match[1].length;
    decos.push(tagMark.range(from, from + match[2].length));
  }
  const grid = new GridWidget();
  decos.push(
    doc.lines > 1
      ? Decoration.replace({ widget: grid, block: true }).range(doc.line(2).from, doc.length)
      : Decoration.widget({ widget: grid, block: true, side: 1 }).range(doc.length),
  );
  return Decoration.set(decos, true);
}

const decorations = StateField.define<DecorationSet>({
  create: build,
  update: (decos, tr) => (tr.docChanged ? build(tr.state) : decos),
  provide: (field) => EditorView.decorations.from(field),
});

/** Keeps the grid showing the cells as they're written, read-only while the note is, and fitted to the editor. */
const follow = ViewPlugin.define(() => ({
  update(update: ViewUpdate) {
    const sheet = sheets.get(update.view);
    if (!sheet) return;
    if (update.docChanged || update.startState.readOnly !== update.state.readOnly) sheet.sync(update.state);
    if (update.geometryChanged) sheet.layout?.();
  },
}));

/** From the title into the grid. */
function intoGrid(view: EditorView) {
  const sheet = sheets.get(view);
  if (!sheet?.focus || view.state.selection.main.head > view.state.doc.line(1).to) return false;
  sheet.focus();
  return true;
}

/** ↓ on the title's last line (it can wrap) goes into the grid. */
function down(view: EditorView) {
  const range = view.state.selection.main;
  const below = view.moveVertically(range, true);
  return below.head === range.head || below.head > view.state.doc.line(1).to ? intoGrid(view) : false;
}

export const sheetEditing: Extension = [
  sheetText,
  decorations,
  follow,
  EditorView.editorAttributes.of({ class: "cm-sheet-note" }),
  Prec.high(
    keymap.of([
      { key: "Enter", run: intoGrid },
      { key: "Tab", run: intoGrid },
      { key: "ArrowDown", run: down },
    ]),
  ),
];
