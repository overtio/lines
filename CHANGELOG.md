# Changelog

What changed in each release of lines. Written by `bun scripts/release.mjs prepare` from the commits since the release before (docs/releasing.md).

## [0.4.2](https://github.com/overtio/lines/compare/v0.4.1...v0.4.2) (2026-11-12)

### Fixes

- **themes:** borders with Increased contrast reach 3:1 in every theme, as the docs promise ([#301](https://github.com/overtio/lines/pull/301))
- **calendar:** screen readers hear "repeats" on a repeating event for the whole day too ([#296](https://github.com/overtio/lines/pull/296))
- **themes:** aero's colored buttons keep their text readable, with no shine under it ([#290](https://github.com/overtio/lines/pull/290))
- **calendar:** on the days the clocks change, the week's hours and event times aren't an hour off ([#287](https://github.com/overtio/lines/pull/287))
- **themes:** constructivist's focus ring on the chosen row follows its slant, not cut off by it ([#300](https://github.com/overtio/lines/pull/300))
- **settings:** search lists only settings, not messages shown once something's done ([#299](https://github.com/overtio/lines/pull/299))
- **editor:** marking and unmarking a line keeps the line break at its end ([#279](https://github.com/overtio/lines/pull/279))
- **themes:** void's field and switch lines darken with increased contrast ([#294](https://github.com/overtio/lines/pull/294))
- **themes:** orange, yellow and grey tags read on the sidebars of classic and other themes ([#291](https://github.com/overtio/lines/pull/291))
- **settings:** presets' undo goes back to your look after trying several in a row ([#286](https://github.com/overtio/lines/pull/286))
- **themes:** text on the accent stays readable when increased contrast darkens the accent ([#282](https://github.com/overtio/lines/pull/282))
- **themes:** increased contrast darkens puddle's and lightbulb's grey text and accent ([#278](https://github.com/overtio/lines/pull/278))
- **notes:** a tag in a double-backtick span, indented code or an HTML comment isn't listed ([#295](https://github.com/overtio/lines/pull/295))
- **calendar:** after renaming an event by keyboard, focus is back on the event rather than lost ([#293](https://github.com/overtio/lines/pull/293))
- **calendar:** renaming an event to a name with $& or $$ in it keeps the name as typed ([#292](https://github.com/overtio/lines/pull/292))
- **calendar:** an event stretched or moved to end at midnight keeps that end, rather than losing it ([#289](https://github.com/overtio/lines/pull/289))
- **calendar:** ⌘Z after moving an event doesn't undo what was done to the note since ([#285](https://github.com/overtio/lines/pull/285))
- **calendar:** the week and day show a note at two times on one day, instead of nothing at all ([#283](https://github.com/overtio/lines/pull/283))
- **editor:** a line dragged below a list stays apart from it, and leaves no blank line at the top ([#288](https://github.com/overtio/lines/pull/288))
- **editor:** ===x=== stays text instead of highlighting part of it ([#277](https://github.com/overtio/lines/pull/277))

### Performance

- **calendar:** counting the notes on a day with thousands of them doesn't slow to a crawl ([#298](https://github.com/overtio/lines/pull/298))

## [0.4.1](https://github.com/overtio/lines/compare/v0.4.0...v0.4.1) (2026-11-12)

### Fixes

- **sync:** an edit synced in while a floating note is typed in is kept as a conflicted copy ([#281](https://github.com/overtio/lines/pull/281))
- **settings:** Settings and a note's info fit a phone's width, in Spanish and French too ([#280](https://github.com/overtio/lines/pull/280))
- **editor:** a slash command on a quoted line keeps it in the quote, with no space left at its end ([#276](https://github.com/overtio/lines/pull/276))
- **list:** Esc in the search field puts focus on the open note's row, not on the page ([#274](https://github.com/overtio/lines/pull/274))
- **editor:** ⌘↵ leaves code, table rows and headings alone, and ⌘⇧M marks a todo ([#272](https://github.com/overtio/lines/pull/272))
- **editor:** ⌘D isn't listed as selecting the next match, which notes with one selection can't do ([#270](https://github.com/overtio/lines/pull/270))
- **notes:** keep what's typed just before closing the tab, reloading or quitting the Mac app ([#273](https://github.com/overtio/lines/pull/273))
- **sync:** a cloud drive's own conflicted copy of a note comes in as a conflicted copy, not lost ([#271](https://github.com/overtio/lines/pull/271))

## [0.4.0](https://github.com/overtio/lines/compare/v0.3.3...v0.4.0) (2026-11-12)

### Features

- **themes:** give every theme its own highlight, mark, callout and status colors ([#269](https://github.com/overtio/lines/pull/269))
- theme tools, Green World, Miku and Teto, five styles, and settings to hide toolbars and icons ([#268](https://github.com/overtio/lines/pull/268))
- inbox, calendar, notes side by side, presets and styles, fonts, and plugin settings pages ([#264](https://github.com/overtio/lines/pull/264))

## [0.3.3](https://github.com/overtio/lines/compare/v0.3.2...v0.3.3) (2026-11-10)

### Fixes

- **sync:** with every synced note deleted elsewhere, Settings asks what to do instead of stopping ([#255](https://github.com/overtio/lines/pull/255))
- **sync:** read note files another app saved with a byte order mark, or not in UTF-8, as notes ([#260](https://github.com/overtio/lines/pull/260))
- **editor:** find shows the match it's on in a table, a link's address, a diagram or a mark ([#263](https://github.com/overtio/lines/pull/263))
- **sync:** keep a pin, icon, trash or lock made while the note is edited elsewhere, with no copy ([#244](https://github.com/overtio/lines/pull/244))
- **import:** a note's file from a sync folder comes back as that note, without lines' header as text ([#262](https://github.com/overtio/lines/pull/262))
- **themes:** the Dot pointer and Comet trail follow your theme's accent as it changes, and contrast ([#261](https://github.com/overtio/lines/pull/261))
- **latex:** a #include in a code listing or verbatim no longer tags the note ([#235](https://github.com/overtio/lines/pull/235))
- **notes:** a note that fails to save is tried again, and a message says so until it's saved ([#252](https://github.com/overtio/lines/pull/252))
- **i18n:** French says vous everywhere, as in the rest of lines, not tu in a few new messages ([#258](https://github.com/overtio/lines/pull/258))
- **a11y:** closing the sidebar drawer with a click beside it gives focus back to what had it ([#257](https://github.com/overtio/lines/pull/257))
- **notes:** tags and mentions in Hindi, Thai or Vietnamese are read whole, not cut at an accent ([#256](https://github.com/overtio/lines/pull/256))
- **sync:** keep an edit another device saves while this one syncs, rather than write over it ([#232](https://github.com/overtio/lines/pull/232))
- **editor:** tab and shift-tab on a numbered item number it and the items around it again ([#253](https://github.com/overtio/lines/pull/253))
- **list:** ⌘⇧F puts focus in the search field from focus mode, and from an open note on a phone ([#251](https://github.com/overtio/lines/pull/251))
- **sync:** a conflicted copy of a LaTeX document is titled in its \title, its preamble left intact ([#250](https://github.com/overtio/lines/pull/250))

## [0.3.2](https://github.com/overtio/lines/compare/v0.3.1...v0.3.2) (2026-11-09)

### Fixes

- **editor:** enter at the start of a list item adds an empty item above, not a heading ([#248](https://github.com/overtio/lines/pull/248))
- **a11y:** F6 leaves the note while the sidebar is hidden, going through only the panes showing ([#247](https://github.com/overtio/lines/pull/247))
- **spreadsheets:** a CSV from Excel on Windows imports with its accents and euro signs ([#246](https://github.com/overtio/lines/pull/246))
- **settings:** under Invert, a custom page color starts as the page was, not white under light text ([#245](https://github.com/overtio/lines/pull/245))
- **notes:** a code note's #include or 'use strict' first line is its title as written ([#243](https://github.com/overtio/lines/pull/243))
- **editor:** enter on an empty second item ends the list instead of spacing it out ([#241](https://github.com/overtio/lines/pull/241))
- **requests:** a Hurl note made under a tag no longer shows the tag as its first entry's title ([#242](https://github.com/overtio/lines/pull/242))
- **sync:** choose any cloud drive folder on Windows and Linux, and find OneDrive and iCloud there ([#238](https://github.com/overtio/lines/pull/238))
- **requests:** an XML or text body stops before the comments after it, the next Hurl entry's title ([#239](https://github.com/overtio/lines/pull/239))
- **settings:** opened on a section in a narrow window, focus is in Settings, not in the note behind ([#237](https://github.com/overtio/lines/pull/237))
- **requests:** a pasted curl command reads -XPUT, -H'Accept: …' and --data-urlencode as curl does ([#236](https://github.com/overtio/lines/pull/236))
- **editor:** a code block in a list item or a quote copies, formats and prints all its lines ([#234](https://github.com/overtio/lines/pull/234))
- **requests:** a curl command copied from Chrome or Firefox keeps its !, accents and control codes ([#233](https://github.com/overtio/lines/pull/233))
- **spreadsheets:** a cell with a ``` line no longer ends its spreadsheet block early ([#231](https://github.com/overtio/lines/pull/231))
- **requests:** keep 64-bit ids as written in responses, the requests that use them, and pasted curl ([#230](https://github.com/overtio/lines/pull/230))

## [0.3.1](https://github.com/overtio/lines/compare/v0.3.0...v0.3.1) (2026-11-09)

### Fixes

- **attachments:** resized images and odd or long names open, and one failed open no longer sticks ([#227](https://github.com/overtio/lines/pull/227))
- **native:** turning Update automatically off stops a downloaded version installing at quit ([#229](https://github.com/overtio/lines/pull/229))
- **notes:** save a note its format can't read, such as a Hurl note with an unclosed body ([#228](https://github.com/overtio/lines/pull/228))
- **latex:** a half-typed \end no longer freezes the app ([#226](https://github.com/overtio/lines/pull/226))
- **native:** Windows and Linux laptops with a touch screen get updates, floating notes and printing ([#225](https://github.com/overtio/lines/pull/225))
- **editor:** links to a whole drive open, and one that can't be opened doesn't say it's missing ([#223](https://github.com/overtio/lines/pull/223))
- **native:** show programs in Finder rather than run them when an attachment or link opens ([#222](https://github.com/overtio/lines/pull/222))
- **notes:** keep images whose link has a title, which were deleted at the next launch ([#221](https://github.com/overtio/lines/pull/221))
- **native:** a picture of an SF Symbol sized NaN no longer closes the Mac app ([#220](https://github.com/overtio/lines/pull/220))

## [0.3.0](https://github.com/overtio/lines/compare/v0.2.0...v0.3.0) (2026-11-09)

### Features

- **plugins:** Wallhaven, its wallpapers in notes and as themes and the backdrop ([#219](https://github.com/overtio/lines/pull/219))
- **editor:** links to folders on your computer, made by dropping a folder from Finder or /folder ([#218](https://github.com/overtio/lines/pull/218))
- **typing:** a plugin to practice typing, on any text in a note, timed, with speed and accuracy ([#216](https://github.com/overtio/lines/pull/216))
- **themes:** dark panes, a sidebar and note list in the theme's dark colors beside a light note ([#215](https://github.com/overtio/lines/pull/215))
- **editor:** copy what you select with the mouse, as a terminal does ([#214](https://github.com/overtio/lines/pull/214))
- **settings:** a mascot, in pixel art, that keeps you company as you write ([#213](https://github.com/overtio/lines/pull/213))
- **settings:** cursors of your own, a text cursor that glides, trails or sparks, and pointers ([#212](https://github.com/overtio/lines/pull/212))
- **editor:** typing sounds, from built-in keyboards or any Mechvibes sound pack ([#211](https://github.com/overtio/lines/pull/211))
- **themes:** make a theme from a picture's colors, a wallpaper or a photo ([#210](https://github.com/overtio/lines/pull/210))
- **themes:** styles, whole looks beyond the colors: Classic, Pixel and Neon ([#209](https://github.com/overtio/lines/pull/209))
- **themes:** Ink, Indigo, Plum, Moss, Amber and Mono ([#208](https://github.com/overtio/lines/pull/208))
- **settings:** headings in the accent or a color of your own ([#207](https://github.com/overtio/lines/pull/207))
- **settings:** turn spell checking in notes on or off ([#206](https://github.com/overtio/lines/pull/206))
- **settings:** make only the sidebar, or the sidebar and note list, see-through ([#205](https://github.com/overtio/lines/pull/205))
- **editor:** page breaks, which split the page over a backdrop and start a new page in the PDF ([#204](https://github.com/overtio/lines/pull/204))
- **editor:** show Markdown as written, all in sight, live or never, and turn dragging off ([#203](https://github.com/overtio/lines/pull/203))
- **code:** code notes with line numbers, a fixed-width font and highlighting, in 124 languages ([#202](https://github.com/overtio/lines/pull/202))
- **editor:** mark lines in the margin, by a comment in the note or from plugins, and see changes ([#201](https://github.com/overtio/lines/pull/201))
- **settings:** turn scroll bars off everywhere in lines ([#200](https://github.com/overtio/lines/pull/200))
- **paper:** grids follow the text, a row of cells for each line, or take a size of your own ([#199](https://github.com/overtio/lines/pull/199))
- **paper:** a backdrop behind notes, which sit on it as pages, solid or frosted ([#198](https://github.com/overtio/lines/pull/198))
- **paper:** write on ruled lines, dots, squares, graph or isometric paper, with a paper texture ([#197](https://github.com/overtio/lines/pull/197))
- **site:** a home page with downloads, the docs as pages, and the web app at app/ ([#196](https://github.com/overtio/lines/pull/196))
- **native:** lines updates itself, once a new version has been out a week ([#195](https://github.com/overtio/lines/pull/195))
- **themes:** Monochrome and Invert show any theme in greys or turned light for dark ([#193](https://github.com/overtio/lines/pull/193))
- **themes:** make and share your own themes, and import them from VS Code, Zed, Base16 or terminals ([#194](https://github.com/overtio/lines/pull/194))
- **settings:** group Appearance and Data, each over its sections, and give Layout its own ([#191](https://github.com/overtio/lines/pull/191))
- **editor:** play audio and video in notes, and resize videos by their corner ([#190](https://github.com/overtio/lines/pull/190))
- **diagrams:** timing diagrams, register bit fields and logic circuits from WaveDrom code ([#189](https://github.com/overtio/lines/pull/189))
- **pdf:** print a note from the share menu ([#186](https://github.com/overtio/lines/pull/186))
- **papers:** arXiv links read short, and /paper searches arXiv ([#185](https://github.com/overtio/lines/pull/185))
- **asciinema:** play terminal recordings in notes, from asciinema.org or attached .cast files ([#184](https://github.com/overtio/lines/pull/184))
- **spreadsheets:** turn a CSV file in a note into a spreadsheet with its button ([#182](https://github.com/overtio/lines/pull/182))
- **drawings:** turn Mermaid diagrams into drawings with Pele, not Mermaid 11 ([#181](https://github.com/overtio/lines/pull/181))
- **models:** 3D models in notes, from OpenSCAD code or attached STL, 3MF, glTF, STEP and IGES files ([#180](https://github.com/overtio/lines/pull/180))
- **diagrams:** draw Mermaid diagrams with Pele by default, with Mermaid as the alternative ([#171](https://github.com/overtio/lines/pull/171))

### Fixes

- what reviewing the new features found, now covered by unit and browser tests, and QA pictures ([#217](https://github.com/overtio/lines/pull/217))
- show the hand cursor over menu items, as over buttons ([#188](https://github.com/overtio/lines/pull/188))
- **pdf:** keep the Mac window's buttons off the PDF preview's title ([#187](https://github.com/overtio/lines/pull/187))
- **drawings:** keep the Mac window's buttons off Excalidraw's menu ([#172](https://github.com/overtio/lines/pull/172))

## [0.2.0](https://github.com/overtio/lines/compare/v0.1.0...v0.2.0) (2026-11-08)

### Features

- API requests in notes (.http and Hurl), and secrets kept in a locked note ([#169](https://github.com/overtio/lines/pull/169))

## [0.1.0](https://github.com/overtio/lines/releases/tag/v0.1.0) (2026-11-07)

### Features

- fast with thousands of notes, benchmarks, Bun and Oxlint, automated releases ([#157](https://github.com/overtio/lines/pull/157))

### Changes

- Spreadsheets: fill, move, point across notes, money formats; a note beside
- Spreadsheets, formulas, a Settings window, layout, outline and more
- Plugins: formats, engines, themes and icons on a small core
- README: easier to read, with a screenshot
- Select several notes, Settings window, tag icons, Alpha label
- Add LaTeX notes, objects and mentions, drawings, math and PDF
- lines: local-first Markdown notes
