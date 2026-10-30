# lines

Beautiful, simple, local-first notes. Write in Markdown and see formatted text as you type.

lines is inspired by [Bear](https://bear.app): a calm, focused writing space with tags instead of folders. It runs on the web, macOS, Windows, Linux, iOS and Android from one codebase.

## Features

- **Live Markdown.** Type `**bold**`, `# Heading` or `- [ ] todo` and see it formatted. Move the cursor onto a line to see its Markdown again.
- **Your notes are plain Markdown.** The text you type is exactly what's stored. Nothing is converted into a proprietary format. The few additions lines makes to Markdown (callouts, highlights, tags…) are described in [docs/linedown.md](docs/linedown.md), "Linedown".
- **Or write in LaTeX.** Switch a note to LaTeX in its ⓘ panel and write `\section`, `\textbf`, `itemize`, `tabular`, theorems, citations and math as you would in a paper, drawn as you type the way Markdown is. Paste a whole paper and its preamble folds into its title, and its `\newcommand`s work in its math. Pasting works as in Markdown notes, written as LaTeX: spreadsheet rows become a `tabular`, images `\includegraphics`, files and links `\href`. `\` opens a menu of LaTeX commands, and of math commands inside math. Export makes each one a `.tex` file that compiles. What's drawn is in [docs/latex.md](docs/latex.md).
- **Note icons.** Right-click a note (or long-press it) → Add Icon… to show an icon before its title in the list. Icons sync with the note.
- **Objects and mentions.** Start a note with properties (`key: value` lines between `---` lines, as YAML front matter) and a `type`, like `type: person`, and it shows under Types in the sidebar, where each type can have an icon that its notes take on, and can be renamed in every note at once. Type `@` to mention another note by its title (`@Oleks`, `@[Ada Lovelace]`), or `[[` for a wiki link as in Obsidian (`[[Ada Lovelace]]`, `[[Ada Lovelace|Ada]]`): it reads as the title, with the note's icon, and ⌘-click opens it. `@Oleks.email` shows the value of its property, and changes when the property does. `/properties` adds them. `@type.recipe` on a line of its own is a table of every recipe, a column per property: add, remove and sort columns from its header, and add a recipe from under it. Details in [docs/linedown.md](docs/linedown.md#properties).
- **Tags, not folders.** Add `#tag` or `#nested/tag` anywhere in a note and it shows up in the sidebar. Right-click a tag (or long-press it) to rename it everywhere or give it an icon.
- **Tables.** GFM tables show as real tables. Click a cell to edit its Markdown, which stays neatly aligned: <kbd>Tab</kbd> moves between cells, <kbd>↵</kbd> adds a row, and <kbd>↵</kbd> on an empty last row leaves the table. Hover a cell for a button that copies its text. Paste rows copied from a spreadsheet, pgAdmin or a web page to get a table (undo once for the text as copied).
- **Cards.** Group a section into a card: type `/card`, or put Markdown between `::: card` and `:::` (Pandoc's fenced divs, so other apps keep it). Anything goes inside: headings, lists, code, tables, even other cards. <kbd>↵</kbd> on a second empty line at the end of a card leaves it.
- **Callouts.** Cards tinted by kind, with an icon on the left: `:::info` (or `:::i`), `:::question` (`:::?`), `:::warning` (`:::!`), `:::error` (`:::!!!`) and `:::decision` (`:::^`), closed with `:::`. Click the icon to pick any other, or none; it's written on the fence (`:::! icon=flag`, `:::! icon=none`). Or type `/info`, `/warning` and so on.
- **GitHub links.** A link to a GitHub repository, issue, pull request, commit or file reads short, with GitHub's mark: `overtio/lines#12`, `overtio/lines@6781dd7`, `overtio/lines › app.ts:10`. The note keeps the full URL, shown while the cursor is on it.
- **Copy values.** In a `Key: Value` line (like `**Plate:** 3WBZ56`), hover the value for a button that copies it.
- **Nested lists.** <kbd>Tab</kbd> / <kbd>⇧Tab</kbd> on a list item nests it under the item above or moves it back out, sub-items included. Each level steps in further and gets its own bullet: dot, ring, square.
- **Drag to move.** Hover a line or block for a grip on its left; drag it to move the line, a list item with its sub-items, a heading, code block, table, quote or card (by its `:::` line). Click the grip to select it. <kbd>⌥↑</kbd> / <kbd>⌥↓</kbd> move lines from the keyboard.
- **Todos.** Click checkboxes to toggle them. The Todo view collects every note with open tasks.
- **Arrows and symbols.** `->` shows as →, and `<-`, `<->`, `=>`, `<=>`, `<=`, `>=` and `!=` as ←, ↔, ⇒, ⇔, ≤, ≥ and ≠, in text and in code (where each keeps the room of its characters, so columns line up). Only on screen and on paper: the note keeps what you typed, and the cursor on one shows it. Settings → Text turns them off in text and in code separately.
- **Format toolbar.** Select text for a small toolbar to make it bold, italic, struck through, code or highlighted. It shows which ones the text already has; click again to remove.
- **Code blocks.** Write the language after the fence (` ```sql `, ` ```ts `, ` ```python `…) for syntax highlighting in your theme's colors; each language loads the first time a note uses it. A copy button in the top right corner copies the code, and the wand next to it tidies it: one-line JSON becomes indented JSON (long numbers keep every digit), SQL gets laid out by clause, and JavaScript, TypeScript, CSS, HTML, YAML, GraphQL and Markdown go through Prettier. A block with no language that starts with `{` or `[` is treated as JSON. Typing ` ``` ` or `:::` adds the closing fence, and typing <kbd>`</kbd> or <kbd>:</kbd> with text selected puts it in a code block (inline code within a line) or a card.
- **Image sizes.** Drag the handle on an image's (or drawing's) corner to make it smaller or larger; the width goes into its Markdown as Obsidian writes it (`![Lake|400](…)`), and prints that size. Double-click the handle for its own size again.
- **Drawings.** `/drawing` opens [Excalidraw](https://excalidraw.com) full-window to sketch boxes, arrows and handwriting. The check mark at the top right (<kbd>⌘S</kbd>) saves it in the note as an SVG image with the drawing inside it, so any Markdown app shows it, and lines (or excalidraw.com) opens it again to change. Double-click a drawing, use its pencil button, or press <kbd>Enter</kbd> with it selected; undo in the note brings back the drawing before. Excalidraw loads the first time you draw.
- **Diagrams.** A ` ```mermaid ` code block is drawn as its [Mermaid](https://mermaid.js.org) diagram (flowcharts, sequence, class, state, Gantt, ER, pie…) in your theme's colors. Click it to edit the code, with the diagram redrawn below as you type. Drag its corner to resize it, as with images. `/diagram` starts one. Mermaid loads the first time a note has a diagram. Its Copy and Edit as Drawing button opens a copy in Excalidraw, a flowchart as boxes and arrows to rearrange and restyle, and Save puts the drawing below the code.
- **Math.** LaTeX between `$…$` within text, or in a block between `$$` lines, is drawn with [KaTeX](https://katex.org), as GitHub and Obsidian read it. Click it to edit the LaTeX, with the math redrawn below as you type. `/math` starts a block, and `\` inside math opens a menu of math commands and symbols, with Tab moving between their braces. KaTeX loads the first time a note has math.
- **Images.** Paste an image, drop one onto a note, or type `/image` to choose some. Each goes on a line of its own as ordinary Markdown (`![](../attachments/….png)`) and is kept on the device; sync carries it to your other devices, and export puts it in the .zip. Click an image (or arrow up or down to it) to select it, then <kbd>⌫</kbd> deletes it. Images from the web (`![](https://…)`) show too. Paste the link to a photo on [Unsplash](https://unsplash.com) on an empty line and the photo shows.
- **Files.** Attach any other file the same way, or with `/file`. It shows as a card with its name and size and is linked as `[Report.pdf](../attachments/….pdf)`; double-click it to open it in its app (on the web, PDFs, pictures and media open in a tab and other files download). Files sync and export like images.
- **Slash commands.** Type `/` at the start of a line for headings, todos, lists, quotes, cards, callouts, tables, code blocks, diagrams, math, images, files, drawings, dividers, links, mentions, type tables, properties and today's date. Keep typing to filter (`/to` → Todo). <kbd>Tab</kbd> completes like a shell: it runs the only command left, or fills in as much of the name as the ones left share (`/he` → `/heading`), then moves through them.
- **Note info.** Words, characters, sentences, paragraphs, reading time and dates, from the ⓘ button, which also switches the note between Markdown and LaTeX.
- **Export everything.** Settings → Sync & Data saves all notes as Markdown files in a .zip, named after their titles, with their images and files.
- **PDF.** <kbd>⌘P</kbd> (or Share → Preview as PDF) lays the note out on A4 or Letter pages, black on white whatever the theme: headings, lists, todos, tables, callouts, highlighted code, diagrams and math. Print… prints exactly those pages, or saves them as a PDF from the print dialog. A LaTeX note's pages look like a paper's, with its title, numbered sections, theorems and equations, and references that show their numbers. Save PNG saves those pages as images instead: the whole note as one tall picture, or one per page in a ZIP (Share → Export as PNG… goes straight there). Or have TeX itself typeset a LaTeX note (pdfLaTeX, in WebAssembly): the first time, it downloads TeX (about 125 MB), and Save PDF saves the PDF it makes.
- **Sample notes.** Settings → Sync & Data adds the feature tour (a note per feature), LaTeX examples (a short paper, lecture notes, a problem set) or the QA notes (see [qa/README.md](qa/README.md)). Development builds can also reset the notes to the welcome note, the tour and the examples as they are in that build.
- **Share.** The system share sheet where available, copy as Markdown (or LaTeX) or plain text, or download a `.md` (or `.tex`) file on the web.
- **Fast search** across all your notes.
- **Pin, trash, restore.** Right-click a note (or long-press on a phone) for a menu, or swipe it: right to pin, left to trash. Swipes work with touch and with two fingers on a trackpad.
- **Themes.** Sixteen themes (Lines, Graphite, Sepia, Forest, Ocean, Solarized, Nord, Dracula, Catppuccin, Tokyo Night, Gruvbox, Everforest, Ayu, and three for accessibility: High Contrast, Red-Green Friendly and Blue-Yellow Friendly), each with light and dark variants that follow your system or a setting you choose.
- **Fonts and text size.** System (San Francisco on Apple devices), Serif, Rounded or Mono, with an adjustable text size.
- **Adjustable spacing.** Line height, paragraph and heading spacing, space below the title, text width and margins. Start from Compact, Default or Relaxed and fine-tune with a live preview.
- **SF Symbols** in the Mac and iPhone apps, as an alternative to Lucide icons. They're drawn by macOS / iOS at runtime and never bundled, as Apple's license requires.
- **Floating notes** (desktop apps). Pop any note into its own small window that can stay above everything else. Open as many as you like; they come back when you relaunch, and edits show up everywhere at once.
- **Focus mode.** Hide the sidebar and note list to see just the note (<kbd>⇧⌘\\</kbd>).
- **English, Spanish and French.** Settings → Appearance → Language, or follow the system's. Dates and numbers are written the way your device writes them. Adding a language is a folder of messages: see [docs/translations.md](docs/translations.md).
- **Accessible.** Everything works from the keyboard and with a screen reader, at large text sizes and with reduced motion. Settings → Appearance → Contrast → Increased (or the system's Increase Contrast) darkens grey text, links and borders in every theme to meet WCAG AA. The High Contrast theme keeps all text at 7:1 (AAA) with strong borders; Red-Green Friendly (protanopia, deuteranopia) and Blue-Yellow Friendly (tritanopia) keep callouts, warnings and code colors apart for color blindness. In Windows' contrast themes (forced colors), selection, focus and chips are drawn in the system's colors. See [docs/accessibility.md](docs/accessibility.md).
- **See-through windows** (Mac app). Adjustable opacity and background blur for the main window and floating notes.
- **Responsive.** Three columns on desktop, a drawer on tablets, a navigation stack on phones. Drag the sidebar's or the note list's edge to make it wider or narrower (double-click it for the usual width); lines remembers.
- **Local-first.** Notes live on your device and work offline. No account, no server.
- **Save to a folder** (web, in Chrome and Edge). Settings → Sync & Data → Folder: pick a folder, and lines writes your notes there as `.md` files and keeps them up to date, both ways.
- **Sync through your cloud drive** (desktop apps). iCloud Drive, Google Drive, Proton Drive, Dropbox, OneDrive or any folder: lines writes your notes there as `.md` files and the drive's own app syncs them.
- **Sync with your own storage.** Bring any S3-compatible bucket (Cloudflare R2, Backblaze B2, Amazon S3, MinIO, …). Notes are stored there as plain `.md` files, and conflicts never lose an edit. See [docs/sync.md](docs/sync.md).
- **End-to-end encryption** (optional). Settings → Sync & Data → Set up encryption: notes and attachments are encrypted on your device (AES-256-GCM, key from your passphrase) before they reach the bucket or drive, which only ever sees unreadable files. Your other devices ask for the passphrase once.
- **Locked notes.** Lock a note from its toolbar or menu (Lock Note), like in Apple Notes: one password (or Touch ID on the Mac) opens them all, until you lock them again or after 5 minutes without use. A locked note is encrypted on the device and wherever it syncs, with or without end-to-end encryption; its title stays readable so the list can show it.
- **App lock** (optional). Settings → Privacy: notes, attachments and sync settings on the device are encrypted, and lines asks for your passphrase (or Touch ID on the Mac) when it opens and after a while without use. Lock it any time with the lock button or <kbd>⌃⌘L</kbd>.

## Keyboard shortcuts

Settings → Shortcuts (<kbd>⌘/</kbd>, <kbd>Ctrl+/</kbd> on Windows and Linux) lists them all, as they are on a Mac or on Windows and Linux, in the app or on the web. The main ones:

| Shortcut | Action |
| --- | --- |
| <kbd>⌘N</kbd> | New note in the apps. On the web it's <kbd>⌥N</kbd> (<kbd>Alt+N</kbd> on Windows and Linux), since browsers keep <kbd>⌘N</kbd> for a new window |
| <kbd>⌘⇧F</kbd> | Search notes |
| <kbd>⌘\\</kbd> | Toggle sidebar |
| <kbd>⇧⌘\\</kbd> | Focus mode: just the note |
| <kbd>⌘B</kbd> / <kbd>⌘I</kbd> / <kbd>⌘E</kbd> | Bold / italic / inline code |
| <kbd>⌘⇧X</kbd> / <kbd>⌘⇧H</kbd> | Strikethrough / highlight |
| <kbd>⌘↵</kbd> | Make a todo, or toggle it |
| <kbd>Tab</kbd> / <kbd>⇧Tab</kbd> | In a list: nest / un-nest the item. In a table: next / previous cell |
| <kbd>⌘F</kbd> | Find in note |
| <kbd>F6</kbd> / <kbd>⇧F6</kbd> | Move between the sidebar, the note list and the note |
| <kbd>⌘/</kbd> | Keyboard shortcuts |
| <kbd>⌘P</kbd> | Preview the note as a PDF; in the preview, print or save it |
| <kbd>↵</kbd> on a note in the list | Open it and move into its text |
| <kbd>⌘-click</kbd> | Open link, mention or file |
| <kbd>⌥↵</kbd> | Open the link, mention or file the cursor is on (<kbd>Alt+Enter</kbd> on Windows and Linux); on a mention of a note that isn't there yet, make it |
| <kbd>⌃⌘L</kbd> | Lock lines, when the app lock is on (<kbd>Ctrl+Alt+L</kbd> on Windows and Linux) |

On Windows and Linux, use <kbd>Ctrl</kbd> instead of <kbd>⌘</kbd>.

## Tech stack

| | |
| --- | --- |
| UI | [Svelte 5](https://svelte.dev): compiled, no virtual DOM, very small runtime |
| Editor | [CodeMirror 6](https://codemirror.net) with a custom live-preview layer |
| Icons | [Lucide](https://lucide.dev), or SF Symbols on Apple platforms |
| Native apps | [Tauri 2](https://v2.tauri.app): macOS, Windows, Linux, iOS, Android |
| Build | [Vite](https://vite.dev) + TypeScript |

### Why this editor approach?

Block-based editors such as Notion and many ProseMirror/contenteditable setups keep a rich document model and translate between it and what's on screen. That translation is where most cursor jumps, lost characters and odd IME behavior come from.

lines keeps the document as **plain Markdown text** in CodeMirror, which is built for fast, correct text input on desktop and mobile (including IME, spellcheck and accessibility). Formatting is a *decoration* drawn over the text: the markup is hidden when the cursor isn't on it. Only the visible part of a note is decorated, so very long notes stay fast.

The editor is also *uncontrolled*: the note list gets a copy of the text shortly after you type, but nothing pushes content back into the editor while you're writing.

## Getting started

Requirements: [Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io). The native apps also need [Rust](https://rustup.rs) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install

# Web app at http://localhost:1420
pnpm dev

# Desktop app (macOS / Windows / Linux)
pnpm tauri dev
pnpm tauri build
```

Typesetting LaTeX notes with TeX needs TeX itself: BusyTeX's engine and TeX Live's basic packages, about 125 MB, which aren't in git. `pnpm tex-assets` downloads them into `public/busytex/`, so `pnpm dev` and builds include them. Without them everything else works, and the PDF preview says TeX isn't included. Since a build then carries 125 MB more (the desktop app embeds it), they can be served from elsewhere instead: set `VITE_TEX_ASSETS` to that address when building.

### Demo website

The web app with the feature tour instead of the welcome note, saving only to a folder on the visitor's computer (or the browser). Where it keeps everything, and for how long, is in [docs/storage.md](docs/storage.md). It's published to GitHub Pages by `.github/workflows/website.yml` on every push to main.

```sh
pnpm build:site   # to dist-site/, works from any subfolder
pnpm exec vite preview --outDir dist-site
```

In a debug build of the desktop app, press <kbd>F12</kbd> (or View → Developer Tools on a Mac) for the Web Inspector. Release builds don't include it.

### Mobile

Set up the native projects once, then run on a simulator or device:

```sh
# iOS (needs Xcode)
pnpm tauri ios init
pnpm tauri ios dev

# Android (needs Android Studio, the SDK and NDK)
pnpm tauri android init
pnpm tauri android dev
```

## Project structure

```
src/
  App.svelte                 App shell and responsive layout
  app.css                    Design tokens (colors, type), light and dark
  lib/
    editor/
      Editor.svelte          CodeMirror host; per-note undo history
      livePreview.ts         Hides Markdown and renders bullets, checkboxes, rules, images
      symbols.ts             Shows -> as →, != as ≠ and the like (the table is notes/symbols.ts)
      tables.ts              Rendered tables, cell navigation, column alignment, pasting tables
      cards.ts               Draws ::: card blocks and callouts behind their text; /card, leaving a card
      formatCode.ts          Tidies code blocks (JSON, SQL, Prettier languages)
      formatting.ts          Bold, italic, code… toggles and the toolbar over selected text
      dragBlocks.ts          Grips for dragging lines and blocks to move them
      cursor.ts              Draws the text cursor (WebKit can leave a stray native caret behind)
      mermaid.ts             Draws ```mermaid code blocks as diagrams
      drawings.ts            Excalidraw drawings (SVGs holding their scene): spotting, opening, /drawing, from a diagram
      math.ts                Draws $math$ and $$ blocks with KaTeX
      latex.ts               Live preview, keys and slash commands for notes written in LaTeX
      latexSyntax.ts         Reads a LaTeX note into what latex.ts draws
      attachments.ts         Image and file blocks; pasting, dropping, /image and /file
      fences.ts              Closes ``` and ::: fences as you type them; ` or : wraps a selection
      lists.ts               Tab / Shift-Tab nesting for list items; Backspace after a marker
      keyValue.ts            Copy buttons for Key: Value lines
      syntax.ts              #tag, ==highlight==, ::: card, $math$ and @mention / [[wiki link]] parser extensions
      objects.ts             Properties, @mentions and their menus; creating a mentioned note
      typeTables.ts          Tables of a type's notes (@type.recipe)
      setup.ts               Extensions, keymaps, formatting commands; Markdown or LaTeX per note
      editor.css             Styles for the rendered Markdown
    print/
      markdown.ts            A Markdown note as a printed document
      latex.ts               A LaTeX note as a printed document: paragraphs, numbering, references, title
      parts.ts               Math, code, diagrams and images on paper, and waiting for them to draw
      pages.ts               Cuts a document into pages between lines, as the preview shows and prints them
      tex.ts                 Typesets a LaTeX note with TeX (BusyTeX's pdfLaTeX in WebAssembly)
      print.css              How a note looks on paper
    icons/                   Icon component: Lucide or SF Symbols
    i18n/                    Translations: t(), the language, and each language's messages (locales/)
    a11y.ts                  Saying things to screen readers
    prefs.svelte.ts          Theme, appearance, font, text size, spacing, icon set
    crypto.ts                AES-256-GCM and passphrase keys (WebCrypto), for sync and the app lock
    lock/
      lock.svelte.ts         The app lock: unlocking, turning it on and off, locking when idle
      vault.ts               Encrypts what's stored on the device while the lock is on
    sync/
      engine.svelte.ts       Two-way sync: upload, download, conflicts, deletions; turning encryption on and off
      sealed.ts              End-to-end encryption: the key file, and a remote that encrypts everything
      s3.ts                  Minimal S3 client (SigV4 via aws4fetch)
      format.ts              Note ⇄ Markdown-with-front-matter
      providers.ts           R2 / B2 / S3 presets
      folder.ts              Cloud drive folders in the desktop apps
      browserFolder.ts       A folder on the web, through the File System Access API
    notes/
      store.svelte.ts        Reactive note state: filtering, search, tags, saving
      storage.ts             Storage interface + IndexedDB implementation
      attachments.ts         Images and files: saved by content hash, opened, cleaned up when unused
      noteKeys.svelte.ts     Locked notes' keys: encrypting a note, opening it with the password
      locked.svelte.ts       Locking and opening locked notes, their password, closing them when idle
      parse.ts               Title, excerpt and tag extraction; renaming tags and types
      properties.ts          Properties (front matter), types and mentions as text
      latex.ts               LaTeX notes as plain text, and as a whole document for export
      samples.ts             Adds the feature tour (tour/), the LaTeX examples (examples/) or the QA notes (qa/)
      tour/                  The feature tour: the demo website's first notes
      examples/              Notes written in LaTeX: a paper, lecture notes, a problem set
    components/              Sidebar, tag tree, note list, settings
  themes.css                 Theme colors (light and dark for each)
src-tauri/                   Native shell (Rust); sf_symbols.rs draws SF Symbols, lock.rs shares the
                             unlocked key with floating notes and does Touch ID
src-tauri/icons/source/      App icon artwork (SVG): Mac layout and full-bleed for iOS/Android
docs/linedown.md             Linedown: the Markdown lines reads and writes
docs/storage.md              Where the web app keeps notes and settings, and for how long
docs/translations.md         How translations work, and adding a language
docs/accessibility.md        What lines does for keyboard and screen reader use, and how it's checked
qa/                          Release checklist and QA notes (generated by scripts/qa-notes.mjs)
```

## Roadmap

Known limitations of encryption, the app lock and locked notes, and what hasn't been tried on real devices yet, are in [docs/limitations.md](docs/limitations.md).

- [x] Sync through any S3-compatible storage
- [x] Sync through a cloud drive folder on the desktop (iCloud Drive, Google Drive, Proton Drive, Dropbox, OneDrive)
- [x] Save to a folder on the web (Chrome and Edge)
- [ ] iCloud on the iPhone app (an iCloud container, which needs the app signed with iCloud entitlements)
- [ ] iCloud on the web: sign in with your Apple Account (CloudKit JS)
- [ ] Google Drive on the web and phones: sign in with Google (Drive API; needs an OAuth client ID)
- [ ] Proton Drive on the web and phones, once Proton opens its Drive SDK to third-party apps
- [ ] Show notes by title in synced folders, for browsing them in Finder
- [x] End-to-end encryption for synced notes
- [x] App lock: encrypted on the device, with a passphrase or Touch ID
- [x] Locked notes, with a password or Touch ID
- [ ] Encrypt images and files in locked notes
- [ ] Face ID for the app lock and locked notes on iPhone
- [ ] Store sync credentials (the S3 secret key) in the OS keychain on native platforms instead of local storage
- [ ] Conditional S3 writes (`If-Match`), so an upload fails instead of overwriting a note another device changed in between
- [ ] Narrow the app's native permissions: limit network access to the configured endpoint and file access to the chosen sync folder
- [x] Syntax highlighting inside code blocks
- [x] Rendered tables
- [x] Image attachments (paste and drag-and-drop)
- [x] Any file as an attachment
- [x] Drawings with Excalidraw, kept as SVG images
- [x] Mermaid diagrams copied into drawings, to edit by hand
- [ ] Drawings in LaTeX notes (`\includegraphics` of a drawing, as a PDF for TeX)
- [ ] Remove attachments from sync storage once no note uses them (they're only cleaned up on the device for now)
- [x] Note links: mentions (`@Note`), and properties of notes (`@Note.key`)
- [x] Wiki links (`[[Note]]`, `[[Note|text]]`) as mentions
- [ ] Backlinks: the notes that mention this one
- [ ] Renaming a note updates the mentions of it
- [ ] Sync the icons chosen for tags and types (each device keeps its own for now)
- [x] Math (KaTeX), and notes written in LaTeX
- [x] LaTeX notes: typesetting a PDF with a real TeX engine
- [ ] LaTeX notes: converting a note between Markdown and LaTeX
- [x] A note as a PDF: preview, print and save
- [x] A note as PNG images: one tall image, or one per page
- [x] Arrows and symbols (`->` as →, `!=` as ≠) shown without changing the note, in text and code, each switchable
- [x] Resizable sidebar and note list
- [ ] Save lines' PDF straight to a file in the apps, without the print dialog
- [ ] More of TeX Live for TeX's PDFs (packages beyond the basic ones, fetched as a note needs them)
- [ ] Export a note as HTML
- [ ] Offline support for the web app (service worker)
- [ ] Browser extensions (Chrome, Edge, Firefox, Safari)
- [ ] Try the forced-colors styles (Windows' contrast themes) on Windows
- [ ] A "System" theme that follows your desktop, generated from one seed color for light and dark, and updating live:
  - Mac: colors picked from the wallpaper (dynamic and per-display wallpapers, re-checked when the app comes to the front)
  - Windows: the wallpaper, or the accent color Windows picks from it
  - Linux: a full palette from pywal / wallust / matugen (`~/.cache/wal/colors.json`) or a KDE color scheme; otherwise the XDG desktop portal's accent color
  - Android: Material You colors
  - iPhone and web: the system accent color (CSS `AccentColor`, real in Safari and Firefox; Chrome reports a default blue, so fall back to a neutral theme)
- [ ] Spike: a fully native Rust interface, as Zed does with GPUI, to see what it would take. Build the editor with live preview for a few elements (headings, lists, a callout, a table) and judge:
  - speed with very large notes, memory use and startup time, against the current app
  - text input: Chinese, Japanese and Korean input, dead keys, dictation, spellcheck and autocorrect
  - screen readers, right-to-left text and emoji
  - which frameworks reach the web and phones (GPUI has neither; egui, Makepad and Slint draw to a canvas on the web)
  - what replaces Mermaid for diagrams

## Contributing

Issues and pull requests are welcome. A change users can see also updates the Linedown spec, the QA notes and checklist, and the feature tour where they're affected (see [qa/README.md](qa/README.md)). Before opening a PR, please run:

```sh
pnpm check
pnpm build
```

## License

lines is free software, licensed under the [GNU Affero General Public License v3.0](LICENSE).

You can use, study, change and share it. If you distribute a modified version, or run one as a network service that other people use, you must make your source code available to those users under the same license.
