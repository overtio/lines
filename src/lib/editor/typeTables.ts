import type { EditorState, Extension } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import { keyOf, mentionKey, propertyOf, readTypeRef, type TypeRef, typeLabel, typeRefOf } from "../notes/properties";
import { notes } from "../notes/store.svelte";
import { typeIcons } from "../notes/tagIcons.svelte";
import { t } from "../i18n/index.svelte";
import { ui } from "../ui.svelte";
import { windowLabel } from "../windows/channel";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { iconOf, objectsChanged, openNote, valueText } from "./objects";
import { arrowsInto, drawnBlock, drawnBlocks, focused, isEditing } from "./util";

/*
 * Type tables: `@type.recipe` on a line of its own is drawn as a table of the notes of that type,
 * a row each, with a column for each of their properties, or the ones named after it:
 * `@type.recipe(time, servings)`. The header adds, removes and sorts columns; adding or removing
 * one rewrites the line. With the cursor on the line, it shows with the table below it.
 */

interface Column {
  /** The key as the line writes it. */
  key: string;
  /** The key as the notes write it, for the header. */
  label: string;
}

export interface TableData {
  /** The type as its notes write it (`recipe`), or as the line does if there are none yet. */
  type: string;
  icon: IconName;
  /** Columns named in the line, or null for all of them. */
  chosen: string[] | null;
  columns: Column[];
  /** The type's other keys, which the header's + offers. */
  others: Column[];
  rows: { id: string; title: string; icon: IconName; cells: string[] }[];
}

/** The notes of `ref`'s type, as a table: every key they have, most used first, unless the line names them. */
export function tableData(ref: TypeRef): TableData {
  const entries = notes.ofType(ref.type);
  const keys = new Map<string, { label: string; count: number }>();
  // Oldest note first, so keys used as often keep the order they were first written in, whatever's edited.
  for (const { meta } of [...entries].sort((a, b) => a.note.createdAt - b.note.createdAt)) {
    for (const property of meta.properties) {
      const key = keyOf(property.key);
      if (key === "type") continue;
      const found = keys.get(key);
      if (found) found.count++;
      else keys.set(key, { label: property.key, count: 1 });
    }
  }
  // Sorted by use; the order they were first written in breaks ties.
  const all = [...keys.values()]
    .map((key, order) => ({ ...key, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ label }) => ({ key: mentionKey(label), label }));
  const columns = ref.columns ? ref.columns.map((key) => ({ key, label: keys.get(keyOf(key))?.label ?? key })) : all;
  const shown = new Set(columns.map((column) => keyOf(column.key)));
  const type = entries[0]?.meta.type ?? ref.type;
  return {
    type,
    icon: typeIcons.get(type),
    chosen: ref.columns,
    columns,
    others: all.filter((column) => !shown.has(keyOf(column.key))),
    rows: entries
      .map((entry) => ({
        id: entry.note.id,
        title: entry.meta.title || t("editor.untitled"),
        icon: iconOf(entry),
        cells: columns.map((column) => {
          const property = propertyOf(entry.meta.properties, column.key);
          return property ? valueText(property.value) : "";
        }),
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}

/** Each table's sort, kept while it redraws: which column (-1 for the title) and which way. */
const sorts = new WeakMap<HTMLElement, { column: number; descending: boolean }>();
const icons = new WeakMap<HTMLElement, Record<string, unknown>[]>();

function icon(name: IconName, size = 14) {
  const span = document.createElement("span");
  span.className = "cm-lp-type-table-icon";
  return { span, mounted: mount(Icon, { target: span, props: { name, size, strokeWidth: 2 } }) };
}

function button(className: string, label: string, onClick: (event: MouseEvent) => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.setAttribute("aria-label", label);
  el.title = label;
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick(event);
  });
  return el;
}

/** Writes the line's type reference again, with these columns. */
function setColumns(view: EditorView, dom: HTMLElement, data: TableData, columns: string[] | null) {
  const line = view.state.doc.lineAt(view.posAtDOM(dom));
  const match = /@type\.[\p{L}\p{N}_][\p{L}\p{N}_-]*(?:\([^()\n]*\))?/iu.exec(line.text);
  if (!match) return;
  const from = line.from + match.index;
  view.dispatch({ changes: { from, to: from + match[0].length, insert: typeRefOf(data.type, columns) }, userEvent: "input" });
}

/** A new note of the type, with the table's columns as empty properties, opened to type its title. */
function newNote(data: TableData) {
  const keys = data.columns.map((column) => `${column.label}: `);
  const body = ["---", `type: ${data.type}`, ...keys, "---", "# "].join("\n");
  if (windowLabel().startsWith("note-")) return openNote(notes.add(body));
  notes.show(notes.create(body));
}

function render(dom: HTMLElement, data: TableData, view: EditorView) {
  // Drawing it again replaces its buttons; the one that had focus gets it back afterwards.
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement && dom.contains(active) ? active.dataset.focus : undefined;
  for (const mounted of icons.get(dom) ?? []) void unmount(mounted);
  const mounted: Record<string, unknown>[] = [];
  const editable = !view.state.readOnly;
  const sort = sorts.get(dom);
  const table = document.createElement("table");
  table.className = "cm-lp-table-grid";
  table.setAttribute("aria-label", t("editor.typeTable.label", { type: typeLabel(data.type) }));

  const head = document.createElement("tr");
  const sortBy = (column: number) => () => {
    const current = sorts.get(dom);
    // Ascending, then descending, then back to by title.
    if (current?.column !== column) sorts.set(dom, { column, descending: false });
    else if (!current.descending) sorts.set(dom, { column, descending: true });
    else sorts.delete(dom);
    render(dom, data, view);
  };
  const header = (text: string, column: number) => {
    const th = document.createElement("th");
    th.className = "is-sortable";
    th.scope = "col";
    // A button, so the sort can be reached and changed from the keyboard too; a click anywhere in
    // the header sorts.
    const label = document.createElement("button");
    label.type = "button";
    label.className = "cm-lp-type-table-sort";
    label.dataset.focus = `sort:${column}`;
    label.textContent = text;
    label.addEventListener("mousedown", (event) => event.preventDefault());
    th.append(label);
    // With no sort chosen, the rows are by title.
    const sorted = sort ? sort.column === column : column === -1;
    if (sorted) th.setAttribute("aria-sort", sort?.descending ? "descending" : "ascending");
    if (sort?.column === column) {
      th.classList.add("is-sorted");
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = sort.descending ? " ↓" : " ↑";
      th.append(arrow);
    }
    th.addEventListener("click", sortBy(column));
    return th;
  };
  const first = header(typeLabel(data.type), -1);
  const typeIcon = icon(data.icon);
  mounted.push(typeIcon.mounted);
  first.prepend(typeIcon.span);
  head.append(first);
  data.columns.forEach((column, i) => {
    const th = header(column.label, i);
    if (editable) {
      const rest = data.columns.filter((_, j) => j !== i).map((other) => other.key);
      const remove = button("cm-lp-type-table-remove", t("editor.typeTable.remove", { column: column.label }), () => setColumns(view, dom, data, rest));
      remove.dataset.focus = `remove:${i}`;
      th.append(remove);
    }
    head.append(th);
  });
  if (editable && data.others.length) {
    const th = document.createElement("th");
    th.className = "cm-lp-type-table-add";
    th.scope = "col";
    const addColumn = button("cm-lp-type-table-add-button", t("editor.typeTable.addColumn"), (event) => {
        const { left, bottom } = (event.currentTarget as HTMLElement).getBoundingClientRect();
        ui.openMenu({
          x: left,
          y: bottom + 4,
          items: data.others.map((other) => ({
            label: other.label,
            icon: "plus" as const,
            run: () => setColumns(view, dom, data, [...data.columns.map((column) => column.key), other.key]),
          })),
        });
      });
    addColumn.setAttribute("aria-haspopup", "menu");
    addColumn.dataset.focus = "add";
    const plus = icon("plus");
    mounted.push(plus.mounted);
    addColumn.append(plus.span);
    th.append(addColumn);
    head.append(th);
  }
  const thead = document.createElement("thead");
  thead.append(head);
  table.append(thead);

  const rows = [...data.rows];
  if (sort) {
    const value = (row: TableData["rows"][number]) => (sort.column < 0 ? row.title : row.cells[sort.column] ?? "");
    rows.sort((a, b) => {
      // Empty cells last, either way.
      const [x, y] = [value(a), value(b)];
      if (!x || !y) return Number(!x) - Number(!y);
      const order = x.localeCompare(y, undefined, { numeric: true });
      return sort.descending ? -order : order;
    });
  }
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    const chip = document.createElement("span");
    chip.className = "cm-lp-mention";
    chip.dataset.note = row.id;
    chip.title = t("editor.typeTable.open", { title: row.title });
    // A link to the note, which Enter follows too.
    chip.setAttribute("role", "link");
    chip.tabIndex = 0;
    chip.dataset.focus = `open:${row.id}`;
    chip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      openNote(row.id);
    });
    const rowIcon = icon(row.icon);
    mounted.push(rowIcon.mounted);
    rowIcon.span.className = "cm-lp-mention-icon";
    chip.append(rowIcon.span, row.title);
    chip.addEventListener("mousedown", (event) => event.preventDefault());
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      openNote(row.id);
    });
    name.append(chip);
    tr.append(name);
    for (const cell of row.cells) {
      const td = document.createElement("td");
      td.textContent = cell;
      // Short values ("25 min") stay on one line; long ones wrap.
      if (cell.length <= 24) td.classList.add("is-short");
      tr.append(td);
    }
    if (editable && data.others.length) tr.append(document.createElement("td"));
    tbody.append(tr);
  }
  if (rows.length) table.append(tbody);

  const footer = document.createElement("div");
  footer.className = "cm-lp-type-table-footer";
  if (!rows.length) {
    const empty = document.createElement("span");
    empty.textContent = t("editor.typeTable.empty", { type: data.type });
    footer.append(empty);
  }
  if (editable) {
    const label = t("editor.typeTable.new", { type: typeLabel(data.type) });
    const add = button("cm-lp-type-table-new", label, () => newNote(data));
    add.dataset.focus = "new";
    const plus = icon("plus");
    mounted.push(plus.mounted);
    add.append(plus.span, label);
    footer.append(add);
  }
  icons.set(dom, mounted);
  dom.replaceChildren(table, footer);
  if (focusKey) dom.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`)?.focus();
}

class TypeTableWidget extends WidgetType {
  readonly key: string;
  constructor(
    readonly data: TableData,
    readonly inset: CardInset,
    /** Drawn below its line while the cursor is on it, rather than in its place. */
    readonly preview: boolean,
  ) {
    super();
    this.key = JSON.stringify(data);
  }
  eq(other: TypeTableWidget) {
    return other.key === this.key && sameInset(other.inset, this.inset) && other.preview === this.preview;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-lp-table-wrap cm-lp-type-table" + (this.preview ? " is-preview" : "");
    setInset(dom, this.inset);
    render(dom, this.data, view);
    // A click anywhere but its buttons, chips and headers shows its line, with the cursor at its end.
    dom.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const target = event.target as HTMLElement;
      if (event.button !== 0 || view.state.readOnly || dom.classList.contains("is-preview")) return;
      if (target.closest("button, .cm-lp-mention, th")) return;
      view.dispatch({ selection: { anchor: view.state.doc.lineAt(view.posAtDOM(dom)).to }, scrollIntoView: true });
      view.focus();
    });
    return dom;
  }
  updateDOM(dom: HTMLElement, view: EditorView) {
    if (dom.classList.contains("is-preview") !== this.preview) return false;
    setInset(dom, this.inset);
    render(dom, this.data, view);
    return true;
  }
  destroy(dom: HTMLElement) {
    for (const mounted of icons.get(dom) ?? []) void unmount(mounted);
  }
  get estimatedHeight() {
    return 44 + this.data.rows.length * 34;
  }
  // It handles its own clicks (toDOM).
  ignoreEvent() {
    return true;
  }
}

function drawTable(state: EditorState, node: SyntaxNodeRef) {
  if (node.name !== "Mention") return null;
  const text = state.sliceDoc(node.from, node.to);
  const ref = readTypeRef(text);
  const line = state.doc.lineAt(node.from);
  // Only a reference on a line of its own.
  if (!ref || line.text.trim() !== text) return null;
  const editing = isEditing(state, line.from, line.to);
  return drawnBlock(new TypeTableWidget(tableData(ref), cardInset(state, node.node), editing), line.from, line.to, editing);
}

// Drawn at the top level, or in cards, from a paragraph.
const tables = drawnBlocks(drawTable, { inside: ["Document", "Card", "Paragraph"], also: (tr) => tr.effects.some((effect) => effect.is(objectsChanged)) });

export const typeTables: Extension = [focused, tables, arrowsInto(tables)];
