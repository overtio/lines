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

## Closing and quitting

- A note is stored a moment after the last key typed. Closing a tab or reloading before then keeps a copy in localStorage, stored at the next start. Not for locked notes, nor while the app lock is on, as localStorage can't be written encrypted that fast: those have only the write started as the page goes, which may not finish.
- In the Mac app, Quit (⌘Q) waits for every window to store what's typed in it, three seconds at most, and closing the main window waits too. Quitting from the Dock, or logging out, still ends lines at once. Neither has been tried in the Mac app yet.

## The website

The home page and the docs at https://overtio.github.io/lines/ (`site/`):

- There's no search across the docs yet.
- They're in English only, though the app speaks Spanish and French too.
- Code in the docs isn't highlighted.

## Import and export

- Import takes files, not an export's .zip. Imported, an export's notes come back without their images and files, whose links then show as missing.
- An export holds at most 65,535 files and 4 GB (it doesn't use ZIP64).

## Unsplash photos

- An Unsplash photo is kept as the link to its page, not as a file, so it needs the internet to show, and isn't in exports or sync as a picture.
- Other Markdown apps show these links as broken images, as the page isn't a picture.
- lines loads the photo through Unsplash's download link, which counts as a download each time it's shown.
- Unsplash+ photos don't show: Unsplash only hands them to subscribers. They say the image couldn't be shown. `/unsplash` leaves them out.

## Feeds

- **On the web, most feeds can't be read.** A web page may only read a feed whose site allows it (CORS), and most don't; the Feeds view and the box to subscribe say so. Feeds that allow it (some blogs, many podcast hosts) work, and Apple Podcasts' lookup finds a podcast's feed, which can be subscribed to if it allows it. The desktop apps read every feed.
- On the web, a site's answer can't be read either unless it allows it: a feed that says to wait (with Retry-After) or that it's gone looks like one that couldn't be reached, so it's asked again as one that failed, later each time, a day at most.
- **Read and unread are per device.** Subscriptions are notes and sync, but which posts were read, and the posts themselves, are kept on each device, which fetches them itself (a new device starts with every post unread).
- Only the newest 200 posts of each feed are kept. Older ones go, and so does their content, unless saved to the Library.
- A post is shown as Markdown made from its HTML: what Markdown can't say (layouts, embedded players, forms, styling) is left out, and embedded videos are links. Its pictures load from the web each time it's opened.
- A feed is fetched in the main window only, at start and then as often as Settings → Library says, a few at a time and never two from one site at once; while lines is closed nothing's fetched.
- A feed that moved for good (a permanent redirect) is followed each time; its note keeps the address it was subscribed with.
- JSON Feed isn't read yet, only RSS 2.0, Atom and RSS 1.0, nor feeds that need signing in.
- A feed subscribed to before lines kept what it's written in is listed with RSS Feeds (or Podcast Feeds, if its note is a podcast's) until it's next fetched, which it is at start; one that can't be fetched stays there.
- Fetching feeds hasn't been tried in the Mac, Windows, Linux, iOS or Android apps yet: the apps fetch through Rust (`webFetch`, with conditional requests of their own), which the browser tests don't reach.

## The podcast player

- Episodes play from the web, as they're listened to: nothing is downloaded for offline listening yet.
- Where each episode was stopped, and which were played, are kept on each device, not synced.
- A feed's episode and the `episode` note saved from it are kept apart: one by its post, the other by its note, so each starts from where it was itself stopped.
- An episode linked over `http:` is asked for over https, as the apps' web views play only that; one whose site has no https doesn't play, and nor in the apps does one whose https address redirects to `http:` (the apps' content security policy allows sound only over https).
- On a phone, the mini player is at the bottom of the note list, so not over an open note; the system's media controls work from anywhere.
- Episodes play in the main window. A floating note's Play asks the main window to play it, and its button says Play even while it's playing there.
- Locking lines, or quitting it, stops the episode playing: it's back in the player once lines is unlocked or open again, paused where it was.
- The player hasn't been tried in the Mac app yet: playing through its web view, Now Playing and the media keys, a floating note's Play, and keeping the place on ⌘Q.
- Not tried in the Mac app (WKWebView), nor Windows, Linux, iOS or Android: only in Chromium and WebKit with sound served by the tests. The Mac's Now Playing and media keys need trying there.

## Wallhaven

- In the apps only: Wallhaven's site doesn't answer web pages (it sends no CORS headers), so the web app can't search it.
- Only wallpapers Wallhaven marks safe for work; there's no way to sign in to Wallhaven for the rest.
- What you search for goes to Wallhaven, and the picture you pick is fetched whole (often several megabytes) before it's made smaller and kept.
- Wallhaven's search gives no description of a wallpaper, so a picture's description in the note is what you searched for; change it as you would any image's.
- Wallpapers are uploaded by Wallhaven's users, who may not have made them: whose they are, and what you may do with one beyond your own notes, is as Wallhaven says on its page.
- Wallhaven answers 45 searches a minute; typing fast may wait for it.
- In Markdown notes only, as `/unsplash` and `/giphy` are.

## /unsplash and /giphy

- They need the internet, and an API key from each service built into lines (see the README). A build without one doesn't have the command, and Settings → Plugins says so.
- What you search for goes to Unsplash or GIPHY. Nothing else does: lines doesn't send them your notes.
- The keys are shared by everyone using that build, and each service limits how many searches a key can make an hour (until it approves the app for more). Past that, the picker says it couldn't reach them for a while.
- A GIF is kept as its address on GIPHY, like an Unsplash photo: it needs the internet to show, and isn't in exports or sync as a picture. With reduced motion, GIFs from GIPHY show still, but other animated images in notes still play.
- They're in Markdown notes only. A LaTeX note can't compile a picture from the web anyway.

## Terminal recordings (asciinema)

- A recording on asciinema.org is kept as its embed code, not as a file: it needs the internet to play, and isn't in exports or sync as a recording. A `.cast` file dropped into a note is an attachment like any other, and plays offline.
- Printed, a recording from asciinema.org is asciinema's preview of it (dark, with its play mark), not a frame of it in black on white; a `.cast` file prints as its name.
- A recording from another asciinema server than asciinema.org, or a link to a `.cast` file on the web, is a picture or link like any other: only asciinema.org's embed code and attached `.cast` files play.
- The player is asciinema's, so its buttons are named in English for screen readers ("Play", "Toggle fullscreen mode"), and its list of keys (`?`) is English. lines hides its tooltips and the button for that list.
- Recordings play only in Markdown notes. In a LaTeX note, a link to one is a link.
- A recording plays again from its start, at the preview, when the theme changes or it's scrolled far out of view and back.
- The player (about 185 KB, 65 KB compressed) loads the first time a note has a recording.
- Not tried in the Mac app yet: loading recordings through the app's own fetch, and the player under its content security policy.

## /paper and arXiv

- Searching arXiv works in the apps only. arXiv's API doesn't take requests from web pages (CORS), so on the demo website `/paper` isn't there; links to arXiv still read short.
- It needs the internet. What you search for goes to arXiv, nothing else: lines doesn't send it your notes.
- arXiv asks for no more than one request every three seconds, so a search right after another waits for its turn (the picker says it's searching). What's been searched is kept until lines quits and isn't asked again.
- arXiv's ranking is its own, and plain: lines looks for every word in titles and authors first, which finds the paper meant far more often, and in abstracts too when that finds nothing. arXiv's own syntax (`au:hinton AND ti:distilling`) goes to it as typed.
- arXiv is the only source of papers so far. Others (Semantic Scholar, OpenAlex, PubMed…) can be added as plugins ([plugins.md](plugins.md#what-a-plugin-can-add)); one that allows requests from web pages would bring `/paper` to the website too.
- A paper goes in as a link named by its title, as arXiv writes it: a title with math (`$k$-means`) shows it drawn in Markdown, and TeX accents (`Schr\"odinger`) aren't turned into the letters they make. Its authors, year and abstract aren't added.
- Searching from the Windows, Linux, iOS and Android apps hasn't been tried yet.

## Library

- Only Markdown notes are looked up: a LaTeX, code or spreadsheet note that's just a link stays one, and so does a locked note, whose link isn't sent anywhere.
- On the web, only YouTube, Open Library, Wikidata, MusicBrainz and Apple Podcasts can be asked; other sites don't let web pages read them (CORS), so links to them stay links there. The apps read any page ([library.md](library.md#where-lines-looks)).
- A page that only says what it is once its scripts have run (YouTube Music, some shops) isn't read for it: lines reads the page as it arrives, and never runs it. IMDb doesn't answer apps at all; its links are looked up through Wikidata, which has most films and series but not every one, nor the newest the day they're announced.
- What Wikidata finds is what it's about from Wikipedia, in lines' language where Wikipedia has the page, else in English, and the poster at the top of that page.
- Episodes from Apple Podcasts are found among a podcast's latest 200; a link to an older one stays a link.
- MusicBrainz knows Spotify, Apple Music, Bandcamp, Deezer and Tidal links only where someone has added them: most albums, few songs. In the apps, Web Pages reads the rest.
- A YouTube video looked up on the web has its title, channel and picture, but not when it came out, how long it is or what it's about: those are on its page, which only the apps can read.
- The keys and `status` values are English in every language, so a note reads the same everywhere; lines shows the status in its own language.
- A note filled in after you've moved to another note can't be put back with <kbd>⌘Z</kbd>: that's the note you're in's. Delete what was written, or paste the link again.
- If its cover can't be stored once the note's written (the device out of space), the note keeps the picture's link without the picture.
- The Library has no grid of covers yet. Feeds have limits of their own ([Feeds](#feeds)).
- Add to Library searches each catalog as it ranks things: Wikidata's search puts what's titled as typed and has the most Wikipedias first, but can miss what's new; MusicBrainz is asked once a second, so Music, which searches songs and albums, takes a moment more; only the first page of what each finds is shown.
- A link added to the library from its menu becomes a mention as one change, which ⌘Z takes back; the library note made stays (it isn't taken back with it), in the Library. Done while the note's closed, the mention can't be taken back with ⌘Z.
- A link being added shows how it's getting on in one pane: the same note open in two shows it in the first.
- Looking links up hasn't been tried in the Mac, Windows, Linux, iOS or Android apps yet: the apps read pages through Rust (`webFetch`), which the browser tests don't reach.

## Math

- Math is drawn by KaTeX, which covers most of LaTeX's math mode but not all of it (no `\newcommand` shared between blocks, no TikZ or other packages), and not whole LaTeX documents.
- Other Markdown apps without math support show the LaTeX as written, dollar signs included.
- The note list shows a note's LaTeX as text, not drawn.

## Diagrams

- Diagrams are drawn by [Pele](https://pele.run), which reads Mermaid's syntax (up to Mermaid 12.1) but lays diagrams out its own way: they look different from GitHub's and other Mermaid apps'. Settings → Plugins → Diagrams (Mermaid) draws them with Mermaid itself instead.
- Pele doesn't read Mermaid's themes or `themeVariables`, except the colors of charts' series: diagrams take the theme's colors. Colors set in a diagram (`style`, `classDef`) stay as written.
- Links in diagrams (`click A href "…"`) aren't drawn as links, as one followed would open in lines' own window. In labels, HTML's bold, italic, underline, code, subscript and superscript (`<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<code>`, `<sub>`, `<sup>`) and line breaks (`<br>`) are drawn; other tags are left out with their text kept (a link's, a `<span>`'s), and pictures aren't drawn. Icons (`fa:fa-car`) aren't drawn. ZenUML and Mermaid's other add-ons aren't drawn.
- Math in a label (`$$x^2$$`) is drawn by the math plugin, KaTeX, and shows as written with it off.
- Mermaid itself (about 5 MB) is still in the app, for the Diagrams (Mermaid) plugin, though it's off unless chosen. It can leave the download once plugins can be installed on their own ([#158](https://github.com/overtio/lines/issues/158)).

## LaTeX notes

- lines draws a common part of LaTeX ([latex.md](latex.md)), not what a TeX engine typesets: no packages, text macros (`\newcommand` only works in math), floats' placement or page layout. What it doesn't know stays as written, faint.
- In the editor, equation, section and theorem numbers aren't used for references: `\ref{sec:intro}` shows `sec:intro`, not "1", and equations aren't numbered at all. The PDF preview numbers them (see below).
- A paragraph hard-wrapped in the source shows on several lines, where LaTeX would join them.
- `\input` and `\include` don't pull in other files: a paper made of several files has to be pasted in as one.
- There's no format toolbar over selected text, no todos, and no drag handles in LaTeX notes. An attached file is a plain `\href` link, not a card with its size; audio and video on a line of their own play there, but Enter doesn't play them.
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
- Only a CSV or TSV file in a note can be turned into a spreadsheet there; an Excel workbook can't yet, though Settings → Export and Import imports it as notes.
- A screen reader hears each cell as it's reached, but can't browse the grid's rows and columns as a table: the grid is inside the editor's text box (docs/accessibility.md).
- Filling by dragging scrolls the grid only as the pointer moves, not while it's held still past the edge. Dates go on only written as `2026-01-31`; days and months by name only in English and the app's language. There are no lists of your own to fill from, and double-clicking the corner fills down, not across.
- Every row is kept in memory and worked out again on each change, so very large sheets (tens of thousands of rows) are slow to change, though only the rows in view are drawn.
- A formula engine other than IronCalc can't be chosen yet ([HyperFormula](https://github.com/overtio/lines/issues/1)).

## PDF

- lines' own pages are saved as a PDF through the print dialog (Save as PDF), not straight to a file. The print dialog isn't there on iPhone and iPad, so there lines' pages can be previewed but not printed or saved; a LaTeX note typeset by TeX saves as usual.
- Printing hasn't been tried in the Mac, Windows and Linux apps yet: whether their print dialogs keep the paper size the preview chose (A4 or Letter). Nor has showing TeX's PDF in the apps, whose web views draw PDFs themselves.
- Pages are black on white: headings print black whatever color Settings → Typography gives them on screen, and formatting prints as it always does whatever colors your theme gives it.
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

## Folders and files on your computer

- Dropping a folder to link to it, and `/folder`, are in lines for Mac only: a page isn't told where a dropped folder is, and the Windows and Linux apps don't ask the system yet. Their links open in the Windows and Linux apps too.
- On the web and on phones a link to the computer can't be opened; following one copies its path.
- A link leads to a path: moved or renamed, the folder isn't followed, and on another device the path may lead nowhere.
- On Windows, a link to a share on another computer (`\\server\share`) isn't followed, since Windows would sign in to that computer, with your account, only to look; a share mapped to a drive letter is followed.
- Not tried yet with folders on network drives, or dropped from apps other than Finder.

## Audio and video

- Which files play is the browser's choice: AIFF plays only in Safari and the Mac app, a `.mov` from an iPhone only where the browser can decode HEVC, and MKV and AVI aren't played at all. Those show as a file's card, to open in another app.
- A video is as wide as the note at most, and 480 px tall at most until it's given a width. Its width is written in its link text (`[Sky.mp4|400]`), which other Markdown apps show as part of the link. Videos in LaTeX notes can't be resized, as images there can't.
- Audio stops when another note opens: there's no player that carries on across notes.
- Not tried yet on iPhone, iPad or Android.

## Showing Markdown

- Hidden Markdown (Settings → Editor → Show Markdown) hides what only styles text (`**`, `#`, `>`, list markers); links, images, math, mentions' sources, code fences, cards' `:::` and a note's properties still show their Markdown while the cursor is in them, as in Live, since there's no other way to change them yet (no link or math editor over the text).
- Hidden, typing at either end of styled text writes outside it: to add to a bold word, type inside it, or ⌘B again. Return at the start of a heading's text puts a line above it; Backspace at a list item's text takes its marker, as Markdown's own Backspace does.
- LaTeX notes follow Source, Visible and Live; with Hidden they show their commands as in Live.
- Not tried yet with input methods that compose text (Japanese, Chinese, Korean) in Hidden, nor in the Mac app or on phones.

## Page breaks

- Only at a note's top level: in a card, a callout, a list or a quote a page break stays as written, and doesn't break the PDF's page.
- In a LaTeX note, `\newpage` inside an environment (`center`, a list) is drawn as a page break, but the PDF breaks only at those outside any environment but the document; one in the middle of a line breaks the PDF but isn't drawn.
- Other apps don't break pages at `<!-- pagebreak -->`; for their PDFs, `<div style="page-break-after: always"></div>` (which lines reads too) does in Obsidian, Typora and VS Code, with a blank line after it.
- A picture of a note (PNG) is one long page, without its breaks.
- With a pattern drawn in columns (squares, graph) over a backdrop, each page's columns run its full height, past the last line's row.

## Mascots

- A mascot lives in the main window only, not in floating notes or Settings' own window, and walks along the bottom of the note's pane. Where it stands, it's clicked rather than what's under it: drag it away.
- It sits beside the line being written in notes; a spreadsheet's cells and other fields don't call it.
- Only the four lines draws can be chosen; a plugin can add more, but there's no way yet to draw your own in Settings.

## Copying what you select

- Only in notes: the note list's search, renaming and a spreadsheet's cells copy only with ⌘C. There's no pasting with the middle button, as terminals on Linux have; and it isn't the system's own selection to paste from on Linux, just the clipboard.
- Not tried on phones and tablets, where selecting is the system's long press.

## Cursors

- A note has one cursor and one selection: there are no multiple cursors, nor ⌘D to select the next match as well, as code editors have.
- The text cursor's look is in notes and Settings' little note; fields (search, renaming) and a spreadsheet's cells keep the system's, in the color chosen.
- The Retro and Dot pointers show over lines' own windows only, and only where something hasn't asked for a pointer of its own (a resize edge, a diagram you can drag): those keep the system's. Not tried in the Mac app yet, where WebKit draws pointer images itself.
- Rainbow and the trail need a recent browser (`@property`, the Web Animations API); in an older one the cursor stays its color and jumps.
- In WebKit (Safari, the Mac app), a block or underline cursor just before Markdown that's hidden (the `**` of bold, with Show Markdown on Hidden) can be drawn narrower than the letter after it, until it moves: it's measured before WebKit has laid the line out.

## Typing sounds

- The built-in keyboards are made from sound, not recorded: close to the real thing, not the real thing. Recorded ones come as Mechvibes sound packs, which people share under their own terms; lines carries none of them.
- Only keys pressed in lines' windows play, not everywhere on the computer, as Mechvibes does.
- A pack whose sounds the system can't decode stays silent and says so: OGG files play in Chrome and Firefox, and in Safari and the Mac app only on recent versions of macOS. Not tried in the Mac app yet.
- Packs are read from a .zip or a folder; a ZIP64 or encrypted .zip isn't read. Mouse packs are left out, and a pack's `random_pitch` and recommended volume aren't used (every keyboard varies its pitch a little).
- Packs are kept on this device and don't sync.

## Themes from a picture

- A picture is read in whatever formats the system can show (JPEG, PNG, WebP, GIF; HEIC in the Mac app and Safari); an animated one by its first frame.
- The colors are worked out, not chosen by taste: a picture of many equal colors can give an accent that isn't the one you'd pick. Each color can be changed after.

## Changing colors by right-clicking

- It works in the main window only, not in a floating note or Settings in a window of its own (which show the changes, though).
- It's made for a mouse or trackpad, or a keyboard's menu key: on a phone or tablet it may not open.
- A color is matched to the theme's by its value: where two of the theme's colors are the same (code's background and a field's), lines goes by what the part is, and can name the other. With Monochrome or Invert on, colors are picked as the theme has them and shown through those.
- A part drawn in a gradient, a picture or a mix of colors (a callout's tint, a scroll bar) isn't matched; the color it's made from can be changed in Settings → Theme's editor once saved.

## Styles

- A style can't be made in Settings yet, only added by a plugin; a theme of your own can be used with any style.
- Pixel's, Adventure's, Constructivist's and Neon's fonts cover Latin (and Pixel's, Adventure's and Constructivist's Cyrillic, Neon's Thai and Vietnamese); other writing shows in the fallback font. With Icons off (Settings → Layout), buttons that are only an icon show their names in words, which can crowd a narrow window's toolbar; a block's buttons inside a note keep their icons. Classic uses Tahoma, which Linux usually lacks, so it falls back to Verdana or the system's sans.
- Classic's scroll bars with arrow buttons show where the system draws scroll bars that stay (Windows, Linux, or macOS set to show them always); overlay scroll bars stay the system's.
- Printed pages and PDFs are black on white in every style, but in a style's own font while it's the first font (Settings → Typography).
- Not tried in the Mac app yet, nor on phones.

## Fonts

- IBM Plex Sans, Fira Sans and Agave cover Latin, Greek, Cyrillic and Vietnamese; other writing shows in the fallback font. They come in regular and bold (Plex and Fira with their italics); weights between are the nearest of those, and Agave's italic is its regular slanted.
- Code is in the code font whichever font notes are in, unless Fonts for formatting gives inline code or code blocks one of their own (Agave among them).
- Fonts for formatting (Settings → Typography) are drawn in Markdown and LaTeX notes as lines shows them, and in lines' PDF of a Markdown note. Source mode (Markdown as written) keeps every part in the text's font, as it keeps their sizes, and a LaTeX note's PDF, lines' or TeX's, is in Computer Modern throughout. Bullets are drawn rather than written, so only lists' numbers take a font. Code notes, and blocks drawn as something else (diagrams, requests, spreadsheets), keep the code font.
- Not tried in the Mac app yet.
- A font installed on your device (Settings → Typography → Installed font): the apps list the fonts the system has, but on Android none, so there it's typed by name, and on iPhone and iPad only those iOS comes with: fonts installed from the App Store's font apps need the Fonts entitlement (`com.apple.developer.user-fonts`), which lines' app doesn't have yet. In a browser, Chrome and Edge list them once you allow it; Safari and Firefox can't, and you type a font's name instead, which says when it isn't one there. Safari only uses the fonts macOS comes with, not ones you installed, and Firefox can limit fonts the same way with its stricter privacy settings: such a font says it isn't installed.
- It's kept by its name, so settings or a preset from another computer can name one this device hasn't: notes are then in the system's font (a style's own, where it has one) and formatting given it as if none were chosen, Settings → Typography says the font isn't installed here, and it's used again where it is. The same goes for a font of lines' whose plugin is off. A font's bold and italic are its own where it has them; where it hasn't, the browser thickens or slants its regular.
- lines' printed pages, PDF and PNG images are in it; TeX's PDF of a LaTeX note never is (it's in TeX's fonts).
- Listing them hasn't been tried in the apps yet: the Mac's (AppKit), Windows' (DirectWrite), Linux's (fontconfig's `fc-list`, which a desktop without it lacks; then the name is typed), the iPhone's and iPad's (UIKit).

## Symbols

- Only Markdown notes show `->` as →; LaTeX notes show what's typed (LaTeX has `\to` and `\neq` for these).
- `\->` keeps the characters, but the backslash shows in the editor (as it does for any escape); the PDF leaves it out, as Markdown does.
- The note list's previews and search show the characters as typed.
- In code, a symbol is drawn in the code font, and some code fonts draw arrows small.

## Timing diagrams

- WaveJSON is read as JSON5, not run as JavaScript: a diagram that makes its waves with code (`"0".repeat(8)`, a function) says what it can't read.
- WaveDrom lays text out for Helvetica's widths, and lines draws it in the note's font. A diagram grows to show every name whole, but a long data label can run past its box, more so in a wide font.
- WaveDrom's `dark` look isn't used: the theme's colors stand in for it. Logic circuits don't light up under the pointer, as they do on WaveDrom's site.
- A name written as markup keeps only WaveDrom's own (`<b>`, `<sub>`…); anything else (links, pictures) is left out, so a diagram can't run code or load anything from the web.
- They're in Markdown notes only: LaTeX notes don't draw `tikz-timing`, and TeX's PDF has no TikZ.
- WaveDrom (about 320 KB, 46 KB compressed) loads the first time a note has one.
- Not tried in the Mac app yet; checked in Chromium and WebKit on the web.

## Drawings

- Drawings are Excalidraw's: what it can draw is what there is. Its shape library (and its browser, libraries.excalidraw.com), its help, its links, its image tool (pictures go in the note instead), live collaboration and AI features aren't part of lines. Its ? key still opens its list of shortcuts.
- Its fonts come with lines, except Xiaolai, its 12 MB Chinese and Japanese hand: on the web Excalidraw fetches that from its CDN when it's needed, and in the apps (which don't allow that) such text is in a system font.
- In dark themes a drawing is drawn inverted, as Excalidraw does, so a photo inside a drawing shows inverted too.
- A Mermaid diagram copied into a drawing is a copy: changing the code afterwards doesn't change the drawing, nor the other way round. Flowcharts, sequence, class, ER and state diagrams become shapes; other kinds (pie, Gantt, mindmap, timeline…) come in as one picture that can be moved and drawn around but not taken apart. The conversion lays the diagram out with Pele, its own copy inside Excalidraw's converter (which loads the first time a diagram is copied), so the shapes follow Pele's layout even when diagrams are drawn by Mermaid. Pasting Mermaid code onto a drawing, and Excalidraw's Mermaid to Excalidraw, convert the same way.
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
- A locked note can be mentioned by its title, but its properties can't be read, even while it's open.
- A synced note's file has two front matter blocks: lines' own (id, dates…) and then the note's properties, as part of its text. Apps that read front matter see the first.
- A synced note's file is read as UTF-8 (or UTF-16, with its byte order mark). One another app saved in another encoding, such as Latin-1, shows its other characters as �, and keeps them so once the note is edited here.

## Calendar

- The week and day show beside the note list, so not on a phone, where the Calendar is the month and the day's notes. A narrow window makes the week's columns cramped.
- Times are read 24-hour (`14:00`), as the clock reads them; a time zone after one is read past, so `T14:00Z` is 2 PM here. Something spanning several days, with times or not, shows under All day rather than across the hours.
- Making an event at an hour or of whole days, and moving or stretching one, is by pointer: a mouse, trackpad or pen, not a finger, which scrolls the hours. By keyboard, a note is made for a day and its times typed in its properties. Only the last move can be undone (⌘Z), and only until something else is done.
- An event made on the Calendar and left without a title is gone, as an empty new note is.
- The list beside the week shows the chosen day's notes in the list's usual order, with when they were edited, not their times.
- Only dates written `2026-11-30` (perhaps with a time after) count, in a `date`, `due`, `start` or `end` property; which properties count can't be chosen yet, and dates in a note's text or on todos aren't read.
- Only Markdown notes have properties, so LaTeX notes, spreadsheets and other formats show on a day only with Notes made or edited that day on (Settings → General). A note made on a day in one of those formats isn't dated.
- "Edited that day" is the day a note was last changed: lines doesn't keep each day a note was changed.
- Repeating is for the whole series: one time can't be moved, changed or skipped on its own, and a repeating event is dragged to another time, not another day (change its dates for that). A `repeat` is written in English words (`every monday`), whatever language lines is in, and RFC 5545 rules (`FREQ=WEEKLY;BYDAY=MO`) aren't read yet. A monthly one on the 29th to 31st comes on a shorter month's last day.
- Colors are the theme's eight (a note's own, or its type's or tag's), not any color. A day in the month shows a dot for each of three colors at most, and on the chosen day, filled in the accent, they're all the accent's text color.
- A colored tag's name is in the text's color on a tint of its color: in Solarized's light colors that's a little under 4.5:1 (4.3:1 at least), as its text is under 5:1 on its own; Increased contrast makes it more.
- Your calendars' events (EventKit, `.ics` subscriptions) and a feed of your dates for other calendar apps aren't there yet ([#77](https://github.com/overtio/lines/issues/77)).

## Panes

- The panes the notes are split into last while lines is open; they aren't kept after it's closed. The open note's pane stays where it is (its toolbar with it): others are moved around it, or swapped into it.
- A note or pane is dragged with a mouse, trackpad or pen, not a finger; by keyboard, Open to the Side, Open Below and Swap do the same.

## Inbox

- Notes leave the Inbox only by Mark as Filed (or Move to Inbox puts them back); tagging one or giving it a type doesn't file it. Notebooks to file them into are planned ([#75](https://github.com/overtio/lines/issues/75)).
- The Inbox lists notes in the list's usual order, newest first, not oldest first as inboxes are often worked through.
- A trashed note in the Inbox is still in it when restored.

## The sidebar's layout

- The order of the sidebar's rows, what's hidden and which sections are folded are kept on each device, not synced (tags' and types' icons and colors are synced).
- Rows are dragged within their own list: places between the sections of places, but types and tags stay in Types and Tags; a tag can't be dragged into another to nest it (rename it for that).
- A section that's only a gap can't be dragged among the others; name it to move it, then take the name off.
- Notes can't be hidden, so there's always a way back to every note.

## Dragging notes out

- One note at a time: the one dragged, not every picked note. Its images and files don't go with it.
- In the Mac app and in Chrome and Edge it's a file; in Safari and Firefox, and the Linux app, it's the note's text (use Download in the share menu for a file).

## Paper

- Patterns and textures are for the screen: printing, PDFs and exports are on plain white.
- Ruled lines, and grids following the text, go under each line of a note's text, so they run as wide as the text, not across the whole page, and rows start again below pictures, diagrams and code. At a custom size, grids are the page's own and don't line up with the text. Isometric paper never follows the text: its rows of dots are half a line apart.
- The paper and the backdrop are the same for every note, not chosen for each.
- A backdrop is the main window's: floating notes and the Settings window are plain.
- A picture chosen for the backdrop stays on the device it was chosen on (made no larger than 2400 pixels across), and doesn't sync or export.
- Ruled lines, and grids following the text, need the `lh` unit: Safari 16.4 and macOS 13.3 or later, Chrome 109 or later. Earlier ones show Lines as plain, dots not at all and grids' columns only; at a Custom size, grids don't need it.

## Code notes

- They're for reading and writing code, not running it: no completion as you type, no errors shown, no terminal.
- Long lines wrap, as in every note, rather than scroll sideways.
- Only languages with a file extension are offered (Dockerfile and a few others aren't), as a note has to be saved as a file.

## Line marks

- Marks are for the screen: printing and PDFs leave them out (a note's own are comments, which don't print either).
- A screen reader hears a note's own mark as the comment it is, on the line being edited; the marks plugins add aren't read yet.
- The Changes plugin compares a note with how it was when it was opened, not with the last time it synced or was exported.

## Layout, tabs and the outline

- Tabs have no keyboard shortcuts of their own beyond their tablist (← →, Delete): browsers keep ⌘W, Ctrl+Tab and ⌘1–9 for their own tabs.
- There are no tabs at phone width, nor in floating notes, and a tab can't be dragged to another place or into its own window.
- Open tabs are kept on each device; they don't sync.
- Two notes side by side: only two, and only where the window has room for both (the notes' pane at least 660 px wide; otherwise the note beside waits, and Open to the Side isn't offered), and never the same note in both (selecting the one beside closes it). The note beside isn't remembered when lines restarts, and has no tabs of its own.
- Panes on the right, and tabs, haven't been tried in the Mac app yet: the window buttons' room in each arrangement, and dragging the window by the space around the tabs.
- Links (Settings → Editor → Links): a web link can't open in a background tab of the browser, as browsers decide that; tab choices for mentions need tabs on, and in a floating note they open the note in the main window.
- The outline shows only with room for it beside the text (none at phone width, nor with Compact spacing in a narrow window), and in Markdown and LaTeX notes; plain-text notes have no headings. In a very long note, headings far down join it a moment after the note opens, as the note is read in the background.

## Themes

- Your themes and palettes are kept on each device, like the rest of Settings, and don't sync; a theme or palette file, or Copy Theme and Copy Palette, moves one to another device.
- A VS Code theme that builds on another (`"include": "./dark_plus.json"`) is read without what it includes, so its code may take lines' colors. Themes are read from their `.json`; a `.vsix` extension package isn't opened, nor are Sublime Text's `.sublime-color-scheme` files, Vim, Neovim or Emacs themes (which are code), JetBrains' `.icls`, or Obsidian's CSS.
- Only colors are imported: an app's fonts, its colors for parts lines doesn't have (an editor's gutter, a terminal's cursor), and translucency are left out. Which of an editor theme's colors becomes the accent is a guess when the theme doesn't say; it can be changed after.
- Colors made from the other scheme (Make Light Colors) are a start, not a designed theme.
- A palette keeps its colors in sRGB, hex or `rgb()`, so lines can shade them: one typed another way (`oklch()`, `hsl()`, a name) goes in as the browser draws it, brought into sRGB if it's outside it.
- GTK themes are read only as named colors (`@define-color`, or libadwaita's custom properties); colors made with GTK's functions (`mix()`, `shade()`, `alpha()`) are left out.
- Monochrome and Invert change lines' colors, not pictures or drawings' pen colors. Inverted, menus and cards (lighter than the note in a dark theme) are darker than the note, as in a negative.
- The color picker picks colors without transparency (one typed as text keeps its own), and its eyedropper, which picks a color from anywhere on the screen, is only in Chrome and Edge: Safari, Firefox and the Mac app have none to offer. The colors it offers first are the palette's as it has them, so with Monochrome or Invert on they aren't the greys or turned colors shown; and a theme's palette has only the colors it lists, so the picker offers no red or green for one whose tag and callout colors are worked out (lines' own Lines, Ink and the like), only its greys and accent.
- Formatting's colors (Settings → Theme's editor → Formatting): Markdown shown as written (Source) colors headings, bold, italics, strikethrough, links, mentions and quotes, but not underlines, highlighted text, inline code or list markers, which it doesn't draw; there, text both bold and italic is in italics' color if both have one, where Live has the innermost's. LaTeX notes take them as Live draws them; shown as written, a LaTeX note has only its commands' colors. Void's links in the text's color and grey bullets give way to colors your theme sets for them.
- Dark panes: the theme's editor (Your themes) previews each scheme as it is, without them; on a phone, the strip under the status bar keeps the note's color over a dark note list.

## Plugins

How plugins work is in [plugins.md](plugins.md).

- Plugins come with lines; one made by someone else can't be installed yet.
- A note in a format whose plugin is off shows as plain text: no live preview, and its title is its first line as written. Exports and downloads still write it in its format.
- Turning a plugin on or off isn't synced: each device keeps its own.
- Drawings (Excalidraw), highlighting code blocks, symbols, and objects and mentions are still part of the core and Markdown, not plugins.
- Only Markdown notes take additions from plugins; a renderer plugin draws code blocks in Markdown notes, not in LaTeX ones, and an embed (asciinema's recordings) draws links in Markdown notes only. Links drawn short and sources of papers are the exceptions: LaTeX notes have them too.
- Turning a plugin off or on in the Mac app's Settings window hasn't been tried there yet, nor in floating notes (each window should follow at once).

## 3D models

- OpenSCAD has no fonts here, so `text()` makes nothing (with a warning), and no libraries (MCAD, BOSL2): `include` and `use` find only what's in the block or file. `import()` can't reach attached files either, and an attached `.scad` file can't use another.
- OpenSCAD runs one model at a time, and stops one that takes more than a minute. While you type, a slow model is made again at each pause.
- OpenSCAD is only there when the build includes it (`bun run openscad-assets`, see the README); a build without it says so in the block.
- A glTF file is read only as `.glb`, or a `.gltf` with everything inside it: one whose parts are in other files, or compressed with Draco or meshopt, can't be read. An OBJ file shows without its materials (its `.mtl` isn't attached with it). A STEP or IGES file is drawn in one color per part, not per face, and a part it makes black is drawn in the theme's colors, as one with no color.
- Models aren't measured or cut through, and there's no exploded view of an assembly; the size shown is the box around the whole model.
- Very large meshes (over 300,000 triangles) are drawn without their edges, and a large STEP file can take some seconds to read the first time.
- The models haven't been tried in the Mac, Windows, Linux or phone apps yet, nor turned with a finger on a real touch screen.

## API requests

What isn't done yet is in [requests.md](requests.md#not-yet): environments, assertions and tests, bodies from files, forms with files, GraphQL and WebSocket, plain `http://` beyond this computer, and importing a Bruno or Postman collection.

- In the browser, only APIs that allow requests from other sites (CORS) answer, and headers the browser keeps from pages (`Cookie`) aren't sent.
- Responses aren't saved in the note: once lines quits they're gone, and a request using an earlier one's response needs that one sent again.
- **+** adds a response's body to the note only up to 200 KB.
- Hurl: what lines doesn't read or check of a Hurl file is in [requests.md](requests.md#hurl): the HTTP version, certificates, cookies shared between entries, `[Multipart]`, `md5`, and the options that tune curl or repeat entries. Not following redirects works in the apps only. Dates in `toDate` are read as ISO 8601. Captures and asserts read a JSON number as a double, so a whole number past 2^53 (a 64-bit id) is rounded; a `.http` request's `{{name.response.body.$.id}}` keeps it as written.
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
- Icon names, and the words the icon picker's search finds them by ("money", "finance"), are English in every language.
- Errors from the desktop app's own code (folders, the window) are English, inside a translated sentence.
- The welcome note, the feature tour and the examples are English. A note's text isn't translated, and the date `/date` writes is in the app's language.
- Changing the language starts lines again.

## Updates

- Tried on a Mac, with test builds and a stand-in for GitHub: a release that had waited long enough was downloaded and installed as the app quit, and the new version opened. Restart to update, and updating on Windows and Linux, haven't been tried yet; the first real release with updates will be the first test of its packages.
- The apps aren't signed, so after an update macOS may ask for the login password once more to read lines' Keychain item (app lock, Touch ID), as after reinstalling by hand.
- A `.deb` or `.rpm` install asks for a password when it updates, and the Windows MSI for permission; the AppImage and the `-setup.exe` install don't.
- Once an update is downloaded it's the one installed: a newer one found before quitting waits for the next run.
- There's no Check for Updates… in the Mac's app menu yet; it's in Settings → About.

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
- [ ] Install plugins made by others, safely; icon sets from a file
- [ ] Drawings in LaTeX notes, saved as a PDF beside the SVG for TeX
- [ ] Circuit schematics in CircuiTikZ (` ```circuitikz ` blocks, and `circuitikz` in LaTeX notes), drawn as you type
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
