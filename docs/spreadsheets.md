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

A code block with the language `csv` is drawn as a spreadsheet's grid, to work in as a spreadsheet note's is (below): the same keys, formulas, suggestions, menu and copying and pasting. `/spreadsheet` puts an empty one in, ready to type in its first cell.

````markdown
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```
````

- **Its text** is CSV, as other Markdown apps show it, row 1 its first line. Spaces after the commas are left out (`Rent, 1200` is `Rent` and `1200`), as people write CSV by hand; quoted, they're kept (`" Rent"`). Changing a cell in the grid writes the block again as CSV without them.
- **Its size.** It's as wide as the note, and as tall as its rows and one more to write in (at least three), up to 15 rows; then it scrolls. Typing in its last row adds another.
- **Moving in and out.** ↓ on the line above it goes into its first row, and ↑ on the line below into its last; ↑ from its first row and ↓ from its last go back to the text (↓ adds a line after a block that ends the note). Clicking a cell works too.
- **No formula bar.** Quieter in a note than a spreadsheet's, a block does without the bar over the grid: a formula shows when you hover its cell, and as written when you change it (Return). The current cell is outlined only while you're working in the grid.
- **Its CSV.** The cells' menu has **Edit as CSV**, which shows the block's text in place of the grid, the cursor at its start, to change by hand (or to change the language, or delete it); moving out of it draws the grid again.
- Blocks are drawn at the top level of a note and in cards, as diagrams are; in a list or quote, a ` ```csv ` block is code.
- Formulas reach only the cells of their own block, not another block's or a table's.
- It prints as a table, formulas worked out. With the Spreadsheets plugin off, it's a code block.

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

Click a cell, or move to it with the arrow keys, and type: what you type replaces what's there. Return (or F2, or a double-click) changes what's there instead. The bar above the grid shows the current cell and what's written in it, a formula rather than its result.

| Keys | |
|---|---|
| ↑ ↓ ← →, Tab, ⇧Tab | Move between cells. ↑ from the first row goes to the title. |
| ⇧ and an arrow, ⇧-click, drag | Select cells |
| ⌘ and an arrow, Home, End | To the end of what's written, along the row or column |
| ⌘A | Select everything written |
| Return, F2 | Change what's in the cell, or just type over it |
| Return, ⇧Return, Tab | While writing: keep it and move down, up or across. After Tab across a row, Return goes to the next row's first cell. |
| ↑ ↓, Return or Tab, Esc | While a formula's suggestions show: move through them, take one, put them away |
| ↑ ↓ ← →, ⇧ and an arrow | While writing a formula, where a reference can go: point at a cell, or stretch to a range |
| Esc | While writing: leave the cell as it was |
| ⌥Return | A line break in the cell |
| ⌫ | Clear the selected cells |
| ⌘D, ⌘R | Fill down or right: the top row (or first column) copied across the selection, formulas moving as they go |
| ⌘C, ⌘X, ⌘V | Copy, cut and paste (below) |
| ⌘Z, ⇧⌘Z | Undo and redo, as for any note |
| ⇧F10, or right-click | The cells' menu: cut, copy, insert or delete rows and columns, clear |

From the title, Return, Tab or ↓ goes into the grid.

- **Rows and columns** are put in and taken out from the cells' menu, as many as are selected. Formulas still point at the same cells afterwards: insert a row above row 3 and `=SUM(B2:B4)` becomes `=SUM(B2:B5)`.
- **Copying** gives other apps tab-separated values, as Excel, Numbers and Google Sheets paste them, showing what the cells work out to. Pasted into a spreadsheet note, cells copied from one keep their formulas, with relative references moved as in other spreadsheet apps (`=B2*2` pasted a row down is `=B3*2`). One cell pasted over a selection fills it.
- **Pasting** rows from Excel, Numbers, Google Sheets or a table on a web page puts them in the cells from the current one.
- **Columns** are as wide as what's in them, within limits. Text too long for a column is cut short; the bar above the grid shows all of it.
- Numbers, money and dates line up on the right, `TRUE` and `FALSE` and errors in the middle.

### Formulas

- **Suggestions.** Typing a function's name after `=` lists the functions starting with it, the everyday ones (SUM, AVERAGE, IF…) first, each with what it does. ↑ and ↓ move through them, Return or Tab takes one (writing `SUM(`), Esc puts the list away.
- **Arguments.** Inside a function's parentheses, a hint under the cell shows its arguments, the one the cursor is on in bold, and what that one is for. Optional ones are in brackets.
- **Pointing at cells.** Where a reference can go (after `=`, `(`, a comma or an operator), click a cell to write its reference, or drag over cells for a range (`B2:B5`). The arrow keys do the same from the cell being written in, and ⇧ with an arrow stretches the range. Pointing again replaces the reference just written, until something else is typed. Clicking in the text moves the cursor as usual.
- **Colors.** Each reference in the formula is outlined on the grid in a color of the theme, and shown in that color in the bar above the grid.
- Formulas are written as in Excel, in English with commas between arguments (`=IF(B2>100,"high","low")`), whatever the app's language, so a note works out the same on every device and in other apps.
- Numbers and dates are read as in US English: `1,200.50`, `$450.50`, `12%`, `2026-01-15` or `1/15/2026`.
- A `'` in front keeps a cell as text: `'=not a formula`, `'00123`.
- `TODAY()` and `NOW()` are in the device's time zone.
- IronCalc has Excel's common functions and many more. One it doesn't have shows `#NAME?`.

### Opening and saving files

- **Import** (Settings → Data → Import Files…) makes a spreadsheet note of a `.csv` file (comma, semicolon or tab-separated, found by itself) or a `.tsv` file, titled by the file's name, and one of each sheet of an Excel workbook (`.xlsx`), titled "Workbook – Sheet". Formulas come in as formulas. A formula that reaches into another sheet comes in as its value, as each sheet is a note of its own. Cells whose format shows them differently (dates, money) come in as they show. The same button imports Markdown and LaTeX files as notes.
- **The share menu** has **Copy CSV** (formulas as written), **Copy Plain Text** (the title, then what the cells work out to, tab-separated), **Download CSV** (formulas as written), **Download Values as CSV** (what they work out to) and **Download Excel Workbook** (formulas and their values, which Excel, Numbers and Google Sheets open). In the desktop apps, downloads go to the Downloads folder and are shown in Finder.
- **Export** (Settings → Data) writes spreadsheet notes as CSV files with their formulas, beside the Markdown and LaTeX ones.
- **Printing and PDFs** show the title and the cells, formulas worked out.

## Plugins

- **Spreadsheets** is the format. Off, spreadsheet notes show as their text.
- **Formulas (IronCalc)** is the engine. Off, formulas in tables and spreadsheets show as written, and spreadsheets don't download as values or as Excel workbooks. Another engine could take its place: [HyperFormula is being considered](https://github.com/overtio/lines/issues/1) as one to turn on instead.

How it's built: the CSV is read and written by `src/lib/sheets/`, the engine by `src/plugins/ironcalc/`, and the note format and its grid by `src/plugins/spreadsheet/`. What's not there yet is in [limitations.md](limitations.md#spreadsheets).
