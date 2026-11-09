# Spreadsheets

A `csv` code block is a spreadsheet in the note: a grid of cells with the keys you know from Excel and Numbers. Click a cell and type, or press Return to change what's there; ↓ from the line above goes in. Type `/spreadsheet` to start one.

```csv
Month, Spent
January, $820
February, $760
March, $905
Average, =AVERAGE(B2:B4)
```

- Select a few cells to see their sum and average below the grid
- Drag the small square on the selection's corner to go on from it, as in Excel: January → February, 1, 2 → 3, 4
- Hold a cell for a moment, then drag it to move it
- Right-click for the cells' menu: insert rows and columns, sort, format as currency
- The button beside the grid turns it into a Markdown table, and a table's button turns it back

## Spreadsheet notes

A whole note can be a spreadsheet: switch one in its ⓘ panel, or import a CSV file or an Excel workbook from Settings → Export and Import. The next note, **Trip budget**, is one.

Formulas can use other spreadsheets' cells, as Excel's use other sheets. This one takes the trip's total from that note, and changes when it does:

```csv
Saving for, Cost
Trip to Italy, ='Trip budget'!F6
Saved so far, $500
Still to save, =B2-B3
```

Type `='` in a cell for a list of the spreadsheets it can use, or open Trip budget beside this note (⌥-click it in the list) and click its cells. Settings → Editor → Spreadsheets sets how money, dates and numbers below zero show.

#tour
