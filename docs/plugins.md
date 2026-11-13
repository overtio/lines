# Plugins

lines is built like a code editor such as [Zed](https://zed.dev): a small core that does one thing well, and everything else as plugins. The core keeps your notes: storing, syncing, locking and listing them, the windows, and an editor that knows nothing about any one way of writing. The formats notes are written in, what draws math and diagrams, the ways to make a PDF, the themes and the icons are all plugins. lines' own come built in, and use the same interface any other plugin would.

Settings → Plugins lists them (All Plugins). A plugin that isn't needed can be turned off, and turned on again whenever: its notes and settings wait for it. A plugin with settings of its own has a page of them under Plugins too (Spreadsheets, Paper, Keyboards and Mascots), its switch at the top and its settings below while it's on; the gear by its switch in the list goes there.

## lines' own plugins

| Plugin | What it adds | On by default | Code |
|---|---|---|---|
| Markdown | The Markdown notes are written in ([Linedown](linedown.md)). Always on. | Yes | `src/plugins/markdown/`, with the editor in `src/lib/editor/` and printing in `src/lib/print/markdown.ts` |
| LaTeX | Notes written in LaTeX ([latex.md](latex.md)) | Yes | `src/plugins/latex/` |
| Spreadsheets | Draws ` ```csv ` code blocks in Markdown notes as spreadsheets, and adds `/spreadsheet` ([spreadsheets.md](spreadsheets.md)) | Yes | `src/plugins/spreadsheet/` |
| Spreadsheet Notes | Notes that are spreadsheets, kept as CSV, and opening CSV and Excel files; needs Spreadsheets. Off at first, it comes on by itself where there's a spreadsheet note (synced, imported, the feature tour's), unless it was turned off by hand ([spreadsheets.md](spreadsheets.md#spreadsheet-notes)) | No | `src/plugins/spreadsheet/` |
| API Requests | Sends requests written in the `.http` format or Hurl's, from `.http` and `.hurl` notes and ` ```http ` and ` ```hurl ` code blocks in Markdown notes, shows their responses and checks Hurl's asserts; adds `/request` and `/hurl` ([requests.md](requests.md)) | Yes | `src/plugins/http/` |
| Secrets | Draws `{{name}}` in Markdown notes as a secret kept in a locked note, to show or copy; adds `/secret` ([secrets.md](secrets.md)) | Yes | `src/plugins/secrets/`, with the store in `src/lib/notes/secrets.svelte.ts` |
| Math (KaTeX) | The math engine, for math in notes of any format | Yes | `src/plugins/katex/` |
| Diagrams (Pele) | Draws ` ```mermaid ` code blocks with [Pele](https://pele.run), and adds `/diagram` | Yes | `src/plugins/pele/` |
| Diagrams (Mermaid) | Draws ` ```mermaid ` code blocks with [Mermaid](https://mermaid.js.org) itself, instead of Pele, and adds `/diagram` | No | `src/plugins/mermaid/` |
| Typing Practice | Draws ` ```typing ` code blocks as a passage to type over, timed, with your speed, accuracy and the keys you miss, and adds `/typing` ([linedown.md](linedown.md#typing-practice)) | Yes | `src/plugins/typing/` |
| Timing Diagrams (WaveDrom) | Draws ` ```wavedrom ` code blocks as timing diagrams, register bit fields and logic circuits, and adds `/timing` ([linedown.md](linedown.md#timing-diagrams)) | Yes | `src/plugins/wavedrom/` |
| 3D Models | Draws ` ```openscad ` blocks as the models OpenSCAD makes from their code, ` ```stl ` blocks, and attached OpenSCAD, STL, OBJ, PLY, OFF, 3MF, glTF, STEP and IGES files, as 3D models to turn around; adds `/model` ([linedown.md](linedown.md#3d-models)) | Yes | `src/plugins/models/` |
| Formulas (IronCalc) | The formula engine, for formulas in tables and spreadsheets, and Excel workbooks | Yes | `src/plugins/ironcalc/` |
| TeX Typesetting | Makes a LaTeX note's PDF with TeX. Needs LaTeX. | Yes | `src/plugins/tex/` |
| Unsplash | `/unsplash`: search Unsplash's free photos and put one in a note. Needs an API key when lines is built ([README](../README.md#development)) | Yes | `src/plugins/unsplash/` |
| Wallhaven | `/wallhaven`: search Wallhaven's wallpapers (only those safe for work) and put one in a note, kept with it; and Settings → Theme → New → From Wallhaven makes a theme of one's colors, and the backdrop. In the apps: Wallhaven's site doesn't answer web pages | Yes | `src/plugins/wallhaven/` |
| GIPHY | `/giphy`: search GIPHY's GIFs and put one in a note. Needs an API key when lines is built | Yes | `src/plugins/giphy/` |
| asciinema | Plays terminal recordings in Markdown notes: asciinema.org's embed code, and attached `.cast` files ([linedown.md](linedown.md#terminal-recordings)) | Yes | `src/plugins/asciinema/` |
| GitHub | Draws links to GitHub short, with GitHub's mark: `overtio/lines#12` ([linedown.md](linedown.md#github)) | Yes | `src/plugins/github/` |
| arXiv | Draws links to arXiv's papers as arXiv cites them, `arXiv:1706.03762`, and in the apps is a source of papers for `/paper` ([linedown.md](linedown.md#arxiv)) | Yes | `src/plugins/arxiv/` |
| Themes | The twenty-six themes, each with its palette, and reading themes made for other apps: VS Code, Zed, TextMate, Base16, terminals, KDE and GTK ([themes.md](themes.md)). Always on. | Yes | `src/plugins/themes/`, with your own themes and palettes in `src/lib/themes/` |
| Code | Code notes: a note that's a file of code, in any of the 122 languages `@codemirror/language-data` has file extensions for (but Markdown and LaTeX, which are formats of their own), with line numbers, a fixed-width font and highlighting; it downloads and exports as its language's file | Yes | `src/plugins/code/` |
| Changes | Marks the lines changed in a note since it was opened, in its margin: added, changed, and where lines were taken out. | No | `src/plugins/changes/` |
| Styles | Whole looks for the app beyond its colors, each a preset (Settings → Presets): Classic, a desktop of the late 90s with bevels and a title bar; Pixel, one-bit and minimal with a pixel font; Neon, glowing lines, a grid and scan lines; Puddle, a rainy day in a picture book with ink lines on cream paper; Lightbulb, a spark of lightning drawn as a cartoon, lemon and red with bold ink lines and hard shadows; Adventure, a 2D adventure game's pixel art, with framed slots and grass; Aero, glossy 2000s glass; Brutalist, thick rules, uppercase labels and big type; Constructivist, 1920s avant-garde posters in red, black and paper; Void, heavy minimalism; each with a color theme of its own. Their fonts are open (SIL OFL) and bundled | Yes | `src/plugins/styles/` |
| Fonts | Fonts to write notes in (Settings → Typography → Font family), beside the system's: IBM Plex Sans, Fira Sans and Agave, a monospaced one. They're open (SIL OFL) and bundled, so notes look the same on every computer and offline | Yes | `src/plugins/fonts/` |
| Keyboards | Keyboards to hear as you type (Settings → Plugins → Keyboards), made from sound rather than recorded: creamy and clacky linears, tactile, clicky, Topre, and a typewriter with its bell. Recorded keyboards come as Mechvibes sound packs of your own | Yes | `src/plugins/keyboards/` |
| Mascots | Companions that live in the window (Settings → Plugins → Mascots): a cat, an alien, a slime in the theme's accent and a pixel girl, each pixel art drawn for lines | Yes | `src/plugins/mascots/` |
| Paper | Paper to write on (Settings → Plugins → Paper): ruled lines under each line of text, dots, squares, graph and isometric paper behind the note, in the theme's colors or one chosen and as strong as wanted, grain or linen under it, and gradient backdrops behind the page | Yes | `src/plugins/paper/` |
| Lucide | lines' icons. Always on. | Yes | `src/plugins/lucide/` |
| SF Symbols | Apple's icons, in the Mac and iPhone apps | Yes | `src/plugins/sf-symbols/` |

## Turning a plugin off

Nothing is lost. A plugin turned off stops adding what it adds, at once, in every window:

- **A format.** Its notes keep their format and show as plain text, which can still be read and changed. Their ⓘ panel says so, with a button that turns the plugin back on. Export, Copy and Download still write them as what they are (a LaTeX note as a `.tex` file that compiles). With Spreadsheets off, a ` ```csv ` block in a Markdown note is a code block too, `/spreadsheet` is gone from the "/" menu, and tables and CSV files have no Convert to Spreadsheet button. With API Requests off, ` ```http ` and ` ```hurl ` blocks are code blocks with no Send buttons, and `/request` and `/hurl` are gone. With Secrets off, `{{name}}` is text and `/secret` is gone; requests still use secrets.
- **Links drawn short, or a source of papers.** With GitHub or arXiv off, its links are ordinary links. With arXiv off, `/paper` is gone (until another source of papers is on).
- **An engine.** With Math off, math shows as it's written. With both Diagrams plugins off, a ` ```mermaid ` block is a code block and `/diagram` is gone from the "/" menu. With Typing Practice off, a ` ```typing ` block is a code block and `/typing` is gone. With Timing Diagrams off, a ` ```wavedrom ` block is a code block and `/timing` is gone. With 3D Models off, ` ```openscad ` and ` ```stl ` blocks are code blocks, `/model` is gone, and an attached model is a card naming its file. With asciinema off, a recording's embed code is the picture it's written as (asciinema's preview), and an attached `.cast` file is a card naming it. With Formulas off, formulas show as written, and spreadsheets don't download as values or Excel workbooks. Without TeX, a LaTeX note's PDF is laid out by lines.
- **Pictures from the web.** With Unsplash, GIPHY or Wallhaven off, its `/` command is gone; with Wallhaven off, so is New → From Wallhaven. Pictures already in notes stay: Wallhaven's are kept in the note.
- **A theme or an icon set.** What was chosen is kept, and lines shows its own (Lines, Lucide) until the plugin is on again.
- **Paper.** What was chosen is kept, and notes are plain until the plugin is on again.
- **A plugin others need** (TeX needs LaTeX): those wait, and say what they need. Turning one on turns on what it needs too.

Pele and Mermaid draw the same blocks, so only one of them is on: turning one on turns the other off. Pele is on to begin with. Mermaid is larger and slower to load, and lays diagrams out as GitHub and other Mermaid apps do, where Pele has its own layout.

Which plugins are on is kept on each device, like the rest of Settings. A note in a format this device doesn't have, synced from another, shows as plain text and keeps its format when it syncs back.

## Writing a plugin

A plugin is a folder in `src/plugins/` whose module exports a function returning its `Plugin` (`src/lib/plugins/types.ts`), listed in `src/plugins/index.ts`. lines calls it once it has started, so a plugin can use anything in `src/lib/`. Its name and description are messages, translated like the rest ([translations.md](translations.md)).

```ts
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

export const graphviz = (): Plugin => ({
  id: "graphviz", // what's saved when it's turned on or off: never change it
  name: t("plugins.graphviz"),
  description: t("plugins.graphviz.description"),
  icon: "workflow",
  enabledByDefault: false, // waits to be turned on in Settings → Plugins
  contributes: {
    renderers: [
      {
        id: "graphviz",
        name: "Graphviz",
        languages: ["dot", "graphviz"],
        label: t("editor.diagram"),
        render: async (source, { paper }) => (await import("./draw")).toSvg(source, paper),
      },
    ],
  },
});
```

That's all a new renderer needs: ` ```dot ` blocks in Markdown notes are then drawn on screen and on paper, with the resize handle and the width after the language (` ```dot |400 `) that Mermaid's diagrams have.

Load anything big the first time it's needed (`import()`), as KaTeX, Pele, Mermaid, TeX and 3D Models do, so lines starts as fast with the plugin as without it. A stylesheet is the exception: added once the page is drawn, it restyles all of it, a stall that shows while scrolling, so import it with the plugin, as KaTeX does.

A plugin's own settings are a page in Settings under Plugins, given as `settings`, a Svelte component loaded with `import()` the first time Settings opens: `settings: () => import("./GraphvizSettings.svelte")`. lines shows it under the plugin's name, icon and switch, while the plugin's on (`src/lib/components/settings/PluginPage.svelte`). It's made of Settings' shared parts (`FieldGroup`s of `FieldRow`s, `src/lib/components/ui/`), keeping its values in lines' settings (`src/lib/prefs.svelte.ts`) or its own. Named `<Id>Settings.svelte`, for the plugin's id (`SfSymbolsSettings.svelte` for `sf-symbols`), the words in it are found by Settings' search, read from the file when lines is built (`vite.config.ts`).

### What a plugin can add

Every part of `contributes` is optional, and a plugin can add several kinds of things (Pele adds a renderer and a "/" command; API Requests a format, a code language, and editing and a "/" command for Markdown).

**`languages`**: formats notes can be written in (`NoteLanguage`). A language says everything lines needs to know about notes written in it, so nothing outside its plugin knows how it reads: Languages that are kinds of one thing say so with `group` (`{ id, name, default }`): a note's ⓘ panel shows them as one choice, then which, and switching to the group picks the one chosen last on the device, or `default` (the Code plugin's are one group, JavaScript first). A language can also say how a line is marked in its notes (`lineMarks`): `read(text)` finds a mark written at the end of a line's text (its start, color and label), `skip(state, pos)` says where one is in code rather than text (asked again as the note changes, while only the lines changed are read again), and `write(color, label)` makes one, which ⌘⇧M uses. `commentMarks(open, close)` in `src/lib/editor/markers.ts` makes those from a comment: Markdown's `<!-- mark … -->` (not in code), LaTeX's `% mark …`.

- `id`, kept with every note in it (`format: latex` in synced files), so it must never change; `name`, `extensions` (the usual one first) and `mimeType`
- `editor()`: CodeMirror extensions for how it's read, drawn as you type, its keys and its "/" menu. The editor in `src/lib/editor/` has pieces to build on: the menu (`slashMenu`), math (`mathElement`, `MathBlockWidget`), bullets and numbers (`livePreview.ts`), pasting tables and attachments, and the backslash commands (`texCommands.ts`). To show its headings in the outline beside the note, the editor adds `outlineHeadings.of((state) => headings)` (`outline.svelte.ts`), each with its `level` (1 the largest), `title` as it reads and where it starts (`from`); a language without one has no outline. It's asked each time a note in the language opens: the same extensions each time (made once, or again when they should change) keep the note from being set up again. What it draws can follow Settings → Editor → Show Markdown by reading `markupMode` (`markupMode.ts`): drawing nothing in `source`, showing all its markup in `visible`.
- `meta(body)`: what the note list, sidebar and search know of a note: title, excerpt, tags, open todos, properties and type. It's asked as the note is typed, so it should read any text, half-written too; if it throws, the note is listed as plain text, and still saved
- `plainText(body)` and `stats(body)`, for copying and the ⓘ panel's counts (`countLines` in `notes/stats.ts` counts as every format does)
- `addTag(body, tag)`, and `newNote({ tag, type })`, how a new note starts. Optionally `markTitle(body, mark)`, for a language that keeps a title apart from the text (LaTeX's `\title{…}`): the note with that title changed by `mark`, given it as written, or null if the note has none, as for a conflicted copy's title; without it, the line the title is read from is marked
- `file(body, attachments?)`: the note as a file of its own, for exports and downloads
- `print(body, parts)`: the note laid out for paper, for its PDF, printing and PNG images. `parts` draws math, code, renderers' code blocks, tables' formulas and images.
- Optionally, for a language whose notes aren't simply files of their text (a spreadsheet's are a title and CSV): `copyAs`, what Copy and Download call its text and give (`CSV`); `exports`, more files the share menu downloads (values as CSV, an Excel workbook); `opens`, more extensions it makes notes from (`xlsx`); and `read(file)`, the notes a file makes, for Settings → Export and Import → Import. A language without `read` makes a note of a file's text as it is.

**`palettes`**: named lists of colors that themes are drawn in (`Palette`), as Nord is sixteen: an `id` themes refer to it by, a `name`, `author` for a well-known one, and its `colors`, 4 to 32 of them as a rule, each an `id` (lasting, never shown), a `name` if it has one of its own (lines names one without from how it looks, in the app's language: `paletteNames` in `src/lib/themes/names.ts`), and the `color`, hex or `rgb()`, so lines can work out shades of it. Shades aren't listed: lines works them out.

**`themes`**: each a `palette`, by id (or one for each scheme, `{ light, dark }`, where a theme's light and dark colors are each their own, as Catppuccin's Latte and Mocha), and for `light`, `dark` or both which of its colors each part of lines is drawn in, by app.css's custom properties without `--` (`ThemeDefinition`): `{ bg: "nord6", text: "nord0", accent: "nord10" }`. Any part can be given a color: the backgrounds, text and accent (`bg`, `bg-list`, `bg-sidebar`, `bg-elevated`, `text`, `text-sidebar`, `text-muted`, `text-faint`, `accent`, `tag-text`, and `ink`, what faint overlays are mixed from), `danger`, `callout-info`, `syn-keyword`, the colors tags and events can be given (`palette-red` … `palette-gray`), formatting in notes (`text-h1` … `text-h6`, `text-bold`, `text-link` and the rest, [themes.md](themes.md#lines-theme-files)), and the rest app.css has. What a theme leaves out is worked out from what it gives (`workOut` in `src/lib/themes/palette.ts`): the note list, faint and sidebar text, tags readable on their chips, text on the accent; app.css mixes borders, hovers and the selection from them; and what there's nothing to work out from is lines' own. A part with a reading goal (`GOALS`: danger 4.5:1 on the note and menus, formatting in notes 4.5:1 on the note, success, callouts and tags' colors 3:1) is drawn in its color made just light or dark enough where it falls short, its hue kept; and Increased contrast's colors are worked out for every theme. A theme made from another palette should set its highlighter (`highlight-base`), `pin`, `danger`, `success` and callout colors from that palette, so highlights, line marks, callouts and icons match it rather than showing lines' own. `properties` sets the rest of how it draws, made only from its own colors (`color-mix(in srgb, var(--ink) 62%, transparent)`, `var(--accent)`, a tint's share, a shadow). A theme with one scheme is shown in it whatever Light or dark says; `author` credits who made it; `accessible` lists it with the themes for low vision and color blindness. A theme is data, nothing more: the registry works it out into a `Theme` with its colors for light and dark (`resolveTheme`), app.css builds the rest from these and hands them to Tailwind (`bg-panel`, `text-muted`, `border-line`…), so every component follows the theme. It's the same shape as lines' theme files ([themes.md](themes.md#lines-theme-files)), and the registry lists the palettes and themes people make or import after the plugins' (`src/lib/themes/custom.svelte.ts`); asked for a palette by id, it finds a plugin's even while it's off, so a theme of yours drawn in it keeps its colors. The Themes plugin's are in `src/plugins/themes/themes.ts`, each with its palette or palettes beside it (`builtIn.ts` gives them as a plugin's contributions).

**`themeFormats`**: kinds of theme files made for other apps, which Settings → Theme → Import reads (`ThemeFormat`). A format has its `name` ("Kitty"), the `extensions` its files have (tried first for those), and `read(text, fileName)`, which gives the themes in a file, or none if it isn't one of the format's: several share `.json`, so each checks the file is its own. A theme read is its `name`, `author` and its `colors` (`ImportedColors`): the background and text it has, and whatever else of a sidebar, menus, secondary and faint text, an accent, status colors, a terminal's hues and code's colors it names. lines makes a palette of those colors and a theme drawn in it, works the rest out (`importedColors` in `src/lib/themes/palette.ts`), tells light from dark by the background, and makes one theme of a light and a dark version. `src/plugins/themes/formats/parse.ts` reads the files themes come in: JSON with comments, YAML, TOML, INI and property lists. The Themes plugin's own read VS Code's, Zed's, TextMate's, Base16's, ten terminals', KDE's and GTK's, each loaded the first time a file is imported.

**`styles`**: whole looks for the app, beside its colors, each a preset in Settings → Presets (`AppStyle`). A style has its `name` and a `description`; `theme`, the id of a color theme made for it, which is chosen with it; `settings`, the rest of its preset, by the names of lines' settings that a preset has ([themes.md](themes.md#presets) lists them), such as `{ caretShape: "block", pointerStyle: "retro" }`, lines' own for any it leaves out; `font`, its own font's `name` and CSS `family`, for the whole app and as notes' first font in Settings → Typography; `properties`, custom properties it sets by name without `--`; and `css`, its own rules, each with a selector starting `:root[data-style="<id>"]`, so they show only while it's chosen. lines writes them after its own CSS, so they outrank it. The properties are app.css's tokens: `radius-scale` (how round every corner is, 1 as lines draws them, 0 square), the text sizes (`text-xs` … `text-xl`), the shadows (`card-shadow`, `shadow-menu`, `shadow-dialog`, `shadow-segment`, `shadow-drawer`), the fonts (`font-system`, `font-mono`) and heights (`control`, `row`). For the rest, the app's parts carry classes made for styles to reach them by: `ui-button` (with `data-variant`: `primary`, `secondary`, `quiet`, `danger`, `danger-primary`), `ui-icon-button`, `ui-field` (text fields and the note list's search), `ui-select` (a select's button, and the field of a combobox, such as Installed font's), `ui-switch` and `ui-switch-thumb`, `ui-slider-track` and `ui-slider-thumb`, `ui-segmented` and `ui-segment`, `ui-card` (a group of settings), `ui-callout` (with `data-tone`), `ui-nav-item`, `ui-menu`, `ui-option` and `ui-separator` (menus, a select's options, popovers), `ui-dialog`, `ui-sidebar-row` (`.active` when chosen) and `ui-note-row` (`.selected`, with its background in `--layer`); and the panes, `.sidebar`, `.note-list`, `.editor-pane`, `.toolbar` and `.titlebar`, and the Calendar's week or day in the note's place, `.calendar-days`. Each icon is an `svg.icon` with its name as a class too (`icon-check`, `icon-pin`). What's drawn in a note has editor.css's classes (`cm-lp-h`, `cm-lp-checkbox`, `cm-lp-tag`, `cm-cursor`…). Colors come from the theme's custom properties, so a style works with any colors chosen with it. A style with its own color for some formatting (Void's links are the text's) sets that formatting's property as app.css does, at its weight, `:root:where([data-style="<id>"])`, so a color a theme gives it still wins. A part can have colors of its own, a pane shown dark (Settings → Theme → Dark panes), marked with `data-scheme`: a style's `properties` are set there again, and custom properties its `css` makes from the theme's colors (Classic's bevels) should be too, with `:root[data-style="<id>"] [data-scheme]` beside `:root[data-style="<id>"]`, so they're made from that part's colors. The Styles plugin's own are in `src/plugins/styles/`, each a CSS file.

**`fonts`**: fonts to write notes in, listed in Settings → Typography → Font family after the system's (`NoteFont`): an `id`, the `name` shown under its sample, and its CSS `family`, with fonts to fall back on. lines writes a rule for each (`src/lib/themes/fonts.svelte.ts`) setting `--font-text`, the notes' font, while the page's `data-font` is its id; while its plugin is off, a note chosen in it is in the system's font. The plugin brings the font's files itself (`@font-face`, as fontsource's packages give them), which load only once text is drawn in it. The Fonts plugin's are in `src/plugins/fonts/`.

**`paperStyles`**: paper a note's page can look like, chosen in Settings → Plugins → Paper (`PaperStyle`): a `pattern` drawn behind the text, a `texture` under it, or a `backdrop` behind the page, one of each at a time. A style has its `name` and the CSS background layers that draw it (`image`, `size`, `position`), in the scheme shown: `layers(scheme)`, across the page; and for a pattern that can follow the text, `lineLayers()`, drawn under each line of the note in tiles `1lh` high (the line's own height), so each line has its own row, headings and wrapped lines too, with `columnLayers()` down the whole text column from its left edge, unbroken by the lines (a grid's columns). While Settings → Plugins → Paper → Spacing is Text (to begin with), a pattern with `lineLayers` uses them; at a Custom size, its `layers`; a pattern with only `lineLayers` (ruled lines) always follows the text. A pattern draws in `--paper-color` (the theme's ink, its accent, or a color chosen, as Color says) at `--paper-opacity` (0 to 1, from Opacity: a line's strength; something smaller, like a dot, can go a few times over it), every `--paper-step`: a line of text, or the size chosen. So it follows the theme, Monochrome and Invert, and grows with the text. A texture is told whether it's shown in light or dark, and so is a backdrop, which fills the main window's note pane around the page (lines' own are soft glows of color, with a darker version for dark; a color or a picture of your own are chosen in Settings, not from plugins). lines sets the chosen ones as custom properties (`src/lib/paper.svelte.ts`) that `editor.css` draws behind every note but a spreadsheet's. The Paper plugin's are gradients, and SVG noise for its textures.

**`keyboardSounds`**: keyboards to hear as you type, chosen in Settings → Plugins → Keyboards (`KeyboardSound`). One has its `name` and a `description`, and `load(context)`, which makes (or decodes) its sounds for a Web Audio context the first time it's chosen and gives back what each key plays going down and coming up: `press(code)` and `release(code)`, by `KeyboardEvent.code` (`KeyA`, `Space`, `Enter`), each a `KeyClip`, an `AudioBuffer` and the part of it to play (`offset`, `duration`, in seconds), or nothing for silence. lines plays one for each press, not a held key's repeats, a little higher or lower each time, at the volume chosen (`src/lib/sounds/typing.svelte.ts`). The Keyboards plugin's are synthesized (`src/plugins/keyboards/synth.ts`); sound packs people add (Mechvibes', V1 and V2, from a .zip or a folder) are listed after the plugins' (`src/lib/sounds/packs.svelte.ts`).

**`pictureLibraries`**: pictures on the web whose whole picture a plugin can fetch (`PictureLibrary`): a library's `name`, `credit` (under its picker), `search(query, page, signal)` giving a page of `FoundImage`s (a `thumb` to show, a `color` while it loads, an `alt`), and `picture(image)`, the picture itself as a Blob. Settings → Theme → New lists each as From <name>…: a picture chosen there is a theme of its colors, as one from your device is, and can be the backdrop. Given as a `/` command's picker (`pickWebImage(library)`, `src/lib/editor/webImages.ts`), a picture chosen is kept with the note, at most 2,400 pixels across, rather than shown from the library. Wallhaven's plugin is one.

**`mascots`**: companions that live in the main window, chosen in Settings → Plugins → Mascots (`Mascot`). One is pixel art: its `frames`, the poses `stand`, `walk1`, `walk2`, `sit`, `sleep` and `cheer`, each facing right, a row a line and a character a pixel, all the same size (16 × 16 and 16 × 24 are lines' own), or a pose that's another with its eyes shut (`{ like: "sit", closed: true }`); its `palette`, a color for each character (`.` is see-through), where `accent` and `accent-dark` are the theme's, and `e` and `i` are its eyes and their shine, which blinking turns to its `lid` color but for a line; how it `moves` (`walk`, `float`, bobbing, or `hop`); and `sounds`, what it says its own way. lines does the rest (`src/lib/mascot/`): it walks it along the bottom of the note, hops it up beside the line being written (told where by the editor, `editor/cursor.ts`), has it cheer, nap, turn to the pointer and pounce, react to a click, be picked up and dropped, and celebrate a ticked todo or a finished typing drill (a window event, `lines:done`).

**`markers`**: what marks lines in a note's margin, as a code editor marks the lines changed (`MarkerSource`). A source's `markers(note)` is given the note's `text`, its text when it was `opened`, and its `format`, and gives `LineMarker`s: the lines (`from`, and `to` for more than one, counted from 1), a `color` (the theme's `accent`, or `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `gray`), a `label` shown on pointing at it, and `between` for a wedge where lines were taken out rather than a bar. It's asked on every change, so it has to be quick. Each source has a lane of its own, outside the note's own marks; lines next to each other marked alike join into one bar. The Changes plugin's marks what's different since the note was opened, by a line diff (`src/plugins/changes/diff.ts`, Myers', with the same lines at both ends set aside first). A spelling or grammar checker, a linter for code, or a request whose response failed could each be one.

**`iconSets`**: a Svelte component that draws any of lines' icons (`src/lib/icons/icons.ts`) at a size.

**`math`**: an engine that draws LaTeX math into an element, after loading itself the first time.

**`formulas`**: an engine that works out formulas (`FormulaEngine`), for tables in Markdown notes and for spreadsheets. It keeps a sheet that works its cells out again as they change (`sheet(find)`, `find` finding the other sheets its formulas name: `Budget!B4`), moves a formula's relative references as copying does (`move`), renames the other sheets a formula names, as renaming a sheet does (`renameSheets`), moves cells with formulas pointing at them following, as cutting and pasting does (`moveCells`), puts in and takes out rows and columns with formulas still pointing at the same cells (`shift`), says what can go at the cursor in a formula being written (`complete`), where its references are (`references`) and which functions it knows (`functions`, for suggesting them), and can read and write Excel workbooks. Formulas are in Excel's English, with commas, so they work the same everywhere. Only the first engine on is used; IronCalc's is lines' own, and [HyperFormula is being considered](https://github.com/overtio/lines/issues/1) as another.

**`renderers`**: engines that draw a code block of their languages, on screen in the theme's colors or for paper in black on white, as SVG markup or an element. `actions` are buttons beside what they draw, down its right side. A renderer with an `editor` draws its blocks on screen as something to work in instead, which `render` still prints: the Spreadsheets plugin's draws a ` ```csv ` block as a grid. `editor(dom, block)` puts what it draws into `dom` and gives back what the editor calls as things change (`BlockEditor`: `update` when the block's code or name, the note around it or its read-only state changes, `focus` when ↓ or ↑ moves into it from the text around it, `layout`, `destroy`). Through `block` (`EditableBlock`) it reads the block's code (`source`), where it starts (`from`) and its name (`name`, written after the language: ` ```csv name=costs `), writes its code back as one step to undo (`write`) and its name (`rename`), and moves the cursor out into the text (`leave`) or into its code (`showCode`), which shows in its place while the cursor's in it (`src/lib/editor/rendered.ts`). Its `actions` sit beside it too: an editor that draws something narrower than the block, or below a caption, sets `--actions-left` and `--actions-top` on `dom` to where that ends and starts. `render` is given the whole note's text (`note`) when it's known, for what depends on the rest of the note: a ` ```csv ` block's formulas use other blocks in it. A renderer with `fromFiles` makes its blocks from attached files of those `extensions`: their card in a Markdown note gets a button (its `label` and `icon`) that puts the block `read` makes from the file's bytes in the file's place, with the name `read` gives it, if any. The Spreadsheets plugin's turns a `.csv` or `.tsv` file into a ` ```csv ` block named after the file.

**`files`**: ways to show attached files of some kinds (`FileView`, by their `extensions`), as the 3D Models plugin shows a model to turn around. A link to such a file on a line of its own, `[Bracket.stl](../attachments/….stl)`, is drawn with what `show(dom, file)` puts in `dom` above the card naming the file, given the file's `name`, `label` (its link's text) and `data`. What it gives back (`Shown`) takes it down with `destroy`, and can take the keyboard with `focus`, which Enter does while the file is selected: a recording starts playing. On paper it's what `print(file)` makes (a picture), above the file's name; without `print`, the name alone. What's shown can take drags of its own: an element with the class `cm-lp-interactive` keeps them, and a click on it that isn't a drag selects the file's line, as a click on a card does. A renderer's drawing can have such an element too, where a click shows its code. One with the class `cm-lp-own-input` takes all its clicks and keys, as a player does, and Esc in it goes back to the note's text with the file selected.

**`codeLanguages`**: how code blocks in more languages are highlighted, in the editor and on paper, as CodeMirror [`LanguageDescription`](https://codemirror.net/docs/ref/#language.LanguageDescription)s: API Requests' highlights ` ```http `. A plugin's language comes before the ones CodeMirror knows by the same name.

**`typesetters`**: ways to make a PDF for notes in some languages, offered beside lines' own pages in the PDF preview.

**`links`**: sites whose links are drawn short, the way the site writes them, with its `mark` (SVG markup in `currentColor`) in front. `text(url)` says how a link reads, or null for one that stays as it is: GitHub's plugin reads `https://github.com/overtio/lines/issues/12` as `overtio/lines#12`, arXiv's `https://arxiv.org/abs/1706.03762` as `arXiv:1706.03762`. Markdown and LaTeX notes draw them in text and tables (`src/lib/editor/shortLinks.ts`), and printed Markdown reads them short. The first plugin on that reads a link draws it.

**`papers`**: places research papers are found (`PaperSource`). Each is a `/paper` command in Markdown and LaTeX notes, its name beside it in the menu, which opens a picker searching it (`src/lib/editor/PaperPicker.svelte`) and puts the paper chosen in the note as a link named by its title, as the note's format writes links. A source has its `name`, the `credit` its terms ask for under the results, and `search(query, page, signal)`, which gives one page of `Paper`s (`id`, `title`, `authors`, `year`, `venue`, the `url` to link to) and whether there are more; with nothing typed, nothing. Searching is the source's to pace and to keep answers of: arXiv's waits three seconds between requests, as arXiv asks. A source usually comes with `links` for its papers, as arXiv's does. Semantic Scholar, OpenAlex, PubMed, bioRxiv or a library's catalog would each be one:

```ts
import { t } from "../../lib/i18n/index.svelte";
import { webFetch } from "../../lib/platform";
import type { Paper, Plugin } from "../../lib/plugins/types";

interface Work {
  id: string;
  title: string;
  publication_year: number;
  authorships: { author: { display_name: string } }[];
  doi: string | null;
}

/** A work as OpenAlex describes it, as a paper: linked to by its DOI, or else its page on OpenAlex. */
const paper = (work: Work): Paper => ({
  id: work.id,
  title: work.title,
  authors: work.authorships.map((each) => each.author.display_name),
  year: work.publication_year,
  url: work.doi ?? work.id,
});

export const openalex = (): Plugin => ({
  id: "openalex",
  name: "OpenAlex",
  description: t("plugins.openalex.description"),
  icon: "graduation-cap",
  enabledByDefault: false,
  contributes: {
    papers: [
      {
        id: "openalex",
        name: "OpenAlex",
        credit: { text: "Papers from OpenAlex", href: "https://openalex.org" },
        async search(query, page, signal) {
          if (!query) return { items: [], more: false };
          const response = await (await webFetch())(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&page=${page}`, { signal });
          const { results, meta } = await response.json();
          return { items: results.map(paper), more: page * meta.per_page < meta.count };
        },
      },
    ],
  },
});
```

**`markdown`**: new syntax for Markdown notes. A `syntax` extension for the parser ([`@lezer/markdown`](https://github.com/lezer-parser/markdown)), `editor` extensions that draw it, `commands` for the "/" menu (each can go `after` another, by id; several after the same one keep their plugins' order), and `print`, a printer for each node the syntax adds. A command can open a picker of pictures from a library on the web with `pickWebImage` (`src/lib/editor/webImages.ts`): the library searches, and the picker is the same for each, as Unsplash's and GIPHY's are. Pictures and papers are both picked in `WebSearchPicker.svelte`, which searches as you type, loads more on scrolling and moves through what it found with the arrow keys; something else to search on the web can use it too.

`embeds`, also in `markdown`, draw links on a line of their own as something to watch or use, as `files` do attachments: asciinema's draws a recording's embed code as its player. An `Embed` says which links it `draws` (`EmbedLink`: where it links, the image it shows if it's one, its text), and `draw` puts what it draws into an element, calling back when its size changes, and gives back a `Shown`, as a file view does. The core does the rest, as for images and files (`src/lib/editor/attachments.ts`): ↑ and ↓ stop on it, a click beside it selects it, and it's moved and deleted as a block; `cm-lp-own-input` works the same. With `paste`, a link pasted on an empty line becomes what the embed writes, its embed code say, and undo turns it back into the link.

### Plugins built on plugins

A plugin can need others (`requires`): it runs only while they do, and turning it on turns them on. TeX needs LaTeX, and imports its code. Plugins that do the same work name each other as `alternatives`, and turning one on turns the others off: Pele and Mermaid both draw ` ```mermaid ` blocks, with what they add besides from `src/plugins/mermaid/blocks.ts`. Otherwise plugins meet only through what they add: a renderer draws the code blocks of any format whose editor asks for it, and any format's math is drawn by whichever math engine is on.

## Not yet

- Plugins come with lines; there's no installing one made by someone else yet. That needs a way to run their code safely (the apps only run lines' own scripts), and to check where it came from. See the [roadmap](../README.md#roadmap).
- Some of lines isn't a plugin yet: drawings (Excalidraw), highlighting code blocks, symbols (`->` as →), and the objects and mentions in Markdown notes.
- Only Markdown takes additions from other plugins (`markdown`). Links drawn short and sources of papers are used by Markdown and LaTeX notes both.
- Whether a plugin is on doesn't sync between devices.
