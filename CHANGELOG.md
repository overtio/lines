# Changelog

What changed in each release of lines. Written by `bun scripts/release.mjs prepare` from the commits since the release before (docs/releasing.md).

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
