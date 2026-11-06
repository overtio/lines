# Plugins

lines is built like a code editor such as [Zed](https://zed.dev): a small core that does one thing well, and everything else as plugins. The core keeps your notes: storing, syncing, locking and listing them, the windows, and an editor that knows nothing about any one way of writing. The formats notes are written in, what draws math and diagrams, the ways to make a PDF, the themes and the icons are all plugins. lines' own come built in, and use the same interface any other plugin would.

Settings → Plugins lists them. A plugin that isn't needed can be turned off, and turned on again whenever: its notes and settings wait for it.

## lines' own plugins

| Plugin | What it adds | On by default | Code |
|---|---|---|---|
| Markdown | The Markdown notes are written in ([Linedown](linedown.md)). Always on. | Yes | `src/plugins/markdown/`, with the editor in `src/lib/editor/` and printing in `src/lib/print/markdown.ts` |
| LaTeX | Notes written in LaTeX ([latex.md](latex.md)) | Yes | `src/plugins/latex/` |
| Math (KaTeX) | The math engine, for math in notes of any format | Yes | `src/plugins/katex/` |
| Diagrams (Mermaid) | Draws ` ```mermaid ` code blocks, and adds `/diagram` | Yes | `src/plugins/mermaid/` |
| TeX Typesetting | Makes a LaTeX note's PDF with TeX. Needs LaTeX. | Yes | `src/plugins/tex/` |
| Themes | The sixteen themes. Always on. | Yes | `src/plugins/themes/` |
| Lucide | lines' icons. Always on. | Yes | `src/plugins/lucide/` |
| SF Symbols | Apple's icons, in the Mac and iPhone apps | Yes | `src/plugins/sf-symbols/` |
| nekos.best | Anime reaction GIFs and pictures from [nekos.best](https://nekos.best), searchable by anime | No | `src/plugins/nekos-best/` |
| Gifukai | Anime reaction GIFs from [Gifukai](https://gifukai.com), in the apps only | No | `src/plugins/gifukai/` |
| OtakuGIFs | Anime reaction GIFs from [OtakuGIFs](https://otakugifs.xyz) | No | `src/plugins/otakugifs/` |
| Purr Bot | Anime GIFs and pictures from [Purr Bot](https://purrbot.site)'s safe-for-work set, in the apps only | No | `src/plugins/purrbot/` |

## Turning a plugin off

Nothing is lost. A plugin turned off stops adding what it adds, at once, in every window:

- **A format.** Its notes keep their format and show as plain text, which can still be read and changed. Their ⓘ panel says so, with a button that turns the plugin back on. Export, Copy and Download still write them as what they are (a LaTeX note as a `.tex` file that compiles).
- **An engine.** With Math off, math shows as it's written. With Diagrams off, a ` ```mermaid ` block is a code block and `/diagram` is gone from the "/" menu. Without TeX, a LaTeX note's PDF is laid out by lines.
- **A theme or an icon set.** What was chosen is kept, and lines shows its own (Lines, Lucide) until the plugin is on again.
- **A picture source.** Its "/" command leaves the menu. Pictures already put in notes stay: they're links to the pictures themselves.
- **A plugin others need** (TeX needs LaTeX): those wait, and say what they need. Turning one on turns on what it needs too.

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

Load anything big the first time it's needed (`import()`), as KaTeX, Mermaid and TeX do, so lines starts as fast with the plugin as without it.

### What a plugin can add

Every part of `contributes` is optional, and a plugin can add several kinds of things (Mermaid adds a renderer and a "/" command).

**`languages`**: formats notes can be written in (`NoteLanguage`). A language says everything lines needs to know about notes written in it, so nothing outside its plugin knows how it reads:

- `id`, kept with every note in it (`format: latex` in synced files), so it must never change; `name`, `extensions` (the usual one first) and `mimeType`
- `editor()`: CodeMirror extensions for how it's read, drawn as you type, its keys and its "/" menu. The editor in `src/lib/editor/` has pieces to build on: the menu (`slashMenu`), math (`mathElement`, `MathBlockWidget`), bullets and numbers (`livePreview.ts`), pasting tables and attachments, and the backslash commands (`texCommands.ts`).
- `meta(body)`: what the note list, sidebar and search know of a note: title, excerpt, tags, open todos, properties and type
- `plainText(body)` and `stats(body)`, for copying and the ⓘ panel's counts (`countLines` in `notes/stats.ts` counts as every format does)
- `addTag(body, tag)`, and `newNote({ tag, type })`, how a new note starts
- `file(body, attachments?)`: the note as a file of its own, for exports and downloads
- `print(body, parts)`: the note laid out for paper, for its PDF, printing and PNG images. `parts` draws math, code, renderers' code blocks and images.

**`themes`**: each with `light` and `dark` colors for app.css's custom properties, by name without `--`. `bg`, `bg-list`, `bg-sidebar`, `bg-elevated`, `text`, `text-sidebar`, `text-muted`, `text-faint`, `accent`, `tag-text` and `ink` (what faint overlays are mixed from) are needed; any other property app.css has (`danger`, `callout-info`, `syn-keyword`…) can be set too. `moreContrast` holds the colors for Contrast → Increased. A theme is data, nothing more.

**`iconSets`**: a Svelte component that draws any of lines' icons (`src/lib/icons/icons.ts`) at a size.

**`math`**: an engine that draws LaTeX math into an element, after loading itself the first time.

**`renderers`**: engines that draw a code block of their languages, on screen in the theme's colors or for paper in black on white, as SVG markup or an element. `actions` are buttons on what they draw.

**`typesetters`**: ways to make a PDF for notes in some languages, offered beside lines' own pages in the PDF preview.

**`pictures`**: places to find pictures and GIFs online (`PictureSource`). Each gets a "/" command in Markdown notes, named after it, which opens the picture picker: the source's categories (`categories()`), a few pictures from the one chosen (`pictures(category, count)`), and, if it can, a search by anime or artist (`search(query, count)`). The picture picked goes in the note as a link to it, `![hug (Anime)](https://…)`, its alt text the category and the credit the source gives. The picker, the command and how the picture goes in are lines' own (`src/lib/components/PicturePicker.svelte`, `src/lib/editor/pictures.ts`), so a source is only where its pictures come from. Ask for them with `getJSON` (`src/lib/net.ts`), which goes through the apps' native networking, where a server needs no CORS for lines; on the web the server has to allow it, or the plugin says it's only in the apps (`available`, as Gifukai and Purr Bot do). `oneByOne` asks a source that gives one picture per request for several at once.

**`markdown`**: new syntax for Markdown notes. A `syntax` extension for the parser ([`@lezer/markdown`](https://github.com/lezer-parser/markdown)), `editor` extensions that draw it, `commands` for the "/" menu (each can go `after` another, by id), and `print`, a printer for each node the syntax adds.

### Plugins built on plugins

A plugin can need others (`requires`): it runs only while they do, and turning it on turns them on. TeX needs LaTeX, and imports its code. Otherwise plugins meet only through what they add: a renderer draws the code blocks of any format whose editor asks for it, and any format's math is drawn by whichever math engine is on.

## Not yet

- Plugins come with lines; there's no installing one made by someone else yet. That needs a way to run their code safely (the apps only run lines' own scripts), and to check where it came from. See the [roadmap](../README.md#roadmap).
- Some of lines isn't a plugin yet: drawings (Excalidraw), highlighting code blocks, GitHub links, symbols (`->` as →), and the objects and mentions in Markdown notes.
- Only Markdown takes additions from other plugins.
- Whether a plugin is on doesn't sync between devices.
