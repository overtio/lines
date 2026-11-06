import { isolateHistory } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, Prec, type Range, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { githubLink, githubText } from "./github";
import { copyButton, destroyCopyButton } from "./keyValue";
import { followsLink } from "./links";
import { mathElement } from "./math";
import { isFormula } from "../sheets/cells";
import { showFormulas } from "../sheets/formulas";
import { plugins } from "../plugins/registry.svelte";
import { symbolsChanged } from "./symbols";
import { withSymbols } from "../notes/symbols";
import { prefs } from "../prefs.svelte";
import { t } from "../i18n/index.svelte";
import { ancestors, focusChanged, focused, hasText, isEditing } from "./util";

/*
 * GFM tables. Away from the cursor a table shows as a real table; click a cell (or move into the
 * table) and it turns back into its Markdown, kept neatly aligned as you Tab between cells. A cell
 * written as a formula (`=SUM(B2:B4)`, the header being row 1) shows what it works out to.
 */

type Align = "" | "left" | "center" | "right";

/** Where a table can be drawn and edited as one. */
const BLOCK_PARENTS = new Set(["Document", "Card"]);

/** The cells of one table line, as offsets into the line: everything between unescaped pipes. */
function splitRow(text: string): { from: number; to: number }[] {
  const cells = [];
  let start = /^\s*\|/.exec(text)?.[0].length ?? 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "|") {
      cells.push({ from: start, to: i });
      start = i + 1;
    }
  }
  if (text.slice(start).trim() || !cells.length) cells.push({ from: start, to: text.length });
  return cells;
}

function alignOf(delimiter: string): Align {
  const left = delimiter.startsWith(":");
  const right = delimiter.endsWith(":");
  return left && right ? "center" : left ? "left" : right ? "right" : "";
}

interface Grid {
  /** Trimmed cell text by line; line 1 is the delimiter row. */
  rows: string[][];
  aligns: Align[];
  columns: number;
}

function readGrid(lines: string[]): Grid {
  const rows = lines.map((line) => splitRow(line).map((c) => line.slice(c.from, c.to).trim()));
  const columns = Math.max(...rows.filter((_, i) => i !== 1).map((r) => r.length));
  const aligns = Array.from({ length: columns }, (_, i) => alignOf(rows[1]?.[i] ?? ""));
  return { rows, aligns, columns };
}

/** Lays the grid out as aligned Markdown, and says where each cell's text starts. */
function writeGrid({ rows, aligns, columns }: Grid) {
  const widths = aligns.map((_, col) =>
    Math.max(3, ...rows.filter((_, i) => i !== 1).map((r) => (r[col] ?? "").length)),
  );
  const starts: number[][] = [];
  let offset = 0;
  const lines = rows.map((row, i) => {
    const lineStarts: number[] = [];
    let line = "|";
    for (let col = 0; col < columns; col++) {
      const width = widths[col];
      let cell: string;
      if (i === 1) {
        const align = aligns[col];
        const inner = "-".repeat(width - (align === "center" ? 2 : align ? 1 : 0));
        cell = align === "center" ? `:${inner}:` : align === "left" ? `:${inner}` : align === "right" ? `${inner}:` : inner;
      } else {
        const text = row[col] ?? "";
        const space = width - text.length;
        const before = aligns[col] === "right" ? space : aligns[col] === "center" ? Math.floor(space / 2) : 0;
        cell = " ".repeat(before) + text + " ".repeat(space - before);
        lineStarts.push(offset + line.length + 1 + before);
      }
      line += ` ${cell} |`;
    }
    starts.push(lineStarts);
    offset += line.length + 1;
    return line;
  });
  return { text: lines.join("\n"), starts };
}

/** The table at `pos`, if any, at the top level or in a card. Tables in quotes and lists stay plain Markdown. */
function tableAt(state: EditorState, pos: number): SyntaxNode | null {
  const tree = syntaxTree(state);
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = tree.resolveInner(pos, side); node; node = node.parent) {
      if (node.name === "Table") return node.parent && BLOCK_PARENTS.has(node.parent.name) ? node : null;
    }
  }
  return null;
}

/** Which line of the table, which column, and how far into the cell's text the cursor is. */
function cellAt(state: EditorState, table: SyntaxNode, pos: number) {
  const line = state.doc.lineAt(pos);
  const x = pos - line.from;
  const cells = splitRow(line.text);
  let col = cells.findIndex((c) => x <= c.to);
  if (col < 0) col = cells.length - 1;
  const raw = line.text.slice(cells[col].from, cells[col].to);
  const lead = raw.length - raw.trimStart().length;
  return {
    row: line.number - state.doc.lineAt(table.from).number,
    col,
    offset: Math.max(0, x - cells[col].from - lead),
  };
}

/** Rewrites the table from `grid`, putting the cursor in a cell (`offset` past its end means at the end). */
function rewrite(view: EditorView, table: SyntaxNode, grid: Grid, row: number, col: number, offset = Infinity) {
  const { text, starts } = writeGrid(grid);
  const textLength = (grid.rows[row]?.[col] ?? "").length;
  const anchor = table.from + starts[row][col] + Math.min(offset, textLength);
  view.dispatch({
    changes: { from: table.from, to: table.to, insert: text },
    selection: { anchor },
    scrollIntoView: true,
    userEvent: "input.table",
  });
}

function tableCommand(run: (view: EditorView, table: SyntaxNode, grid: Grid, at: ReturnType<typeof cellAt>) => boolean) {
  return (view: EditorView) => {
    const { state } = view;
    const { head } = state.selection.main;
    if (state.readOnly || state.selection.ranges.length > 1) return false;
    const table = tableAt(state, head);
    if (!table) return false;
    const grid = readGrid(state.sliceDoc(table.from, table.to).split("\n"));
    return run(view, table, grid, cellAt(state, table, head));
  };
}

const emptyRow = (grid: Grid) => Array<string>(grid.columns).fill("");

/** Tab and Shift-Tab: tidy the table and go to the next (or previous) cell, adding a row at the end. */
function moveCell(dir: 1 | -1) {
  return tableCommand((view, table, grid, at) => {
    const last = grid.rows.length - 1;
    let { row, col } = at;
    if (row === 1) [row, col] = dir > 0 ? [2, -1] : [0, grid.columns];
    col += dir;
    if (col >= grid.columns) [row, col] = [row === 0 ? 2 : row + 1, 0];
    if (col < 0) [row, col] = row <= 0 ? [0, 0] : [row === 2 ? 0 : row - 1, grid.columns - 1];
    if (row > last) grid.rows.push(emptyRow(grid));
    rewrite(view, table, grid, row, col);
    return true;
  });
}

/** Enter: start a new row below. On an empty last row, leave the table instead. */
const newRow = tableCommand((view, table, grid, at) => {
  const { doc } = view.state;
  const row = Math.max(at.row, 1);
  const isLast = row === grid.rows.length - 1;
  if (row > 1 && isLast && grid.rows[row].every((c) => !c)) {
    // A line right under a table joins it, so leave a blank line between.
    const line = doc.lineAt(table.to);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "\n" },
      selection: { anchor: line.from + 1 },
      scrollIntoView: true,
      userEvent: "input",
    });
    return true;
  }
  grid.rows.splice(row + 1, 0, emptyRow(grid));
  rewrite(view, table, grid, row + 1, 0);
  return true;
});

export const tableKeymap = Prec.high(
  keymap.of([
    { key: "Tab", run: moveCell(1), shift: moveCell(-1) },
    { key: "Enter", run: newRow },
  ]),
);

/** The `/table` command: an empty two-column table, with the cursor in its first cell. */
export function insertTable(view: EditorView, from: number, to: number) {
  const { doc } = view.state;
  const line = doc.lineAt(from);
  const rest = (line.text.slice(0, from - line.from) + line.text.slice(to - line.from)).trim();
  const { text, starts } = writeGrid({ rows: [["", ""], [], ["", ""]], aligns: ["", ""], columns: 2 });
  // Text right above a table would become its header, and text right below one of its rows.
  const after = hasText(doc, line.number + 1) ? "\n" : "";
  let changes;
  let start: number;
  if (rest) {
    changes = [{ from, to }, { from: line.to, insert: "\n\n" + text + after }];
    start = line.to - (to - from) + 2;
  } else {
    const before = hasText(doc, line.number - 1) ? "\n" : "";
    changes = { from: line.from, to: line.to, insert: before + text + after };
    start = line.from + before.length;
  }
  view.dispatch({ changes, selection: { anchor: start + starts[0][0] }, scrollIntoView: true, userEvent: "input" });
}

// Pasting tables

/** Splits tab-separated text (spreadsheets, pgAdmin, database tools) into rows of cells. A cell in
 * double quotes may hold tabs, line breaks and `""` for a quote, as Excel and pgAdmin write them. */
export function parseTabbed(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let fresh = true;
  text = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') cell += text[++i];
      else quoted = false;
    } else if (ch === '"' && fresh) {
      quoted = true;
      fresh = false;
    } else if (ch === "\t" || ch === "\n") {
      row.push(cell);
      cell = "";
      fresh = true;
      if (ch === "\n") {
        rows.push(row);
        row = [];
      }
    } else {
      cell += ch;
      fresh = false;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/** Rows of a lone `<table>` in copied HTML, as from a web page; null if there's more than a table. */
export function htmlTable(html: string): string[][] | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = doc.querySelectorAll("table");
  if (tables.length !== 1) return null;
  const table = tables[0];
  const rest = (doc.body.textContent ?? "").replace(table.textContent ?? "", "");
  if (rest.trim()) return null;
  return [...table.rows].map((tr) =>
    [...tr.cells].flatMap((td) => [td.textContent ?? "", ...Array<string>(Math.max(0, td.colSpan - 1)).fill("")]),
  );
}

/** Whether `rows` look like a table rather than text that happens to contain tabs (like indented code). */
function looksTabular(rows: string[][]) {
  const columns = rows[0]?.length ?? 0;
  if (rows.length < 2 || columns < 2 || rows.some((row) => row.length !== columns)) return false;
  // A column with nothing in it is indentation, not data.
  return Array.from({ length: columns }, (_, col) => rows.some((row) => row[col].trim())).every(Boolean);
}

const NUMBER = /^[-+]?[\d.,]*\d%?$/;

/** Whether the column `col` of `body` is all numbers (formulas, too, like a total's), and so right-aligned. */
export const numericColumn = (body: string[][], col: number) => {
  const values = body.map((row) => row[col]).filter(Boolean);
  return values.some((v) => NUMBER.test(v)) && values.every((v) => NUMBER.test(v) || isFormula(v));
};

/** The pasted rows as an aligned Markdown table; numeric columns are right-aligned. */
function tableMarkdown(cells: string[][]) {
  const columns = Math.max(...cells.map((row) => row.length));
  const clean = cells.map((row) =>
    Array.from({ length: columns }, (_, col) => (row[col] ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")),
  );
  const [header, ...body] = clean;
  const aligns = Array.from({ length: columns }, (_, col): Align => (numericColumn(body, col) ? "right" : ""));
  return writeGrid({ rows: [header, [], ...body], aligns, columns }).text;
}

/** Code, and tables that are already being edited, where a paste stays as it is. */
const KEEP_PASTE = new Set(["FencedCode", "CodeBlock", "InlineCode", "Table", "HTMLBlock"]);

const inMarkdownCode = (state: EditorState, pos: number) => {
  for (const node of ancestors(state, pos, -1)) if (KEEP_PASTE.has(node.name)) return true;
  return false;
};

/**
 * Pasting rows copied from a spreadsheet, pgAdmin or a web page makes a table, as `write` writes
 * one (Markdown here, a tabular in LaTeX notes), unless `keep(state, pos)` says the paste stays as
 * it is there. The paste goes in as text first, so undo turns the table back into what was copied.
 */
export const tablePasting = (write: (rows: string[][]) => string, keep: (state: EditorState, pos: number) => boolean) =>
  EditorView.domEventHandlers({
    paste(event, view) {
      const { state } = view;
      const data = event.clipboardData;
      if (!data || state.readOnly || state.selection.ranges.length > 1) return false;
      const range = state.selection.main;
      if (keep(state, range.from)) return false;
      // As the editor stores it: pgAdmin and Windows apps copy \r\n line breaks.
      const plain = data.getData("text/plain").replace(/\r\n?/g, "\n");
      const html = data.getData("text/html");
      let rows = html.includes("<table") ? htmlTable(html) : null;
      if (!rows || rows.length < 2) {
        if (!plain.includes("\t")) return false;
        rows = parseTabbed(plain);
        if (!looksTabular(rows)) return false;
      }
      event.preventDefault();
      // First the paste as it was copied…
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: plain },
        selection: { anchor: range.from + plain.length },
        userEvent: "input.paste",
        scrollIntoView: true,
      });
      // …then, as its own undo step, the table in its place, on lines of its own.
      const { doc } = view.state;
      const from = range.from;
      const to = range.from + plain.length;
      const first = doc.lineAt(from);
      const last = doc.lineAt(to);
      const before = from > first.from ? "\n\n" : first.number > 1 && doc.line(first.number - 1).text.trim() ? "\n" : "";
      // A blank line between the table and any text after it (which would otherwise become a row).
      const next = last.number < doc.lines ? doc.line(last.number + 1) : null;
      const after = to < last.to ? "\n\n" : next && !next.text.trim() ? "" : "\n";
      const table = write(rows);
      view.dispatch({
        changes: { from, to, insert: before + table + after },
        // On the line below the table, so it shows as one.
        selection: { anchor: from + before.length + table.length + 1 },
        annotations: isolateHistory.of("before"),
        userEvent: "input.paste",
        scrollIntoView: true,
      });
      return true;
    },
  });

// Rendering

/** A cell's formatted text: plain strings, math, or styled spans around more of the same. */
type Inline = string | { tex: string; display: boolean } | { cls: string; href?: string; children: Inline[] };

const STYLES: Record<string, string> = {
  Emphasis: "cm-lp-em",
  StrongEmphasis: "cm-lp-strong",
  Strikethrough: "cm-lp-strike",
  Highlight: "cm-lp-highlight",
  Underline: "cm-lp-underline",
  InlineCode: "cm-lp-code",
  Tag: "cm-lp-tag",
};

const MARKS = new Set(["EmphasisMark", "StrikethroughMark", "HighlightMark", "UnderlineMark", "CodeMark", "LinkMark", "LinkTitle", "LinkLabel"]);

function inlines(doc: Text, parent: SyntaxNode, from: number, to: number): Inline[] {
  const out: Inline[] = [];
  let pos = from;
  for (let c = parent.firstChild; c; c = c.nextSibling) {
    if (c.to <= from || c.from >= to) continue;
    if (c.from > pos) out.push(doc.sliceString(pos, c.from));
    pos = c.to;
    if (MARKS.has(c.name)) continue;
    if (c.name === "Escape") out.push(doc.sliceString(c.from + 1, c.to));
    else if (c.name === "InlineMath") {
      const marks = c.getChildren("MathMark");
      if (marks.length === 2) out.push({ tex: doc.sliceString(marks[0].to, marks[1].from), display: marks[0].to - marks[0].from === 2 });
    }
    else if (c.name in STYLES) out.push({ cls: STYLES[c.name], children: inlines(doc, c, c.from, c.to) });
    else if (c.name === "Link" || c.name === "Image") {
      const url = c.getChild("URL");
      const marks = c.getChildren("LinkMark");
      const children = marks.length >= 2 ? inlines(doc, c, marks[0].to, marks[1].from) : [];
      const href = url ? doc.sliceString(url.from, url.to) : undefined;
      out.push(href ? { cls: "cm-lp-link", href, children } : { cls: "", children });
    } else if (c.name === "URL" || c.name === "Autolink") {
      const url = c.name === "URL" ? c : c.getChild("URL");
      const href = url ? doc.sliceString(url.from, url.to) : "";
      out.push(href ? { cls: "cm-lp-link", href, children: [href] } : "");
    } else out.push(...inlines(doc, c, c.from, c.to));
  }
  if (pos < to) out.push(doc.sliceString(pos, to));
  return out;
}

/** A cell's text as it reads, without formatting. */
function plainInline(content: Inline[]): string {
  return content.map((item) => (typeof item === "string" ? item : "tex" in item ? item.tex : plainInline(item.children))).join("");
}

/** `code`: inside a code span, which shows symbols (notes/symbols.ts) as Settings → Editing has it for code. */
function renderInline(parent: HTMLElement, content: Inline[], view: EditorView, code = false) {
  for (const item of content) {
    if (typeof item === "string") {
      parent.append((code ? prefs.symbolsInCode : prefs.symbolsInText) ? withSymbols(item) : item);
      continue;
    }
    if ("tex" in item) {
      parent.append(mathElement(item.tex, item.display, () => view.requestMeasure()));
      continue;
    }
    // A GitHub link reads short, or gets the mark in front of its own text (see github.ts).
    const github = item.href ? githubText(item.href) : null;
    const bare = item.children.length === 1 && item.children[0] === item.href;
    if (github && bare) {
      parent.append(githubLink(item.href!, github));
      continue;
    }
    if (github) parent.append(githubLink(item.href!, ""));
    const span = document.createElement("span");
    span.className = item.cls;
    if (item.href) span.dataset.href = item.href;
    renderInline(span, item.children, view, code || item.cls === "cm-lp-code");
    parent.append(span);
  }
}

interface TableModel {
  /** Cells by line of the source, without the delimiter row: as they read, and as written. */
  rows: { line: number; cells: Inline[][]; written: string[] }[];
  aligns: Align[];
  columns: number;
}

const copies = new WeakMap<HTMLElement, HTMLElement>();

class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    /** Parses the table; only called when it's drawn, since most rebuilds keep the same widget. */
    readonly parse: () => TableModel,
    /** How far in it sits, in cards. */
    readonly inset: CardInset,
    /** Which symbols it shows (Settings → Editing), so changing them draws it again. */
    readonly symbols = `${prefs.symbolsInText} ${prefs.symbolsInCode}`,
    /** What works out its formulas, so turning that on or off draws it again. */
    readonly formulas = plugins.formulas?.id,
  ) {
    super();
  }
  eq(other: TableWidget) {
    return (
      other.source === this.source && sameInset(other.inset, this.inset) && other.symbols === this.symbols && other.formulas === this.formulas
    );
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-lp-table-wrap";
    setInset(wrap, this.inset);
    const table = document.createElement("table");
    table.className = "cm-lp-table-grid";
    const model = this.parse();
    const [head, ...body] = model.rows;
    const elements: HTMLElement[][] = [];
    const section = (tag: "thead" | "tbody", rows: TableModel["rows"]) => {
      const el = document.createElement(tag);
      for (const row of rows) {
        const tr = document.createElement("tr");
        elements.push([]);
        for (let col = 0; col < model.columns; col++) {
          const cell = document.createElement(tag === "thead" ? "th" : "td");
          if (tag === "thead") cell.setAttribute("scope", "col");
          cell.dataset.line = String(row.line);
          cell.dataset.col = String(col);
          if (model.aligns[col]) cell.style.textAlign = model.aligns[col];
          if (model.aligns[col] === "right") cell.classList.add("is-right");
          cell.dataset.text = plainInline(row.cells[col] ?? []).trim();
          renderInline(cell, row.cells[col] ?? [], view);
          elements[elements.length - 1].push(cell);
          tr.append(cell);
        }
        el.append(tr);
      }
      table.append(el);
    };
    section("thead", [head]);
    if (body.length) section("tbody", body);
    wrap.append(table);
    const cells = model.rows.map((row) =>
      Array.from({ length: model.columns }, (_, col) => {
        const written = row.written[col] ?? "";
        return isFormula(written) ? written.replaceAll("\\|", "|") : plainInline(row.cells[col] ?? []).trim();
      }),
    );
    void showFormulas(cells, elements, { pending: "cm-lp-formula-pending", error: "cm-lp-formula-error" }).then(() => view.requestMeasure());
    // One copy button for the whole table, moved into whichever cell the pointer is over.
    let text = "";
    const copy = copyButton(() => text, t("editor.copyCell"), "cm-lp-copy cm-lp-cell-copy");
    wrap.addEventListener("mouseover", (event) => {
      const cell = (event.target as HTMLElement).closest<HTMLElement>("td, th");
      if (!cell || cell === copy.parentElement) return;
      text = cell.dataset.text ?? "";
      if (!text) return copy.remove();
      copy.setAttribute("aria-label", t("editor.copyValue", { value: text }));
      cell.append(copy);
    });
    wrap.addEventListener("mouseleave", () => copy.remove());
    copies.set(wrap, copy);
    return wrap;
  }
  destroy(dom: HTMLElement) {
    const copy = copies.get(dom);
    if (copy) destroyCopyButton(copy);
  }
  get estimatedHeight() {
    // Every line but the |---| one is a row.
    return (this.source.split("\n").length - 1) * 34 + 2;
  }
  ignoreEvent() {
    return false;
  }
}

function modelOf(state: EditorState, table: SyntaxNode): TableModel {
  const { doc } = state;
  const first = doc.lineAt(table.from).number;
  const lines = state.sliceDoc(table.from, table.to).split("\n");
  const grid = readGrid(lines);
  const rows: TableModel["rows"] = [];
  for (let row = table.firstChild; row; row = row.nextSibling) {
    if (row.name !== "TableHeader" && row.name !== "TableRow") continue;
    const line = doc.lineAt(row.from);
    const cellNodes = row.getChildren("TableCell");
    const spans = splitRow(line.text);
    const cells = spans.map(({ from, to }) => {
      const node = cellNodes.find((n) => n.from >= line.from + from && n.to <= line.from + to);
      return node ? inlines(doc, node, node.from, node.to) : [];
    });
    rows.push({ line: line.number - first, cells, written: spans.map(({ from, to }) => line.text.slice(from, to).trim()) });
  }
  return { rows, aligns: grid.aligns, columns: grid.columns };
}

function buildTables(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (BLOCK_PARENTS.has(node.name)) return;
      if (node.name !== "Table") return false;
      // Selecting across a table leaves it rendered; a cursor or selection in it shows the Markdown.
      if (!isEditing(state, node.from, node.to)) {
        const source = state.sliceDoc(node.from, node.to);
        const table = node.node;
        const widget = new TableWidget(source, () => modelOf(state, table), cardInset(state, table));
        decos.push(Decoration.replace({ widget, block: true }).range(node.from, node.to));
      }
      return false;
    },
  });
  return Decoration.set(decos);
}

const tableDecorations = StateField.define<DecorationSet>({
  create: buildTables,
  update(decos, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
      focusChanged(tr) ||
      tr.effects.some((effect) => effect.is(symbolsChanged)) ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state)
    ) {
      return buildTables(tr.state);
    }
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Clicking a rendered cell puts the cursor at the end of that cell's text. */
const clickToEdit = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement;
    const wrap = target.closest(".cm-lp-table-wrap");
    if (!wrap || followsLink(event, view)) return false;
    if (target.closest(".cm-lp-copy")) return true;
    const cell = target.closest<HTMLElement>("td, th");
    if (event.button !== 0 || view.state.readOnly || !cell) return true;
    const { doc } = view.state;
    const line = doc.line(doc.lineAt(view.posAtDOM(wrap)).number + Number(cell.dataset.line));
    const cells = splitRow(line.text);
    const { from, to } = cells[Math.min(Number(cell.dataset.col), cells.length - 1)];
    const raw = line.text.slice(from, to);
    const end = raw.trimEnd().length;
    const anchor = line.from + from + (end ? end : Math.min(1, raw.length));
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
    event.preventDefault();
    return true;
  },
});

export const tables: Extension = [
  focused,
  tableDecorations,
  clickToEdit,
  tableKeymap,
  Prec.high(tablePasting(tableMarkdown, inMarkdownCode)),
];
