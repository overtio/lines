<script module lang="ts">
  /** The cells last copied from a sheet, so pasting them into one keeps their formulas, moved as copying moves them. */
  let copied: { text: string; inputs: string[][]; row: number; column: number } | null = null;
</script>

<script lang="ts">
  import { redo, undo } from "@codemirror/commands";
  import type { EditorView } from "@codemirror/view";
  import { untrack } from "svelte";
  import { speak } from "../../lib/a11y";
  import { htmlTable, parseTabbed } from "../../lib/editor/tables";
  import { t } from "../../lib/i18n/index.svelte";
  import { copyText, isApple } from "../../lib/platform";
  import { floating } from "../../lib/components/ui/styles";
  import type { CellValue, Cells, FormulaCompletion, FormulaEngine, FormulaFunction, FormulaSheet } from "../../lib/plugins/types";
  import { cellName, columnName, isFormula, shiftCells } from "../../lib/sheets/cells";
  import { writeCsv } from "../../lib/sheets/csv";
  import { loadedFormulas, loadFormulas } from "../../lib/sheets/formulas";
  import { type MenuItem, ui } from "../../lib/ui.svelte";
  import type { Sheet } from "./state.svelte";

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
   */

  let { sheet, view }: { sheet: Sheet; view: EditorView } = $props();

  type Point = { row: number; column: number };
  type Change = Point & { input: string };

  const MIN_WIDTH = 56;
  const DEFAULT_WIDTH = 96;
  const MAX_WIDTH = 320;
  /** The space either side of a cell's text and its border, and room for figures, which are wider lined up in columns. */
  const PADDING = 26;
  /** Rows drawn beyond those in view, so they're there before they scroll in. */
  const OVERSCAN = 6;
  /** Empty rows after the last one written in, in a note; a block has one, and at least this many in all. */
  const MORE_ROWS = 20;
  const BLOCK_ROWS = 3;
  /** The rows a block shows before it scrolls. */
  const BLOCK_SHOWN = 15;
  const MAX_ROW = 1_048_575;
  const MAX_COLUMN = 16_383;

  let root = $state<HTMLElement>();
  let scroller = $state<HTMLElement>();
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
  const id = $props.id();

  // The formulas, worked out by the engine that's on once it has loaded.
  let engine = $state.raw<FormulaEngine | null>(loadedFormulas());
  let calc: FormulaSheet | undefined;
  let revision = $state(0);
  if (!loadedFormulas()) {
    loadFormulas().then(
      (loaded) => (engine = loaded),
      (error: unknown) => console.error("lines: couldn't load the formula engine", error),
    );
  }

  $effect.pre(() => {
    const cells = sheet.cells;
    if (!engine) return;
    calc ??= engine.sheet();
    calc.update(cells);
    untrack(() => revision++);
  });
  $effect(() => () => calc?.free());

  /** What a cell shows: what its formula works out to, or what's written in it. */
  function shown(row: number, column: number): CellValue {
    void revision;
    if (calc) return calc.value(row, column);
    const written = sheet.cells[row]?.[column] ?? "";
    return { text: written, kind: written ? "text" : "empty" };
  }

  const written = (point: Point) => sheet.cells[point.row]?.[point.column] ?? "";

  // Writing a formula.
  /** The functions most formulas use, suggested before the rest that start the same way. */
  const COMMON = [
    "SUM", "AVERAGE", "IF", "COUNT", "MIN", "MAX", "ROUND", "SUMIF", "COUNTIF", "IFERROR", "VLOOKUP", "XLOOKUP", "INDEX", "MATCH",
    "AND", "OR", "NOT", "ABS", "TODAY", "NOW", "DATE", "CONCAT", "TEXT", "LEFT", "RIGHT", "MID", "LEN", "UPPER", "LOWER", "TRIM",
    "COUNTA", "AVERAGEIF", "SUMPRODUCT", "MEDIAN", "PRODUCT", "POWER", "SQRT", "ROUNDUP", "ROUNDDOWN", "YEAR", "MONTH", "DAY",
  ];
  /** Where the cursor is in what's being written. */
  let caret = $state(0);
  /** The suggestions put away with Esc, until more is typed. */
  let dismissed = $state(false);
  /** The suggestion ↑ and ↓ are on. */
  let picked = $state(0);
  /** Cells pointed at for the formula, and where their reference is written in it, which pointing again replaces. */
  let pointing = $state<{ from: number; to: number; anchor: Point; corner: Point } | null>(null);

  const formula = $derived(!!editing && draft.startsWith("="));
  const completion = $derived<FormulaCompletion | null>(formula && engine ? engine.complete(draft, caret) : null);
  const catalog = $derived(engine && new Map(engine.functions().map((fn) => [fn.name, fn])));
  const suggestions = $derived.by(() => {
    const typed = completion?.name?.typed.toUpperCase();
    if (!typed || dismissed || !catalog) return [];
    const rank = (fn: FormulaFunction) => (COMMON.includes(fn.name) ? COMMON.indexOf(fn.name) : COMMON.length);
    return [...catalog.values()].filter((fn) => fn.name.startsWith(typed)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  });
  /** Inside a function's parentheses: the function, and which of its arguments the cursor is on. */
  const hint = $derived.by(() => {
    const fn = !suggestions.length && completion?.argument && catalog?.get(completion.argument.name.toUpperCase());
    return fn ? { fn, at: Math.min(completion!.argument!.index, fn.args.length - 1) } : null;
  });
  /** Can the cells clicked or reached with the arrow keys be written into the formula? */
  const canPoint = $derived(formula && (!!pointing || !!completion?.reference));

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
    dismissed = false;
    picked = 0;
  }

  function choose(fn: FormulaFunction) {
    const from = completion?.name?.from;
    if (from === undefined || !input) return;
    input.setRangeText(`${fn.name}(`, from, input.selectionStart, "end");
    draft = input.value;
    follow(true);
  }

  const referenceText = (a: Point, b: Point) =>
    a.row === b.row && a.column === b.column
      ? cellName(a.row, a.column)
      : `${cellName(Math.min(a.row, b.row), Math.min(a.column, b.column))}:${cellName(Math.max(a.row, b.row), Math.max(a.column, b.column))}`;

  /** Writes the reference of the cells from `anchor` to `corner` at the cursor, or in place of the one pointed at before. */
  function point(anchor: Point, corner: Point) {
    if (!input) return;
    const text = referenceText(anchor, corner);
    const from = pointing?.from ?? input.selectionStart;
    input.setRangeText(text, from, pointing?.to ?? input.selectionEnd, "end");
    draft = input.value;
    caret = input.selectionStart;
    pointing = { from, to: from + text.length, anchor, corner };
    reveal(corner);
  }

  /** The arrow keys while pointing: the cell next to the one pointed at (at first, the one being written in), or with ⇧ the range stretched. */
  function pointBy([rows, columns]: [number, number], extend: boolean) {
    const next = (p: Point) => ({ row: clamp(p.row + rows, MAX_ROW), column: clamp(p.column + columns, MAX_COLUMN) });
    if (!pointing) {
      const cell = next(active);
      point(cell, cell);
    } else if (extend) point(pointing.anchor, next(pointing.corner));
    else {
      const cell = next(pointing.anchor);
      point(cell, cell);
    }
  }

  // Columns as wide as what's in them, within limits.
  const context = document.createElement("canvas").getContext("2d");
  const textWidths = new Map<string, number>();
  function measure(text: string) {
    let width = textWidths.get(text);
    if (width === undefined && context) {
      context.font = font;
      width = Math.max(...text.split("\n").map((line) => context.measureText(line).width));
      textWidths.set(text, width);
    }
    return width ?? text.length * 8;
  }

  const dataColumns = $derived(sheet.cells.reduce((most, row) => Math.max(most, row.length), 0));
  const dataWidths = $derived.by(() => {
    void revision;
    void font;
    const widths = Array<number>(dataColumns).fill(0);
    sheet.cells.forEach((row, r) =>
      row.forEach((text, c) => {
        if (text) widths[c] = Math.max(widths[c], measure(isFormula(text) ? shown(r, c).text : text) + PADDING);
      }),
    );
    return widths.map((width) => (width ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.ceil(width))) : DEFAULT_WIDTH));
  });
  const widthOf = (column: number) => dataWidths[column] ?? DEFAULT_WIDTH;

  /** The last row: a block's has the note's text below it. */
  const maxRow = $derived(sheet.fills ? MAX_ROW : Math.max(sheet.cells.length, BLOCK_ROWS - 1));
  /** Enough rows and columns to fill the grid, and one past those written in to write in next. */
  const rows = $derived(
    Math.max(sheet.fills ? Math.max(sheet.cells.length + MORE_ROWS, Math.ceil(viewHeight / rowHeight)) : maxRow + 1, active.row + 1, corner.row + 1),
  );
  const numberWidth = $derived(Math.max(40, String(rows).length * 8 + 22));
  const columns = $derived.by(() => {
    let count = Math.max(dataColumns + 1, active.column + 1, corner.column + 1);
    let width = numberWidth;
    for (let c = 0; c < count; c++) width += widthOf(c);
    while (width < viewWidth) width += widthOf(count++);
    return count;
  });
  /** Where each column starts, after the row numbers. */
  const offsets = $derived.by(() => {
    const starts = [0];
    for (let c = 0; c < columns; c++) starts.push(starts[c] + widthOf(c));
    return starts;
  });
  const columnList = $derived(Array.from({ length: columns }, (_, c) => c));
  const firstRow = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN));
  const lastRow = $derived(Math.min(rows, Math.ceil((scrollTop + viewHeight) / rowHeight) + OVERSCAN));
  const rowList = $derived(Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, i) => firstRow + i));

  const range = $derived({
    top: Math.min(active.row, corner.row),
    bottom: Math.max(active.row, corner.row),
    left: Math.min(active.column, corner.column),
    right: Math.max(active.column, corner.column),
  });
  const selected = (row: number, column: number) => row >= range.top && row <= range.bottom && column >= range.left && column <= range.right;
  const box = (top: number, left: number, bottom: number, right: number) => ({
    top: top * rowHeight,
    left: numberWidth + offsets[left],
    width: offsets[right + 1] - offsets[left],
    height: (bottom - top + 1) * rowHeight,
  });
  const selection = $derived(box(range.top, range.left, range.bottom, range.right));
  const current = $derived(box(active.row, active.column, active.row, active.column));
  const many = $derived(range.bottom > range.top || range.right > range.left);
  /** The current cell and selection show while working in a block, and always in a note, where the grid is all there is. */
  const marked = $derived(sheet.fills || focused);

  /** Takes up the editor's text size, and fits a note's grid to the editor's height below the title. */
  function fit() {
    if (!root?.isConnected) return;
    const style = getComputedStyle(root);
    font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    textWidths.clear();
    rowHeight = Math.round(parseFloat(style.fontSize) * 2.1);
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
    fit();
    return () => {
      sheet.focus = sheet.layout = undefined;
    };
  });

  // Not being written in, the text field holds what the current cell shows, selected: what typing
  // replaces, and what screen readers read.
  $effect(() => {
    if (editing || !input) return;
    input.value = shown(active.row, active.column).text || " ";
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
    const below = top + 2 * rowHeight - scroller.clientHeight;
    if (scroller.scrollTop > top) scroller.scrollTop = top;
    else if (scroller.scrollTop < below) scroller.scrollTop = below;
    const left = offsets[point.column] ?? 0;
    const right = numberWidth + (offsets[point.column + 1] ?? left) - scroller.clientWidth;
    if (scroller.scrollLeft > left) scroller.scrollLeft = left;
    else if (scroller.scrollLeft < right) scroller.scrollLeft = right;
  }

  const clamp = (value: number, most: number) => Math.min(most, Math.max(0, value));

  /** Moves to a cell, or with `extend` stretches the selection to it. */
  function go(row: number, column: number, extend = false, say = false) {
    const point = { row: clamp(row, maxRow), column: clamp(column, MAX_COLUMN) };
    corner = point;
    if (!extend) active = point;
    tabStart = null;
    reveal(point);
    if (say) speak(t("sheet.at", { cell: cellName(point.row, point.column), value: shown(point.row, point.column).text || t("sheet.empty") }));
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

  function setCells(changes: Change[]) {
    if (sheet.readOnly) return;
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
    if (cells) sheet.write(cells);
  }

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
    const text = input.value;
    editing = null;
    setCells([{ ...active, input: text }]);
    if (rows || columns) go(active.row + rows, active.column + columns);
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

  /** Puts in (or, negative, takes out) rows or columns, formulas still pointing at the same cells. */
  function shift(axis: "row" | "column", at: number, count: number) {
    if (sheet.readOnly) return;
    sheet.write(engine ? engine.shift(sheet.cells, axis, at, count) : shiftCells(sheet.cells, axis, at, count));
    if (count < 0) go(range.top, range.left);
    const n = Math.abs(count);
    speak(
      axis === "row"
        ? t(count > 0 ? "sheet.rowsInserted" : "sheet.rowsDeleted", { count: n })
        : t(count > 0 ? "sheet.columnsInserted" : "sheet.columnsDeleted", { count: n }),
    );
  }

  /** The selection as tab-separated values, as other spreadsheet apps paste them, and as written. */
  function copySelection() {
    const inputs: Cells = [];
    const values: Cells = [];
    for (let row = range.top; row <= range.bottom; row++) {
      inputs.push([]);
      values.push([]);
      for (let column = range.left; column <= range.right; column++) {
        inputs[inputs.length - 1].push(written({ row, column }));
        values[values.length - 1].push(shown(row, column).text);
      }
    }
    const text = writeCsv(values, "\t");
    copied = { text, inputs, row: range.top, column: range.left };
    return text;
  }

  function oncopy(event: ClipboardEvent) {
    if (editing) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", copySelection());
  }

  function oncut(event: ClipboardEvent) {
    if (editing) return;
    oncopy(event);
    clear();
  }

  function onpaste(event: ClipboardEvent) {
    if (editing || !event.clipboardData) return;
    event.preventDefault();
    if (sheet.readOnly) return;
    const plain = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    const html = event.clipboardData.getData("text/html");
    if (copied && plain === copied.text) paste(copied.inputs, copied);
    else paste((html.includes("<table") ? htmlTable(html) : null) ?? parseTabbed(plain), null);
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
        changes.push({ row, column, input: from ? moved(text, row - from.row - r, column - from.column - c) : text });
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
          void copyText(copySelection());
          clear();
        },
      });
    }
    items.push({ label: t("sheet.copy"), icon: "copy", run: () => void copyText(copySelection()) });
    if (!sheet.readOnly) {
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
    if (sheet.showText) items.push("separator", { label: t("sheet.editText"), icon: "code", run: sheet.showText });
    ui.openMenu({ x, y, label: t("sheet.menu", { cell: cellName(active.row, active.column) }), items });
  }

  function onkeydown(event: KeyboardEvent) {
    const mod = isApple ? event.metaKey : event.ctrlKey;
    const step = STEPS[event.key];
    if (editing) {
      const multiline = draft.includes("\n");
      const count = suggestions.length;
      if (count && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        picked = (picked + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
        document.getElementById(`${id}-fn-${picked}`)?.scrollIntoView({ block: "nearest" });
        // Said rather than pointed at with aria-activedescendant, which makes WebKit take focus out of the field.
        speak(`${suggestions[picked].name}: ${suggestions[picked].about}`);
      } else if (count && (event.key === "Tab" || (event.key === "Enter" && !event.altKey && !mod))) choose(suggestions[picked]);
      else if (count && event.key === "Escape") dismissed = true;
      else if (step && canPoint && !mod) pointBy(step, event.shiftKey);
      else if (event.key === "Enter" && event.altKey) {
        // A line break in the cell, as ⌥↵ makes in Excel and Numbers.
        input!.setRangeText("\n", input!.selectionStart, input!.selectionEnd, "end");
        draft = input!.value;
      } else if (event.key === "Enter" && !mod) {
        const start = tabStart;
        commit();
        go(active.row + (event.shiftKey ? -1 : 1), start ?? active.column);
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
    if (step && !event.shiftKey && !mod && (step[0] < 0 ? active.row === 0 : step[0] > 0 && !sheet.fills && active.row === maxRow)) leave(step[0] < 0);
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
    // Focus stays in the text field.
    event.preventDefault();
    if (canPoint) return pointAtCells(cell);
    commit();
    go(cell.row, cell.column, event.shiftKey);
    focusInput();
    whileDragging((over) => go(over.row, over.column, true));
  }

  /** Calls `over` with each cell the pointer moves over until it's let go. */
  function whileDragging(over: (cell: Point) => void) {
    const drag = (move: PointerEvent) => {
      const cell = cellAt(document.elementFromPoint(move.clientX, move.clientY));
      if (cell) over(cell);
    };
    window.addEventListener("pointermove", drag);
    window.addEventListener("pointerup", () => window.removeEventListener("pointermove", drag), { once: true });
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
    const lastRow = Math.max(0, sheet.cells.length - 1);
    const lastColumn = Math.max(0, dataColumns - 1);
    const from = { row: row ?? 0, column: column ?? 0 };
    const to = { row: row ?? lastRow, column: column ?? lastColumn };
    if (event.shiftKey) {
      corner = { row: row === null ? lastRow : to.row, column: column === null ? lastColumn : to.column };
    } else {
      active = from;
      corner = to;
    }
    focusInput();
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
    editing ? Math.min(Math.max(current.width, Math.ceil(measure(draft) + PADDING + 8)), Math.max(current.width, viewWidth - current.left)) : current.width,
  );
  const editLines = $derived(editing ? draft.split("\n").length : 1);

  /** Suggestions and hints go under the cell being written in, or over it when there's no room below. */
  let helpHeight = $state(0);
  let scrollLeft = $state(0);
  const helpWidth = $derived(Math.min(320, viewWidth - 16));
  const helpLeft = $derived(Math.max(scrollLeft + 8, Math.min(current.left, scrollLeft + viewWidth - helpWidth - 8)));
  const helpTop = $derived.by(() => {
    const below = current.top + editLines * rowHeight + 4;
    const room = viewHeight - rowHeight - (below - scrollTop);
    return room < helpHeight && current.top - scrollTop > helpHeight + 4 ? current.top - helpHeight - 4 : below;
  });
</script>

<div
  bind:this={root}
  class="flex flex-col font-text text-[0.94em] leading-none tabular-nums select-none [--grid-line:color-mix(in_srgb,var(--ink)_12%,transparent)] [--head:linear-gradient(var(--code-bg),var(--code-bg)),var(--bg)] [--head-on:linear-gradient(var(--active),var(--active)),var(--bg)]"
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
    </div>
  {/if}
  <!-- Pointing at cells; the text field over the current cell takes the keyboard. -->
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    bind:this={scroller}
    bind:clientHeight={viewHeight}
    bind:clientWidth={viewWidth}
    class={[
      "relative overflow-auto rounded-md border border-(--grid-line)",
      // A note's grid stops at its edges; a block's passes scrolling down and up on to the note around it.
      sheet.fills ? "min-h-0 flex-1 overscroll-none" : "overscroll-x-none",
    ]}
    style:max-height={sheet.fills ? undefined : `${(BLOCK_SHOWN + 1) * rowHeight + 2}px`}
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
      aria-rowcount={rows + 1}
      aria-colcount={columns + 1}
      aria-multiselectable="true"
      aria-readonly={sheet.readOnly}
      class="relative"
      style:width="{numberWidth + offsets[columns]}px"
    >
      <!-- The column letters and row numbers stay put as the cells scroll under them, so their tints sit on the page's color. -->
      <div role="row" aria-rowindex="1" class="sticky top-0 z-20 flex font-ui text-2xs text-faint" style:height="{rowHeight}px">
        <div
          role="columnheader"
          tabindex="-1"
          aria-label={t("sheet.selectAll")}
          class="sticky left-0 z-10 shrink-0 border-r border-b border-(--grid-line) [background:var(--head)]"
          style:width="{numberWidth}px"
          onpointerdown={(event) => pick(event, null, null)}
        ></div>
        {#each columnList as column (column)}
          <div
            role="columnheader"
            tabindex="-1"
            aria-colindex={column + 2}
            class={[
              "flex shrink-0 items-center justify-center border-r border-b border-(--grid-line)",
              marked && column >= range.left && column <= range.right ? "text-fg [background:var(--head-on)]" : "[background:var(--head)]",
            ]}
            style:width="{widthOf(column)}px"
            onpointerdown={(event) => pick(event, null, column)}
          >
            {columnName(column)}
          </div>
        {/each}
      </div>
      <div class="relative" style:height="{rows * rowHeight}px">
        {#each rowList as row (row)}
          <div role="row" aria-rowindex={row + 2} class="absolute left-0 flex" style:top="{row * rowHeight}px" style:height="{rowHeight}px">
            <div
              role="rowheader"
              tabindex="-1"
              class={[
                "sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-b border-(--grid-line) pr-2 font-ui text-2xs",
                marked && row >= range.top && row <= range.bottom ? "text-fg [background:var(--head-on)]" : "text-faint [background:var(--head)]",
              ]}
              style:width="{numberWidth}px"
              onpointerdown={(event) => pick(event, row, null)}
            >
              {row + 1}
            </div>
            {#each columnList as column (column)}
              {@const value = shown(row, column)}
              <div
                role="gridcell"
                aria-colindex={column + 2}
                aria-selected={selected(row, column)}
                data-row={row}
                data-column={column}
                class={[
                  "shrink-0 overflow-hidden border-r border-b border-(--grid-line) px-2 text-ellipsis whitespace-pre",
                  value.kind === "number" && "text-right",
                  (value.kind === "boolean" || value.kind === "error") && "text-center",
                  value.kind === "error" && "text-danger",
                ]}
                style:width="{widthOf(column)}px"
                style:line-height="{rowHeight - 1}px"
                title={isFormula(sheet.cells[row]?.[column] ?? "") ? sheet.cells[row][column] : undefined}
              >
                {value.text}
              </div>
            {/each}
          </div>
        {/each}
        {#each references as reference (reference.from)}
          {#if reference.top < rows && reference.left < columns}
            {@const area = box(reference.top, reference.left, Math.min(reference.bottom, rows - 1), Math.min(reference.right, columns - 1))}
            <div
              class={["pointer-events-none absolute z-[4] outline-2 -outline-offset-1", pointing?.from === reference.from && "outline-dashed"]}
              style:top="{area.top}px"
              style:left="{area.left}px"
              style:width="{area.width}px"
              style:height="{area.height}px"
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
            style:top="{current.top}px"
            style:left="{current.left}px"
            style:width="{current.width}px"
            style:height="{current.height}px"
          ></div>
        {/if}
        <textarea
          bind:this={input}
          class={[
            "absolute z-[5] m-0 resize-none overflow-hidden border-0 bg-bg px-2 [font:inherit] whitespace-pre text-fg select-text",
            editing ? "shadow-menu outline-2 -outline-offset-1 outline-accent" : "pointer-events-none opacity-0",
          ]}
          style:top="{current.top}px"
          style:left="{current.left}px"
          style:width="{editWidth}px"
          style:height="{editLines * rowHeight}px"
          style:line-height="{rowHeight - 1}px"
          rows="1"
          wrap="off"
          spellcheck="false"
          autocomplete="off"
          readonly={sheet.readOnly}
          inputmode={editing ? "text" : "none"}
          aria-label={t("sheet.cell", { cell: cellName(active.row, active.column) })}
          aria-autocomplete={formula ? "list" : undefined}
          aria-controls={suggestions.length ? `${id}-functions` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
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
            commit();
            // Its menu acts on the selection, so that stays.
            focused = !!(event.relatedTarget as Element | null)?.closest('[role="menu"]');
          }}
        ></textarea>
        {#if suggestions.length || hint}
          <div
            bind:offsetHeight={helpHeight}
            class="{floating} absolute p-[5px] font-ui"
            style:top="{helpTop}px"
            style:left="{helpLeft}px"
            style:width="{helpWidth}px"
          >
            {#if suggestions.length}
              <div id="{id}-functions" role="listbox" aria-label={t("sheet.functions")} class="max-h-[min(16rem,40vh)] overflow-y-auto">
                {#each suggestions as fn, i (fn.name)}
                  <div
                    id="{id}-fn-{i}"
                    role="option"
                    tabindex="-1"
                    aria-selected={i === picked}
                    data-highlighted={i === picked ? "" : undefined}
                    class="flex cursor-default flex-col gap-0.5 rounded-sm px-2.5 py-1.5 data-highlighted:bg-active"
                    onpointerdown={(event) => {
                      // The cell keeps the keyboard.
                      event.preventDefault();
                      choose(fn);
                    }}
                    onpointerenter={() => (picked = i)}
                  >
                    <span class="font-mono text-xs text-fg">{fn.name}</span>
                    <span class="truncate text-2xs text-faint">{fn.about}</span>
                  </div>
                {/each}
              </div>
            {:else if hint}
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
      </div>
    </div>
  </div>
</div>
