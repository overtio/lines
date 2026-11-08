<script module lang="ts">
  import type { Sheet } from "./state.svelte";

  /**
   * The cells last copied from a sheet, so pasting them into one keeps their formulas, moved as
   * copying moves them; and the sheet they were cut from, where pasting them moves them.
   */
  let copied: { text: string; inputs: string[][]; row: number; column: number; cut: Sheet | null } | null = null;
</script>

<script lang="ts">
  import { redo, undo } from "@codemirror/commands";
  import type { EditorView } from "@codemirror/view";
  import { tick, untrack } from "svelte";
  import { speak } from "../../lib/a11y";
  import { htmlTable, parseTabbed } from "../../lib/editor/tables";
  import { locale, type MessageKey, t } from "../../lib/i18n/index.svelte";
  import { copyText, isApple } from "../../lib/platform";
  import { floating } from "../../lib/components/ui/styles";
  import type { CellArea, CellValue, Cells, FormulaEngine, FormulaSheet } from "../../lib/plugins/types";
  import { prefs, type SheetStat } from "../../lib/prefs.svelte";
  import { areaBetween, cellName, columnName, isFormula, movedCells, shiftCells } from "../../lib/sheets/cells";
  import { cellShown as shownAs, dateNumber, moneyText, negativeText, readDate, readMoney, showMoney } from "../../lib/sheets/display";
  import { writeCsv } from "../../lib/sheets/csv";
  import { continueCells } from "../../lib/sheets/fill";
  import { loadedFormulas, loadFormulas, sheetName } from "../../lib/sheets/formulas";
  import { type MenuItem, ui } from "../../lib/ui.svelte";
  import Icon from "../../lib/icons/Icon.svelte";
  import { FormulaHelp, type Suggestion } from "./help.svelte";
  import { type Point, pointing as pointers, type Writer } from "./pointing.svelte";
  import { blockNameText, sheetLook, showCell, spokenCell } from "./sheet";
  import { ColumnWidths, textWidth } from "./widths";

  /*
   * A spreadsheet's cells, drawn as a grid in place of their CSV: a spreadsheet note's (editor.ts),
   * filling the editor, or a ```csv block's in a Markdown note (block.ts), as tall as its rows. Click
   * or move with the arrow keys to a cell; type to write in it, or press Return (F2) to change what's
   * there. Formulas show what they work out to, and their formula above the grid. Only the rows in
   * view are drawn, so long sheets scroll smoothly.
   *
   * One text field over the current cell takes the keyboard: hidden until something's written in
   * it, it's what copying, pasting and typing (accents and IMEs included) go through, as in other
   * spreadsheet apps on the web.
   *
   * Writing a formula, the functions starting with what's typed are suggested, and inside one its
   * arguments are shown. Where a reference can go, clicking or dragging over cells (or the arrow
   * keys) writes theirs, and the cells each reference points at are outlined in its own color.
   *
   * Dragging the selection's corner fills the cells it's dragged over, going on from the selection
   * as Excel and Numbers do (fill.ts); double-clicking it fills down as far as the column beside goes.
   * Held a moment, a cell (and the selection it's in) is picked up, and dragged moves elsewhere.
   *
   * A block is as big as its CSV says (3 × 3 while empty): writing keeps that, and the handle on its
   * corner makes it bigger or smaller, never taking out what's written. A note's grid goes on.
   */

  let { sheet, view }: { sheet: Sheet; view: EditorView } = $props();

  type Change = Point & { input: string };

  const MIN_WIDTH = 56;
  const DEFAULT_WIDTH = 96;
  const MAX_WIDTH = 320;
  /** The space either side of a cell's text and its border, and room for figures, which are wider lined up in columns. */
  const PADDING = 26;
  /** Between money's symbol at a cell's left edge and its amount, at the least. */
  const SYMBOL_GAP = 8;
  /** Rows drawn beyond those in view, so they're there before they scroll in. */
  const OVERSCAN = 6;
  /** Empty rows after the last one written in, in a note. */
  const MORE_ROWS = 20;
  /** An empty block's size. */
  const BLOCK_ROWS = 3;
  const BLOCK_COLUMNS = 3;
  /** How long a cell is held, in milliseconds, before dragging moves it rather than selecting. */
  const HOLD = 350;
  /** The rows a block shows before it scrolls. */
  const BLOCK_SHOWN = 15;
  const MAX_ROW = 1_048_575;
  const MAX_COLUMN = 16_383;

  let root = $state<HTMLElement>();
  let scroller = $state<HTMLElement>();
  /** The cells, below the column letters: where rows and columns are measured from. */
  let body = $state<HTMLElement>();
  let input = $state<HTMLTextAreaElement>();
  let height = $state(360);
  let viewHeight = $state(0);
  let viewWidth = $state(0);
  let scrollTop = $state(0);
  let rowHeight = $state(30);
  let font = $state("");

  let active = $state<Point>({ row: 0, column: 0 });
  /** The other corner of the selection, from `active`. */
  let corner = $state<Point>({ row: 0, column: 0 });
  /** Writing in the current cell: `quick` when started by typing, where the arrow keys go on to the next cell. */
  let editing = $state<{ quick: boolean } | null>(null);
  let draft = $state("");
  /** The column Tab started from across a row, so Return goes on to the start of the next, as in other spreadsheet apps. */
  let tabStart: number | null = null;
  /** Whether the last press was a mouse's, which selects as it drags; a finger's selects on lifting, so the grid can scroll. */
  let mouse = true;
  /** Whether the grid has the keyboard, or its menu is open. */
  let focused = $state(false);
  /** Dragging the selection's corner: the cells it reaches, whether going on and repeating are swapped (fill.ts), and where the pointer is in the grid's box. */
  let filling = $state<{ area: CellArea; other: boolean; x: number; y: number } | null>(null);
  /** Cells held a moment and picked up to move: those, and how far they've been dragged, `rows` down and `columns` across. */
  let moving = $state<{ area: CellArea; rows: number; columns: number } | null>(null);
  /** A block's corner being dragged: the size it makes it, and where the pointer is in the grid's box. */
  let resizing = $state<{ rows: number; columns: number; x: number; y: number } | null>(null);
  /** Writing a block's name, above it. */
  let naming = $state(false);
  const id = $props.id();

  // The formulas, worked out by the engine that's on once it has loaded.
  let engine = $state.raw<FormulaEngine | null>(loadedFormulas());
  let calc: FormulaSheet | undefined;
  if (!loadedFormulas()) {
    loadFormulas().then(
      (loaded) => (engine = loaded),
      (error: unknown) => console.error("lines: couldn't load the formula engine", error),
    );
  }

  /**
   * The cells worked out again whenever they, or the other sheets their formulas name, change: read
   * by what shows them, so it's derived rather than an effect that writes a counter (two grids doing
   * that in one flush left one of them never drawn again).
   */
  const revision = $derived.by(() => {
    const cells = sheet.cells;
    if (!engine) return 0;
    calc ??= engine.sheet(sheet.find);
    calc.update(cells);
    return {};
  });
  $effect(() => () => calc?.free());

  /** What a cell shows: what its formula works out to, or what's written in it. */
  function shown(row: number, column: number): CellValue {
    void revision;
    if (calc) return calc.value(row, column);
    const written = sheet.cells[row]?.[column] ?? "";
    return { text: written, kind: written ? "text" : "empty" };
  }

  /** What a cell shows, as text: dates and money as the settings say. */
  const shownText = (row: number, column: number) => showCell(shown(row, column).text);
  /** What a cell shows, read out. */
  const spokenText = (row: number, column: number) => spokenCell(shown(row, column).text);

  const written = (point: Point) => sheet.cells[point.row]?.[point.column] ?? "";

  // Writing a formula.
  /** Where the cursor is in what's being written. */
  let caret = $state(0);
  /** Cells pointed at for the formula, and where their reference is written in it, which pointing again replaces. */
  let pointing = $state<{ from: number; to: number; anchor: Point; corner: Point; elsewhere?: string } | null>(null);

  const formula = $derived(!!editing && draft.startsWith("="));
  /** What's suggested, previewed and hinted while it's written (help.svelte.ts). */
  const help = new FormulaHelp({ sheet: () => sheet, engine: () => engine, formula: () => (formula ? draft : null), caret: () => caret });
  $effect(() => () => help.free());
  /** Can the cells clicked or reached with the arrow keys be written into the formula? */
  const canPoint = $derived(formula && (!!pointing || !!help.completion?.reference));

  /** The references in the formula, each in a color of the theme's, outlined on the grid and in the bar above it. */
  const COLORS = ["var(--syn-function)", "var(--syn-string)", "var(--syn-number)", "var(--syn-keyword)", "var(--syn-type)"];
  const references = $derived(
    formula && engine ? engine.references(draft).map((reference, i) => ({ ...reference, color: COLORS[i % COLORS.length] })) : [],
  );
  const pieces = $derived.by(() => {
    const out: { text: string; color?: string }[] = [];
    let at = 0;
    for (const { from, to, color } of references) {
      out.push({ text: draft.slice(at, from) }, { text: draft.slice(from, to), color });
      at = to;
    }
    out.push({ text: draft.slice(at) });
    return out;
  });

  /** After typing or moving the cursor: what fits there now. */
  function follow(typed: boolean) {
    caret = input!.selectionStart;
    if (!typed) return;
    pointing = null;
    help.typed();
  }

  function choose(suggestion: Suggestion) {
    if (!input) return;
    input.setRangeText(suggestion.insert, suggestion.from, input.selectionStart, "end");
    draft = input.value;
    follow(true);
  }

  function referenceText(a: Point, b: Point) {
    const { top, left, bottom, right } = areaBetween(a, b);
    return top === bottom && left === right ? cellName(top, left) : `${cellName(top, left)}:${cellName(bottom, right)}`;
  }

  /** Writes the reference of the cells from `anchor` to `corner` at the cursor, or in place of the one pointed at before. */
  /** …or, `elsewhere`, those of the other grid in the note of that name. */
  function point(anchor: Point, corner: Point, elsewhere?: string) {
    if (!input) return;
    const text = (elsewhere ? `${sheetName(elsewhere)}!` : "") + referenceText(anchor, corner);
    const from = pointing?.from ?? input.selectionStart;
    input.setRangeText(text, from, pointing?.to ?? input.selectionEnd, "end");
    draft = input.value;
    caret = input.selectionStart;
    pointing = { from, to: from + text.length, anchor, corner, elsewhere };
    if (!elsewhere) reveal(corner);
  }

  // Writing a formula, other grids point at their cells for it (pointing.svelte.ts): in this note,
  // the note beside it, or another window.
  const self = Symbol();
  $effect(() => {
    if (!canPoint) return;
    const me: Writer = {
      view,
      grid: self,
      note: untrack(() => sheet.noteTitle()),
      point: (name, anchor, corner) => point(anchor, corner, name),
      done: (keep) => (keep ? commit() : cancel()),
      unmark: new Set(),
    };
    pointers.start(me);
    return () => pointers.stop(me);
  });

  /** The cells here a formula in another grid points at, outlined until it's done. */
  let pointedHere = $state<CellArea | null>(null);

  /**
   * A click (or drag) here while another grid writes a formula: these cells' reference, written
   * there. In the same note it names this grid by its name (if it has none, one it's given once
   * let go, so it doesn't move under the pointer); elsewhere, by its note's too.
   */
  function pointFromHere(cell: Point) {
    const to = pointers.writer;
    const name = to?.view === view ? sheet.nameHere?.() : sheet.nameElsewhere();
    if (!name) return;
    const mark = (a: Point, b: Point) => {
      if (to) to.point(name, a, b);
      else pointers.send(name, a, b);
      pointedHere = areaBetween(a, b);
    };
    (to ? to.unmark : pointers.remoteMarks).add(() => {
      pointedHere = null;
      sheet.keepName?.();
    });
    mark(cell, cell);
    whileDragging((over) => (to ? pointers.writer === to : pointers.remote !== null) && mark(cell, over), () => sheet.keepName?.());
  }

  /** The arrow keys while pointing: the cell next to the one pointed at (at first, the one being written in), or with ⇧ the range stretched. */
  function pointBy([rows, columns]: [number, number], extend: boolean) {
    const next = (p: Point) => ({ row: clamp(p.row + rows, MAX_ROW), column: clamp(p.column + columns, MAX_COLUMN) });
    if (!pointing || pointing.elsewhere) {
      const cell = next(active);
      point(cell, cell);
    } else if (extend) point(pointing.anchor, next(pointing.corner));
    else {
      const cell = next(pointing.anchor);
      point(cell, cell);
    }
  }

  /** How cells show what's in them, as Settings says. */
  const look = $derived(sheetLook());

  // Columns as wide as what's in them, within limits.
  const cellWidths = new ColumnWidths();
  const dataColumns = $derived(sheet.cells.reduce((most, row) => Math.max(most, row.length), 0));
  const dataWidths = $derived.by(() => {
    void revision;
    // Measured once the grid's in the page and its font known (fit, before it's first shown).
    if (!font) return Array<number>(dataColumns).fill(DEFAULT_WIDTH);
    const widest = cellWidths.measure(
      sheet.cells,
      (row, column) => {
        const cell = shownAs(shown(row, column).text, look);
        return textWidth(cell.symbol + cell.text + (cell.room ? ")" : ""), font) + (cell.symbol ? SYMBOL_GAP : 0) + PADDING;
      },
      calc && engine ? engine.references : null,
      [font, look, calc],
    );
    return widest.map((width) => (width ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.ceil(width))) : DEFAULT_WIDTH));
  });
  const widthOf = (column: number) => dataWidths[column] ?? DEFAULT_WIDTH;

  /** A block's size: its CSV's rows and columns (3 × 3 while it's empty). */
  const blockSize = $derived(
    sheet.cells.length ? { rows: sheet.cells.length, columns: Math.max(1, dataColumns) } : { rows: BLOCK_ROWS, columns: BLOCK_COLUMNS },
  );
  /** The last row: a block's has the note's text below it. */
  const maxRow = $derived(sheet.fills ? MAX_ROW : blockSize.rows - 1);
  /** How far the grid reaches while cells are filled or moved past its edge, or a block's corner dragged. */
  const reaching = $derived({
    row: Math.max(filling?.area.bottom ?? 0, moving ? moving.area.bottom + moving.rows : 0, resizing ? resizing.rows - 1 : 0),
    column: Math.max(filling?.area.right ?? 0, moving ? moving.area.right + moving.columns : 0, resizing ? resizing.columns - 1 : 0),
  });
  /** A note's grid: enough rows to fill it, and more past those written in. A block's: its own. */
  const rows = $derived(
    Math.max(
      sheet.fills ? Math.max(sheet.cells.length + MORE_ROWS, Math.ceil(viewHeight / rowHeight)) : blockSize.rows,
      active.row + 1,
      corner.row + 1,
      reaching.row + 1,
    ),
  );
  /** The column letters and row numbers show unless Settings turns them off: their height and width, else none. */
  const headings = $derived(prefs.sheetHeadings);
  const headHeight = $derived(headings ? rowHeight : 0);
  const numberWidth = $derived(headings ? Math.max(40, String(rows).length * 8 + 22) : 0);
  /** A cell of the first row or column, when Settings has them stand out as headers, as a table's do. */
  const isHeader = (row: number, column: number) => (prefs.sheetHeaderRow && row === 0) || (prefs.sheetHeaderColumn && column === 0);
  /**
   * The columns' widths. A note's: those written in and one more to write in, then empty ones as far
   * as the grid is wide, the last of them stretched to end at its edge. A block's: its own, the grid
   * as wide as they are. It scrolls sideways only once they don't fit.
   */
  const columnWidths = $derived.by(() => {
    const widths: number[] = [];
    let width = numberWidth;
    const add = () => (width += widths[widths.length] = widthOf(widths.length));
    const needed = Math.max(sheet.fills ? dataColumns + 1 : blockSize.columns, active.column + 1, corner.column + 1, reaching.column + 1);
    while (widths.length < needed) add();
    if (!sheet.fills) return widths;
    while (width + widthOf(widths.length) <= viewWidth) add();
    if (width < viewWidth) widths[widths.length - 1] += viewWidth - width;
    return widths;
  });
  const columns = $derived(columnWidths.length);
  /** Where each column starts, after the row numbers. */
  const offsets = $derived.by(() => {
    const starts = [0];
    for (let c = 0; c < columns; c++) starts.push(starts[c] + columnWidths[c]);
    return starts;
  });
  /** Whether the columns fit the grid's width, so it doesn't scroll sideways, even by the part of a pixel it's rounded to. */
  const fits = $derived(numberWidth + offsets[columns] <= viewWidth);
  $effect(() => {
    // Scrolled sideways while they didn't fit: back to the start.
    if (fits && scroller) scroller.scrollLeft = 0;
  });
  const columnList = $derived(Array.from({ length: columns }, (_, c) => c));
  const firstRow = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN));
  const lastRow = $derived(Math.min(rows, Math.ceil((scrollTop + viewHeight) / rowHeight) + OVERSCAN));
  const rowList = $derived(Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, i) => firstRow + i));

  const range = $derived(areaBetween(active, corner));
  const selected = (row: number, column: number) => row >= range.top && row <= range.bottom && column >= range.left && column <= range.right;
  const box = (top: number, left: number, bottom: number, right: number) => ({
    top: top * rowHeight,
    left: numberWidth + offsets[left],
    width: offsets[right + 1] - offsets[left],
    height: (bottom - top + 1) * rowHeight,
  });
  /** Which of the grid's edges a box over cells meets: above, before, below and after it. */
  const edgesOf = (top: number, left: number, bottom: number, right: number) => ({
    above: top <= 0,
    before: left <= 0,
    below: bottom >= rows - 1,
    after: right >= columns - 1,
  });

  /**
   * The rounding of a box over cells, `radius` for those of its corners that are the grid's own
   * rounded ones (all four without the column letters and row numbers, else the bottom right), so an
   * outline there follows the grid's corner rather than being cut off by it.
   */
  function corners({ above, before, below, after }: ReturnType<typeof edgesOf>, radius: string) {
    const top = above && !headings;
    const start = before && !headings;
    return [top && start, top && after, below && after, below && start].map((round) => (round ? radius : "0")).join(" ");
  }

  /**
   * Where cells' outline goes, as a style: 2px over their borders, one either side
   * (`-outline-offset-1`), but a pixel in where it meets the grid's edges, so the column letters, the
   * row numbers or the edge itself doesn't hide half of it, and rounded at the grid's corners.
   */
  function framed(top: number, left: number, bottom: number, right: number) {
    const area = box(top, left, bottom, right);
    const edges = edgesOf(top, left, bottom, right);
    const [above, before, below, after] = [edges.above, edges.before, edges.below, edges.after].map(Number);
    // The outline's outer edge on the grid's inner one: the grid's rounding less its border and the outline's pixel out.
    const radius = corners(edges, "calc(var(--radius-md) - 2px)");
    return `top: ${area.top + above}px; left: ${area.left + before}px; width: ${area.width - before - after}px; height: ${area.height - above - below}px; border-radius: ${radius}`;
  }
  const selection = $derived(box(range.top, range.left, range.bottom, range.right));
  const current = $derived(box(active.row, active.column, active.row, active.column));
  const currentFrame = $derived(framed(active.row, active.column, active.row, active.column));
  /**
   * The field written in, at the grid's edges: its outline drawn inside it there, and rounded at the
   * grid's corners where it's no bigger than its cell (its outline's outer edge on the grid's inner one).
   */
  const fieldEdges = $derived.by(() => {
    const edges = edgesOf(active.row, active.column, active.row, active.column);
    return { ...edges, below: edges.below && editLines === 1, after: edges.after && editWidth <= current.width };
  });
  const atEdge = $derived(Object.values(fieldEdges).some(Boolean));
  const many = $derived(range.bottom > range.top || range.right > range.left);
  /** The current cell and selection show while working in a block, and always in a note, where the grid is all there is. */
  const marked = $derived(sheet.fills || focused);

  /** Takes up the editor's text size, and fits a note's grid to the editor's height below the title. */
  function fit() {
    if (!root?.isConnected) return;
    const style = getComputedStyle(root);
    font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    rowHeight = Math.round(parseFloat(style.fontSize) * 2.1);
    if (scroller) {
      gridTop = scroller.offsetTop + scroller.clientTop;
      gridLeft = scroller.offsetLeft + scroller.clientLeft;
    }
    if (!sheet.fills) return;
    const outer = view.scrollDOM;
    const top = root.getBoundingClientRect().top - outer.getBoundingClientRect().top + outer.scrollTop;
    const bottom = parseFloat(getComputedStyle(view.contentDOM).paddingBottom) || 0;
    height = Math.max(8 * rowHeight, outer.clientHeight - top - bottom);
  }

  $effect(() => {
    sheet.focus = (from) => {
      // From the text above, to the first row; from below, to the last.
      if (from) go(from === "above" ? 0 : maxRow, active.column);
      focusInput();
      reveal(active);
    };
    sheet.layout = fit;
    // Once this update's done: it sets the grid's sizes, which an effect shouldn't.
    void tick().then(fit);
    return () => {
      sheet.focus = sheet.layout = undefined;
    };
  });

  // Not being written in, the text field holds what the current cell shows, selected: what typing
  // replaces, and what screen readers read.
  $effect(() => {
    if (editing || !input) return;
    input.value = spokenText(active.row, active.column) || " ";
    if (document.activeElement === input) input.select();
  });

  function focusInput() {
    input?.focus({ preventScroll: true });
    if (!editing) input?.select();
  }

  /** Scrolls the grid just enough to show a cell, below the column letters and right of the row numbers. */
  function reveal(point: Point) {
    if (!scroller) return;
    const top = point.row * rowHeight;
    const below = top + headHeight + rowHeight - scroller.clientHeight;
    if (scroller.scrollTop > top) scroller.scrollTop = top;
    else if (scroller.scrollTop < below) scroller.scrollTop = below;
    const left = offsets[point.column] ?? 0;
    const right = numberWidth + (offsets[point.column + 1] ?? left) - scroller.clientWidth;
    if (scroller.scrollLeft > left) scroller.scrollLeft = left;
    else if (scroller.scrollLeft < right) scroller.scrollLeft = right;
  }

  const clamp = (value: number, most: number) => Math.min(most, Math.max(0, value));

  /**
   * Moves to a cell, or with `extend` stretches the selection to it; with `grow`, to the row after a
   * block's last, which writing in adds (and along it, once there).
   */
  function go(row: number, column: number, extend = false, say = false, grow = false) {
    const past = !sheet.fills && (grow || active.row > maxRow) ? 1 : 0;
    const point = { row: clamp(row, maxRow + past), column: clamp(column, MAX_COLUMN) };
    corner = point;
    if (!extend) active = point;
    tabStart = null;
    reveal(point);
    if (say) speak(t("sheet.at", { cell: cellName(point.row, point.column), value: spokenText(point.row, point.column) || t("sheet.empty") }));
  }

  /** One cell across with Tab, remembering where that started. */
  function tab(back: boolean) {
    const start = tabStart ?? active.column;
    go(active.row, active.column + (back ? -1 : 1), false, true);
    tabStart = start;
  }

  /** Where moving with ⌘ and an arrow ends: the edge of what's written, along that row or column. */
  function edge(point: Point, key: string): Point {
    if (key === "ArrowUp") return { ...point, row: 0 };
    if (key === "ArrowLeft") return { ...point, column: 0 };
    if (key === "ArrowDown") return { ...point, row: Math.max(0, sheet.cells.length - 1) };
    return { ...point, column: Math.max(0, (sheet.cells[point.row]?.length ?? 1) - 1) };
  }

  const STEPS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

  /** The cells with `changes` made; undefined if they change nothing. */
  function changed(changes: Change[]): Cells | undefined {
    let cells: Cells | undefined;
    const copiedRows = new Set<number>();
    for (const { row, column, input: text } of changes) {
      if (written({ row, column }) === text) continue;
      cells ??= [...sheet.cells];
      while (cells.length <= row) cells.push([]);
      if (!copiedRows.has(row)) {
        cells[row] = [...cells[row]];
        copiedRows.add(row);
      }
      while (cells[row].length < column) cells[row].push("");
      cells[row][column] = text;
    }
    return cells;
  }

  function setCells(changes: Change[]) {
    const cells = sheet.readOnly ? undefined : changed(changes);
    if (cells) sheet.write(sized(cells));
  }

  /** A block's cells as big as it is at least, so writing in it keeps its size; a note's as they are. */
  function sized(cells: Cells): Cells {
    if (sheet.fills) return cells;
    const width = Math.max(blockSize.columns, ...cells.map((row) => row.length));
    return Array.from({ length: Math.max(blockSize.rows, cells.length) }, (_, r) => Array.from({ length: width }, (_, c) => cells[r]?.[c] ?? ""));
  }

  /** What's typed, as it's kept: a date as an ISO date, however it's written. */
  const typed = (text: string) => (isFormula(text) ? text : (readDate(text, locale) ?? text));

  function edit(quick: boolean, text = written(active)) {
    if (sheet.readOnly || !input) return;
    editing = { quick };
    draft = text;
    input.value = text;
    input.setSelectionRange(text.length, text.length);
    follow(true);
    focusInput();
    reveal(active);
  }

  /** Keeps what's written, and moves on by `rows` and `columns`. */
  function commit(rows = 0, columns = 0) {
    if (!editing || !input) return;
    const text = typed(input.value);
    editing = null;
    setCells([{ ...active, input: text }]);
    if (rows || columns) go(active.row + rows, active.column + columns, false, false, true);
  }

  function cancel() {
    editing = null;
  }

  function clear() {
    const changes: Change[] = [];
    for (let row = range.top; row <= Math.min(range.bottom, sheet.cells.length - 1); row++) {
      for (let column = range.left; column <= range.right; column++) if (written({ row, column })) changes.push({ row, column, input: "" });
    }
    setCells(changes);
  }

  /** A formula as it reads copied `rows` down and `columns` across. */
  const moved = (text: string, rows: number, columns: number) => (engine && isFormula(text) ? engine.move(text, rows, columns) : text);

  /** The selection's top row copied down it (`row`), or its first column across it. */
  function fill(axis: "row" | "column") {
    const changes: Change[] = [];
    for (let row = range.top; row <= range.bottom; row++) {
      for (let column = range.left; column <= range.right; column++) {
        if (axis === "row" ? row === range.top : column === range.left) continue;
        const source = axis === "row" ? { row: range.top, column } : { row, column: range.left };
        changes.push({ row, column, input: moved(written(source), row - source.row, column - source.column) });
      }
    }
    setCells(changes);
  }

  /** What's written filling the cells `from` out to `to`, going on from them along each column (or row). */
  function filled(from: CellArea, to: CellArea, other: boolean): Change[] {
    const down = to.top < from.top || to.bottom > from.bottom;
    const forward = down ? to.bottom > from.bottom : to.right > from.right;
    const [first, last] = down ? [from.top, from.bottom] : [from.left, from.right];
    const length = last - first + 1;
    const count = (down ? to.bottom - to.top : to.right - to.left) + 1 - length;
    const step = forward ? 1 : -1;
    const changes: Change[] = [];
    for (let line = down ? from.left : from.top; line <= (down ? from.right : from.bottom); line++) {
      // Along the fill, from the cell farthest back.
      const at = (k: number): Point => {
        const place = forward ? first + k : last - k;
        return down ? { row: place, column: line } : { row: line, column: place };
      };
      const cells = Array.from({ length }, (_, k) => written(at(k)));
      const inputs = continueCells(cells, count, {
        other,
        locale,
        moved: (text, steps) => (down ? moved(text, steps * step, 0) : moved(text, 0, steps * step)),
      });
      inputs.forEach((input, i) => changes.push({ ...at(length + i), input }));
    }
    return changes;
  }

  /** Fills the cells `from` out to `to`, and selects them all. */
  function fillTo(from: CellArea, to: CellArea, other = false) {
    const changes = filled(from, to, other);
    if (sheet.readOnly || !changes.length) return;
    setCells(changes);
    active = { row: to.top, column: to.left };
    corner = { row: to.bottom, column: to.right };
    speak(t("sheet.filled", { count: changes.length }));
  }

  /** The selection, out as far as `cell` along a row or column (the farther), as dragging its corner reaches. */
  function reach(from: CellArea, cell: Point): CellArea {
    const down = cell.row - from.bottom;
    const up = from.top - cell.row;
    const right = cell.column - from.right;
    const left = from.left - cell.column;
    const most = Math.max(down, up, right, left);
    if (most <= 0) return from;
    if (most === down) return { ...from, bottom: cell.row };
    if (most === up) return { ...from, top: cell.row };
    return most === right ? { ...from, right: cell.column } : { ...from, left: cell.column };
  }

  /** The cell at a point on the screen, or where one would be past the last row or column, as filling grows the grid. */
  function cellAtPoint(x: number, y: number): Point {
    const box = body!.getBoundingClientRect();
    const across = x - box.left - numberWidth;
    let column = 0;
    if (across >= offsets[columns]) column = columns + Math.floor((across - offsets[columns]) / DEFAULT_WIDTH);
    else while (column < columns - 1 && offsets[column + 1] <= across) column++;
    return { row: clamp(Math.floor((y - box.top) / rowHeight), MAX_ROW), column: clamp(column, MAX_COLUMN) };
  }

  /** ⌥ (Ctrl on Windows and Linux) while dragging the corner swaps going on and repeating, as in Excel. */
  const swapped = (event: PointerEvent | KeyboardEvent) => (isApple ? event.altKey : event.ctrlKey);

  /** When the corner was last pressed, to tell a double-click (or tap): pressing it keeps the keyboard in the grid, so there's no `dblclick`. */
  let pressed = 0;

  /** Dragging the selection's corner: shows what it reaches, and fills it on letting go; Esc stops. Double-clicked, it fills down alongside. */
  function dragFill(event: PointerEvent) {
    if (event.button !== 0 || !root) return;
    event.preventDefault();
    event.stopPropagation();
    commit();
    if (event.timeStamp - pressed < 500) {
      pressed = 0;
      return fillAlongside();
    }
    pressed = event.timeStamp;
    const from = { ...range };
    const start = { x: event.clientX, y: event.clientY };
    const stop = new AbortController();
    const options = { signal: stop.signal };
    window.addEventListener(
      "pointermove",
      (move) => {
        // Not until it's moved, so a click (or the first of a double-click) on the corner fills nothing.
        if (!filling && Math.hypot(move.clientX - start.x, move.clientY - start.y) < 4) return;
        pressed = 0;
        const cell = cellAtPoint(move.clientX, move.clientY);
        const area = reach(from, cell);
        const box = root!.getBoundingClientRect();
        filling = { area, other: swapped(move), x: move.clientX - box.left, y: move.clientY - box.top };
        // Scrolled to, as far as the grid has grown to take it.
        reveal({ row: Math.min(Math.max(cell.row, area.top), area.bottom), column: Math.min(Math.max(cell.column, area.left), area.right) });
      },
      options,
    );
    const key = (press: KeyboardEvent) => {
      if (!filling) return;
      if (press.key !== "Escape") filling = { ...filling, other: swapped(press) };
      else {
        press.preventDefault();
        press.stopPropagation();
        filling = null;
        stop.abort();
      }
    };
    window.addEventListener("keydown", key, { ...options, capture: true });
    window.addEventListener("keyup", key, { ...options, capture: true });
    window.addEventListener("pointercancel", () => ((filling = null), stop.abort()), options);
    window.addEventListener(
      "pointerup",
      (up) => {
        stop.abort();
        const area = filling?.area;
        filling = null;
        if (area) fillTo(from, area, swapped(up));
      },
      options,
    );
  }

  /** Down as far as the column beside the selection goes on, as double-clicking its corner does in Excel. */
  function fillAlongside() {
    const from = { ...range };
    const end = (column: number) => {
      let row = from.bottom;
      if (column < 0) return row;
      while (written({ row: row + 1, column })) row++;
      return row;
    };
    const bottom = Math.max(end(from.left - 1), end(from.right + 1));
    if (bottom > from.bottom) fillTo(from, { ...from, bottom });
  }

  /** The cells written at the start of the selection (its top rows, or first columns), to go on through the rest of it; null if it's all written. */
  function autofillFrom(axis: "row" | "column"): CellArea | null {
    const down = axis === "row";
    const [first, last] = down ? [range.top, range.bottom] : [range.left, range.right];
    const [across, end] = down ? [range.left, range.right] : [range.top, range.bottom];
    const blank = (k: number) => {
      for (let i = across; i <= end; i++) if (written(down ? { row: k, column: i } : { row: i, column: k })) return false;
      return true;
    };
    let to = first;
    while (to < last && !blank(to + 1)) to++;
    if (to === last || blank(first)) return null;
    return down ? { ...range, bottom: to } : { ...range, right: to };
  }

  /** What filling shows by the pointer, as Excel does: what goes in the farthest cell, in the current cell's column (or row). */
  const fillLabel = $derived.by(() => {
    if (!filling) return "";
    const { area } = filling;
    const down = area.top < range.top || area.bottom > range.bottom;
    const line = filled(range, area, filling.other).filter((change) => (down ? change.column === active.column : change.row === active.row));
    return line.at(-1)?.input ?? "";
  });

  // Moving cells: held a moment, the cell pressed (with the rest of the selection it's in) is picked up.

  /**
   * After a press on a cell: dragged at once, it selects as it goes; held still a moment, it picks
   * up the cells to move, or let go, it selects the one cell (one in the selection stays selected
   * until then, so it can be held). Esc puts what's picked up back.
   */
  function press(event: PointerEvent, cell: Point, inSelection: boolean) {
    const start = { x: event.clientX, y: event.clientY };
    let state: "pressed" | "selecting" | "moving" = "pressed";
    const stop = new AbortController();
    const options = { signal: stop.signal };
    const hold = window.setTimeout(() => {
      if (state !== "pressed" || sheet.readOnly) return;
      state = "moving";
      moving = { area: { ...range }, rows: 0, columns: 0 };
    }, HOLD);
    const end = () => {
      clearTimeout(hold);
      stop.abort();
    };
    window.addEventListener(
      "pointermove",
      (move) => {
        if (state === "pressed") {
          if (Math.hypot(move.clientX - start.x, move.clientY - start.y) < 4) return;
          clearTimeout(hold);
          state = "selecting";
          // Dragged from inside the selection, a new one starts there.
          if (inSelection) go(cell.row, cell.column);
        }
        if (state === "selecting") {
          const over = cellAt(document.elementFromPoint(move.clientX, move.clientY));
          if (over) go(over.row, over.column, true);
        } else if (moving) {
          const over = cellAtPoint(move.clientX, move.clientY);
          const { area } = moving;
          const rows = Math.min(Math.max(over.row - cell.row, -area.top), MAX_ROW - area.bottom);
          const columns = Math.min(Math.max(over.column - cell.column, -area.left), MAX_COLUMN - area.right);
          moving = { area, rows, columns };
          reveal({ row: cell.row + rows, column: cell.column + columns });
        }
      },
      options,
    );
    window.addEventListener(
      "pointerup",
      () => {
        end();
        if (state === "pressed" && inSelection) go(cell.row, cell.column);
        if (state === "moving") drop();
      },
      options,
    );
    window.addEventListener("pointercancel", () => ((moving = null), end()), options);
    window.addEventListener(
      "keydown",
      (key) => {
        if (key.key !== "Escape" || state !== "moving") return;
        key.preventDefault();
        key.stopPropagation();
        moving = null;
        end();
      },
      { ...options, capture: true },
    );
  }

  /** Puts the cells picked up where they've been dragged. */
  function drop() {
    const picked = moving;
    moving = null;
    if (picked && (picked.rows || picked.columns) && !sheet.readOnly) moveArea(sheet.cells, picked.area, picked.rows, picked.columns);
  }

  /** Moves the cells in `area` of `cells` over what's there, formulas pointing at them following, and selects them there. */
  function moveArea(cells: Cells, area: CellArea, rows: number, columns: number) {
    sheet.write(sized(engine ? engine.moveCells(cells, area, rows, columns) : movedCells(cells, area, rows, columns)));
    active = { row: area.top + rows, column: area.left + columns };
    corner = { row: area.bottom + rows, column: area.right + columns };
    speak(t("sheet.moved", { count: (area.bottom - area.top + 1) * (area.right - area.left + 1) }));
  }

  // A block's size, from the handle on its corner.

  /** Dragging a block's corner: the rows and columns it makes it, as far as the pointer reaches but never past what's written. Esc stops. */
  function dragSize(event: PointerEvent) {
    if (event.button !== 0 || !root || !body) return;
    event.preventDefault();
    event.stopPropagation();
    commit();
    // Never smaller than what's written.
    let least = { rows: 1, columns: 1 };
    sheet.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell) least = { rows: Math.max(least.rows, r + 1), columns: Math.max(least.columns, c + 1) };
      }),
    );
    const from = { ...blockSize, x: event.clientX, y: event.clientY };
    const edge = { x: numberWidth + offsets[from.columns], y: from.rows * rowHeight };
    const stop = new AbortController();
    const options = { signal: stop.signal };
    window.addEventListener(
      "pointermove",
      (move) => {
        // Where the grid's corner would be: as many columns and rows as are mostly left of and above it.
        const x = edge.x + move.clientX - from.x;
        let columns = 0;
        while (columns < columnWidths.length && numberWidth + offsets[columns] + columnWidths[columns] / 2 < x) columns++;
        if (columns === columnWidths.length) columns += Math.max(0, Math.round((x - numberWidth - offsets[columns]) / DEFAULT_WIDTH));
        const rows = Math.round((edge.y + move.clientY - from.y) / rowHeight);
        const box = root!.getBoundingClientRect();
        resizing = {
          rows: Math.min(Math.max(least.rows, rows), MAX_ROW + 1),
          columns: Math.min(Math.max(least.columns, columns), MAX_COLUMN + 1),
          x: move.clientX - box.left,
          y: move.clientY - box.top,
        };
      },
      options,
    );
    window.addEventListener(
      "pointerup",
      () => {
        stop.abort();
        const size = resizing;
        resizing = null;
        if (size) resize(size.rows, size.columns);
      },
      options,
    );
    window.addEventListener("pointercancel", () => ((resizing = null), stop.abort()), options);
    window.addEventListener(
      "keydown",
      (key) => {
        if (key.key !== "Escape") return;
        key.preventDefault();
        key.stopPropagation();
        resizing = null;
        stop.abort();
      },
      { ...options, capture: true },
    );
  }

  /** Makes a block `rows` by `columns`, the selection staying inside. */
  function resize(rows: number, columns: number) {
    if (sheet.readOnly || (rows === blockSize.rows && columns === blockSize.columns)) return;
    sheet.write(Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => sheet.cells[r]?.[c] ?? "")));
    const inside = (point: Point) => ({ row: Math.min(point.row, rows - 1), column: Math.min(point.column, columns - 1) });
    active = inside(active);
    corner = inside(corner);
    speak(t("sheet.size", { rows, columns }));
  }

  // Sorting, and money.

  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

  /** A number as a cell shows it (1,650.50, $1,200, 50%), or null: text, dates and the rest. With the engine on, text that looks like a number is text. */
  function numberAt(row: number, column: number): { value: number; currency?: string } | null {
    const { text, kind } = shown(row, column);
    if (kind !== "number" && (kind !== "text" || calc)) return null;
    if (dateNumber(text) !== null) return null;
    const money = readMoney(text, prefs.sheetCurrency);
    if (money) return { value: money.amount, currency: money.currency };
    const match = /^([-+]?)(\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?|\.\d+)(%?)$/i.exec(text.trim());
    if (!match) return null;
    const value = Number(match[2].replaceAll(",", "")) * (match[1] === "-" ? -1 : 1);
    return { value: match[3] ? value / 100 : value };
  }

  /** How a cell sorts: numbers and dates, then text, then TRUE and FALSE, then errors, empty cells always last. */
  function sortKey(row: number, column: number): { rank: number; value: number | string } {
    const { text, kind } = shown(row, column);
    if (kind === "empty") return { rank: 4, value: 0 };
    if (kind === "error") return { rank: 3, value: text };
    if (kind === "boolean") return { rank: 2, value: text };
    const number = dateNumber(text) ?? numberAt(row, column)?.value ?? null;
    return number === null ? { rank: 1, value: text } : { rank: 0, value: number };
  }

  /** Whether a sheet's first row (or column) is its header: highlighted as one, or reading as one, all text over cells with numbers or formulas. */
  function hasHeader(axis: "row" | "column") {
    if (axis === "row" ? prefs.sheetHeaderRow : prefs.sheetHeaderColumn) return true;
    const first = axis === "row" ? (sheet.cells[0] ?? []) : sheet.cells.map((row) => row[0] ?? "");
    if (!first.some(Boolean) || first.some((_, i) => (axis === "row" ? numberAt(0, i) : numberAt(i, 0)) !== null || isFormula(first[i]))) return false;
    return sheet.cells.some((row, r) =>
      row.some((input, c) => (axis === "row" ? r : c) > 0 && (isFormula(input) || numberAt(r, c) !== null || dateNumber(input) !== null)),
    );
  }

  /** What sorting sorts: the selected rows by the current cell's column, or, one row selected, its columns by that row; a header stays put. */
  function sortable(): { axis: "row" | "column"; from: number; to: number; by: number } | null {
    if (range.bottom > range.top) {
      const from = range.top === 0 && hasHeader("row") ? 1 : range.top;
      const to = Math.min(range.bottom, sheet.cells.length - 1);
      return to > from ? { axis: "row", from, to, by: active.column } : null;
    }
    if (range.right > range.left) {
      const from = range.left === 0 && hasHeader("column") ? 1 : range.left;
      const to = Math.min(range.right, dataColumns - 1);
      return to > from ? { axis: "column", from, to, by: active.row } : null;
    }
    return null;
  }

  /** Sorts the selection's rows (or columns), whole, formulas moving with them as copying moves them. */
  function sortBy(descending: boolean) {
    const area = sortable();
    if (!area || sheet.readOnly) return;
    const { axis, from, to, by } = area;
    const keyOf = (i: number) => (axis === "row" ? sortKey(i, by) : sortKey(by, i));
    const order = Array.from({ length: to - from + 1 }, (_, i) => from + i).sort((a, b) => {
      const [x, y] = [keyOf(a), keyOf(b)];
      if (x.rank !== y.rank) return x.rank === 4 || y.rank === 4 ? x.rank - y.rank : (x.rank - y.rank) * (descending ? -1 : 1);
      const compared = typeof x.value === "number" && typeof y.value === "number" ? x.value - y.value : collator.compare(String(x.value), String(y.value));
      return descending ? -compared : compared;
    });
    const width = Math.max(dataColumns, 1);
    const cells = sheet.cells.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? ""));
    order.forEach((source, i) => {
      const target = from + i;
      if (axis === "row") cells[target] = cells[target].map((_, c) => moved(written({ row: source, column: c }), target - source, 0));
      else for (const [r, row] of cells.entries()) row[target] = moved(written({ row: r, column: source }), 0, target - source);
    });
    sheet.write(sized(cells));
    speak(t("sheet.sorted"));
  }

  /** The selected numbers written as money in the chosen currency ($1200); if they're all money already, as plain numbers again. */
  function moneyChanges(): { changes: Change[]; remove: boolean } | null {
    const found: { row: number; column: number; amount: number; money: boolean }[] = [];
    for (let row = range.top; row <= Math.min(range.bottom, sheet.cells.length - 1); row++) {
      for (let column = range.left; column <= range.right; column++) {
        const text = written({ row, column });
        if (!text || isFormula(text)) continue;
        const money = readMoney(text, prefs.sheetCurrency);
        const plain = /^[-+]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text.replaceAll(",", "")) : null;
        if (money || plain !== null) found.push({ row, column, amount: money?.amount ?? plain!, money: !!money });
      }
    }
    if (!found.length) return null;
    const remove = found.every((cell) => cell.money);
    return { remove, changes: found.map(({ row, column, amount }) => ({ row, column, input: remove ? String(amount) : moneyText(amount, prefs.sheetCurrency) })) };
  }

  // The selected numbers' stats, as other spreadsheet apps show them below the grid.

  const STAT_NAMES: Record<SheetStat, MessageKey> = { sum: "sheet.sum", average: "sheet.average", min: "sheet.min", max: "sheet.max", count: "sheet.count" };
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });

  /** The selection's sum, average, smallest and largest number, and how many cells have something in them: those chosen in Settings. */
  const stats = $derived.by(() => {
    if (!prefs.sheetStats.length || !many || !marked || editing || moving || filling) return null;
    let count = 0;
    let numbers = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    const currencies = new Set<string | undefined>();
    for (let row = range.top; row <= Math.min(range.bottom, rows - 1); row++) {
      for (let column = range.left; column <= Math.min(range.right, columns - 1); column++) {
        if (shown(row, column).kind !== "empty") count++;
        const number = numberAt(row, column);
        if (!number) continue;
        numbers++;
        sum += number.value;
        min = Math.min(min, number.value);
        max = Math.max(max, number.value);
        currencies.add(number.currency);
      }
    }
    // All money in one currency: the sums are money too.
    const [currency] = currencies.size === 1 ? currencies : [undefined];
    const format = (n: number) =>
      currency ? showMoney(n, currency, { money: prefs.sheetMoney, negative: prefs.sheetNegative, locale }) : negativeText(numberFormat.format(n), prefs.sheetNegative);
    const values: Record<SheetStat, string | null> = {
      sum: numbers ? format(sum) : null,
      average: numbers ? format(sum / numbers) : null,
      min: numbers ? format(min) : null,
      max: numbers ? format(max) : null,
      count: count ? numberFormat.format(count) : null,
    };
    const shownStats = prefs.sheetStats.flatMap((stat) => (values[stat] === null ? [] : [{ name: t(STAT_NAMES[stat]), value: values[stat]! }]));
    return shownStats.length ? shownStats : null;
  });

  // A block's name, above it.

  let nameInput = $state<HTMLInputElement>();

  async function startNaming() {
    naming = true;
    await tick();
    nameInput?.focus();
    nameInput?.select();
  }

  /**
   * Keeps the name written (none, if it's empty), or with `save` false leaves it as it was, and back
   * to the grid unless something else took the keyboard. Names leave out what formulas write sheets' names with.
   */
  function endNaming(save: boolean, back = true) {
    if (!naming) return;
    naming = false;
    if (save && nameInput) sheet.rename?.(blockNameText(nameInput.value));
    if (back) focusInput();
  }

  /** Puts in (or, negative, takes out) rows or columns, formulas still pointing at the same cells. */
  function shift(axis: "row" | "column", at: number, count: number) {
    if (sheet.readOnly) return;
    const cells = sized(sheet.cells);
    sheet.write(engine ? engine.shift(cells, axis, at, count) : shiftCells(cells, axis, at, count));
    if (count < 0) go(range.top, range.left);
    const n = Math.abs(count);
    speak(
      axis === "row"
        ? t(count > 0 ? "sheet.rowsInserted" : "sheet.rowsDeleted", { count: n })
        : t(count > 0 ? "sheet.columnsInserted" : "sheet.columnsDeleted", { count: n }),
    );
  }

  /** The selection as tab-separated values, as other spreadsheet apps paste them, and as written; `cut`, to be moved by pasting here. */
  function copySelection(cut = false) {
    const inputs: Cells = [];
    const values: Cells = [];
    for (let row = range.top; row <= range.bottom; row++) {
      inputs.push([]);
      values.push([]);
      for (let column = range.left; column <= range.right; column++) {
        inputs[inputs.length - 1].push(written({ row, column }));
        values[values.length - 1].push(shownText(row, column));
      }
    }
    const text = writeCsv(values, "\t");
    copied = { text, inputs, row: range.top, column: range.left, cut: cut ? sheet : null };
    return text;
  }

  function oncopy(event: ClipboardEvent) {
    if (editing) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", copySelection());
  }

  function oncut(event: ClipboardEvent) {
    if (editing) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", copySelection(true));
    clear();
  }

  function onpaste(event: ClipboardEvent) {
    if (editing || !event.clipboardData) return;
    event.preventDefault();
    if (sheet.readOnly) return;
    const plain = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    const html = event.clipboardData.getData("text/html");
    if (copied && plain === copied.text) {
      if (!(copied.cut === sheet && pasteCut(copied))) paste(copied.inputs, copied);
    } else paste((html.includes("<table") ? htmlTable(html) : null) ?? parseTabbed(plain), null);
  }

  /**
   * Cells cut from here and pasted here: moved, as dragging them does, so formulas pointing at them
   * follow, as cutting and pasting does in other spreadsheet apps. Pasted again, they're copies.
   * False if something's been written where they were since.
   */
  function pasteCut(cut: NonNullable<typeof copied>) {
    const area = { top: cut.row, left: cut.column, bottom: cut.row + cut.inputs.length - 1, right: cut.column + (cut.inputs[0]?.length ?? 1) - 1 };
    for (let row = area.top; row <= area.bottom; row++) for (let column = area.left; column <= area.right; column++) if (written({ row, column })) return false;
    cut.cut = null;
    // Back where they were, then moved.
    const back = changed(cut.inputs.flatMap((line, r) => line.map((input, c) => ({ row: area.top + r, column: area.left + c, input }))));
    moveArea(back ?? sheet.cells, area, active.row - area.top, active.column - area.left);
    return true;
  }

  /** Pastes rows of cells at the current cell; one cell pasted over a selection fills it. Copied from a sheet (`from`), formulas move. */
  function paste(cells: Cells, from: Point | null) {
    const width = cells.reduce((most, row) => Math.max(most, row.length), 0);
    if (!cells.length || !width) return;
    const one = cells.length === 1 && width === 1;
    const area = one ? range : { top: active.row, left: active.column, bottom: active.row + cells.length - 1, right: active.column + width - 1 };
    const changes: Change[] = [];
    for (let row = area.top; row <= area.bottom; row++) {
      for (let column = area.left; column <= area.right; column++) {
        const [r, c] = one ? [0, 0] : [row - area.top, column - area.left];
        const text = cells[r]?.[c] ?? "";
        changes.push({ row, column, input: from ? moved(text, row - from.row - r, column - from.column - c) : typed(text) });
      }
    }
    setCells(changes);
    active = { row: area.top, column: area.left };
    corner = { row: area.bottom, column: area.right };
  }

  /** Into the note's text, above the grid (a note's title) or below it. */
  function leave(up: boolean) {
    commit();
    sheet.leave(up);
  }

  function openMenu(x: number, y: number) {
    const rowCount = range.bottom - range.top + 1;
    const columnCount = range.right - range.left + 1;
    const items: MenuItem[] = [];
    if (!sheet.readOnly) {
      items.push({
        label: t("sheet.cut"),
        icon: "scissors",
        run: () => {
          void copyText(copySelection(true));
          clear();
        },
      });
    }
    items.push({ label: t("sheet.copy"), icon: "copy", run: () => void copyText(copySelection()) });
    if (!sheet.readOnly) {
      // Going on from what's written at the start of the selection, for the keyboard as dragging its corner.
      const down = autofillFrom("row");
      const right = autofillFrom("column");
      if (down || right) items.push("separator");
      if (down) items.push({ label: t("sheet.autofillDown"), icon: "chevrons-down", run: () => fillTo(down, range) });
      if (right) items.push({ label: t("sheet.autofillRight"), icon: "chevrons-right", run: () => fillTo(right, range) });
      items.push(
        "separator",
        { label: t("sheet.insertRowsAbove", { count: rowCount }), icon: "between-horizontal-start", run: () => shift("row", range.top, rowCount) },
        { label: t("sheet.insertRowsBelow", { count: rowCount }), icon: "between-horizontal-end", run: () => shift("row", range.bottom + 1, rowCount) },
        { label: t("sheet.deleteRows", { count: rowCount }), icon: "trash", danger: true, run: () => shift("row", range.top, -rowCount) },
        "separator",
        { label: t("sheet.insertColumnsLeft", { count: columnCount }), icon: "between-vertical-start", run: () => shift("column", range.left, columnCount) },
        {
          label: t("sheet.insertColumnsRight", { count: columnCount }),
          icon: "between-vertical-end",
          run: () => shift("column", range.right + 1, columnCount),
        },
        { label: t("sheet.deleteColumns", { count: columnCount }), icon: "trash", danger: true, run: () => shift("column", range.left, -columnCount) },
        "separator",
        { label: t("sheet.clear"), icon: "eraser", run: clear },
      );
    }
    if (!sheet.readOnly) {
      const sort = sortable();
      const money = moneyChanges();
      if (sort || money) items.push("separator");
      if (sort) {
        const by = sort.axis === "row" ? t("sheet.column", { name: columnName(sort.by) }) : t("sheet.row", { name: String(sort.by + 1) });
        items.push(
          { label: t("sheet.sortAscending", { by }), icon: "arrow-up-narrow-wide", run: () => sortBy(false) },
          { label: t("sheet.sortDescending", { by }), icon: "arrow-down-wide-narrow", run: () => sortBy(true) },
        );
      }
      if (money) items.push({ label: t(money.remove ? "sheet.noCurrency" : "sheet.currency"), icon: "banknote", run: () => setCells(money.changes) });
    }
    // A block's own: its name, as a table, as CSV.
    const block: MenuItem[] = [];
    if (sheet.rename && !sheet.readOnly) block.push({ label: t(sheet.name ? "sheet.rename" : "sheet.name"), icon: "pencil", run: startNaming });
    if (sheet.toTable && !sheet.readOnly) block.push({ label: t("sheet.toTable"), icon: "table", run: sheet.toTable });
    if (sheet.showText) block.push({ label: t("sheet.editText"), icon: "code", run: sheet.showText });
    if (block.length) items.push("separator", ...block);
    ui.openMenu({ x, y, label: t("sheet.menu", { cell: cellName(active.row, active.column) }), items });
  }

  function onkeydown(event: KeyboardEvent) {
    const mod = isApple ? event.metaKey : event.ctrlKey;
    const step = STEPS[event.key];
    if (editing) {
      const multiline = draft.includes("\n");
      const { suggestions } = help;
      const count = suggestions.length;
      if (count && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        help.picked = (help.picked + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
        document.getElementById(`${id}-fn-${help.picked}`)?.scrollIntoView({ block: "nearest" });
        // Said rather than pointed at with aria-activedescendant, which makes WebKit take focus out of the field.
        speak(`${suggestions[help.picked].name}: ${suggestions[help.picked].about}`);
      } else if (count && (event.key === "Tab" || (event.key === "Enter" && !event.altKey && !mod))) choose(suggestions[help.picked]);
      else if (count && event.key === "Escape") help.dismissed = true;
      else if (step && canPoint && !mod) pointBy(step, event.shiftKey);
      else if (event.key === "Enter" && event.altKey) {
        // A line break in the cell, as ⌥↵ makes in Excel and Numbers.
        input!.setRangeText("\n", input!.selectionStart, input!.selectionEnd, "end");
        draft = input!.value;
      } else if (event.key === "Enter" && !mod) {
        const start = tabStart;
        commit();
        go(active.row + (event.shiftKey ? -1 : 1), start ?? active.column, false, false, true);
      } else if (event.key === "Tab") {
        commit();
        tab(event.shiftKey);
      }
      else if (event.key === "Escape") cancel();
      else if (step && !mod && !event.shiftKey && (step[0] ? !multiline : editing.quick && !isFormula(draft))) commit(...step);
      else return;
      event.preventDefault();
      return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    // ↑ from the first row goes into the text above (a note's title), and ↓ from a block's last into the text below.
    if (step && !event.shiftKey && !mod && (step[0] < 0 ? active.row === 0 : step[0] > 0 && !sheet.fills && active.row >= maxRow)) leave(step[0] < 0);
    else if (step) {
      const from = event.shiftKey ? corner : active;
      const to = mod ? edge(from, event.key) : { row: from.row + step[0], column: from.column + step[1] };
      go(to.row, to.column, event.shiftKey, true);
    } else if (key === "Tab") tab(event.shiftKey);
    else if (key === "Enter" || key === "F2") edit(false);
    else if ((key === "Backspace" || key === "Delete") && !mod) clear();
    else if (key === "Escape" && many) corner = active;
    else if (key === "Home") go(mod ? 0 : active.row, 0, event.shiftKey, true);
    else if (key === "End") {
      const row = mod ? Math.max(0, sheet.cells.length - 1) : active.row;
      go(row, Math.max(0, (mod ? dataColumns : (sheet.cells[row]?.length ?? 1)) - 1), event.shiftKey, true);
    } else if (key === "PageDown" || key === "PageUp") {
      const page = Math.max(1, Math.floor(viewHeight / rowHeight) - 2) * (key === "PageDown" ? 1 : -1);
      go((event.shiftKey ? corner : active).row + page, (event.shiftKey ? corner : active).column, event.shiftKey);
    } else if (mod && key === "z") (event.shiftKey ? redo : undo)(view);
    else if (mod && key === "y" && !isApple) redo(view);
    else if (mod && key === "a") {
      active = { row: 0, column: 0 };
      corner = { row: Math.max(0, sheet.cells.length - 1), column: Math.max(0, dataColumns - 1) };
    } else if (mod && key === "d") fill("row");
    else if (mod && key === "r") fill("column");
    else if (key === "ContextMenu" || (key === "F10" && event.shiftKey)) {
      const rect = input!.getBoundingClientRect();
      openMenu(rect.left, rect.bottom);
    } else return;
    event.preventDefault();
  }

  function oninput() {
    if (!editing) return edit(true, input!.value);
    draft = input!.value;
    follow(true);
  }

  function oncompositionstart() {
    // An IME's first characters, before `input`: they replace what's there too.
    if (!editing && !sheet.readOnly) edit(true, "");
  }

  const cellAt = (target: EventTarget | null): Point | null => {
    const el = (target as Element | null)?.closest?.<HTMLElement>("[data-row]");
    return el ? { row: Number(el.dataset.row), column: Number(el.dataset.column) } : null;
  };

  function onpointerdown(event: PointerEvent) {
    mouse = event.pointerType === "mouse";
    const cell = cellAt(event.target);
    if (!cell || event.button !== 0 || !mouse) return;
    // Focus stays in the text field (another grid's, writing a formula).
    event.preventDefault();
    if (pointers.writer ? pointers.writer.grid !== self : pointers.remote !== null) return pointFromHere(cell);
    if (canPoint) return pointAtCells(cell);
    commit();
    focusInput();
    if (event.shiftKey) {
      go(cell.row, cell.column, true);
      return whileDragging((over) => go(over.row, over.column, true));
    }
    const inSelection = selected(cell.row, cell.column);
    if (!inSelection) go(cell.row, cell.column);
    press(event, cell, inSelection);
  }

  /** Calls `over` with each cell the pointer moves over until it's let go, then `end`. */
  function whileDragging(over: (cell: Point) => void, end?: () => void) {
    const drag = (move: PointerEvent) => {
      const cell = cellAt(document.elementFromPoint(move.clientX, move.clientY));
      if (cell) over(cell);
    };
    window.addEventListener("pointermove", drag);
    window.addEventListener(
      "pointerup",
      () => {
        window.removeEventListener("pointermove", drag);
        end?.();
      },
      { once: true },
    );
  }

  /** Writing a formula, a click on a cell writes its reference, and a drag a range's. */
  function pointAtCells(cell: Point) {
    point(cell, cell);
    whileDragging((over) => pointing && point(pointing.anchor, over));
  }

  function onclick(event: MouseEvent) {
    const cell = cellAt(event.target);
    if (!cell || mouse) return;
    if (canPoint) return point(cell, cell);
    // A tap on the current cell writes in it.
    if (cell.row === active.row && cell.column === active.column && !many) return edit(false);
    commit();
    go(cell.row, cell.column);
    focusInput();
  }

  function ondblclick(event: MouseEvent) {
    if (cellAt(event.target) && !editing) edit(false);
  }

  /** Clicking a column letter or a row number selects all of it that's written in, the corner the whole sheet. */
  function pick(event: PointerEvent, row: number | null, column: number | null) {
    if (event.button !== 0) return;
    event.preventDefault();
    commit();
    pickWhole(row, column, event.shiftKey);
    focusInput();
  }

  /** Selects all that's written of a row or column (both null: the whole sheet), or with `extend` stretches the selection to it. */
  function pickWhole(row: number | null, column: number | null, extend = false) {
    const lastRow = Math.max(0, sheet.cells.length - 1);
    const lastColumn = Math.max(0, dataColumns - 1);
    const from = { row: row ?? 0, column: column ?? 0 };
    const to = { row: row ?? lastRow, column: column ?? lastColumn };
    if (extend) {
      corner = { row: row === null ? lastRow : to.row, column: column === null ? lastColumn : to.column };
    } else {
      active = from;
      corner = to;
    }
  }

  /** Right-clicking a column letter or row number (or the corner): it's selected, unless whole ones with it are, and the cells' menu opens. */
  function headerMenu(event: MouseEvent, row: number | null, column: number | null) {
    event.preventDefault();
    event.stopPropagation();
    commit();
    const wholeColumns = range.top === 0 && range.bottom >= sheet.cells.length - 1;
    const wholeRows = range.left === 0 && range.right >= dataColumns - 1;
    const inSelection =
      column !== null ? wholeColumns && column >= range.left && column <= range.right
      : row !== null ? wholeRows && row >= range.top && row <= range.bottom
      : false;
    if (!inSelection) pickWhole(row, column);
    focusInput();
    openMenu(event.clientX, event.clientY);
  }

  function oncontextmenu(event: MouseEvent) {
    const cell = cellAt(event.target);
    if (!cell) return;
    event.preventDefault();
    if (!selected(cell.row, cell.column)) go(cell.row, cell.column);
    commit();
    focusInput();
    openMenu(event.clientX, event.clientY);
  }

  const editWidth = $derived(
    editing ? Math.min(Math.max(current.width, Math.ceil(textWidth(draft, font) + PADDING + 8)), Math.max(current.width, viewWidth - current.left)) : current.width,
  );
  const editLines = $derived(editing ? draft.split("\n").length : 1);

  /*
   * Suggestions and hints hang under the cell being written in, past the grid's edge onto the note
   * if need be (a block can be only a few rows tall), or over the cell when there's no room below
   * in the note's window. They're placed in the grid's box, outside what scrolls, so nothing cuts them off.
   */
  /** Whether a block's name shows above its grid. */
  const captioned = $derived(!!sheet.rename && (!!sheet.name || naming));
  /** How wide a block's grid is, and where it starts below its name, for its buttons beside it (actions.ts). */
  let rootWidth = $state(0);
  $effect(() => {
    const parent = root?.parentElement;
    if (sheet.fills || !parent || !scroller) return;
    void captioned;
    void gridTop;
    parent.style.setProperty("--actions-left", `${rootWidth}px`);
    parent.style.setProperty("--actions-top", `${scroller.getBoundingClientRect().top - parent.getBoundingClientRect().top}px`);
  });
  let helpHeight = $state(0);
  let handleSize = $state(14);
  let scrollLeft = $state(0);
  /** Where the scrolling part starts in the grid's box: under the bar, if there is one, and inside its border. */
  let gridTop = $state(0);
  let gridLeft = $state(0);
  const helpWidth = $derived(Math.min(320, viewWidth - 16));
  /** The cell being written in, in the grid's box, under the column letters. */
  const cellTop = $derived(gridTop + headHeight + current.top - scrollTop);
  const cellLeft = $derived(gridLeft + current.left - scrollLeft);
  /** Whether it's in view, not scrolled away under the letters, the numbers or the grid's edges. */
  const cellShown = $derived(
    current.top + rowHeight > scrollTop &&
      current.top < scrollTop + viewHeight - headHeight &&
      current.left + current.width > scrollLeft + numberWidth &&
      current.left < scrollLeft + viewWidth,
  );
  const helpLeft = $derived(Math.max(gridLeft, Math.min(cellLeft, gridLeft + viewWidth - helpWidth)));
  const helpTop = $derived.by(() => {
    const below = cellTop + editLines * rowHeight + 4;
    const above = cellTop - helpHeight - 4;
    if (!root) return below;
    const box = root.getBoundingClientRect();
    const window = view.scrollDOM.getBoundingClientRect();
    return box.top + below + helpHeight > window.bottom && box.top + above > window.top ? above : below;
  });
</script>

{#snippet statList()}
  {#each stats ?? [] as stat (stat.name)}
    <span><span class="text-faint">{stat.name}</span> <span class="text-fg">{stat.value}</span></span>
  {/each}
{/snippet}

<div
  bind:this={root}
  bind:offsetWidth={rootWidth}
  class={[
    "group relative flex flex-col font-text text-[0.94em] leading-none tabular-nums select-none [--grid-line:color-mix(in_srgb,var(--ink)_12%,transparent)] [--head:linear-gradient(var(--code-bg),var(--code-bg)),var(--bg)] [--head-on:linear-gradient(var(--active),var(--active)),var(--bg)]",
    // A block is as wide as its columns.
    !sheet.fills && "w-fit max-w-full",
    filling && "cursor-crosshair",
    // A formula in another window or tab is waiting for cells to be pointed at.
    pointers.remote !== null && !pointers.writer && "cursor-cell",
    moving && "cursor-grabbing",
    resizing && "cursor-nwse-resize",
  ]}
  style:height={sheet.fills ? `${height}px` : undefined}
>
  <!-- The current cell, and what's written in it: a formula, not what it works out to. A block in a note does without, quieter in the text around it: its formulas show as they're written in, and on hovering. -->
  {#if sheet.fills}
    <div class="mb-2 flex h-control min-w-0 items-center gap-3 rounded-md bg-code px-3 text-sm">
      <span class="w-12 shrink-0 font-mono text-xs text-faint tabular-nums">{cellName(active.row, active.column)}</span>
      <button
        type="button"
        tabindex="-1"
        class="min-w-0 flex-1 cursor-text truncate text-left font-mono text-xs text-fg"
        aria-label={t("sheet.editCell", { cell: cellName(active.row, active.column) })}
        onclick={() => edit(false)}
      >
        {#if editing}
          {#each pieces as piece, i (i)}<span style:color={piece.color}>{piece.text}</span>{/each}
        {:else}
          {written(active)}
        {/if}
      </button>
      {#if stats}
        <span id="{id}-stats" class="flex shrink-0 gap-3 font-ui text-xs whitespace-nowrap tabular-nums">{@render statList()}</span>
      {/if}
    </div>
  {/if}
  <!-- A block's name, which formulas elsewhere find its cells by: clicked, or Name… in its menu, it's written here. -->
  {#if captioned}
    <div class="mb-1.5 flex h-6 min-w-0 items-center font-ui text-xs">
      {#if naming}
        <input
          bind:this={nameInput}
          value={sheet.name ?? ""}
          aria-label={t("sheet.nameLabel")}
          spellcheck="false"
          autocomplete="off"
          class="h-6 w-48 max-w-full rounded-sm border-0 bg-input px-1.5 font-mono text-xs text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== "Escape") return;
            event.preventDefault();
            endNaming(event.key === "Enter");
          }}
          onblur={() => endNaming(true, false)}
        />
      {:else}
        <button
          type="button"
          tabindex="-1"
          title={t("sheet.rename")}
          disabled={sheet.readOnly}
          class="-mx-1.5 h-6 min-w-0 cursor-text truncate rounded-sm px-1.5 font-mono text-faint enabled:hover:bg-active enabled:hover:text-muted"
          onclick={startNaming}
        >
          {sheet.name}
        </button>
      {/if}
    </div>
  {/if}
  <!-- Pointing at cells; the text field over the current cell takes the keyboard. -->
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    bind:this={scroller}
    bind:clientHeight={viewHeight}
    bind:clientWidth={viewWidth}
    class={[
      "relative overflow-y-auto rounded-md border border-(--grid-line)",
      fits ? "overflow-x-hidden" : "overflow-x-auto",
      // A note's grid stops at its edges; a block's passes scrolling down and up on to the note around it.
      sheet.fills ? "min-h-0 flex-1 overscroll-none" : "overscroll-x-none",
    ]}
    style:max-height={sheet.fills ? undefined : `${BLOCK_SHOWN * rowHeight + headHeight + 2}px`}
    onscroll={() => {
      scrollTop = scroller!.scrollTop;
      scrollLeft = scroller!.scrollLeft;
    }}
    {onpointerdown}
    {onclick}
    {ondblclick}
    {oncontextmenu}
  >
    <div
      role="grid"
      aria-label={sheet.label}
      aria-rowcount={rows + (headings ? 1 : 0)}
      aria-colcount={columns + (headings ? 1 : 0)}
      aria-multiselectable="true"
      aria-readonly={sheet.readOnly}
      class="relative"
      style:width="{numberWidth + offsets[columns]}px"
    >
      <!-- The column letters and row numbers stay put as the cells scroll under them, so their tints sit on the page's color. -->
      {#if headings}
      <div role="row" aria-rowindex="1" class="sticky top-0 z-20 flex font-ui text-2xs text-faint" style:height="{rowHeight}px">
        <div
          role="columnheader"
          tabindex="-1"
          aria-label={t("sheet.selectAll")}
          class="sticky left-0 z-10 shrink-0 border-r border-b border-(--grid-line) [background:var(--head)]"
          style:width="{numberWidth}px"
          onpointerdown={(event) => pick(event, null, null)}
          oncontextmenu={(event) => headerMenu(event, null, null)}
        ></div>
        {#each columnList as column (column)}
          <div
            role="columnheader"
            tabindex="-1"
            aria-colindex={column + 2}
            class={[
              "flex shrink-0 items-center justify-center border-b border-(--grid-line)",
              column < columns - 1 && "border-r",
              marked && column >= range.left && column <= range.right ? "text-fg [background:var(--head-on)]" : "[background:var(--head)]",
            ]}
            style:width="{columnWidths[column]}px"
            onpointerdown={(event) => pick(event, null, column)}
            oncontextmenu={(event) => headerMenu(event, null, column)}
          >
            {columnName(column)}
          </div>
        {/each}
      </div>
      {/if}
      <div bind:this={body} class="relative" style:height="{rows * rowHeight}px">
        {#each rowList as row (row)}
          <div role="row" aria-rowindex={row + (headings ? 2 : 1)} class="absolute left-0 flex" style:top="{row * rowHeight}px" style:height="{rowHeight}px">
            {#if headings}
            <div
              role="rowheader"
              tabindex="-1"
              class={[
                "sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-(--grid-line) pr-2 font-ui text-2xs",
                row < rows - 1 && "border-b",
                marked && row >= range.top && row <= range.bottom ? "text-fg [background:var(--head-on)]" : "text-faint [background:var(--head)]",
              ]}
              style:width="{numberWidth}px"
              onpointerdown={(event) => pick(event, row, null)}
              oncontextmenu={(event) => headerMenu(event, row, null)}
            >
              {row + 1}
            </div>
            {/if}
            {#each columnList as column (column)}
              {@const value = shown(row, column)}
              {@const cell = shownAs(value.text, look)}
              <div
                role="gridcell"
                aria-colindex={column + (headings ? 2 : 1)}
                aria-selected={selected(row, column)}
                data-row={row}
                data-column={column}
                class={[
                  "shrink-0 overflow-hidden border-(--grid-line) px-2 text-ellipsis whitespace-pre",
                  // The grid's own border is the last column's and row's.
                  column < columns - 1 && "border-r",
                  row < rows - 1 && "border-b",
                  value.kind === "number" && "text-right",
                  (value.kind === "boolean" || value.kind === "error") && "text-center",
                  (value.kind === "error" || cell.red) && "text-danger",
                  isHeader(row, column) && "bg-code font-semibold",
                ]}
                style:width="{columnWidths[column]}px"
                style:line-height="{rowHeight - 1}px"
                title={isFormula(sheet.cells[row]?.[column] ?? "") ? sheet.cells[row][column] : undefined}
              >
                {#if cell.symbol}<span class="float-left pe-2">{cell.symbol}</span>{/if}{cell.text}{#if cell.room && value.kind === "number"}<span class="invisible">)</span>{/if}
              </div>
            {/each}
          </div>
        {/each}
        {#each references as reference (reference.from)}
          {#if reference.top < rows && reference.left < columns}
            {@const area = framed(reference.top, reference.left, Math.min(reference.bottom, rows - 1), Math.min(reference.right, columns - 1))}
            <div
              class={["pointer-events-none absolute z-[4] outline-2 -outline-offset-1", pointing?.from === reference.from && "outline-dashed"]}
              style={area}
              style:outline-color={reference.color}
              style:background-color="color-mix(in srgb, {reference.color} 10%, transparent)"
            ></div>
          {/if}
        {/each}
        {#if many && marked && !editing}
          <div
            class="pointer-events-none absolute bg-selection outline-1 -outline-offset-1 outline-accent"
            style:top="{selection.top}px"
            style:left="{selection.left}px"
            style:width="{selection.width}px"
            style:height="{selection.height}px"
          ></div>
        {/if}
        {#if marked && !editing}
          <div
            class="pointer-events-none absolute outline-2 -outline-offset-1 outline-accent"
            style={currentFrame}
          ></div>
          {#if !sheet.readOnly && !moving && !resizing}
            <!-- The corner to drag to fill, on the selection's, inside the grid's edges. Bigger to a finger. The menu's Autofill does it by keyboard. -->
            <div
              bind:offsetWidth={handleSize}
              aria-hidden="true"
              class="absolute z-[6] flex size-3.5 cursor-crosshair touch-none items-center justify-center coarse:size-7"
              style:top="{Math.min(selection.top + selection.height - handleSize / 2, rows * rowHeight - handleSize)}px"
              style:left="{Math.min(selection.left + selection.width - handleSize / 2, numberWidth + offsets[columns] - handleSize)}px"
              onpointerdown={dragFill}
            >
              <span class="size-2 rounded-[2px] bg-accent ring-1 ring-bg"></span>
            </div>
          {/if}
        {/if}
        {#if pointedHere}
          <!-- Pointed at from a formula in another grid. -->
          {@const area = framed(pointedHere.top, pointedHere.left, pointedHere.bottom, pointedHere.right)}
          <div
            class="pointer-events-none absolute z-[4] bg-selection outline-2 -outline-offset-1 outline-accent outline-dashed"
            style={area}
          ></div>
        {/if}
        {#if moving}
          <!-- The cells picked up, where they'd go. -->
          {@const to = framed(moving.area.top + moving.rows, moving.area.left + moving.columns, moving.area.bottom + moving.rows, moving.area.right + moving.columns)}
          <div
            class="pointer-events-none absolute z-[6] bg-selection shadow-menu outline-2 -outline-offset-1 outline-accent outline-dashed"
            style={to}
          ></div>
        {/if}
        {#if resizing}
          {@const size = framed(0, 0, resizing.rows - 1, resizing.columns - 1)}
          <div
            class="pointer-events-none absolute z-[6] outline-2 -outline-offset-1 outline-accent outline-dashed"
            style={size}
          ></div>
        {/if}
        {#if filling}
          {@const area = framed(filling.area.top, filling.area.left, filling.area.bottom, filling.area.right)}
          <div
            class="pointer-events-none absolute z-[6] outline-2 -outline-offset-1 outline-accent outline-dashed"
            style={area}
          ></div>
        {/if}
        <textarea
          bind:this={input}
          class={[
            // No padding but the cell's, so its text stays where the cell's was (a text field has some of its own above and below).
            "absolute z-[5] m-0 resize-none overflow-hidden border-0 bg-bg px-2 py-0 [font:inherit] whitespace-pre text-fg select-text",
            editing ? "shadow-menu outline-2 -outline-offset-1 outline-accent" : "pointer-events-none opacity-0",
          ]}
          style:top="{current.top}px"
          style:left="{current.left}px"
          style:width="{editWidth}px"
          style:height="{editLines * rowHeight}px"
          style:outline-offset={editing && atEdge ? "-2px" : undefined}
          style:border-radius={editing && atEdge ? corners(fieldEdges, "calc(var(--radius-md) - 1px)") : undefined}
          style:line-height="{rowHeight - 1}px"
          style:font-weight={isHeader(active.row, active.column) ? 600 : undefined}
          rows="1"
          wrap="off"
          spellcheck="false"
          autocomplete="off"
          readonly={sheet.readOnly}
          inputmode={editing ? "text" : "none"}
          aria-label={t("sheet.cell", { cell: cellName(active.row, active.column) })}
          aria-autocomplete={formula ? "list" : undefined}
          aria-controls={help.suggestions.length ? `${id}-functions` : undefined}
          aria-describedby={[help.preview ? `${id}-preview` : help.hint && `${id}-hint`, stats && `${id}-stats`].filter(Boolean).join(" ") || undefined}
          {onkeydown}
          onkeyup={() => editing && follow(false)}
          onpointerup={() => {
            // Moving the cursor by hand ends pointing.
            if (!editing) return;
            follow(false);
            pointing = null;
          }}
          {oninput}
          {oncompositionstart}
          {oncopy}
          {oncut}
          {onpaste}
          onfocus={() => (focused = true)}
          onblur={(event) => {
            // Another window or tab took the keyboard, perhaps to point at its cells for the formula: it
            // waits. The field is still this page's focus then, while a click elsewhere in the page moves
            // it. (Not document.hasFocus(): the Mac app's web view can say false with its window in front.)
            if (formula && document.activeElement === event.currentTarget) return;
            commit();
            // Its menu acts on the selection, so that stays.
            focused = !!(event.relatedTarget as Element | null)?.closest('[role="menu"]');
          }}
        ></textarea>
      </div>
    </div>
  </div>
  {#if (help.suggestions.length || help.preview || help.hint) && cellShown}
    <div
      bind:offsetHeight={helpHeight}
      class="{floating} absolute p-[5px] font-ui"
      style:top="{helpTop}px"
      style:left="{helpLeft}px"
      style:width="{helpWidth}px"
    >
      {#if help.suggestions.length}
        <div id="{id}-functions" role="listbox" aria-label={t("sheet.functions")} class="max-h-[min(16rem,40vh)] overflow-y-auto">
          {#each help.suggestions as suggestion, i (`${suggestion.kind} ${suggestion.name}`)}
            <div
              id="{id}-fn-{i}"
              role="option"
              tabindex="-1"
              aria-selected={i === help.picked}
              data-highlighted={i === help.picked ? "" : undefined}
              class="flex cursor-default flex-col gap-1 rounded-sm px-2.5 py-1.5 data-highlighted:bg-active"
              onpointerdown={(event) => {
                // The cell keeps the keyboard.
                event.preventDefault();
                choose(suggestion);
              }}
              onpointerenter={() => (help.picked = i)}
            >
              <span class="flex min-w-0 items-center gap-1.5 text-xs text-fg">
                {#if suggestion.kind === "sheet"}<Icon name="sheet" size={13} class="shrink-0 text-muted" />{/if}
                <span class={["truncate", suggestion.kind !== "sheet" && "font-mono"]}>{suggestion.name}</span>
              </span>
              <span class="truncate text-2xs text-faint">{suggestion.about}</span>
            </div>
          {/each}
        </div>
      {:else if help.preview}
        {@const preview = help.preview}
        <div id="{id}-preview" class="px-2.5 py-1.5">
          <p class="m-0 truncate font-mono text-xs text-muted">{preview.written}</p>
          <p class="m-0 mt-1 truncate text-sm text-fg tabular-nums">{preview.value}</p>
          {#if preview.about}<p class="m-0 mt-0.5 truncate text-2xs text-faint">{preview.about}</p>{/if}
        </div>
      {:else if help.hint}
        {@const hint = help.hint}
        <div id="{id}-hint" class="px-2.5 py-1.5">
          <p class="m-0 font-mono text-xs text-muted">
            {hint.fn.name}({#each hint.fn.args as arg, i (i)}{i ? ", " : ""}<span class={[i === hint.at && "font-semibold text-fg"]}
                >{arg.optional ? `[${arg.name}]` : arg.name}</span
              >{/each})
          </p>
          <p class="m-0 mt-1 text-2xs leading-snug text-faint">{hint.fn.args[hint.at]?.about ?? hint.fn.about}</p>
        </div>
      {/if}
    </div>
  {/if}
  {#if !sheet.fills && !sheet.readOnly}
    <!-- The block's corner (editor.css, as an image's and a diagram's): dragged, more rows and columns or fewer, never taking out what's written. Inserting and deleting rows and columns from the menu does it by keyboard. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      aria-hidden="true"
      title={t("sheet.resize")}
      class={["cm-lp-resize", marked || resizing ? "opacity-100" : "opacity-0 group-hover:opacity-100 coarse:opacity-100"]}
      onpointerdown={dragSize}
    ></div>
  {/if}
  {#if stats && !sheet.fills}
    <div id="{id}-stats" class="{floating} pointer-events-none absolute top-full left-0 mt-1.5 flex gap-3 px-2.5 py-1 font-ui text-xs whitespace-nowrap tabular-nums">
      {@render statList()}
    </div>
  {/if}
  {#if resizing}
    <div class="{floating} pointer-events-none absolute px-2 py-1 font-ui text-xs text-fg tabular-nums" style:top="{resizing.y + 18}px" style:left="{resizing.x + 14}px">
      {t("sheet.size", { rows: resizing.rows, columns: resizing.columns })}
    </div>
  {/if}
  {#if filling && fillLabel}
    <div
      class="{floating} pointer-events-none absolute max-w-60 truncate px-2 py-1 font-ui text-xs whitespace-pre text-fg"
      style:top="{filling.y + 18}px"
      style:left="{filling.x + 14}px"
    >
      {fillLabel}
    </div>
  {/if}
</div>
