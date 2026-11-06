# Tables

Tables in Markdown show as real tables. Click a cell to edit it.

| Plan | Notes | Devices | Price |
| :--- | :---- | :-----: | ----: |
| Free | Unlimited | All | $0 |
| You | Still unlimited | Still all | Still $0 |

- **Tab** and **Shift-Tab** move between cells
- **Enter** adds a row; Enter on an empty last row leaves the table
- `:---:` centers a column, `---:` aligns it right
- Hover a cell for a button that copies its text
- Paste rows from a spreadsheet or a web page to get a table

A cell that starts with `=` is a formula, as in a spreadsheet. Columns are A, B, C… and the header is row 1:

| Trip | Nights | Per night | Cost |
| :--- | -----: | --------: | ---: |
| Rome | 3 | 140 | =B2*C2 |
| Lisbon | 4 | 95 | =B3*C3 |
| Total | =SUM(B2:B3) | | =SUM(D2:D3) |

Click a cell to see its formula. Type `/table` to start one.

## Spreadsheets

A `csv` code block is a spreadsheet in the note: a grid of cells with the keys you know from Excel and Numbers. Click a cell and type, or press Return to change it; ↓ from the line above goes in. Type `/spreadsheet` to start one.

```csv
Month, Spent
January, 820
February, 760
March, 905
Average, =AVERAGE(B2:B4)
```

For a whole spreadsheet, switch a note to Spreadsheet in its ⓘ panel. Settings → Data imports CSV files and Excel workbooks.

#tour
