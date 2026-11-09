# Spreadsheets

lines works with numbers in three ways: formulas in any Markdown table, spreadsheets in Markdown notes (a ` ```csv ` block, drawn as a grid of cells), and spreadsheet notes, which are a grid of cells and nothing else. The formulas in all of them are worked out by [IronCalc](https://www.ironcalc.com), an open source spreadsheet engine, which comes as a plugin (Formulas, in Settings → Plugins) and loads the first time a note has a formula.

## Formulas in tables

A table cell that starts with `=` is a formula. Away from the cursor the table shows what it works out to; with the cursor in the table, its Markdown shows the formula.

```markdown
| Item  | Cost        |
| ----- | ----------: |
| Rent  | 1200        |
| Food  | 450.50      |
| Total | =SUM(B2:B3) |
```

- Cells are named as in a spreadsheet: columns A, B, C… from the left, rows from 1, **the header row being row 1**. So the table above's Total is `=SUM(B2:B3)`.
- Hovering a worked-out cell shows its formula. Its copy button copies the result.
- Errors show in red: `#DIV/0!`, `#NAME?` for a function IronCalc doesn't know, `#REF!` for a cell that isn't there.
- `\=` at the start of a cell is a plain `=`, not a formula.
- Other Markdown apps show the formula as written. Printing and PDFs show results.
- Formulas are worked out in tables at the top level of a note and in cards, where tables are drawn ([linedown.md](linedown.md#formulas-in-tables)). LaTeX tables (`tabular`) don't have them.

## Spreadsheets in Markdown notes

A code block with the language `csv` is drawn as a spreadsheet's grid, to work in as a spreadsheet note's is (below): the same keys, formulas, suggestions, menu, filling and copying and pasting. `/spreadsheet` puts an empty one in, ready to type in its first cell.

````markdown
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```
````

- **Its text** is CSV, as other Markdown apps show it, row 1 its first line. Spaces after the commas are left out (`Rent, 1200` is `Rent` and `1200`), as people write CSV by hand; quoted, they're kept (`" Rent"`). Changing a cell in the grid writes the block again as CSV without them.
- **Its size** is its CSV's: as many rows and columns as it has, empty ones at the end included (an empty block is 3 × 3), up to 15 rows tall before it scrolls, and as wide as its columns. Writing in it keeps that size. The round handle on its bottom right corner makes it bigger or smaller: drag it down or across, and a label says the size; it never takes out a row or column with something in it. Return in the last row adds a row, and Tab past the last column a column. It scrolls sideways only once its columns don't fit.
- **Its name.** A block can have a name, written after its language (` ```csv name=costs `), by which formulas in other blocks and notes use its cells (below). It shows above the grid; click it, or choose **Name…** in the cells' menu, to write it. Names leave out `/`, quotes, `!` and brackets.
- **As a table.** The button beside its top right corner (or **Convert to Table** in the cells' menu) turns it into a Markdown table, its first row the header, so its formulas still point at the same cells. A table's own button, on hover, turns it into a spreadsheet the same way. Formatting in a table's cells (bold, links) doesn't go into a spreadsheet, and line breaks in cells don't go into a table.
- **From a CSV file.** A `.csv` or `.tsv` file in a note (pasted, dropped or added with `/file`) has a button beside its card on hover, Convert to Spreadsheet, that puts its cells in the file's place as a block named after the file: `Budget 2026.csv` becomes ` ```csv name="Budget 2026" `. Commas, semicolons or tabs are found by themselves, as an import finds them. One ⌘Z brings the file back.
- **Moving in and out.** ↓ on the line above it goes into its first row, and ↑ on the line below into its last; ↑ from its first row and ↓ from its last go back to the text (↓ adds a line after a block that ends the note). Clicking a cell works too.
- **No formula bar.** Quieter in a note than a spreadsheet's, a block does without the bar over the grid: a formula shows when you hover its cell, and as written when you change it (Return). The current cell is outlined only while you're working in the grid.
- **Its CSV.** The cells' menu has **Edit as CSV**, which shows the block's text in place of the grid, the cursor at its start, to change by hand (or to change the language, or delete it); moving out of it draws the grid again.
- Blocks are drawn at the top level of a note and in cards, as diagrams are; in a list or quote, a ` ```csv ` block is code.
- It prints as a table, formulas worked out, dates and money as they show. With the Spreadsheets plugin off, it's a code block.

## Formulas that use other notes

A formula can use the cells of another spreadsheet, as Excel's use another sheet:

| Written | Uses |
|---|---|
| `=Budget!B4`, `='Budget 2026'!B4` | the note called Budget: a spreadsheet note's cells, or a Markdown note's first ` ```csv ` block |
| `='Trip/costs'!B2` | the block named costs in the note Trip |
| `=costs!B2` | the block named costs in the same note |
| `=SUM(Budget!B2:B9)` | ranges too |

- **Suggested as you type.** Typing a word where a function's name could go (`=Fi`) lists the spreadsheets whose name (or a word of it) starts so, with the functions: everyday functions first, then spreadsheets, then the rest. Typing a quote (`='`) lists only spreadsheets: this note's named blocks, spreadsheet notes, notes with a ` ```csv ` block (their first) and their named blocks (`Trip/costs`), each saying which it is. Choosing one writes its name and a `!` (`Finance!`, `'Budget 2026'!`), quoted when it needs to be.
- **Pointing at another note's cells.** The same works with a note open beside this one (Open to the Side), another lines window (a floating note) or another browser tab or window of lines (side by side, or split view): while a formula's being written, a spreadsheet there shows a cell pointer, and clicking or dragging over its cells writes their reference with the note's name (`=Finance!B2`, `='Trip/Sheet1'!B2`; a note's first block goes by the note's name alone). The formula waits while the other window has the keyboard, and a note at the bottom of that window says so ("Click cells to use them in the formula in Plan"): Return there finishes the formula, as does a click on anything but a cell, and Esc leaves the cell as it was; or go back and finish it there. Until then, a click on a grid there points rather than selects.
- **Pointing at another block's cells.** Writing a formula in a block, where a reference can go (after `=`, `(`, a comma or an operator), click a cell in another block of the same note, or drag over its cells: their reference goes in (`=Sheet1!B3`, `=Sheet1!B1:B2`), outlined there until the formula's done. A block without a name is given one as it's pointed at (Sheet1, Sheet2…, as spreadsheet apps name sheets; Hoja1, Feuille1 in Spanish and French), written on its fence line.
- **Its cells, suggested.** After the `!`, its columns (below a header, `B2:B9`, with the header) and its cells with something in them (`B4`, with what it shows and its row's and column's labels: $1,650.00 · Total · Cost) are listed, narrowing as the cell's name is typed (`B` lists column B).
- **What it holds.** With a whole reference written (`Finance!B4`, `Finance!B2:B9`), what's there shows under the cell, as it shows in Finance: a cell's value with its labels, or a range's first few values and how many have something in them.
- Notes are found by their title as a mention finds them (case, spaces, `-` and `_` alike). A name with spaces or a `/` goes in quotes. A title with a `/` in it works too.
- What's used changes as those notes do: change the Budget note, and the formulas using it work out again.
- A name nothing goes by (or a note in the trash, locked, or in LaTeX) is `#REF!`.
- **Renaming follows.** Rename a block (from its name over the grid, or in its code) or a note, and the formulas that use it, in every note, are renamed with it, as renaming a sheet in Excel renames it in formulas: `=costs!B2` becomes `=expenses!B2`, `='Trip/costs'!B2` becomes `='Journey/costs'!B2`. A block's rename follows at once, a note's once you pause typing its title. Undoing a rename renames them back. Only formulas that no longer find anything by the old name change, so a note given a name another already has leaves them as they are. Locked notes' formulas aren't changed.
- Downloaded as an Excel workbook, the sheets a spreadsheet's formulas use come with it as sheets of their own, named after what they're called (Budget, Trip – costs), the formulas pointing at them.

## Spreadsheet notes

A note can be a spreadsheet: switch it in its ⓘ panel (Markdown · LaTeX · Spreadsheet), or import a CSV or Excel file (below). Its title goes on the line above the grid, with its tags after it if it has any (`Budget 2026 #home`).

### Its text

Like every note, a spreadsheet is text: its title line, a blank line, then its cells as CSV, formulas and all. It syncs, searches and conflicts as any note does.

```
Budget 2026 #home

Item,Cost
Rent,1200
Food,$450.50
Total,=SUM(B2:B3)
```

With the Spreadsheets plugin off, the note shows as this text, which can still be changed.

### The grid

Click a cell, or move to it with the arrow keys, and type: what you type replaces what's there. Return (or F2, or a double-click) changes what's there instead. The bar above the grid shows the current cell and what's written in it, a formula rather than its result; clicking it changes the cell too.

| Keys | |
|---|---|
| ↑ ↓ ← →, Tab, ⇧Tab | Move between cells. ↑ from the first row goes to the title. |
| ⇧ and an arrow, ⇧-click, drag | Select cells |
| ⌘ and an arrow | To the end of what's written, along the row or column |
| Home, End | To the row's first cell, or its last with something written; with ⌘, the sheet's first or last |
| Page Up, Page Down | A screenful up or down |
| ⌘A | Select everything written; Esc goes back to the one cell |
| Return, F2 | Change what's in the cell, or just type over it |
| Return, ⇧Return, Tab | While writing: keep it and move down, up or across. After Tab across a row, Return goes to the next row's first cell. |
| ↑ ↓, Return or Tab, Esc | While a formula's suggestions show: move through them, take one, put them away |
| ↑ ↓ ← →, ⇧ and an arrow | While writing a formula, where a reference can go: point at a cell, or stretch to a range |
| Esc | While writing: leave the cell as it was |
| ⌥Return | A line break in the cell |
| ⌫ | Clear the selected cells |
| ⌘D, ⌘R | Fill down or right: the top row (or first column) copied across the selection, formulas moving as they go |
| Drag the selection's corner | Fill the cells it's dragged over, going on from the selection (below) |
| Hold a cell, then drag | Move it, with the rest of the selection it's in (below) |
| ⌘C, ⌘X, ⌘V | Copy, cut and paste (below) |
| ⌘Z, ⇧⌘Z | Undo and redo, as for any note |
| ⇧F10, or right-click | The cells' menu: cut, copy, autofill, insert or delete rows and columns, clear, sort, currency. Right-clicking a column letter or row number selects all of it first (unless it's selected already), the corner the whole sheet |

From the title, Return, Tab or ↓ goes into the grid.

- **Rows and columns** are put in and taken out from the cells' menu, as many as are selected. Formulas still point at the same cells afterwards: insert a row above row 3 and `=SUM(B2:B4)` becomes `=SUM(B2:B5)`.
- **Copying** gives other apps tab-separated values, as Excel, Numbers and Google Sheets paste them, showing what the cells work out to. Pasted into a spreadsheet, cells copied from one keep their formulas, with relative references moved as in other spreadsheet apps (`=B2*2` pasted a row down is `=B3*2`). One cell pasted over a selection fills it.
- **Filling.** Drag the small square on the selection's corner down, up or across, and the cells it's dragged over go on from the selection, as in Excel and Numbers. A dashed outline shows what will fill, and a label by the pointer what goes in the last cell; Esc stops. Each column (or row) goes on by itself:
  - numbers along their trend (1, 2 → 3, 4; 10, 8 → 6, 4), keeping their decimals (1.50, 2.25 → 3.00)
  - text ending in a number counts on (Item 1 → Item 2; Room 007, Room 009 → Room 011)
  - days and months by name, long or short, in English or the app's language, written as the first is (Mon → Tue; JANUARY, MARCH → MAY), going round the week and year
  - dates written as `2026-01-31`, a day on (or as far apart as those selected), or by months when they're the same day of each (the 31st a month on is the last day of a shorter one)
  - anything else repeats, formulas moving as copying moves them (`=A1*2` → `=A2*2`)

  One number repeats, as in Excel. Holding ⌥ (Ctrl on Windows and Linux) while letting go swaps the two: one number counts up by 1, and a series repeats. Double-clicking the corner fills down as far as the column beside goes on. Dragged past a block's last row or column, the grid grows to take it. From the keyboard, select the cells to fill along with those to go on from, and choose **Autofill Down** or **Autofill Right** in the cells' menu: the rows (or columns) written in at the selection's start go on through the rest.
- **Moving.** Hold a cell still for a moment, and it (with the rest of the selection it's in) is picked up: drag it elsewhere, a dashed outline showing where, and let go. It goes over what's there, and formulas pointing at the cells moved follow them, as cutting and pasting does in Excel (`=A1*2` pointing at a cell moved from A1 to A5 is `=A5*2`). Dragged past a block's edge, the block grows. Esc puts it back. A press that moves at once selects, as before. From the keyboard, cut and paste.
- **Sorting.** With several rows selected, **Sort Ascending** and **Sort Descending** in the cells' menu sort them, whole, by the current cell's column: numbers and dates first, then text (in the app's language's order, numbers in text by value: Item 2 before Item 10), then `TRUE` and `FALSE`, then errors; empty cells always last. A first row that's highlighted as a header (below), or reads as one (all text, over numbers), stays put. With one row selected, they sort its columns the same way. Formulas move with their rows as copying moves them.
- **Money.** A cell written with a currency's symbol first (`$1200`, `€5`, `CHF 30`) is money, shown as Settings → Editor → Spreadsheets says ($1,200.00, $1,200 or USD 1,200.00, in the app's language's way). **Format as Currency** in the cells' menu writes the selected numbers with the chosen currency's symbol; on money, it's **Remove Currency**. `$` is the chosen currency if that's a dollar. A formula that works with money shows money too: `=B2`, `=B2*2`, `=SUM(B2:B9)`, `=MAX(…)`, `=ROUND(…)`, `=IF(…)`, `=Finance!B4` show the currency of the first cell they point at (not `COUNT`, which counts), and follow when that cell becomes money later. A percentage carries on the same way (`=C2*2` of 5% is 10%), as do thousands separators (of 1,200, 2,400). A result is worked out and shown in full, rounded only as the money style shows it: `=B2/3` of $2 is $0.67, `=B2-3` is -$1.00. Any currency's money is worked out as a number (`₹500` too). **Symbol at the cell's left edge** (Settings) shows money as accounting formats do, `$` on the cell's left and the amount on its right, where the app's language writes the symbol first ($1,200.00, not 1 200,00 €).
- **Numbers below zero**, money and others, show as Settings → Editor → Spreadsheets says: with a minus (-$45.50), in parentheses (($45.50)), or either in red. With parentheses, amounts above zero leave room for the `)`, so their decimals line up. Copied, they go as shown; a screen reader hears a minus.
- **Dates** are kept as `2026-11-05` however they're typed or pasted (`11/5/2026` or `5/11/2026`, as the app's language writes them, `5.11.26`, `Nov 5, 2026`, `5 November 2026`, `5 de noviembre de 2026`), and shown in the style Settings → Editor → Spreadsheets says (Nov 5, 2026, 11/5/26, November 5, 2026 or 2026-11-05).
- **The selected cells' numbers.** Selecting several cells shows their sum, average and count, below a block or on the bar above a note's grid; money in one currency sums as money. Settings → Editor → Selected cells chooses which of sum, average, min, max and count show, or none.
- **Pasting** rows from Excel, Numbers, Google Sheets or a table on a web page puts them in the cells from the current one.
- **Columns** are as wide as what's in them, within limits. Text too long for a column is cut short; the bar above the grid shows all of it. In a spreadsheet note, empty columns fill the rest of the grid's width, so it scrolls sideways only when the columns written in (and one more) don't fit.
- Numbers, money and dates line up on the right, `TRUE` and `FALSE` and errors in the middle.
- **How it looks.** Settings → Editor → Spreadsheets can highlight the top row and the left column as headers, bold on a tint as a table's header is (they print bold too), and hide the column letters and row numbers, so a block reads as a table. Without them, the cells' menu still inserts, deletes and sorts rows and columns.

### Formulas

- **Suggestions.** Typing a function's name after `=` lists the functions starting with it, the everyday ones (SUM, AVERAGE, IF…) first, each with what it does, and the other spreadsheets the formula can use ([above](#formulas-that-use-other-notes)). ↑ and ↓ move through them, Return or Tab takes one (writing `SUM(`), Esc puts the list away.
- **Arguments.** Inside a function's parentheses, a hint under the cell shows its arguments, the one the cursor is on in bold, and what that one is for. Optional ones are in brackets.
- **Pointing at cells.** Where a reference can go (after `=`, `(`, a comma or an operator), click a cell to write its reference, or drag over cells for a range (`B2:B5`). The arrow keys do the same from the cell being written in, and ⇧ with an arrow stretches the range. Pointing again replaces the reference just written, until something else is typed. Clicking in the text moves the cursor as usual.
- **Colors.** Each reference in the formula is outlined on the grid in a color of the theme, and shown in that color in the bar above the grid.
- Formulas are written as in Excel, in English with commas between arguments (`=IF(B2>100,"high","low")`), whatever the app's language, so a note works out the same on every device and in other apps.
- Numbers are read as in US English: `1,200.50`, `$450.50`, `12%`. Dates are typed in any usual way, and kept as `2026-01-15` (above).
- A `'` in front keeps a cell as text: `'=not a formula`, `'00123`.
- `TODAY()` and `NOW()` are in the device's time zone.
- IronCalc has Excel's common functions and many more. One it doesn't have shows `#NAME?`.

### Opening and saving files

- **Import** (Settings → Export and Import → Import Files…) makes a spreadsheet note of a `.csv` file (comma, semicolon or tab-separated, found by itself) or a `.tsv` file, titled by the file's name, and one of each visible sheet of an Excel workbook (`.xlsx`), titled "Workbook – Sheet" (just "Workbook" when it has one sheet). Formulas come in as formulas. A formula that reaches into another sheet comes in as its value, as each sheet is a note of its own. Cells whose format shows them differently (dates, money) come in as they show. The same button imports Markdown and LaTeX files as notes.
- **The share menu** has **Copy CSV** (formulas as written), **Copy Plain Text** (the title, then what the cells work out to, tab-separated), **Download CSV** (formulas as written), **Download Values as CSV** (what they work out to) and **Download Excel Workbook** (formulas and their values, which Excel, Numbers and Google Sheets open). In the desktop apps, downloads go to the Downloads folder and are shown in Finder.
- **Export** (Settings → Export and Import) writes spreadsheet notes as CSV files with their formulas, beside the Markdown and LaTeX ones.
- **Printing and PDFs** show the title and the cells, formulas worked out, dates and money as on screen.

## Plugins

- **Spreadsheets** is the format. Off, spreadsheet notes show as their text.
- **Formulas (IronCalc)** is the engine. Off, formulas in tables and spreadsheets show as written, and spreadsheets don't download as values or as Excel workbooks. Another engine could take its place: [HyperFormula is being considered](https://github.com/overtio/lines/issues/1) as one to turn on instead.

How it's built: the CSV is read and written by `src/lib/sheets/`, the engine by `src/plugins/ironcalc/`, and the note format and its grid by `src/plugins/spreadsheet/`. What's not there yet is in [limitations.md](limitations.md#spreadsheets).
