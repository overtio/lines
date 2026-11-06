/** Spreadsheet notes: their grid, its menu, and their downloads. Cells are named as spreadsheets name them (B4) in every language. */
export default {
  // The format, in the ⓘ panel's switch beside Markdown and LaTeX.
  "sheet.format": "Spreadsheet",
  "sheet.label": "Spreadsheet",
  // A spreadsheet's empty title line.
  "sheet.title": "Title",
  // For screen readers: the field over the current cell, the formula bar's button, and moving between cells.
  "sheet.cell": "Cell {cell}",
  "sheet.editCell": "Edit {cell}",
  "sheet.at": "{cell}: {value}",
  "sheet.empty": "empty",
  "sheet.functions": "Functions",
  "sheet.selectAll": "Select all",
  // The menu on a cell, row number or column letter.
  "sheet.menu": "Cell {cell}",
  "sheet.cut": "Cut",
  "sheet.copy": "Copy",
  "sheet.insertRowsAbove": "{count, plural, one {Insert Row Above} other {Insert # Rows Above}}",
  "sheet.insertRowsBelow": "{count, plural, one {Insert Row Below} other {Insert # Rows Below}}",
  "sheet.deleteRows": "{count, plural, one {Delete Row} other {Delete # Rows}}",
  "sheet.insertColumnsLeft": "{count, plural, one {Insert Column Left} other {Insert # Columns Left}}",
  "sheet.insertColumnsRight": "{count, plural, one {Insert Column Right} other {Insert # Columns Right}}",
  "sheet.deleteColumns": "{count, plural, one {Delete Column} other {Delete # Columns}}",
  "sheet.clear": "Clear",
  // A ```csv block's grid in a Markdown note: shows the block's CSV in its place, to change as text.
  "sheet.editText": "Edit as CSV",
  "sheet.rowsInserted": "{count, plural, one {Row inserted} other {# rows inserted}}",
  "sheet.rowsDeleted": "{count, plural, one {Row deleted} other {# rows deleted}}",
  "sheet.columnsInserted": "{count, plural, one {Column inserted} other {# columns inserted}}",
  "sheet.columnsDeleted": "{count, plural, one {Column deleted} other {# columns deleted}}",
  // The share menu, after "Download CSV" (its formulas as written).
  "sheet.downloadValues": "Download Values as CSV",
  "sheet.downloadWorkbook": "Download Excel Workbook",
  "sheet.noEngine": "Excel workbooks need the Formulas (IronCalc) plugin. Turn it on in Settings → Plugins.",
};
