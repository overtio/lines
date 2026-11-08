# QA · Release checklist

Go through this before every release, on each platform you ship: the Mac app, the web app (Chrome and Safari), and a phone width (or the phone apps). Tick items as you go. If something's wrong, note it under the item.

:::i
Platforms in brackets: **[Mac]** Mac app only, **[Desktop]** desktop apps, **[Web]** web only, **[Touch]** phones and tablets, **[Chromium]** Chrome and Edge. Everything else applies everywhere. ⌘ is Ctrl and ⌥ is Alt on Windows and Linux.
:::

#qa/checklist

## 0. Setup

- [ ] Start from a fresh profile (a new browser profile; in a development build of the app, Settings → Data → Reset Notes to Defaults…), so first-launch behaviour can be checked
- [ ] A fresh start shows one note, **Welcome to lines** (the demo website: the feature tour instead), and everything in it renders
- [ ] Settings → Data → **Add QA Notes**: the QA notes are added, tagged qa, and the list switches to that tag
- [ ] Settings → Data → **Add Feature Tour**: the tour notes are added in order, with the picture and the CSV file working, and **Trip budget** a spreadsheet note with its formulas worked out
- [ ] Look through every QA note (qa tag in the sidebar) in light and dark, and at phone width; each says what to check at the top

## 1. Typing and live Markdown

- [ ] Bold, italic, underline, code, strikethrough and highlight shortcuts (⌘B, ⌘I, ⌘U, ⌘E, ⌘⇧X, ⌘⇧H) wrap the selection; again unwraps it; with no selection they insert a pair with the cursor between (`<u></u>` for underline)
- [ ] Underline: `<u>text</u>` shows underlined with its tags hidden until the cursor is in it, in text, table cells and properties; mixed with bold or highlight both show; a lone `<u>` stays as typed; it prints and exports as underlined, and the note list and word count read it without its tags
- [ ] In a LaTeX note, ⌘U wraps the selection in `\underline{…}` and again unwraps it
- [ ] The shortcuts on several lines format each line, skipping list markers, headings and fence lines
- [ ] ⌘↵ turns a line into a todo, replaces a bullet or number with a todo, and ticks or unticks a todo; works on every selected line
- [ ] Enter in a list, todo or quote continues it; Enter on an empty item ends it
- [ ] Markdown of a line shows when the cursor is on it and hides when it leaves; with the editor unfocused everything is rendered
- [ ] Headings, links, autolinks, tags, quotes, rules, bullets (dot, ring, square by depth) and numbers render correctly
- [ ] A tag shows its sidebar icon (a hash unless one was chosen) in place of its `#`, a little apart from its name, inside its pill; with the cursor on the tag the `#` shows. Choosing another icon for the tag in the sidebar changes it in the open note at once. A screen reader still reads "#"
- [ ] ⌘-click (Ctrl-click) on a tag lists its notes, as choosing it in the sidebar does, and selects it there; a plain click puts the cursor in it; ⌥↵ with the cursor on a tag does the same as ⌘-click; a tap on a phone while not editing opens it too; in a note's own window nothing happens
- [ ] Typing `#` at the start of a line leaves it as text, not a big heading; a space after it (`# `) makes the heading, and a letter (`#t`) a tag
- [ ] Clicking a checkbox ticks it; not in a trashed note
- [ ] ⌘-click a link opens it (system browser in the apps, new tab on the web); only http, https, mailto and tel open
- [ ] [Touch] Tapping a link while the editor isn't focused opens it
- [ ] Settings → Editing → Links: a choice for Click, ⌘-click and ⇧⌘-click (Ctrl-click and Ctrl+Shift-click on Windows and Linux) for web links, tags and mentions; by default Click edits everything, ⌘-click opens (shows a tag's notes), and ⇧⌘-click copies a web link's address, shows a tag's notes and opens a mention in a new tab; changes apply at once, in every window, and are remembered
- [ ] Each choice does what it says on each kind, in text, table cells, properties and LaTeX notes' links: Edit puts the cursor there; Open opens the link, lists the tag's notes, or opens the mentioned note (a type's chip lists its notes); Copy address copies it, with a moment's glow and "Copied" for screen readers
- [ ] Mentions with tabs on: Open in new tab adds a kept tab after the open one and shows it; Open in background tab adds it and stays; with tabs off both open the note. Open in floating window [Desktop] floats the note (the choice isn't offered on the web)
- [ ] ⇧-click alone extends the selection on any link; a tap while not typing opens whatever Click is set to; ⌥↵ opens what the cursor is on; Ctrl-click on a Mac shows the context menu rather than following the link
- [ ] Pasting a URL over selected text makes a link
- [ ] GitHub links show short with GitHub's mark (`owner/repo#12`, `owner/repo@1a2b3c4`), in text and in table cells; the URL shows while the cursor is on one; ⌘-click opens it; a named GitHub link keeps its text with the mark in front (see the QA note "GitHub links")
- [ ] Symbols (QA note "Symbols"): `->` `<-` `<->` `=>` `<=>` `<=` `>=` `!=` show as → ← ↔ ⇒ ⇔ ≤ ≥ ≠ in text, code spans, code blocks (as wide as the two or three characters, so columns line up) and table cells; `-->`, `!==`, `\->`, addresses, HTML comments and a quote's `>=` stay as typed; a code span or link with one inside stays one chip or one underline; the cursor touching one shows the characters; copying copies the characters
- [ ] Typing ``` or ::: at the end of a line adds the closing fence below; not when it closes a block above
- [ ] Selecting lines and typing ` makes a code block; within one line it makes inline code
- [ ] Selecting whole lines and typing : makes a card, with blank lines around
- [ ] [Mac] With Edit → Substitutions on, smart quotes and dashes stay straight inside code and curly outside
- [ ] "Start writing…" shows in an empty note
- [ ] The text cursor is the accent color, blinks, and never leaves a stray caret behind
- [ ] ⌘F opens the find bar over the note, in the app's look, with the cursor in its field, from anywhere in the window while a note is open (the list or sidebar too); selected text is what it finds; it counts as you type ("3 of 12", "No results", a red note for a regular expression that isn't valid); Aa, .* and ab match case, use a regular expression or whole words; ↵ and ⇧↵ (and ⌘G, ⇧⌘G) go to the next and previous match; the chevron shows Replace, where ↵ replaces the match and ⌘↵ all of them (not in a read-only note); Esc closes it, back in the note; the same in LaTeX notes, floating notes and dark themes
- [ ] ⌘Z and ⇧⌘Z undo and redo; switching notes and back keeps each note's undo history and scroll position
- [ ] ⌥↑ and ⌥↓ move lines; ⇧⌥↑ and ⇧⌥↓ copy them
- [ ] ⇧⌘\ with the cursor beside a bracket only toggles focus mode (it's also CodeMirror's "matching bracket")
- [ ] [Mac] Ctrl+N in the editor makes a new note and doesn't also move the cursor down

## 2. Format toolbar

- [ ] Selecting text with the mouse shows the toolbar above the selection once the button is released
- [ ] [Touch] The toolbar shows below the selection, clear of the system menu, with larger buttons
- [ ] Buttons show which styles the text already has; clicking toggles them and keeps the selection
- [ ] No toolbar in code blocks, on a selected image or file, in trashed notes, or over fence-only lines
- [ ] Esc hides it until the selection changes

## 3. Key: Value lines

- [ ] Hovering the value of a line like **Plate:** 3WBZ56 shows a copy button; it copies just the value and shows a check
- [ ] [Touch] The copy button is always faintly visible
- [ ] Times like 10:30 and URLs don't get a copy button
- [ ] A Key: Value line (or bullet) that fills the line to the note's edge stays one line: its copy button shows in the margin rather than wrapping onto a line of its own

## 4. Tables

- [ ] Tables render with alignment, styled text and links in cells; selecting across one keeps it rendered
- [ ] A table wider than the note scrolls sideways inside its own edges; the note's text beside it stays within the window, none cut off at its right
- [ ] Clicking a cell shows the Markdown with the cursor in that cell
- [ ] ⌘-click a link in a rendered cell opens it
- [ ] Hovering a cell shows a copy button that copies the cell's text; empty cells have none
- [ ] Tab and ⇧Tab move between cells and re-align the table; Tab after the last cell adds a row
- [ ] Enter adds a row below; Enter on an empty last row leaves the table
- [ ] `/table` inserts a table with the cursor in the first header cell
- [ ] Pasting rows from a spreadsheet makes a table, numbers right-aligned; one ⌘Z gives the pasted text instead
- [ ] Pasting a table from a web page or Google Docs makes a table
- [ ] Pasting text that isn't a table pastes it as text; pasting in code pastes plain text
- [ ] Tables in quotes and list items stay Markdown
- [ ] Formulas (QA note "Table with formulas"): a cell like `=SUM(B2:B3)` shows its result once IronCalc has loaded (faint formula for a moment the first time), the header being row 1; `=B2/0` shows `#DIV/0!` in red; hovering a result shows its formula; the cell's copy button copies the result; with the cursor in the table the formulas show; `\=` stays a plain `=`; the PDF shows results
- [ ] Pasting rows whose last one has a formula (a total) still right-aligns the number column

## 4a. Spreadsheets

- [ ] ⓘ → Spreadsheet turns a new note into an empty grid under a faint "Title"; typing a title and Return goes into the grid; ↑ from row 1 goes back to the title
- [ ] The grid fills the editor's width and height, column letters and row numbers stay put while it scrolls both ways, and a long sheet scrolls smoothly
- [ ] The current cell's outline (and a formula's references, filling, moving and a block's resize outline) is as thick in the first and last row and column as elsewhere, letters and numbers shown or hidden, and while writing in the cell; in a corner cell (all four with the letters and numbers hidden, else the bottom right) it rounds with the grid's corner, an even ring inside its border
- [ ] Typing in a cell replaces what's there; Return, F2 or a double-click changes it instead; Return keeps it and moves down, Tab across, and after Tab-Tab-Return the next row's first cell; Esc leaves it as it was; ⌥Return makes a line break in the cell
- [ ] Arrows move, ⇧ and arrows (or drag, or ⇧-click) select, ⌘ and an arrow goes to the end of what's written, ⌘A selects everything and Esc goes back to one cell; Home and End go to the row's first cell and its last written one (with ⌘, the sheet's first and last), Page Up and Page Down a screenful; clicking a column letter or row number selects it
- [ ] `=SUM(B2:B4)` shows the sum; the bar above shows the cell's name and formula, and clicking it changes the cell; numbers line up right, TRUE/FALSE and errors in the middle, errors in red; `$450.50`, `12%` and `2026-01-15` are read as money, a percentage and a date
- [ ] ⌫ clears the selection; ⌘Z and ⇧⌘Z undo and redo cell changes, one at a time, with focus staying in the grid
- [ ] ⌘C then ⌘V elsewhere in the sheet pastes formulas with their references moved (`=SUM(B2:B3)` one column right is `=SUM(C2:C3)`); one cell pasted over a selection fills it; ⌘X then ⌘V in the same grid moves the cells, as dragging them does (formulas pointing at them follow, and a moved formula keeps its references), pasting again copies; copied cells paste into Numbers, Excel or Google Sheets as values; rows copied from those apps (or a web page's table) paste into the grid
- [ ] ⌘D fills down and ⌘R fills right, formulas moving as they go
- [ ] The selection's corner has a small square (not in a read-only note, nor while writing in a cell); the pointer is a crosshair over it. Dragging it down, up, left or right shows a dashed outline of what will fill and, by the pointer, what goes in the last cell; letting go fills it and selects it all. A click on the square fills nothing; Esc while dragging stops
- [ ] Filling goes on from the selection in each column (or row): 1, 2 → 3, 4; 10, 8 → 6, 4; 1.50, 2.25 → 3.00; Item 1 → Item 2; Room 007 → Room 008; Mon → Tue, Sun → Mon; JANUARY, MARCH → MAY; lundi → mardi with the app in French; 2026-01-31 → 2026-02-01; 2026-01-15, 2026-02-15 → 2026-03-15; dragged up, 3, 4 → 2, 1. One number repeats; `=A1*2` dragged down is `=A2*2`; a, b → a, b, a; an empty cell clears what it's dragged over
- [ ] Holding ⌥ (Ctrl on Windows) while letting go swaps them: one number counts up, a series repeats; the label by the pointer changes as ⌥ is pressed
- [ ] Double-clicking the square fills down as far as the column beside goes on (left, or right if that's longer)
- [ ] In a ```csv block, dragging the square past the last row or column grows the grid to take it, and the block's CSV gets the new rows; in a note, dragging past the bottom scrolls the grid as the pointer moves
- [ ] The cells' menu has Autofill Down when the selection is several rows with something written at its top and empty rows after (Autofill Right likewise across), filling as dragging would; VoiceOver says "4 cells filled"
- [ ] [iPhone, iPad] The square is big enough to drag with a finger, and dragging it doesn't scroll the grid
- [ ] Typing `=su` lists SUM first (then SUMIF, SUMPRODUCT…, each with what it does); ↑ ↓ move, Return or Tab writes `SUM(`, Esc puts the list away and Esc again leaves the cell as it was; clicking a suggestion takes it without leaving the cell
- [ ] Inside `SUM(` a hint shows `SUM(number1, [number2], …)` with the current argument in bold and what it's for; after a comma the next argument is bold
- [ ] After `=`, `(`, a comma or an operator: clicking a cell writes its reference, dragging writes a range, and clicking another replaces it; ↑ ↓ ← → point from the cell being written in, ⇧ and an arrow stretches to a range; typing `+` and pointing again adds a second reference; each reference is outlined on the grid in its own color (the one being pointed at dashed) and colored in the bar above
- [ ] Writing text that isn't a formula, the arrow keys still keep it and move to the next cell
- [ ] Right-click (or ⇧F10) opens the cells' menu: Cut, Copy, Insert Row Above/Below, Delete Row, Insert Column Left/Right, Delete Column (counts when several are selected), Clear; inserting a row inside a sum's range widens the sum; Esc gives focus back to the grid
- [ ] `#tag` on the title line shows as a tag and puts the note under it in the sidebar; the list shows the title and the first cells as the excerpt
- [ ] A trashed spreadsheet can't be changed (no typing, pasting or menu changes), but can be scrolled and copied
- [ ] Spreadsheets plugin off: the note shows its text (title, blank line, CSV) and can be changed; on again, the grid
- [ ] [Mac] [Touch] Typing (with accents and an IME), copying and pasting, and the menu work the same as in Chrome
- [ ] In a Markdown note, a ```csv block is a grid as big as its CSV (an empty one 3 × 3; past 15 rows it scrolls, and scrolling on past its end scrolls the note) and as wide as its columns, without the bar above, no sideways scrolling until its columns don't fit (ten months across do); `Rent, 1200` reads as two cells, `=SUM(…)` is worked out; no cell is outlined until you click into it, and the outline goes when you click back into the text
- [ ] A block's round corner handle (on hover, or while working in it; always on a touch screen) dragged down and across adds rows and columns, a dashed outline and label (4 × 3) showing the size, and its CSV keeps the empty ones (`,,`); dragged back it takes out empty ones, but stops at any with something written; Esc while dragging stops; typing in a 3 × 3 block keeps it 3 × 3
- [ ] Return in a block's last row goes to a new row below (kept once something's written in it); Tab past the last column, a new column; ↓ from that new row goes back to the text, and ← → and Tab move along it; Insert Column Right on the last column (and inserting into an empty 3 × 3 block) widens the block
- [ ] ```csv name=costs shows "costs" above the grid; clicking it, or Name… / Rename… in the menu, writes it in a field (only the accent ring around it, no light edges inside, in dark mode too; Return keeps, Esc doesn't, empty takes the name out), written after `csv` on the fence line, a width after it kept
- [ ] Typing `=Fi` lists a note Finance (with a grid icon, "Note, its first spreadsheet") before FILTER and FIND; `=co` lists COUNT, COUNTIF, CONCAT, COUNTA, then Trip/costs, then the other CO… functions; `='` lists every spreadsheet (this note's named blocks, spreadsheet notes, notes with a csv block and their named blocks, not this note itself), `='bud` narrows to Budget 2026; Return, Tab or a click writes `='Budget 2026'!` (or `Finance!`), Esc puts the list away; VoiceOver says each as ↑ ↓ reach it
- [ ] After `=Finance!` its column ranges (`B2:B4` · Cost, below its header) and cells (`B4` · $1,650.00 · Total · Cost) are listed, `=Finance!B` only column B's; choosing one writes it; with `=Finance!B4` written, a box under the cell shows "Finance!B4", $1,650.00 (a formula's result, money as it shows) and Total · Cost; `Finance!B2:B4` shows its values and "3 cells with something in them"; an empty cell shows "empty"; VoiceOver reads it with the cell
- [ ] In a note with two blocks, type `=` in the second, then click a cell of the first: `=Sheet1!B3` is written (the first block named Sheet1 above it, its fence ```csv name=Sheet1), the cell outlined dashed, and its value previewed under the formula; dragging over cells there writes a range; Return keeps it; a block named already keeps its name; with the app in Spanish it's Hoja1; the same click with no formula being written just selects there
- [ ] With Finance open beside Plan: in Plan's grid type `=SUM(`, drag over Finance's B1:B2: `=SUM(Finance!B1:B2` (a named block there: `'Finance/costs'!…`), outlined in Finance until it's done; Return works it out
- [ ] Two windows or tabs of lines (web: two tabs side by side, or Chrome's split view; Desktop: a floating note): type `=` in one's grid; the other shows "Click cells to use them in the formula in Plan · Return to finish · Esc to cancel" at its bottom and a cell pointer over its grids; clicking a cell there writes `=Finance!B2` in the first, whose cell stays open; Return there keeps it, Esc leaves the cell as it was, a click on its text keeps it; then the note goes and that window's grids select and take typing at once (also going back to the first window and pressing Return there)
- [ ] [Desktop] After pointing at another block's (or note's) cell, clicking the note's text keeps the formula, and the grids can be clicked and typed in at once (not only after opening another note and coming back)
- [ ] Type `=` in a cell, click another cell of the same grid (a block's or a spreadsheet note's), type `+`, click another: `=A1+B1`
- [ ] A note with two blocks that each use another note (`=Finance!G6` in one, `=Finance!B1:B12` in the other): typing in either and pressing Return, then clicking its cells a second later, selects them; it never stops responding until another note is opened
- [ ] In the same note, `=costs!B2` uses that block's cell; `=Budget!B2` a note called Budget (its first ```csv block, or a spreadsheet note's cells), `='Trip/costs'!B2` the block named costs in Trip; changing that note changes the result; a name nothing has is `#REF!`; downloading an Excel workbook of a spreadsheet note using `Budget!B2` has a Budget sheet
- [ ] Renaming a block from its name over the grid (`costs` → `Expenses 2026`): `=costs!B2` in the note's other blocks becomes `='Expenses 2026'!B2`, `='Trip/costs'!B2` in other notes (a note open beside included) `='Trip/Expenses 2026'!B2`, at once, the grid keeping the keyboard; ⌘Z puts the name and the formulas back, ⇧⌘Z renames them again; renaming the note Trip to Journey (typing its title, then a pause) makes them `='Journey/Expenses 2026'!B2`, and `=Trip!B3` becomes `=Journey!B3`, even after a pause with no title or partway; a spreadsheet note renamed (`Money` → `Money box`) the same, taken up at once on opening another note; a name another note already has leaves the formulas as they are
- [ ] Settings → Editing → Spreadsheets: Highlight top row and Highlight left column make those cells bold on a tint, as a table's header (in blocks and notes, at once; the cell being written bold too; printed bold); a highlighted top row stays put sorting; Column letters and row numbers off hides them, the grid reading as a table, and clicking, writing in a cell (the field right over it), filling, moving and resizing still land on the right cells
- [ ] Hold a cell still a moment, then drag: a dashed outline shows where it goes, the cursor a closed hand; letting go moves it (with the rest of the selection, held inside it) over what's there, and `=A1*2` elsewhere pointing at it follows; dragged past a block's edge, the block grows; Esc puts it back; a press that moves at once selects as before; a click inside a selection selects that one cell
- [ ] A block's buttons sit 6px beside its right edge, level with its top (a grid's, below its name; a table's; a diagram's or a drawing's picture), more of them going down that edge; where the note's margin or a card's is too narrow (a grid or table as wide as the note in a narrow or floating window, or in a card), they go inside its top right corner, 6px in, and switch live as a window, a grid's columns or a diagram are resized. The button and the menu's Convert to Table make it a Markdown table, header first, numbers on the right; hovering a table shows Convert to Spreadsheet, which makes it a ```csv block again with its formulas; both are one ⌘Z
- [ ] Several rows selected: the menu's Sort Ascending / Descending by Column B sorts them whole (numbers, then text with Item 2 before Item 10, empty last); a header row of text over numbers stays; one row selected sorts its columns; formulas move with their rows
- [ ] Format as Currency writes the selected numbers as `$1200` (the currency chosen in Settings → Editing → Spreadsheets), shown $1,200.00; on money it's Remove Currency; Settings' Money style ($1,200.00, $1,200, USD 1,200.00) and Currency (€: 1 200,00 € in French) change every grid at once
- [ ] Settings → Editing → Spreadsheets → Negative numbers: -$1,234.56, ($1,234.56), and either in red change every grid at once, for money and plain numbers (`-5` → (5)), formulas' results too, and the sum below a selection; with parentheses, $1,200.00 above ($45.50) has its decimals in line; red is the theme's; printed the same; VoiceOver still hears "-45.50"; copied, it's ($45.50)
- [ ] Symbol at the cell's left edge on: `$` sits at each money cell's left, the amount on its right (USD with the Money style USD 1,234.56; whole amounts too), columns wide enough for both; with the app in French, `1 200,00 €` stays as it is; off, `$1,200.00` again; printed the same
- [ ] Formula results in full, with the minus: B1 `$2`, B2 `-$3`, `=SUM(B1:B2)` is -$1.00 (red with red negatives), `=B1/3` $0.67, `=B1-3` -$1.00; A1 `1,200` and `=A1-1201` is -1, `=A1*2` 2,400; `5%` and `=C1-5.6%` is -0.6%; `₹500` and `=D1*2` is ₹1,000.00; `=Finance!B4` of another note's money is money, and plain once that cell is written as a plain number
- [ ] With B1 `$5`: `=B1`, `=B1*2`, `=SUM(B1:B2)`, `=MAX(B1,B2)`, `=ROUND(B1/3,2)`, `=IF(B1>1,B1,0)` and `=Sheet1!B1` from another block or note show money ($5.00…); `=COUNT(B1:B2)` shows 2; a formula pointing at a cell to its right or below, or at another formula that's money, shows money as the note opens; writing `$5` over a plain 5 a formula points at makes the formula money at once, and `5` back makes it plain
- [ ] Typing `11/5/2026` (or `5/11/2026` with the app in French, `Nov 5, 2026`, `5 de noviembre de 2026`) keeps `2026-11-05`, shown in Settings' Dates style (Nov 5, 2026 by default, 11/5/26, November 5, 2026, 2026-11-05); pasted dates too; printed the same
- [ ] Selecting several cells shows Sum, Average and Count below a block (a note's on the bar above its grid), as money if they're all one currency; Settings → Editing → Selected cells turns each of Sum, Average, Min, Max and Count on or off, all off showing nothing; a screen reader reads them with the cell
- [ ] Double-clicking a cell to change it: its text stays exactly where it was (also in the Mac app)
- [ ] ↓ on the line above a ```csv block goes into its first row, ↑ on the line below into its last; ↑ from its first row and ↓ from its last go back to the text (↓ adds a line after a block that ends the note); Return keeps focus in the grid, and ⌘Z undoes a change to the block
- [ ] `/spreadsheet` (and `/csv`… by its keywords) puts in an empty ```csv block with the cursor in its first cell; typing, Tab and Return fill it in, written into the block as CSV
- [ ] In a three-row block, `=s` shows its suggestions (and `=SUM(` its hint) whole, hanging below the block over the note's text; with the cell near the window's bottom, above it
- [ ] The cells' menu in a block ends with Edit as CSV: the block's text shows in its place with the cursor at its start; moving out of it draws the grid again; a trashed note's block can't be changed
- [ ] Several ```csv blocks in one note each keep their own cells and formulas; one in a card is inset like the card's text; one in a list or quote is code
- [ ] PDF and printing show a ```csv block as a table, formulas worked out (those using other blocks and notes too), dates and money as on screen; Spreadsheets off, the block is code, `/spreadsheet` is gone and tables have no Convert to Spreadsheet
- [ ] Any menu (a cell's, a note's) opens again right after an item was chosen from it, by keyboard or pointer
- [ ] Right-clicking a column letter selects that column (written rows) and opens the cells' menu (Insert/Delete Column, Sort … by Column B); a row number likewise; the corner selects everything; a column inside a selection of whole columns keeps that selection
- [ ] [Desktop] Right-clicking anywhere in what a note draws (a grid's letters, numbers, borders and cells, a table, a diagram, a block's buttons) never shows the webview's own menu (Reload, Inspect Element); in a note's text, a text field or selected text it still shows (spelling, Cut, Copy, Paste)
- [ ] Share → Copy CSV, Copy Plain Text (title and tab-separated values), Download CSV (formulas), Download Values as CSV and Download Excel Workbook; the workbook opens in Numbers or Excel with formulas and values; [Desktop] each saves to Downloads and shows the file in Finder

## 5. Cards and callouts

- [ ] Cards draw behind their text, nest, and keep a gap between cards that touch and after a code block
- [ ] Enter on a second empty line at the end of a card leaves the card
- [ ] `/card` makes a card from the line, with blank lines around
- [ ] Each callout kind (`:::i`, `:::?`, `:::!`, `:::!!!`, `:::^`) has its color and icon, with the icon level with the first line
- [ ] Moving or deleting all the text out of a callout leaves its icon in the middle of the empty card, not on the closing fence
- [ ] `/info`, `/question`, `/warning`, `/error` and `/decision` insert callouts
- [ ] Clicking a callout's icon opens the picker; choosing an icon writes `icon=…` on the fence; No Icon writes `icon=none`; Reset removes it
- [ ] Choosing a kind's own icon leaves the fence without `icon=`
- [ ] A callout with no icon shows a faint + to add one while its fence is hovered or has the cursor
- [ ] The cursor and focus stay put when the icon is clicked; trashed notes don't open the picker

## 6. Code blocks, diagrams and math

- [ ] ↓ on the line above a table, diagram, math block or type table (and in a LaTeX note, its math, tables and folded preamble) stops on its first line, showing its source; ↑ on the line below stops on its last; ↑ and ↓ within a wrapped line still move along it
- [ ] A long `$$` equation scrolls sideways inside its block on a phone, the note's text staying within the window; an attached file deep in cards stays inside them, a long name cut with "…"
- [ ] Opening a note from a mention (⌥↵ or ⌘-click) or with ⌘N while typing: moving into a table or diagram shows its Markdown, and selecting text shows the format toolbar, without clicking first
- [ ] Languages highlight in the theme's colors, loading the first time they're used; unknown languages show plain
- [ ] The copy button copies the code without its fences
- [ ] The wand tidies JSON (long numbers keep every digit), SQL and Prettier languages, in one undo step
- [ ] A bad block shows "Couldn't format: …" for a few seconds; editing while it formats doesn't get overwritten
- [ ] A mermaid block draws as a diagram in the theme's colors; clicking it shows the code with the diagram below, redrawn as you type
- [ ] Hovering a diagram (or its preview while editing) shows a shapes button, Copy and Edit as Drawing: it opens the diagram in Excalidraw, a flowchart as boxes and arrows to move, a pie or Gantt chart as a picture of it; Save puts the drawing on its own line below the code block, which stays, with the cursor where it was; Cancel adds nothing; ⌘Z takes the drawing out. No button on a broken or empty diagram, nor in the Trash
- [ ] Hovering a diagram shows a handle on its bottom right corner, as an image's (always on touch): dragging it resizes the diagram, keeping its shape and no wider than the note, and writes the width after the language (` ```mermaid |300 `); double-clicking it takes the width out. A width typed by hand works the same; the PDF preview and PNGs use it. No handle on a broken or empty diagram, nor in the Trash
- [ ] A broken diagram shows a short error; an empty one shows "Empty diagram"
- [ ] Changing theme, light/dark or font redraws diagrams
- [ ] `/code` and `/diagram` insert their templates
- [ ] `$x^2$` draws as math, and shows its LaTeX while the cursor is on it; `$5 and $10` stays text
- [ ] A `$$` block (or ```` ```math ````) draws centered; clicking it shows the LaTeX with the math below, redrawn as you type
- [ ] Enter after a new `$$` adds the closing `$$` with the cursor between; Enter on a block's closing `$$` just starts a new line
- [ ] LaTeX KaTeX can't read shows red, as written, with the reason on hover; an empty block shows "Empty math"
- [ ] Math in a table cell draws; `/math` inserts a block
- [ ] `\` inside `$…$`, a `$$` block or ```` ```math ```` opens the math menu (`\fr` → `\frac`, with symbols on the right); outside math, `\*` and other escapes don't open it
- [ ] Picking `\frac` writes `\frac{}{}` with the cursor in the first braces; Tab goes to the second, then past it; Tab in the menu completes (`\al` → `\alpha`)
- [ ] Smart quotes stay straight in math (`f'(x)`)

## 6a. API requests

- [ ] `/request` adds an ` ```http ` block with the cursor after `https://`; the block's methods, header names, `{{variables}}`, comments and JSON in bodies highlight in the theme's colors
- [ ] An `http` block's top right corner has Send, Copy as curl (a terminal icon) and Copy; Send sends its request, or for several says Send all and sends each in turn (a later one using an earlier one's response works); ⌘↵ with the cursor anywhere in a request sends just it. The response shows under the block: status (green for 2xx, red for 4xx and 5xx), time, size, and the body, JSON indented and highlighted however long (a 1 MB one too, typing in the note staying quick), its objects folding from the margin, an image shown. ⌘↵ outside a request still makes a todo
- [ ] In a body, a web address has Send's icon after it: clicking it adds `###` and `GET` the address after the request it came from (at the end of the block in a Markdown note; after the request in a `.http` note), with its headers but Content-Type, and sends it, its response showing below; not in a locked note or the Trash
- [ ] Hovering a JSON value's line shows a copy button at its end: a string copies without quotes, a number as written, an object or array (on the line it opens on) as indented JSON
- [ ] Headers shows the response's headers; Copy copies the body or the headers; × closes it; while sending, × cancels and says Cancelled
- [ ] `@api = …` in one block works in another block of the note; a request using `{{todo.response.body.$.userId}}` before `# @name todo` was sent says to send that first, and after, sends with the value; an unknown `{{name}}` says there's no such variable and sends nothing
- [ ] Pasting a curl command (Chrome's Copy as cURL, with `$'…'` and `\` continued lines) into an `http` block writes it as a request, JSON bodies indented; pasted anywhere else it stays as written
- [ ] Copy as curl copies each of the block's requests as a curl command, variables filled in, and shows a check for a moment; Copy still copies the text as written. In a `.http` note, Send and the terminal icon are at the end of each request's line (the icon while the line's hovered, always on touch), for that request
- [ ] **+** on a response adds its body as a code block after the requests' block, and closes the response; ⌘Z takes it out
- [ ] A note switched to HTTP Requests in its ⓘ panel shows in a monospace font, `###` titles bold and in the outline, Send at the end of each request's line, and responses under each request; its title in the list is its first line, its excerpt its requests; `# #tag` tags it
- [ ] Importing a `.http` file makes an HTTP Requests note; Download and Export write it as `.http`; ⌘P prints it highlighted
- [ ] [Desktop] An API without CORS (`GET https://example.com`) answers; `Cookie` and `Origin` headers reach the server as written (`GET https://httpbin.org/headers`); `GET http://localhost:…` works, `GET http://example.com` says the apps only send to https:// and localhost
- [ ] [Web] An API without CORS says it didn't answer, and why
- [ ] VoiceOver reads Send, the response's status as it arrives, and its buttons

## 6b. Secrets

- [ ] A locked note with properties `type: secrets` and `token: …` is a secrets note; one that isn't locked isn't read
- [ ] `{{token}}` in a Markdown note shows a key, `token` and dots; Show reveals it (and hides it after 15 seconds, or when locked notes close); Copy copies it; with the cursor in it, it shows as written. `{{nope}}` has an outline and says there's no such secret. In code it's text. `/secret` writes `{{}}`
- [ ] With locked notes closed, Show or Copy asks for their password ("Your secrets are kept in a locked note"), with Touch ID [Mac]; Cancel does nothing
- [ ] `Authorization: Bearer {{token}}` in a request sends the value (`https://httpbin.org/headers` echoes it); a secret in the address shows as `••••` in the response; Copy as curl writes `"${TOKEN}"`; with locked notes closed Send asks first, and Cancel says why in the response
- [ ] Printing and the PDF show `token ••••••`; Copy, Download and Export keep `{{token}}`
- [ ] Secrets off: `{{token}}` is text, `/secret` is gone; requests still use it

## 6c. Hurl

- [ ] `/hurl` adds a ` ```hurl ` block; methods, `HTTP 200`, `[Sections]`, names, queries, filters, predicates, strings, regular expressions and `{{templates}}` highlight
- [ ] Send all runs the entries in order: a `[Captures]` value (`owner: jsonpath "$.userId"`) is used by the next entry's `{{owner}}`; `[Query]`, `[Form]`, `[BasicAuth]` and `[Cookies]` are sent (`https://httpbin.org/anything` echoes them); a JSON body is sent as JSON
- [ ] A response shows "3 passed" in green or "1 failed" in red beside its status; Checks lists each check with ✓ or ✗, and what the response had for a failed one; it opens on Checks when one failed. Send all stops at the first entry that fails
- [ ] Asserts with jsonpath (wildcards, filters `[?@.price < 10]`), header, regex, xpath on HTML, duration, sha256 `== hex,…;`, `count`, `nth`, `toInt`, `not`, `exists`, `isString`, `matches /…/` and `== {{variable}}` work; one lines can't do (`certificate`, `version`) says so in its check
- [ ] A note switched to Hurl: Send at the end of each request line, ⌘⇧↵ sends all, the comment above each request is in the outline; importing a `.hurl` file makes a Hurl note
- [ ] [Desktop] An entry without `location: true` shows a redirect's own status (`HTTP 302`); with it, the page it leads to

## 7. Images and files

- [ ] Pasting an image, or dropping one onto a note, adds it on its own line; the cursor moves past it
- [ ] Dropping files puts them above or below the line under the pointer
- [ ] Pasting text that also carries a file (a document paragraph) pastes the text
- [ ] TIFF and BMP images become PNG; unreadable images become files
- [ ] `/image` and `/file` open the file picker
- [ ] Nothing can be attached in code, tables or trashed notes
- [ ] Files show as a card with an icon, name and kind · size
- [ ] An image or file that hasn't synced yet says so, and appears when it arrives
- [ ] Clicking an image or file selects it; Delete removes it; ↑ and ↓ stop on it first
- [ ] An image or drawing on its own line shows a round handle with a corner mark just past its bottom right corner on hover (always on touch), the same as a diagram's and a spreadsheet block's; dragging it resizes the image, keeping its shape, between 48 px and the note's width, and writes the width into its Markdown (`![Lake|400](…)`); ⌘Z undoes it; double-clicking the handle goes back to the image's own size. No handle in the Trash
- [ ] Typing `|300` after an image's alt text shows it 300 px wide, inline images too; the description read aloud leaves out the `|300`; the PDF preview and PNGs use the width
- [ ] Double-click (or ⌘-click) opens a file: in its app [Desktop], a new tab or download [Web], saved to Downloads or Documents [Touch]
- [ ] [Desktop] Scripts and apps attached as files are shown in Finder, not run
- [ ] Pictures from the web show; a broken one says it couldn't be shown
- [ ] `/drawing` opens Excalidraw full-window in the app's language and light or dark, with Cancel (×) and Save (✓, in the accent) as icons at the canvas's top right, the size of Excalidraw's undo and redo, each with a tooltip (in a row above the canvas on a phone or a window narrower than 820 px, Cancel at the left); Save (⌘S) puts the drawing on a line of its own, as `![Drawing](../attachments/….svg)`; a blank drawing adds nothing
- [ ] Excalidraw has no image tool, no Library or help button, and its menu has only Find on canvas, Reset the canvas and Canvas background (no GitHub, X or Discord links)
- [ ] Excalidraw takes the theme's colors (try a few themes, light and dark): its toolbars and menus in the theme's surfaces, text and font, the chosen tool, sliders and the selection box in the accent, and the canvas the note's own background. A drawing given a canvas background in Excalidraw keeps it, in Excalidraw and in the note
- [ ] A drawing has no edge, shows light on dark in dark themes, and has a pencil button on hover (always on touch); the button, a double-click, or Enter with it selected opens it with its shapes editable
- [ ] Changing a drawing and pressing Save replaces its link with a new one; ⌘Z in the note brings the old drawing back. Save with nothing changed leaves the note alone
- [ ] Cancel, or Esc outside the canvas (on Cancel or Save, say), closes at once when nothing changed; with changes it asks "Discard your changes to this drawing?" (Keep Editing goes back to the canvas). Esc in the canvas is Excalidraw's (stops editing text, deselects) and never closes it
- [ ] Excalidraw's keys work while it's open (letters pick tools, ⌘Z undoes a stroke, ⌘A selects all) and don't reach the app (⌘/ doesn't open Settings, ⌘Z doesn't restore a trashed note)
- [ ] Excalidraw's hand-drawn font shows offline [Web] and in the apps; dropping an `.excalidraw.svg` exported from excalidraw.com with "Embed scene" makes a drawing lines can edit
- [ ] A drawing prints and shows in the PDF preview, dark on white
- [ ] Pasting an Unsplash photo's link (its page, or the picture) on an empty line adds the photo, described by the words in the link; ⌘Z turns it back into the link. Pasted within text, or over selected text, it stays a link. An Unsplash+ photo says it couldn't be shown
- [ ] `/unsplash` (Photo) and `/giphy` (GIF) are right after Image in the "/" menu; each takes out what was typed and opens a picker at the cursor (above it near the window's bottom), focused in its search field, showing Unsplash's picks or GIPHY's trending GIFs, three across, each in its color while it loads. Typing searches after a pause; ↵ searches at once, or takes the first picture once the ones shown are for what's typed
- [ ] In the picker, ↓ goes into the pictures, the arrow keys, Home and End move between them (↑ from the top row goes back to the field), and ↵ or a click puts one in on a line of its own, as `![description](https://unsplash.com/photos/…)` or `![description](https://media.giphy.com/media/…/giphy.gif)`, with the cursor on the line after it. Pointing at or focusing a picture shows who made it. Esc or a click outside closes it, with focus back in the note
- [ ] Scrolling to the end of the pictures loads more. A search that finds nothing says so; with no connection (or a bad key) it says it couldn't reach Unsplash or GIPHY, with Try Again. The credit under the pictures ("Photos from Unsplash", "Powered by GIPHY") opens their site
- [ ] With reduced motion on in the system, GIFs in the picker and GIPHY GIFs in notes are still

## 8. Lists, todos and moving

- [ ] Tab nests a list item with its sub-items under the one above; Tab on the first item does nothing
- [ ] ⇧Tab moves it back out; Backspace right after a marker moves it out, or turns it into text at the top level
- [ ] The Todo section lists notes with open todos; ticking the last one removes the note from it
- [ ] Hovering a line shows a grip on its left; it covers the line, a list item with its sub-items, or a whole heading, table, code block, quote or card
- [ ] In a callout the grip sits left of the icon column, not over the icon
- [ ] Clicking the grip selects the block; dragging it shows a drop line that glides from place to place (fading out where dropping would leave the note as it is, such as anywhere between a paragraph and the cards right around it, and never two lines in one gap that would do the same), scrolls near the edges, and moves the block: it and the lines it passes slide into their new places rather than jumping. With reduced motion turned on in the system, nothing slides
- [ ] Moved list items take the indent of where they land; tables and cards get blank lines around them
- [ ] [Touch] No grips

## 9. Slash commands

- [ ] `/` at the start of a line or after a space opens the menu, with Format and Insert sections; not in code or links
- [ ] Typing filters it (`/to` → Todo, `/checkbox` → Todo); no match closes it
- [ ] ↑, ↓, Enter and clicking choose; Esc closes
- [ ] Tab completes like a shell: `/to` + Tab makes a todo (one name left); `/he` + Tab becomes `/heading`; Tab again moves to the next heading and ⇧Tab back; Tab never indents the line while the menu is open
- [ ] Each command does what it says: Text, Heading 1–3, Todo, Bullet list, Numbered list, Quote, Code block, Diagram, Math, Card, the five callouts, Table, Spreadsheet, Image, Photo, GIF, File, Drawing, Divider, Link, Tag, Mention, Type table, Properties, Date
- [ ] `/properties` in a note without properties adds `---`, `type: ` and `---` at the top with the cursor after `type: `; in a note with them, it adds a line at their end
- [ ] Block commands replace a line's existing prefix rather than stacking; Divider under text adds a blank line so the text doesn't become a heading

## 10. Note list

- [ ] New note (⌘N in the apps, ⌥N on the web) starts with `# ` and the cursor in it; in a tag view the tag is added; in a type view it starts with `type:` properties and the cursor on the title; from Trash it switches to Notes
- [ ] Leaving a new note untouched deletes it; typing a title and pressing ⌘N (or opening another note) at once keeps it
- [ ] Rows show icon (the note's own, or else its type's), title or "Untitled", excerpt, pin, lock and date; pinned first, then newest
- [ ] A note with properties shows the line after them as its title, and an excerpt without them
- [ ] ↑ and ↓ move between notes when the list has focus; Home and End go to the first and last note, however long the list, scrolling to it
- [ ] With thousands of notes (import a few thousand Markdown files from Settings → Data), the list scrolls smoothly, its scrollbar spans every note, and Tab, F6 and ⇧F6 reach the open note's row however far it's scrolled; a note opened from a mention, search, ⌘N or a floating note's Show scrolls into view in the list
- [ ] [Touch] Swiping right pins (restores in Trash), left trashes (in Trash, needs a tap to delete); a long swipe does the action; one row open at a time
- [ ] [Desktop] Two-finger trackpad swipes do the same; Settings → General → Trackpad reverses them
- [ ] Right-click (long-press [Touch], context-menu key, ⇧F10) opens the menu: Pin, Open to the Side (not for the open note, in the Trash, or where the window has no room for two notes), Floating Window [Desktop], Icon, Lock items, Copy Text, Move to Trash / Delete Forever
- [ ] Open to the Side (or ⌥-click, Alt-click elsewhere) opens the note beside the open one, its title over it with Swap and Close; each has its own editor (typing in one, ⌘Z, find); the line between them drags (and ← → from the keyboard, double-click for the usual width), the main note keeping at least 360 px; Swap exchanges them; selecting the note beside in the list closes it there; trashing it closes it; where the window has no room for both (a phone, a narrow window), it waits until there is, and ⌥-click just opens the note; a locked note beside shows its lock
- [ ] ⌘Z right after trashing a note brings it back
- [ ] ⌘-click (Ctrl-click on Windows and Linux) picks a note along with the open one, and again takes it out; ⇧-click picks every note from the last one clicked; ⌘A with a row focused picks every note in the list; ⇧↑ and ⇧↓ pick the way from the keyboard; a plain click, or Esc, picks just the one again
- [ ] With two or more picked, they're highlighted and the bar above the list says how many ("3 notes selected"), with Add Tag, Pin to Top (Unpin when they all are), Move to Trash and × (in Trash: Restore and Delete Forever); right-clicking a picked note opens the same as a menu named "3 notes"; right-clicking another note lets the others go
- [ ] Add Tag… opens a box with the tags in use as suggestions (↑ ↓ and Enter choose one, Tab fills it in to nest under it); spaces become dashes as you type ("Two words" adds `#two-words`); Add puts the tag on the last line if that's a line of tags, else on a line of its own at the end, in a LaTeX note as `% #tag`; notes that have it already, and locked notes, are left as they are; the notes keep their dates; a screen reader hears "Added #tag to 3 notes"
- [ ] ⌫ (Delete) with a row focused moves the picked notes, or the open one, to the Trash, and focus stays in the list; ⌘Z brings them all back at once, pinned as they were
- [ ] Changing the filter (a tag, Trash) or the search lets the picked notes go
- [ ] Trash shows "Notes in the trash can be restored." and Empty Trash; empty states read right

## 11. Sidebar, tags and search

- [ ] Above the sync button: "Alpha 0.1.0" (the version in package.json), with a tooltip saying it's an early version; the GitHub mark opens github.com/overtio/lines (in the browser, from the apps); screen readers hear the explanation and "Source on GitHub"
- [ ] Notes, Todo, Untagged and Trash filter the list, with counts
- [ ] Tags show as a tree with counts; the chevron expands nested tags; clicking filters to the tag and those under it
- [ ] Rename… renames a tag in every note (not inside code, not in locked notes), keeps its icon, and the filter follows; a name with a space becomes dashes, and one with `#` is refused
- [ ] Change Icon… works for tags, and Reset in its picker goes back to the hash; the menu has no separate Reset Icon
- [ ] Types list each `type:` with a count and icon (`person` starts as a person, an unknown type as shapes); clicking filters to its notes, and the list's title is the type
- [ ] Right-click a type → Rename… edits its name in place (Enter keeps it, Esc doesn't): every note of it gets the new `type`, every `@type.…` of it the new name (keeping its columns; not in code), the icon and the list's filter follow, and notes keep their dates; renaming onto another type merges them
- [ ] Right-click (long-press [Touch]) a type: Change Icon… (Reset in its picker goes back to the usual icon); the icon changes in the sidebar, on the type's notes in the list, and on mentions of them in an open note
- [ ] Search finds notes by their property values
- [ ] ⌘⇧F focuses search (leaving focus mode, or going back to the list on a phone); every word must match; Esc clears
- [ ] Locked notes are found only by their title

## 12. Menus, pickers and note info

- [ ] Menus open at the pointer, stay inside the window, move with ↑ ↓, and close on Esc, a click outside, scroll or resize
- [ ] The icon picker searches by name, Enter picks the first match, arrow keys move around the grid, and focus starts on the current icon
- [ ] Share: Share… where the system has it, Copy Markdown, Copy Plain Text, Download Markdown ([Web] downloads; [Desktop] saves to Downloads and shows it in Finder)
- [ ] Note info shows words, characters, sentences, paragraphs, reading time and dates

## 13. Settings

- [ ] The sections are listed down the side, each with its icon: General, Appearance, Windows [Desktop], Typography, Editing, Plugins, Sync, Privacy, Data, Shortcuts and About; each opens with its title, a line on what it's for, and its settings in groups of rows (a label and note on the left, the control on the right)
- [ ] ↑ and ↓ move through the sections (Home and End to the first and last), Tab goes on into the section, Esc closes; Settings opens on its section with that section focused; every change applies at once, in every window
- [ ] Only the section scrolls, with one scrollbar, in every section (Shortcuts too, all the way to the end); the list of sections stays put, and each section opens at its top
- [ ] Switches, selects, sliders and segmented choices look the same in every section; the selects open a list that the arrow keys and typing move through, and Esc closes the list before Settings
- [ ] Narrow (a phone, or a small browser window): Settings opens on the list of sections, filling it; choosing one opens it full width with ‹ to go back to the list, and focus follows (the section's title, then the section in the list). [Desktop] The Settings window can't be made narrower than the list beside a section
- [ ] Privacy → Synced notes: its button opens Sync
- [ ] [Web] A click outside Settings closes it; a click inside, or selecting text and letting go outside, doesn't
- [ ] [Desktop] Settings opens in its own window (the sidebar's gear, the sync button, ⌘/): one at a time, brought forward if it's open, on the section asked for; it can be moved (by its top edge on the Mac, the window buttons over the list of sections), resized and minimized; Esc, ⌘W or the window's close button closes it; closing the main window closes it too
- [ ] [Desktop] Every change in the Settings window shows in the main window and floating notes with no wait you can see, and never goes back: flip a switch (Column letters and row numbers, a theme, appearance) several times quickly and each window ends as Settings shows; drag the text size slider and the note follows each step; turn a plugin off and on the same way
- [ ] [Desktop] In the Settings window: themes and text settings change the main window and floating notes at once; connecting sync, setting up encryption, Sync Now and the sync status work as in the main window; the app lock turns on and off (Settings stays open, unlocked), Lock Now locks lines and closes Settings; locked notes' password, Touch ID and reset work; Add Feature Tour adds the notes to the main window's list and shows them there; Export saves every note
- [ ] [Desktop] With the app lock on, lines locking for being idle closes Settings; using Settings counts as using lines
- [ ] Shortcuts (also ⌘/ or Ctrl+/, even with the cursor in a note): every shortcut, grouped; shown the Mac way on a Mac (⌘⇧F, ⌃⌘L) and as Ctrl+Shift+F, Ctrl+Alt+L elsewhere, with the switch showing the other system's; new note is ⌘N (Ctrl+N) in the apps and ⌥N (Alt+N) on the web; Close a floating note only in the desktop apps; each shortcut listed does what it says; VoiceOver reads the keys in words ("Shift Command F")
- [ ] Section names and labels fit in English, French and Spanish, wrapping rather than being cut off
- [ ] General → Language: English, Español, Français and System; choosing one saves what's being typed and starts lines again in it, in every window (floating notes too); System follows the device (English when lines doesn't speak it); dates follow it (24-hour clock in French)
- [ ] Appearance → Theme: each of the 16 themes in light and dark; Appearance → Light or dark: System follows the OS live
- [ ] Appearance → Theme: the Accessibility group (High Contrast, Red-Green Friendly, Blue-Yellow Friendly) sits below the other themes with its heading and note; Tab stops once on the theme picker and the arrow keys move through every theme, across both groups
- [ ] High Contrast, light and dark: pure white or black, text black or white, borders clearly visible, the chosen segment ringed; a note with a callout of each kind, code, a tag, a mention, a highlight and a done todo reads clearly; the selected row's date stays readable
- [ ] Red-Green Friendly and Blue-Yellow Friendly, light and dark: the same note; callout kinds, danger (Delete, errors) and success are told apart, and look apart in Chrome DevTools → Rendering → Emulate vision deficiencies (protanopia and deuteranopia for Red-Green, tritanopia for Blue-Yellow)
- [ ] Appearance → Icons: Lucide and SF Symbols [Mac]; on the web SF Symbols is disabled with a note
- [ ] [Mac] Windows → Main window: opacity and blur
- [ ] [Desktop] Windows → Floating notes: theme and appearance; [Mac] opacity, blur, border, window buttons and over full-screen apps (not shown on Windows and Linux, where they do nothing)
- [ ] Typography: the preview follows font, size, spacing presets and every slider; Reset to default
- [ ] Typography → Note width: Narrow, Medium (the default), Wide and Full change how wide notes' text runs, at once and in every window; Full fills the pane beside the sidebar and list, keeping the side margins; the slider sets any width from 480 to 1400 px (no choice then marked) and, dragged while on Full, goes back to a width; spacing presets leave the width alone; a width saved before this section keeps
- [ ] ⌘+ and ⌘− (Ctrl+ and Ctrl− on Windows and Linux; ⌘= and the keypad's + and − too) make notes' text a pixel bigger or smaller, from 12 to 28 px, in the main window and floating notes alike, and Settings → Typography → Text size follows; ⌘0 goes back to 17 px; the page itself doesn't zoom (web); screen readers hear the new size; in the drawing editor the keys zoom the drawing instead
- [ ] Editing → Symbols: turning off "in text" or "in code" shows the characters there at once (tables too), in every window, and is remembered; the other keeps its symbols
- [ ] About: version, Source on GitHub, Report an issue, license, credits, third-party licenses load

## 13a. Plugins

- [ ] Settings → Plugins lists Secrets under More; Formats (Markdown, LaTeX, Spreadsheets, API Requests), Engines (Math, Diagrams, Formulas, TeX Typesetting), Look (Themes, Lucide, SF Symbols [Apple]) and More (Unsplash, GIPHY), each with its icon and what it does; Markdown, Themes and Lucide say Always on; on the web SF Symbols has no switch, and says it's in the Mac and iPhone apps
- [ ] Clicking a plugin's name (or its switch) turns it on or off; VoiceOver reads its name, whether it's on, and what it does
- [ ] LaTeX off: LaTeX notes show as plain text at once (the open one too), their titles in the list become their first line, TeX Typesetting dims and says it needs LaTeX, and a LaTeX note's ⓘ panel says its plugin is off, with Turn On, and its format switch offers only Markdown and Spreadsheet; Turn On draws it as LaTeX again at once
- [ ] With LaTeX off, Share → Copy LaTeX, Download LaTeX and Settings → Data → Export still write LaTeX notes as LaTeX (a .tex document that compiles)
- [ ] Turning TeX Typesetting on while LaTeX is off turns LaTeX on too
- [ ] API Requests off: ```http and ```hurl blocks show as plain code with no Send buttons, `/request` and `/hurl` are gone, and HTTP Requests and Hurl notes show as plain text; on again, all back
- [ ] Diagrams off: ```mermaid blocks show as code, `/diagram` is gone from the "/" menu, and the PDF prints them as code; on again, they're drawn again, and Diagram is right after Code block in the menu
- [ ] Math off: `$…$`, `$$` blocks and LaTeX notes' math show as written, on screen and in the PDF; on again, drawn
- [ ] TeX Typesetting off: a LaTeX note's PDF preview has no "Typeset with" switch
- [ ] Formulas off: formulas in tables and spreadsheets show as written, and a spreadsheet's share menu has no Download Values or Excel Workbook; on again, worked out
- [ ] Unsplash or GIPHY off: `/unsplash` or `/giphy` is gone from the "/" menu, and photos and GIFs already in notes still show. In a build without their keys they have no switch and say they need an API key
- [ ] Choices are remembered after reloading, and turning a plugin on or off in one window changes every window at once (the Settings window, floating notes [Desktop], other browser tabs [Web])

## 13b. Layout and tabs

- [ ] Settings → General → Layout: Sidebar Left/Right and Note list Left/Right; each of the four arrangements applies at once, in every window, and is remembered after reloading
- [ ] Each arrangement, wide: the sidebar is outermost on its side and the list beside the note; dividers are on each pane's inner edge; hiding the sidebar slides it out to its side; focus mode slides both away and back
- [ ] The sidebar's hide button is on its inner edge, with the icon of its side; its show button is in the note list's title bar on the sidebar's side when the list is on that side, else at the note toolbar's edge on that side; focus moves between the two as they swap
- [ ] Dragging a pane's inner edge resizes it the way the pointer goes, on either side; from the keyboard, ← and → move the edge; double-click and Enter put it back
- [ ] With the sidebar and list dragged wide, making the window smaller narrows the sidebar first, then the list, the note keeping at least 360 px; made bigger again, they go back to their widths
- [ ] Tablet width: the sidebar drawer slides in from its own side, with the scrim; Esc closes it and focus goes back to the button that opened it
- [ ] Phone width: the drawer comes from the sidebar's side, and its button is in the note list's title bar; the list and note still stack
- [ ] F6 goes through the panes left to right in every arrangement
- [ ] [Mac] The window buttons never cover anything: the leftmost pane's title bar leaves room for them in every arrangement, with the sidebar shown or hidden, in focus mode, and at each width
- [ ] Tabs are off by default; on, the open note shows as a tab in the note's toolbar, with its icon if it has one, and the space around the tabs still moves the window [Desktop]
- [ ] A note opened from the list (or a mention, or a floating note's Show) opens in the preview tab, in italics, replacing the last preview; editing it, double-clicking its tab, Enter on it, or its menu's Keep Open makes it a normal tab; the next note opens beside the open tab
- [ ] × (on hover, and on the open tab), middle-click, Delete, or the menu's Close Tab closes a tab, and the tab beside it opens; Close Other Tabs leaves one; closing the last shows "Select a note"
- [ ] Choosing another list in the sidebar keeps the open note open; trashing or deleting a note closes its tab; a blank new note left behind closes its tab
- [ ] ← and → (Home, End) go from tab to tab; many tabs shrink, then scroll, keeping the open one in view
- [ ] Tabs and the open one come back after reloading; turning tabs off removes them; at phone width there are no tabs
- [ ] Outline is off by default; on, a note with two or more headings has a short line on the right for each, longer for larger headings and darker for the part being read, which follows scrolling (at the very end, the last heading in sight); past 40 headings each line stands for a run of them; a note with fewer, or no room beside the text (phone width), has none, and it comes back with room
- [ ] Headings in the properties, a code block or HTML don't count; `# Title ##` reads "Title"; Markdown in a heading reads as text; in a LaTeX note \section, \subsection and \subsubsection (starred too) count
- [ ] Moving the pointer up and down the lines, or over the card's headings, lights the heading pointed at in the card and swells the lines in a little wave around its line, smoothly; leaving settles them back; clicking a line goes to its heading
- [ ] Pointing at the lines opens the card of headings after a moment, indented by level, the current one in the accent color; it stays while the pointer crosses to it and closes after leaving; a long card scrolls, keeping the current one in sight
- [ ] Clicking a heading glides there (at once with Reduce motion), the heading ending just below the top with no jump at the end; the cursor and focus stay where they were; scrolling during the glide stops it
- [ ] Keyboard: Tab reaches "Headings"; Enter, Space or ↓ opens the card on the current heading; ↑ ↓ Home End move; Enter goes there with the cursor on the heading and focus in the note; Esc closes the card and returns to the button; Tab away closes it
- [ ] Touch: tapping the lines opens and closes the card; tapping a heading goes there and closes it; tapping elsewhere closes it
- [ ] Turning the outline off and on in Settings applies at once, in floating notes too; it follows edits as headings are added, renamed or removed; switching notes shows the other note's
- [ ] Outline side (Settings → General → Layout, shown while the outline is on) is Right by default; Left moves the lines to the note's left edge at once, lined up on their left, with the card opening to their right over the text; on the left it needs room for the line grip too, so it hides sooner as the window narrows; the side is remembered

## 14. Sync

- [ ] [Desktop] Cloud drive: the drives on the machine are listed; Choose another folder…; Connect, Switch, Disconnect, Show in Finder
- [ ] [Web] [Chromium] Folder: Choose a Folder… saves notes there as Markdown files and keeps them up to date; after a browser restart, Allow access asks once and sync carries on
- [ ] [Web] Safari and Firefox explain that saving to a folder needs Chrome or Edge
- [ ] S3 bucket (not on the demo website): every provider's help, Test connection, Connect, Disconnect, the CORS rule [Web]
- [ ] Sync runs after edits, every minute, on focus and when back online; the sidebar shows its status
- [ ] An edit on two devices keeps the newer and adds a "(conflicted copy)"; a delete on one side deletes on the other; a conflicted copy of a note with properties keeps its type, and a spreadsheet's is marked on its title, not in a cell
- [ ] [Web] With lines open in two tabs, sync runs in one pass at a time: a conflict makes one conflicted copy, not two; connecting or switching in one tab, the other follows; opening a second tab doesn't delete images the first could still bring back with ⌘Z
- [ ] Images and files sync both ways, an empty file too [Desktop: through a cloud drive]
- [ ] Folder sync keeps working offline; a bucket says Offline and catches up

## 15. Encryption

- [ ] Set up encryption: 8 characters minimum, matching passphrases; notes upload again encrypted
- [ ] Another device asks for the passphrase once, then syncs
- [ ] Change passphrase; turn off (and "Turn off here too" on the other device)

## 16. App lock

- [ ] Turn on with a passphrase; every window reloads encrypted
- [ ] Lock after 1, 5, 15 minutes, 1 hour, Never; locks after sleep too
- [ ] ⌃⌘L [Mac] (Ctrl+Alt+L elsewhere) and the sidebar lock button lock at once
- [ ] Lock screen: wrong passphrase shakes and clears; right one unlocks
- [ ] [Mac] Touch ID prompts on its own; cancelling falls back to the passphrase
- [ ] Forgot your passphrase? → Erase this device asks first, in the lock screen itself, then starts over (synced notes come back); Cancel backs out. [Mac] it works in the app too
- [ ] Change passphrase; turn off with the current one
- [ ] [Desktop] Floating notes show "lines is locked" and reopen after unlocking

## 17. Locked notes

- [ ] Lock Note the first time asks for a new password; after that for the password, or Touch ID [Mac]
- [ ] A locked note shows its title and a password field; a wrong password shakes; the right one opens every note locked with it, in every window
- [ ] A note locked with an older password says so
- [ ] Lock Now locks them everywhere; they lock again after 5 minutes idle; typing in an open locked note and choosing Lock Now at once keeps what was typed
- [ ] Remove Lock; Change password (works on other devices once synced); Forgot password
- [ ] Locked notes stay out of tags, Todo, search (except titles) and export

## 18. Export and share

- [ ] Export makes a .zip of files named by title in their notes' formats (Markdown, LaTeX, spreadsheets as CSV with formulas), attachments in their folder, Trash in its folder when included
- [ ] Settings → Data → Import Files… makes notes of Markdown, LaTeX, CSV (comma, semicolon or tab), TSV and Excel files: a workbook's each visible sheet a note "Workbook – Sheet" (one sheet: just "Workbook"), formulas kept, formulas into other sheets as values; other files are listed as not imported
- [ ] A LaTeX note exports as a .tex file wrapped in \documentclass … \end{document}, and compiles with pdflatex; the share menu says Copy LaTeX and Download LaTeX
- [ ] Closed locked notes are left out, and the panel says how many
- [ ] [Web] It downloads; [Desktop] it saves to Downloads and Show in Finder works

## 18a. PDF

- [ ] ⌘P (Ctrl+P), or Share → Preview as PDF, opens the PDF preview of the open note; ⌘P with no note open does nothing (the browser doesn't print the window)
- [ ] The pages are white with black text in every theme, light and dark; Paper switches between A4 and Letter and lays the pages out again, and the choice is remembered (Letter by default in the US and Canada)
- [ ] Markdown: headings, lists, todos (ticked ones greyed), quotes, tables (with alignment), callouts with their colors and icons, cards, highlighted code, Mermaid diagrams, math, images, files, tags, mentions (as their text), properties at the top, type tables; symbols (→, ≠) as the editor shows them, following Settings → Editing
- [ ] No page cuts through a line of text, an image, math, a diagram or a table row; a heading isn't left alone at the bottom of a page; page numbers at the bottom
- [ ] LaTeX (lines): the paper example has its title block, abstract, numbered sections, theorems and equations, "Section 2" and "(1)" where it \ref's them, a numbered table, references and its footnote at the end; lines join into paragraphs
- [ ] Print… opens the print dialog showing the same pages, one per sheet, with nothing of the app; Save as PDF there names the file after the note
- [ ] [iOS] There's no Print… button
- [ ] Export as PDF… opens the preview and goes straight on to print (lines) or save (TeX)
- [ ] Save PNG (lines' pages) offers One Image (the whole note as one tall picture, no page numbers) and One per Page ("3 images, in a ZIP"; a one-page note saves a single PNG). [Web] It downloads "<title>.png" or "<title>.zip"; [Desktop] it saves to Downloads with Show in Finder. The images are twice the page's size, with bullets, numbers, callout icons, code colors, diagrams, math and images as on the pages
- [ ] Share → Export as PNG… opens the preview on lines' pages (a LaTeX note too, even with TeX chosen) with the PNG choices showing
- [ ] LaTeX (TeX): Typeset with → TeX downloads TeX the first time with a progress bar ("Downloading TeX… 40%"), then shows the PDF; the next note typesets in a second or two, offline too
- [ ] The paper example (booktabs), the lecture notes and the problem set all typeset with TeX
- [ ] A note with an error (`\undefined`) says "TeX stopped at line N of the note", with the error and TeX's log; Try Again typesets again
- [ ] Save PDF: [Web] downloads "<title>.pdf"; [Desktop] saves to Downloads, with Show in Finder
- [ ] A build without `bun run tex-assets` says TeX isn't included in this version
- [ ] Esc or × closes the preview and focus goes back where it was; Tab stays inside it; a screen reader hears "2 pages, ready" and each page as "Page 1 of 2"

## 19. Floating notes [Desktop]

- [ ] Open in Floating Window from the toolbar or menu; it stays on top, shows the note's title, and edits appear everywhere at once
- [ ] Moving and resizing is remembered; open floating notes come back after relaunch
- [ ] ⌘W closes it; trashing the note closes it
- [ ] [Mac] Window buttons on hover or always, as set

## 20. Layout

- [ ] Wide (1000 px and up): three columns; ⌘\ hides and shows the sidebar
- [ ] Dragging the sidebar's right edge, or the note list's, makes it wider or narrower (an accent line shows on the edge); it stops at its narrowest and widest, leaves the note at least 360 px, and double-clicking the edge puts it back. The widths are remembered after a reload. Medium windows have just the list's edge; focus mode and phones have none
- [ ] Tab reaches each edge (named "Sidebar width" / "Note list width" with its width): ← and → resize by 10 px, ⇧ by 50, Home and End go to the narrowest and widest, Enter back to the usual width
- [ ] Medium (700–999 px): the sidebar is a drawer over the list
- [ ] Narrow (under 700 px): one pane at a time; Back returns to the list
- [ ] Focus mode (⇧⌘\ or the toolbar button) shows just the note; not on phones
- [ ] Trashed notes show Restore and Delete Forever instead of the toolbar
- [ ] [Mac] The window drags by its toolbars and starts without a flash
- [ ] Reduced motion in the OS settings stops the slides

## 21. Demo website

- [ ] A first visit opens the feature tour, with the picture and the file working
- [ ] Save to a folder at the bottom of the sidebar opens Sync with only the folder option
- [ ] Reloading keeps every change
- [ ] It works when served from a subfolder (GitHub Pages): icons, the manifest and third-party notices load

## 22. LaTeX notes

- [ ] The ⓘ panel switches a note between Markdown, LaTeX and Spreadsheet; the panel stays open, and the note redraws at once
- [ ] A new note switched to LaTeX loses its "# "; one made under a tag keeps it as `% #tag`
- [ ] In **QA · LaTeX note**, each construct draws as its heading says, and its LaTeX shows while the cursor is on it
- [ ] Clicking drawn math or a table shows its LaTeX; displayed math is redrawn below as you type
- [ ] Enter after `\item text` adds an `\item`; Enter on an empty item ends the list; Enter after an unclosed `\begin{itemize}` (or `\[`) adds its end
- [ ] ⌘B, ⌘I and ⌘E wrap the selection in `\textbf{}`, `\emph{}` and `\texttt{}`, and again take it out
- [ ] In a LaTeX note, pasting rows from a spreadsheet or pgAdmin makes a `tabular` (underscores escaped, numbers right-aligned, header over `\hline`); ⌘Z once gives the rows as copied
- [ ] In a LaTeX note, pasting or dropping an image adds `\includegraphics{../attachments/…}` and shows it; a PDF adds an `\href` link; `/image` and `/file` do the same; an Unsplash link on an empty line shows the photo; a URL over selected text becomes `\href{url}{text}`; none of these happen in verbatim or math
- [ ] `/` shows the LaTeX commands (Section, Bullet list, Math, Table…), and each inserts its LaTeX; `/date` writes today in the app's language, as in a Markdown note
- [ ] `\` opens the command menu in sections (Text, Environments); inside math, or after an unclosed `$`, it shows math commands instead; after `\\` and in verbatim it doesn't open
- [ ] An environment picked after text starts on a new line; Tab moves through `\begin{tabular}{ll}`'s places
- [ ] The list shows the title and excerpt without commands; `% #tag` tags the note; note info counts the words as they read
- [ ] A LaTeX note syncs to another device as LaTeX (`format: latex` in its file)
- [ ] Each of the LaTeX examples (Settings → Data → Add LaTeX Examples) draws with no red math: the paper's preamble folds into its title and authors, clicking it shows the LaTeX; theorems are numbered (Lemma 1, Theorem 2), the proof ends with ∎, citations and references are chips, the bibliography is headed References
- [ ] [Dev] Settings → Data → Reset Notes to Defaults… asks in the panel (Delete and Reset, or Cancel), then leaves only the welcome note, the tour and the examples; it works in the Mac app; it's disabled while sync is on, and missing from release builds
- [ ] [Web] On the demo website (`bun run build:site`), Data → Start Again → Reset Notes to Defaults… asks in the panel, then leaves only the tour and the examples (no separate welcome note) and opens the tour's first note; it's disabled while saving to a folder, saying to stop that first

## 23. Properties and mentions

- [ ] In **QA · Ada**, the properties are a column of keys and values with a line under them: the type with its icon, the list items under their key's value, the comment faint, the employer a chip; the `---` lines show only while the cursor is in the properties, and the values don't move when they do
- [ ] Hovering a value shows its copy button, which copies the value as it reads (a mention as its note's title)
- [ ] In **QA · Mentions**, each line reads as it says: chips for notes, values for `.key`, grey dashed text for what isn't found (with the reason on hover), and text for emails, `owner/repo@main`, `\@` and code; wiki links (`[[…]]`) as chips too, `[[…|her]]` reading "her", a missing one grey and dashed with Create on hover, and embeds (`![[…]]`) as text
- [ ] ⌘-click on a chip or a value opens its note (also in a floating note [Desktop], where it opens in the main window); a plain click puts the cursor in and shows the mention as written
- [ ] `@` and a letter opens a menu of notes, with icons and types; it filters as you type; Enter or Tab writes `@Name`, or `@[Two Words]` for a title with spaces
- [ ] After a mention, `.` opens a menu of its properties with their values (long ones end in …), and typing filters it; Enter right after the `.` closes it and starts a new line, while Tab, a click, or ↓ then Enter picks one
- [ ] `[[` opens the same menu at once; Enter or Tab writes `[[Title]]`, taking in a `]]` after the cursor rather than doubling it. `[[` in code, and `![[`, open nothing
- [ ] A lone `@` after text, and `@` in code, open nothing
- [ ] Hovering a mention of a note there isn't shows "No note called …" and Create; Create adds that note (with the property mentioned, empty) without leaving this one, the mention becomes a chip with no underline left behind, and the new note is first in the list
- [ ] Changing a mentioned note's title, icon, type or properties (in another window, or after switching notes) redraws the mention; renaming its title makes the mention grey
- [ ] A note mentioned by two titles that match: the one with a type wins; a trashed note isn't found
- [ ] In **QA · Mentions**, `@type.qa-person` on its own line is a table: a row per note of the type (titles as chips that open the note), columns for every property, the most used first; `@type.qa-person(fullname, email)` has just those two
- [ ] In a type table, hovering a header shows ×, which removes the column and rewrites the line; + at the end lists the type's other properties and adds one; clicking a header sorts by it, again the other way, again back by title
- [ ] New … under a type table makes a note of the type with the table's columns as empty properties and opens it, with the cursor on its title
- [ ] Clicking a type table's cells shows its line with the table below; editing the line redraws it; a table for a type with no notes says so
- [ ] `/type table` writes `@type.` and opens the menu of types (icons, counts); Enter or Tab picks one; within text `@type.qa-person` is a chip that ⌘-click turns into that type's list
- [ ] Changing a property of a note in a type table (in another window, or after switching notes) updates the table

## 24. Accessibility and languages

- [ ] With Contrast → Increased, Lighthouse's accessibility audit (Chrome DevTools) scores 100 on the main window, with Settings open, and in a note with a table, math and a callout, in a few themes light and dark (Lines, Solarized, Ayu, Everforest); on Standard, only contrast fails
- [ ] Contrast: System follows the device's Increase Contrast live; Increased darkens grey text, links, tags and borders in every theme, light and dark, and a selected row's date and count stay readable
- [ ] Keyboard only, from launch: reach the sidebar, list, note, toolbar, menus, Settings and every control in it with Tab; use each with Enter or Space; arrows move in lists, menus, tabs, segmented controls and the icon picker; Esc closes what's open and focus returns to what opened it; focus is always visible
- [ ] Focus never drops to the page: after renaming a tag or a type (Enter or Esc) it's on that row; after a menu item that opens a dialog (Share → Preview as PDF), then Esc, on what opened the menu; locking a note keeps it on the lock button; closing the last tab with Delete puts it in the note list; a window resized to or from phone width moves it to a pane that shows
- [ ] With a dialog open (Settings on the web, the PDF preview, a password), the window's shortcuts wait: ⌥N, ⌘\\, ⇧⌘\\, ⌘P, ⌘F and F6 do nothing behind it; ⌃⌘L and ⌘+ / ⌘− still work
- [ ] [Mac] VoiceOver (⌘F5): every button says what it does; the note list reads each note's title, pinned or locked, and date, then its excerpt after a pause; a note reads as its text; the rotor's Headings list a note's headings; list items say "bullet"; checkboxes say checked or not; a callout reads "Warning callout" … "End of warning callout" and properties "Properties" … "End of properties" (not colons and dashes); menus and dialogs are announced; "Copied" or a sync problem is spoken
- [ ] F6 and ⇧F6 move between the sidebar, the note list and the note; Enter on a note in the list opens it with the cursor in its text
- [ ] System text size or browser zoom at 200%: nothing overlaps or is cut off, and the note list and sidebar still work
- [ ] Reduced motion on (System Settings → Accessibility → Display): nothing slides or bounces
- [ ] [Windows] A contrast theme on (Settings → Accessibility → Contrast themes), or Chrome DevTools → Rendering → Emulate CSS media feature forced-colors: focus rings show; the open note's row, the current sidebar item, the chosen segment, theme, Settings section and tab, a focused menu item and a switch that's on are marked in the system's highlight color, with their text readable on it (no box over it); switches that are off and sliders keep an outline; mentions and links are link-colored; tags, mentions and code are outlined; a ticked checkbox is filled; highlights show; a callout's or card's hidden `:::` lines stay hidden; the theme swatches keep their colors
- [ ] In Spanish and in French: every screen reads in that language, nothing is cut off (the sidebar's sync button, Settings' tabs, menu items), and plurals read right ("1 nota", "0 note")
- [ ] ⌥↵ with the cursor on a link opens it; on an attached file, opens the file; on a mention, its note (the main window shows it); on `@type.…`, that type's list; on a tag, its notes; on a mention of a note that isn't there, makes the note and says so
- [ ] Format toolbar: with text selected, Tab reaches the toolbar, ← → move between its buttons, Enter applies one, Esc goes back to the text
- [ ] A type table's column names sort from the keyboard (Enter), say which way they sort, and a row's title opens its note with Enter
- [ ] `bun run i18n` reports every message translated in Spanish and French
