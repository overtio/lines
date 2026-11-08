# Known limitations and future work: encryption, app lock, locked notes

What these features don't do (yet), and what hasn't been tried outside tests. The planned work is also on the [roadmap](../README.md#roadmap). How they work is in [sync.md](sync.md).

## Not tried on real devices yet

Each of these has only run in Chrome, through the end-to-end tests (two browser profiles and a stand-in S3 server):

- [ ] **Touch ID** in the Mac app, for the app lock and for locked notes. The development build is unsigned, so macOS may ask for the login password the first time lines reads its Keychain item ("lines app lock").
- [ ] **Floating notes** while lines is locked, and while locked notes are locked or open. The key is handed to them through the app's native side (app lock) or the window channel (locked notes).
- [ ] **End-to-end encryption with a cloud drive folder.** Only S3 was tested end to end with encryption on. Plain folder sync passes its test.
- [ ] **iPhone and Android.** None of the three features has been run there.
- [ ] **Saving to a folder on the web** with a folder picked in the real folder picker, and the "Allow access" prompt after restarting the browser. The tests used the browser's private storage, which has the same interface but never asks.

## Saving to a folder on the web

- Only Chrome, Edge and other Chromium browsers have the File System Access API. Safari and Firefox keep notes in the browser, and can export them.
- After the browser restarts, it asks again before lines may use the folder; until someone clicks Allow access in Settings → Sync, sync shows an error.
- The browser blocks some folders (the home folder itself, system folders, Downloads on some systems).

## The web app's own storage

Where the web app keeps everything is in [storage.md](storage.md).

- Notes kept only in the browser can be lost: clearing site data deletes them, the browser may evict them when the disk is low (lines doesn't ask for persistent storage), and Safari deletes them after 7 days without a visit.
- The demo website shares its storage with every other site on `overtio.github.io`. It needs a domain of its own before people keep real notes there.

## Import and export

- Import takes files, not an export's .zip. Imported, an export's notes come back without their images and files, whose links then show as missing.
- An export holds at most 65,535 files and 4 GB (it doesn't use ZIP64).

## Unsplash photos

- An Unsplash photo is kept as the link to its page, not as a file, so it needs the internet to show, and isn't in exports or sync as a picture.
- Other Markdown apps show these links as broken images, as the page isn't a picture.
- lines loads the photo through Unsplash's download link, which counts as a download each time it's shown.
- Unsplash+ photos don't show: Unsplash only hands them to subscribers. They say the image couldn't be shown. `/unsplash` leaves them out.

## /unsplash and /giphy

- They need the internet, and an API key from each service built into lines (see the README). A build without one doesn't have the command, and Settings → Plugins says so.
- What you search for goes to Unsplash or GIPHY. Nothing else does: lines doesn't send them your notes.
- The keys are shared by everyone using that build, and each service limits how many searches a key can make an hour (until it approves the app for more). Past that, the picker says it couldn't reach them for a while.
- A GIF is kept as its address on GIPHY, like an Unsplash photo: it needs the internet to show, and isn't in exports or sync as a picture. With reduced motion, GIFs from GIPHY show still, but other animated images in notes still play.
- They're in Markdown notes only. A LaTeX note can't compile a picture from the web anyway.

## Math

- Math is drawn by KaTeX, which covers most of LaTeX's math mode but not all of it (no `\newcommand` shared between blocks, no TikZ or other packages), and not whole LaTeX documents.
- Other Markdown apps without math support show the LaTeX as written, dollar signs included.
- The note list shows a note's LaTeX as text, not drawn.

## LaTeX notes

- lines draws a common part of LaTeX ([latex.md](latex.md)), not what a TeX engine typesets: no packages, text macros (`\newcommand` only works in math), floats' placement or page layout. What it doesn't know stays as written, faint.
- In the editor, equation, section and theorem numbers aren't used for references: `\ref{sec:intro}` shows `sec:intro`, not "1", and equations aren't numbered at all. The PDF preview numbers them (see below).
- A paragraph hard-wrapped in the source shows on several lines, where LaTeX would join them.
- `\input` and `\include` don't pull in other files: a paper made of several files has to be pasted in as one.
- There's no format toolbar over selected text, no todos, and no drag handles in LaTeX notes. An attached file is a plain `\href` link, not a card with its size.
- A photo pasted from Unsplash, or any other `\includegraphics{https://…}`, shows in lines but doesn't compile: LaTeX can only include files.
- A synced LaTeX note's file still ends in `.md`, with `format: latex` in its front matter. Export writes `.tex` files.
- Switching a note's format doesn't convert its text.
- Formulas in a `tabular` aren't worked out, as they are in Markdown tables.

## Spreadsheets

How they work is in [spreadsheets.md](spreadsheets.md).

- Not tried in the Mac app yet (WebKit), on an iPhone or with a touch screen; only in Chrome. Typing in a cell, IMEs, copying and pasting, and the cells' menu are the parts most likely to differ there.
- One sheet per note. A workbook's sheets come in as notes of their own, and formulas that reach into another sheet come in as their values.
- A synced spreadsheet note's file still ends in `.md`, with `format: spreadsheet` in its front matter, as a LaTeX note's does. Export and Download write `.csv` files.
- How money, dates and numbers below zero show is one choice for every spreadsheet, in Settings, not a cell's own as in Excel.
- No formatting is kept but money's symbol and dates: bold, colors, borders, other number formats (a percentage as written), merged cells, column widths and frozen rows. A formula's result shows as money (or a percentage, or with thousands separators) when the first cell it points at is (through arithmetic and functions that give back an amount, not `COUNT`); with money in two currencies, the first's, and money times a percentage is money only written money first (`=B2*C2`, not `=C2*B2`). Charts, pivot tables, comments and conditional formatting in a workbook are left out.
- Columns can't be resized, filtered or hidden, and whole rows and columns can't be dragged by their numbers and letters (cells can, held a moment). Sorting is by one column at a time, and a header row is told by Settings highlighting it, or else by looking (all text, over numbers).
- Moving cells by dragging and resizing a block work with a mouse or trackpad, not yet with a finger.
- Formulas that use another note find it by its title, so renaming it (or a block) changes the text of the notes whose formulas use it, outside their undo history. A rename is followed only in the window it's made in, and not when it comes from another device by sync; locked notes' formulas aren't changed. Moving, inserting or deleting cells in a note doesn't change the formulas in other notes that point at them. A Markdown table's formulas can't use other notes.
- Dates show in the chosen style only when written as `2026-11-05` (as typing and pasting keep them); a CSV file's `11/5/2026` shows as written. Times aren't read.
- Function suggestions and their descriptions are in English in every language, as the functions' names are. They're IronCalc's, from its own spreadsheet app.
- While pointing, ⌘ and an arrow doesn't jump to the edge of what's written.
- Copied cells paste with their formulas only in the window they were copied in; in another (a floating note, another browser tab) they paste as what they show.
- Formulas are in English with commas, and numbers and dates are read as in US English, whatever the app's language: `1.200,50` is text, not a number.
- Find in a note (⌘F) doesn't search a spreadsheet's cells. The note list's search does. In a Markdown note, it finds text in a ` ```csv ` block but can't show it in the grid; the cells' Edit as CSV shows the block's text.
- A ` ```csv ` block is comma-separated only; a ` ```tsv ` block is code. Empty rows at the end of a one-column block aren't kept.
- A screen reader hears each cell as it's reached, but can't browse the grid's rows and columns as a table: the grid is inside the editor's text box (docs/accessibility.md).
- Filling by dragging scrolls the grid only as the pointer moves, not while it's held still past the edge. Dates go on only written as `2026-01-31`; days and months by name only in English and the app's language. There are no lists of your own to fill from, and double-clicking the corner fills down, not across.
- Every row is kept in memory and worked out again on each change, so very large sheets (tens of thousands of rows) are slow to change, though only the rows in view are drawn.
- A formula engine other than IronCalc can't be chosen yet ([HyperFormula](https://github.com/overtio/lines/issues/1)).

## PDF

- lines' own pages are saved as a PDF through the print dialog (Save as PDF), not straight to a file. The print dialog isn't there on iPhone and iPad, so there lines' pages can be previewed but not printed or saved; a LaTeX note typeset by TeX saves as usual.
- Printing hasn't been tried in the Mac, Windows and Linux apps yet: whether their print dialogs keep the paper size the preview chose (A4 or Letter). Nor has showing TeX's PDF in the apps, whose web views draw PDFs themselves.
- lines' pages break between lines, never through one, but don't keep a paragraph's last line from starting a page alone, or a table's header with its rows. A block taller than a page (a very long code line wrapped many times, say) is cut where the page ends. Text isn't hyphenated.
- A printed LaTeX note follows LaTeX in what it can: lines join into paragraphs, sections, theorems, `equation`s, figures and tables are numbered and `\ref` shows their numbers. But footnotes are gathered at the end rather than at the foot of their page; an `align`'s lines aren't numbered; `\cite` shows its key, not a number; commands lines doesn't know print their last argument's text or nothing; and the layout is lines', not a document class's (`\documentclass[twocolumn]` is one column).
- TeX's PDF uses pdfLaTeX with TeX Live's basic packages only: a note needing others (TikZ, `enumitem`, `microtype`…) stops with "File … not found". `booktabs` stands in with plain rules. Fonts and scripts beyond pdfLaTeX's (no XeLaTeX or LuaLaTeX yet), BibTeX's `.bib` files (there's nowhere to keep one), and `\input`ed files aren't available.
- TeX downloads about 125 MB the first time, so that once needs the internet; the browser keeps it afterwards. It's only there when the build includes it (`bun run tex-assets`, see the README); a build without it says so.
- When TeX stops at an error in a file other than the note (a package), the line it names is that file's, though the preview says it's the note's.
- PNG images are of lines' pages, not TeX's PDF. They're drawn by copying the pages into an SVG picture (modern-screenshot), so what the browser can't copy that way is missing: a web image from a site that doesn't allow it (CORS) shows blank. Images are drawn at twice the page's size, but no bigger than every browser can draw (16.7 million pixels, WebKit's limit on iPhone and iPad): a note longer than about five pages as One Image comes out smaller, and from about twenty pages its text is less sharp than on screen. One per Page keeps every page sharp.
- Saving PNGs hasn't been tried in the Mac app (WebKit) yet.

## Image sizes

- Only an image on a line of its own (in a note or a card) has a resize handle; one within text, a list or a quote takes a width written in its Markdown but can't be dragged. Images in LaTeX notes can't be resized yet (`\includegraphics[width=…]` is shown at the image's own size).
- A width is in pixels and a height is ignored, so an image always keeps its shape.

## Symbols

- Only Markdown notes show `->` as →; LaTeX notes show what's typed (LaTeX has `\to` and `\neq` for these).
- `\->` keeps the characters, but the backslash shows in the editor (as it does for any escape); the PDF leaves it out, as Markdown does.
- The note list's previews and search show the characters as typed.
- In code, a symbol is drawn in the code font, and some code fonts draw arrows small.

## Drawings

- Drawings are Excalidraw's: what it can draw is what there is. Its shape library (and its browser, libraries.excalidraw.com), its help, its links, its image tool (pictures go in the note instead), live collaboration and AI features aren't part of lines. Its ? key still opens its list of shortcuts.
- Its fonts come with lines, except Xiaolai, its 12 MB Chinese and Japanese hand: on the web Excalidraw fetches that from its CDN when it's needed, and in the apps (which don't allow that) such text is in a system font.
- In dark themes a drawing is drawn inverted, as Excalidraw does, so a photo inside a drawing shows inverted too.
- A Mermaid diagram copied into a drawing is a copy: changing the code afterwards doesn't change the drawing, nor the other way round. Flowcharts become shapes; sequence and class diagrams come out simpler than Mermaid draws them; other kinds (pie, Gantt, mindmap, timeline…) come in as one picture that can be moved and drawn around but not taken apart. The conversion uses its own Mermaid (11, inside Excalidraw's converter), which loads the first time a diagram is copied.
- Excalidraw takes the theme's colors for its toolbars, menus and canvas, but not for what's drawn: its pens are its own colors (black, red, green…), as they are in any other app that opens the drawing. Changing the theme while a drawing is open shows in Excalidraw once it's opened again.
- Only a drawing on a line of its own (in a note, or in a card) can be opened; one inside text, a list or a quote is an ordinary image, and in dark themes isn't inverted.
- LaTeX notes show drawings as images but can't open them, and pdfLaTeX can't include an SVG, so TeX's PDF stops at one.
- Excalidraw and React, which it needs, load the first time a drawing opens: about 1.45 MB (440 KB compressed), and its font tools another 1.8 MB (740 KB) the first time one is saved. Nothing of it loads until then.
- Not tried in the Mac app yet: Excalidraw's worker and fonts under the app's content security policy.

## Objects and mentions

- A mention finds a note by its title, and the note keeps the mention as written: renaming the mentioned note doesn't update mentions of it, so they stop finding it (and show grey). Two notes with the same title can't both be mentioned; the one with a type wins.
- There are no backlinks yet: a note doesn't list the notes that mention it.
- Wiki links are mentions by title only: a heading in one (`[[Note#Heading]]`) opens the note at its top, block references (`[[Note#^id]]`) likewise, and embeds (`![[…]]`) stay text. A title with `[`, `]`, `|` or `#` in it can't be written as a wiki link (the menu leaves those out); `@[…]` can mention it.
- Properties are read as flat `key: value` lines. Nested YAML (a map inside a map) is read as text, and values are always text: no dates, numbers or checkboxes, and no sorting or filtering the list by them.
- Types have no schema: a new note made under a type starts with only its `type`, not the keys other notes of that type use.
- Only Markdown notes have properties and mentions; in a LaTeX note `@` and `---` are text.
- A type table shows values; it can't edit them (open the note), filter its rows, or keep a sort. Its values are text, so sorting is by text (numbers within it compare as numbers: 9 before 10). It shows on screen only: in an export or another app it's the `@type.…` line.
- The icon chosen for a type is kept on the device, like a tag's, so other devices show the default.
- A locked note can be mentioned by its title, but its properties can't be read, even while it's open.
- A synced note's file has two front matter blocks: lines' own (id, dates…) and then the note's properties, as part of its text. Apps that read front matter see the first.

## Layout, tabs and the outline

- Tabs have no keyboard shortcuts of their own beyond their tablist (← →, Delete): browsers keep ⌘W, Ctrl+Tab and ⌘1–9 for their own tabs.
- There are no tabs at phone width, nor in floating notes, and a tab can't be dragged to another place or into its own window.
- Open tabs are kept on each device; they don't sync.
- Two notes side by side: only two, and only where the window has room for both (the notes' pane at least 660 px wide; otherwise the note beside waits, and Open to the Side isn't offered), and never the same note in both (selecting the one beside closes it). The note beside isn't remembered when lines restarts, and has no tabs of its own.
- Panes on the right, and tabs, haven't been tried in the Mac app yet: the window buttons' room in each arrangement, and dragging the window by the space around the tabs.
- Links (Settings → Editing → Links): a web link can't open in a background tab of the browser, as browsers decide that; tab choices for mentions need tabs on, and in a floating note they open the note in the main window.
- The outline shows only with room for it beside the text (none at phone width, nor with Compact spacing in a narrow window), and in Markdown and LaTeX notes; plain-text notes have no headings. In a very long note, headings far down join it a moment after the note opens, as the note is read in the background.

## Plugins

How plugins work is in [plugins.md](plugins.md).

- Plugins come with lines; one made by someone else can't be installed yet.
- A note in a format whose plugin is off shows as plain text: no live preview, and its title is its first line as written. Exports and downloads still write it in its format.
- Turning a plugin on or off isn't synced: each device keeps its own.
- Drawings (Excalidraw), highlighting code blocks, GitHub links, symbols, and objects and mentions are still part of the core and Markdown, not plugins.
- Only Markdown notes take additions from plugins; a renderer plugin draws code blocks in Markdown notes, not in LaTeX ones.
- Turning a plugin off or on in the Mac app's Settings window hasn't been tried there yet, nor in floating notes (each window should follow at once).

## API requests

What isn't done yet is in [requests.md](requests.md#not-yet): environments, assertions and tests, bodies from files, forms with files, GraphQL and WebSocket, plain `http://` beyond this computer, and importing a Bruno or Postman collection.

- In the browser, only APIs that allow requests from other sites (CORS) answer, and headers the browser keeps from pages (`Cookie`) aren't sent.
- Responses aren't saved in the note: once lines quits they're gone, and a request using an earlier one's response needs that one sent again.
- **+** adds a response's body to the note only up to 200 KB.
- Requests in a code block inside a list or a quote, indented, aren't read as requests.
- Sending from the Windows and Linux apps hasn't been tried yet.

## Secrets

What isn't done yet is in [secrets.md](secrets.md#not-yet).

- A secrets note's values show in its properties while it's open, as any locked note's text does.
- A response can echo a secret back (an echo service, a token in a redirect), and **+** writes the body into the note as it came.
- Copy as curl writes `${NAME}` for every name it can't fill in, a secret or not.
- Secrets are as safe as locked notes: see Locked notes below.

## Accessibility and languages

- With Contrast on Standard, faint text (dates, counts, the sidebar's headings, hints) is below WCAG AA's 4.5:1 in every theme but the three accessibility ones, and secondary text is too in a few light themes (Solarized, Everforest, Ayu). Contrast → Increased, or the system's Increase Contrast, meets AA (docs/accessibility.md).
- A callout's border and tint stay as subtle in High Contrast as elsewhere (the border is its color at 24%); the strong borders are the panes', cards' and fields'.
- The forced-colors rules (Windows' contrast themes) are written to the CSS spec and haven't been tried on Windows yet, nor with Chrome's forced-colors emulation.
- Not tried yet with VoiceOver on iPhone, TalkBack or NVDA; only with Chrome's audits and the keyboard.
- Icon names (in the icon picker's search and tooltips) are English in every language.
- Errors from the desktop app's own code (folders, the window) are English, inside a translated sentence.
- The welcome note, the feature tour and the examples are English. A note's text isn't translated, and the date `/date` writes is in the app's language.
- Changing the language starts lines again.

## End-to-end encryption (sync)

- Still visible to the storage provider: how many notes and attachments there are, their sizes, when they change, and note ids (random).
- If every device that has the key is lost and the passphrase is forgotten, the encrypted notes in the bucket can't be recovered.
- With encryption on, the bucket no longer holds files that other apps can open. Export still makes plain ones.

## App lock

- Turning it on rewrites notes encrypted, but earlier plain copies can linger in the database's free pages or write-ahead log until they're overwritten. FileVault (or the phone's own encryption) covers this.
- Opening an attachment in the native apps writes a readable copy to the app's cache folder, and it stays there.
- Attachments are encrypted on the device, but their ids (content hashes) aren't.
- On the web, each tab unlocks on its own.
- There's no Face ID on iPhone yet; the passphrase works there.
- A forgotten passphrase means erasing the device. Synced notes come back from sync storage.

## Locked notes

- **Images and files in a locked note aren't encrypted by the lock.** Their names are listed, readable, in the note (so they're kept and synced while it's locked). Sync encryption does encrypt them. Planned.
- Readable even while locked: the title, dates, pin, icon, and the attachment names above.
- A locked note's tags, to-dos and text are left out of tags, Todo and search, even while it's open. Only its title is searchable.
- Locking a note replaces its plain copy in the bucket or drive. A bucket with versioning, or a drive's file history, may still hold the plain version from before.
- Old plain copies can linger on the device's disk, as with the app lock above.
- They lock again after a fixed 5 minutes without use. That's not a setting yet, and each window counts its own idle time (locking by hand locks every window).
- A forgotten password can't be recovered. "Forgot password" only sets a new one for notes locked from then on; notes already locked keep needing the old one.
- A password changed on one device reaches another device's notes when those notes sync from the first. A note locked only on the second device keeps the old wrapping, which the old password still opens, until it's locked or edited again there.
- There's no password hint.
- Notes locked with different passwords (after "Forgot password", or on two devices before they synced) stay separate. Typing a password opens every note it fits.
- Conflict copies of a locked note that isn't open get "(conflicted copy)" in their visible title only.
- Face ID on iPhone isn't done.

## Future work

- [ ] Convert a note between Markdown and LaTeX when switching
- [ ] Formats as plugins: Org mode, AsciiDoc, WikiText and reStructuredText
- [ ] Install plugins made by others, safely; themes and icon sets from a file
- [ ] Drawings in LaTeX notes, saved as a PDF beside the SVG for TeX
- [ ] Save lines' PDF straight to a file in the apps (the web view's own PDF output), and print on iPhone and iPad
- [ ] More of TeX Live for TeX's PDFs, fetched as a note needs it; XeLaTeX for other scripts and fonts
- [ ] Encrypt images and files in locked notes
- [ ] Face ID for the app lock and locked notes on iPhone
- [ ] A setting for how long locked notes stay open
- [ ] Optional password hint for locked notes
- [ ] Clear opened attachment copies from the cache when lines locks or quits
- [ ] Store sync credentials in the OS keychain on native platforms
- [ ] Remove attachments from sync storage once no note uses them
- [ ] Backlinks, and updating mentions when a note is renamed
- [ ] Types with a template: the keys a new note of the type starts with
- [ ] Sync the icons chosen for tags and types
