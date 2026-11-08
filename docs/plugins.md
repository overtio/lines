# Plugins

lines is built like a code editor such as [Zed](https://zed.dev): a small core that does one thing well, and everything else as plugins. The core keeps your notes: storing, syncing, locking and listing them, the windows, and an editor that knows nothing about any one way of writing. The formats notes are written in, what draws math and diagrams, the ways to make a PDF, the themes and the icons are all plugins. lines' own come built in, and use the same interface any other plugin would.

Settings → Plugins lists them. A plugin that isn't needed can be turned off, and turned on again whenever: its notes and settings wait for it.

## lines' own plugins

| Plugin | What it adds | On by default | Code |
|---|---|---|---|
| Markdown | The Markdown notes are written in ([Linedown](linedown.md)). Always on. | Yes | `src/plugins/markdown/`, with the editor in `src/lib/editor/` and printing in `src/lib/print/markdown.ts` |
| LaTeX | Notes written in LaTeX ([latex.md](latex.md)) | Yes | `src/plugins/latex/` |
| Spreadsheets | Notes that are spreadsheets, kept as CSV, and opening CSV and Excel files; draws ` ```csv ` code blocks in Markdown notes as spreadsheets, and adds `/spreadsheet` ([spreadsheets.md](spreadsheets.md)) | Yes | `src/plugins/spreadsheet/` |
| API Requests | Sends requests written in the `.http` format or Hurl's, from `.http` and `.hurl` notes and ` ```http ` and ` ```hurl ` code blocks in Markdown notes, shows their responses and checks Hurl's asserts; adds `/request` and `/hurl` ([requests.md](requests.md)) | Yes | `src/plugins/http/` |
| Secrets | Draws `{{name}}` in Markdown notes as a secret kept in a locked note, to show or copy; adds `/secret` ([secrets.md](secrets.md)) | Yes | `src/plugins/secrets/`, with the store in `src/lib/notes/secrets.svelte.ts` |
| Math (KaTeX) | The math engine, for math in notes of any format | Yes | `src/plugins/katex/` |
| Diagrams (Pele) | Draws ` ```mermaid ` code blocks with [Pele](https://pele.run), and adds `/diagram` | Yes | `src/plugins/pele/` |
| Diagrams (Mermaid) | Draws ` ```mermaid ` code blocks with [Mermaid](https://mermaid.js.org) itself, instead of Pele, and adds `/diagram` | No | `src/plugins/mermaid/` |
| Formulas (IronCalc) | The formula engine, for formulas in tables and spreadsheets, and Excel workbooks | Yes | `src/plugins/ironcalc/` |
| TeX Typesetting | Makes a LaTeX note's PDF with TeX. Needs LaTeX. | Yes | `src/plugins/tex/` |
| Unsplash | `/unsplash`: search Unsplash's free photos and put one in a note. Needs an API key when lines is built ([README](../README.md#development)) | Yes | `src/plugins/unsplash/` |
| GIPHY | `/giphy`: search GIPHY's GIFs and put one in a note. Needs an API key when lines is built | Yes | `src/plugins/giphy/` |
| Themes | The sixteen themes. Always on. | Yes | `src/plugins/themes/` |
| Lucide | lines' icons. Always on. | Yes | `src/plugins/lucide/` |
| SF Symbols | Apple's icons, in the Mac and iPhone apps | Yes | `src/plugins/sf-symbols/` |

## Turning a plugin off

Nothing is lost. A plugin turned off stops adding what it adds, at once, in every window:

- **A format.** Its notes keep their format and show as plain text, which can still be read and changed. Their ⓘ panel says so, with a button that turns the plugin back on. Export, Copy and Download still write them as what they are (a LaTeX note as a `.tex` file that compiles). With Spreadsheets off, a ` ```csv ` block in a Markdown note is a code block too, `/spreadsheet` is gone from the "/" menu, and tables have no Convert to Spreadsheet button. With API Requests off, ` ```http ` and ` ```hurl ` blocks are code blocks with no Send buttons, and `/request` and `/hurl` are gone. With Secrets off, `{{name}}` is text and `/secret` is gone; requests still use secrets.
- **An engine.** With Math off, math shows as it's written. With both Diagrams plugins off, a ` ```mermaid ` block is a code block and `/diagram` is gone from the "/" menu. With Formulas off, formulas show as written, and spreadsheets don't download as values or Excel workbooks. Without TeX, a LaTeX note's PDF is laid out by lines.
- **A theme or an icon set.** What was chosen is kept, and lines shows its own (Lines, Lucide) until the plugin is on again.
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

Load anything big the first time it's needed (`import()`), as KaTeX, Pele, Mermaid and TeX do, so lines starts as fast with the plugin as without it. A stylesheet is the exception: added once the page is drawn, it restyles all of it, a stall that shows while scrolling, so import it with the plugin, as KaTeX does.

### What a plugin can add

Every part of `contributes` is optional, and a plugin can add several kinds of things (Pele adds a renderer and a "/" command; API Requests a format, a code language, and editing and a "/" command for Markdown).

**`languages`**: formats notes can be written in (`NoteLanguage`). A language says everything lines needs to know about notes written in it, so nothing outside its plugin knows how it reads:

- `id`, kept with every note in it (`format: latex` in synced files), so it must never change; `name`, `extensions` (the usual one first) and `mimeType`
- `editor()`: CodeMirror extensions for how it's read, drawn as you type, its keys and its "/" menu. The editor in `src/lib/editor/` has pieces to build on: the menu (`slashMenu`), math (`mathElement`, `MathBlockWidget`), bullets and numbers (`livePreview.ts`), pasting tables and attachments, and the backslash commands (`texCommands.ts`). To show its headings in the outline beside the note, the editor adds `outlineHeadings.of((state) => headings)` (`outline.svelte.ts`), each with its `level` (1 the largest), `title` as it reads and where it starts (`from`); a language without one has no outline.
- `meta(body)`: what the note list, sidebar and search know of a note: title, excerpt, tags, open todos, properties and type
- `plainText(body)` and `stats(body)`, for copying and the ⓘ panel's counts (`countLines` in `notes/stats.ts` counts as every format does)
- `addTag(body, tag)`, and `newNote({ tag, type })`, how a new note starts
- `file(body, attachments?)`: the note as a file of its own, for exports and downloads
- `print(body, parts)`: the note laid out for paper, for its PDF, printing and PNG images. `parts` draws math, code, renderers' code blocks, tables' formulas and images.
- Optionally, for a language whose notes aren't simply files of their text (a spreadsheet's are a title and CSV): `copyAs`, what Copy and Download call its text and give (`CSV`); `exports`, more files the share menu downloads (values as CSV, an Excel workbook); `opens`, more extensions it makes notes from (`xlsx`); and `read(file)`, the notes a file makes, for Settings → Data → Import. A language without `read` makes a note of a file's text as it is.

**`themes`**: each with `light` and `dark` colors for app.css's custom properties, by name without `--`. `bg`, `bg-list`, `bg-sidebar`, `bg-elevated`, `text`, `text-sidebar`, `text-muted`, `text-faint`, `accent`, `tag-text` and `ink` (what faint overlays are mixed from) are needed; any other property app.css has (`danger`, `callout-info`, `syn-keyword`…) can be set too. `moreContrast` holds the colors for Contrast → Increased. A theme is data, nothing more: app.css builds the rest of the palette from these and hands it to Tailwind (`bg-panel`, `text-muted`, `border-line`…), so every component follows the theme.

**`iconSets`**: a Svelte component that draws any of lines' icons (`src/lib/icons/icons.ts`) at a size.

**`math`**: an engine that draws LaTeX math into an element, after loading itself the first time.

**`formulas`**: an engine that works out formulas (`FormulaEngine`), for tables in Markdown notes and for spreadsheets. It keeps a sheet that works its cells out again as they change (`sheet(find)`, `find` finding the other sheets its formulas name: `Budget!B4`), moves a formula's relative references as copying does (`move`), renames the other sheets a formula names, as renaming a sheet does (`renameSheets`), moves cells with formulas pointing at them following, as cutting and pasting does (`moveCells`), puts in and takes out rows and columns with formulas still pointing at the same cells (`shift`), says what can go at the cursor in a formula being written (`complete`), where its references are (`references`) and which functions it knows (`functions`, for suggesting them), and can read and write Excel workbooks. Formulas are in Excel's English, with commas, so they work the same everywhere. Only the first engine on is used; IronCalc's is lines' own, and [HyperFormula is being considered](https://github.com/overtio/lines/issues/1) as another.

**`renderers`**: engines that draw a code block of their languages, on screen in the theme's colors or for paper in black on white, as SVG markup or an element. `actions` are buttons beside what they draw, down its right side. A renderer with an `editor` draws its blocks on screen as something to work in instead, which `render` still prints: the Spreadsheets plugin's draws a ` ```csv ` block as a grid. `editor(dom, block)` puts what it draws into `dom` and gives back what the editor calls as things change (`BlockEditor`: `update` when the block's code or name, the note around it or its read-only state changes, `focus` when ↓ or ↑ moves into it from the text around it, `layout`, `destroy`). Through `block` (`EditableBlock`) it reads the block's code (`source`), where it starts (`from`) and its name (`name`, written after the language: ` ```csv name=costs `), writes its code back as one step to undo (`write`) and its name (`rename`), and moves the cursor out into the text (`leave`) or into its code (`showCode`), which shows in its place while the cursor's in it (`src/lib/editor/rendered.ts`). Its `actions` sit beside it too: an editor that draws something narrower than the block, or below a caption, sets `--actions-left` and `--actions-top` on `dom` to where that ends and starts. `render` is given the whole note's text (`note`) when it's known, for what depends on the rest of the note: a ` ```csv ` block's formulas use other blocks in it.

**`codeLanguages`**: how code blocks in more languages are highlighted, in the editor and on paper, as CodeMirror [`LanguageDescription`](https://codemirror.net/docs/ref/#language.LanguageDescription)s: API Requests' highlights ` ```http `. A plugin's language comes before the ones CodeMirror knows by the same name.

**`typesetters`**: ways to make a PDF for notes in some languages, offered beside lines' own pages in the PDF preview.

**`markdown`**: new syntax for Markdown notes. A `syntax` extension for the parser ([`@lezer/markdown`](https://github.com/lezer-parser/markdown)), `editor` extensions that draw it, `commands` for the "/" menu (each can go `after` another, by id; several after the same one keep their plugins' order), and `print`, a printer for each node the syntax adds. A command can open a picker of pictures from a library on the web with `pickWebImage` (`src/lib/editor/webImages.ts`): the library searches, and the picker is the same for each, as Unsplash's and GIPHY's are.

### Plugins built on plugins

A plugin can need others (`requires`): it runs only while they do, and turning it on turns them on. TeX needs LaTeX, and imports its code. Plugins that do the same work name each other as `alternatives`, and turning one on turns the others off: Pele and Mermaid both draw ` ```mermaid ` blocks, with what they add besides from `src/plugins/mermaid/blocks.ts`. Otherwise plugins meet only through what they add: a renderer draws the code blocks of any format whose editor asks for it, and any format's math is drawn by whichever math engine is on.

## Not yet

- Plugins come with lines; there's no installing one made by someone else yet. That needs a way to run their code safely (the apps only run lines' own scripts), and to check where it came from. See the [roadmap](../README.md#roadmap).
- Some of lines isn't a plugin yet: drawings (Excalidraw), highlighting code blocks, GitHub links, symbols (`->` as →), and the objects and mentions in Markdown notes.
- Only Markdown takes additions from other plugins.
- Whether a plugin is on doesn't sync between devices.
